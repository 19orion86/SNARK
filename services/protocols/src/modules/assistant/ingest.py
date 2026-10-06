"""Индексация одного источника: docx / статья → разделы → чанки → эмбеддинги → rag.*."""

from __future__ import annotations

import hashlib
import uuid
from dataclasses import dataclass

import structlog

from src.core.config import settings
from src.modules.assistant.chunker import chunk_sections
from src.modules.assistant.db import rag_session
from src.modules.assistant.docx_parser import parse_docx, parse_markdown
from src.modules.assistant.embeddings import E5_MAX_INPUT_TOKENS, Embedder, get_embedder
from src.modules.assistant.repository import AssistantRepository, PortalSource
from src.modules.assistant.storage import DocumentStorage, get_storage

logger = structlog.get_logger(__name__)


class PermanentIngestError(Exception):
    """Ошибка, которую повтор не исправит (не тот формат, пустой документ)."""


@dataclass(frozen=True)
class IngestResult:
    action: str  # indexed | unchanged | removed | failed
    chunks: int = 0
    error: str | None = None


def _load_content(source: PortalSource, storage: DocumentStorage) -> tuple[bytes, list]:
    """Вернуть (сырые байты для хеша, разделы)."""
    if source.source_type == "article":
        content = source.content or ""
        return content.encode("utf-8"), parse_markdown(content, source.title)

    if not source.is_docx:
        raise PermanentIngestError(
            "В v1 индексируются только docx. Формат файла: "
            f"{source.content_type or source.file_name or 'неизвестен'}"
        )
    if not source.file_path:
        raise PermanentIngestError("У документа не указан путь к файлу (file_path)")
    data = storage.read(source.file_path)
    return data, parse_docx(data, source.title)


async def ingest_source(
    source_type: str,
    source_id: uuid.UUID,
    embedder: Embedder | None = None,
    storage: DocumentStorage | None = None,
    force: bool = False,
) -> IngestResult:
    """Привести индекс источника в соответствие с порталом. Идемпотентно.

    - источника нет или он не актуален → чанки и запись удаляются;
    - хеш содержимого и версия не изменились → ничего не делаем;
    - иначе старые чанки заменяются новыми в одной транзакции.

    Временные ошибки (сеть, хранилище) пробрасываются вызывающему для повтора.
    Постоянные фиксируются в rag.sources.error и возвращаются как `failed`.
    """
    async with rag_session() as session:
        repo = AssistantRepository(session)
        source = await repo.get_portal_source(source_type, source_id)

        if source is None or not source.is_actual:
            removed = await repo.delete_source(source_type, source_id)
            await session.commit()
            logger.info("Источник убран из индекса", source_type=source_type, chunks=removed)
            return IngestResult(action="removed", chunks=removed)

        existing = await repo.get_source_row(source_type, source_id)

        try:
            data, sections = _load_content(source, storage or get_storage())
        except PermanentIngestError as exc:
            await repo.upsert_source_state(source, "failed", str(exc))
            await session.commit()
            return IngestResult(action="failed", error=str(exc))
        except Exception as exc:
            await repo.upsert_source_state(source, "failed", f"Не удалось прочитать файл: {exc}")
            await session.commit()
            raise

        content_hash = hashlib.sha256(data).hexdigest()
        active = embedder or get_embedder()

        if (
            not force
            and existing
            and existing["index_state"] == "indexed"
            and existing["content_hash"] == content_hash
            and existing["version"] == source.version
            and existing["embedding_model"] == active.model_name
        ):
            return IngestResult(action="unchanged", chunks=existing["chunk_count"])

        row_id = await repo.upsert_source_state(source, "indexing")
        await session.commit()

        try:
            chunks = chunk_sections(
                source.title,
                sections,
                active.count_tokens,
                max_tokens=settings.rag_chunk_max_tokens,
                overlap_tokens=settings.rag_chunk_overlap_tokens,
            )
            if not chunks:
                raise PermanentIngestError("В документе не найден текст для индексации")
            too_long = [
                chunk.ordinal for chunk in chunks if chunk.token_count > E5_MAX_INPUT_TOKENS
            ]
            if too_long:
                raise PermanentIngestError(
                    f"Чанки {too_long} длиннее окна модели ({E5_MAX_INPUT_TOKENS} токенов)"
                )
            vectors = active.encode([chunk.embedding_input for chunk in chunks])

            # Одна транзакция: удаление старых чанков, вставка новых, пометка indexed.
            await repo.replace_chunks(
                row_id, source, content_hash, active.model_name, chunks, vectors
            )
            await session.commit()
        except PermanentIngestError as exc:
            await session.rollback()
            await repo.upsert_source_state(source, "failed", str(exc))
            await session.commit()
            return IngestResult(action="failed", error=str(exc))
        except Exception as exc:
            # Старые чанки остаются: индекс не пустеет из-за сбоя.
            await session.rollback()
            await repo.upsert_source_state(source, "failed", str(exc)[:1000])
            await session.commit()
            raise

        logger.info(
            "Источник проиндексирован",
            source_type=source_type,
            source_id=str(source_id),
            chunks=len(chunks),
        )
        return IngestResult(action="indexed", chunks=len(chunks))
