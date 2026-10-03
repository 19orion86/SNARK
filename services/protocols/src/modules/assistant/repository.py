"""SQL ассистента: чтение public.* (только SELECT) и работа со схемой rag."""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from datetime import date
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.assistant.acl import REQUESTER_CTE, SOURCE_JOINS, VISIBLE_SOURCE_PREDICATE
from src.modules.assistant.chunker import ChunkDraft
from src.modules.assistant.embeddings import to_pgvector

DOCX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


@dataclass(frozen=True)
class PortalSource:
    """Источник в портале, как его видит индексатор."""

    source_type: str
    source_id: uuid.UUID
    title: str
    version: str | None
    is_actual: bool
    file_path: str | None = None
    file_name: str | None = None
    content_type: str | None = None
    content: str | None = None

    @property
    def is_docx(self) -> bool:
        name = (self.file_name or "").lower()
        return self.content_type == DOCX_CONTENT_TYPE or name.endswith(".docx")


@dataclass(frozen=True)
class RetrievedChunk:
    chunk_id: uuid.UUID
    source_type: str
    source_id: uuid.UUID
    title: str
    version: str | None
    section_number: str | None
    section_title: str | None
    text: str
    score: float

    @property
    def section_label(self) -> str:
        if not self.section_number or self.section_number == "0":
            return self.section_title or ""
        return f"{self.section_number}. {self.section_title or ''}".strip()


@dataclass(frozen=True)
class Requester:
    """Пользователь и whitelist полей профиля для персонализации.

    Здесь намеренно нет inn, snils, address, birth_date, phone: запрос их не выбирает.
    """

    user_id: uuid.UUID
    role: str
    position_title: str | None
    department_name: str | None
    start_date: date | None
    contract_end_date: date | None


class AssistantRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # --- public.* (только чтение) -------------------------------------------------

    async def get_portal_source(
        self, source_type: str, source_id: uuid.UUID
    ) -> PortalSource | None:
        if source_type == "document":
            row = (
                (
                    await self.session.execute(
                        text(
                            "SELECT id, title, version, file_path, file_name, content_type, "
                            "rag_status FROM public.documents WHERE id = :id"
                        ),
                        {"id": source_id},
                    )
                )
                .mappings()
                .first()
            )
            if not row:
                return None
            return PortalSource(
                source_type="document",
                source_id=row["id"],
                title=row["title"],
                version=row["version"],
                is_actual=row["rag_status"] == "actual",
                file_path=row["file_path"],
                file_name=row["file_name"],
                content_type=row["content_type"],
            )

        row = (
            (
                await self.session.execute(
                    text(
                        "SELECT id, title, content, is_published, updated_at "
                        "FROM public.knowledge_articles WHERE id = :id"
                    ),
                    {"id": source_id},
                )
            )
            .mappings()
            .first()
        )
        if not row:
            return None
        return PortalSource(
            source_type="article",
            source_id=row["id"],
            title=row["title"],
            version=row["updated_at"].isoformat() if row["updated_at"] else None,
            is_actual=bool(row["is_published"]),
            content=row["content"],
        )

    async def get_requester(self, user_id: uuid.UUID) -> Requester | None:
        row = (
            (
                await self.session.execute(
                    text(
                        """
                    SELECT u.id, u.role::text AS role, p.position_title,
                           dep.name AS department_name, p.start_date, p.contract_end_date
                    FROM public.users u
                    LEFT JOIN public.employee_profiles p ON p.user_id = u.id
                    LEFT JOIN public.departments dep ON dep.id = u.department_id
                    WHERE u.id = :user_id AND u.is_active
                    """
                    ),
                    {"user_id": user_id},
                )
            )
            .mappings()
            .first()
        )
        if not row:
            return None
        return Requester(
            user_id=row["id"],
            role=row["role"],
            position_title=row["position_title"],
            department_name=row["department_name"],
            start_date=row["start_date"],
            contract_end_date=row["contract_end_date"],
        )

    # --- rag.sources / rag.chunks --------------------------------------------------

    async def get_source_row(self, source_type: str, source_id: uuid.UUID) -> dict[str, Any] | None:
        row = (
            (
                await self.session.execute(
                    text("SELECT * FROM rag.sources WHERE source_type = :type AND source_id = :id"),
                    {"type": source_type, "id": source_id},
                )
            )
            .mappings()
            .first()
        )
        return dict(row) if row else None

    async def upsert_source_state(
        self, source: PortalSource, state: str, error: str | None = None
    ) -> uuid.UUID:
        row = await self.session.execute(
            text(
                """
                INSERT INTO rag.sources (source_type, source_id, title, version, index_state, error)
                VALUES (:type, :id, :title, :version, :state, :error)
                ON CONFLICT (source_type, source_id) DO UPDATE
                  SET title = EXCLUDED.title, index_state = EXCLUDED.index_state,
                      error = EXCLUDED.error, updated_at = now()
                RETURNING id
                """
            ),
            {
                "type": source.source_type,
                "id": source.source_id,
                "title": source.title,
                "version": source.version,
                "state": state,
                "error": error,
            },
        )
        return row.scalar_one()

    async def delete_source(self, source_type: str, source_id: uuid.UUID) -> int:
        """Удалить источник вместе с чанками (ON DELETE CASCADE). Возвращает число чанков."""
        count = (
            await self.session.execute(
                text(
                    "SELECT count(*) FROM rag.chunks c JOIN rag.sources s ON s.id = c.source "
                    "WHERE s.source_type = :type AND s.source_id = :id"
                ),
                {"type": source_type, "id": source_id},
            )
        ).scalar_one()
        await self.session.execute(
            text("DELETE FROM rag.sources WHERE source_type = :type AND source_id = :id"),
            {"type": source_type, "id": source_id},
        )
        return int(count)

    async def replace_chunks(
        self,
        row_id: uuid.UUID,
        source: PortalSource,
        content_hash: str,
        model_name: str,
        chunks: list[ChunkDraft],
        vectors: list[list[float]],
    ) -> None:
        """Заменить чанки источника. Вызывается внутри одной транзакции с пометкой indexed."""
        await self.session.execute(
            text("DELETE FROM rag.chunks WHERE source = :source"), {"source": row_id}
        )
        if chunks:
            await self.session.execute(
                text(
                    """
                    INSERT INTO rag.chunks
                      (source, ordinal, section_number, section_title, text, token_count, embedding)
                    VALUES
                      (:source, :ordinal, :section_number, :section_title, :text, :token_count,
                       CAST(:embedding AS vector))
                    """
                ),
                [
                    {
                        "source": row_id,
                        "ordinal": chunk.ordinal,
                        "section_number": chunk.section_number,
                        "section_title": chunk.section_title,
                        "text": chunk.text,
                        "token_count": chunk.token_count,
                        "embedding": to_pgvector(vector),
                    }
                    for chunk, vector in zip(chunks, vectors, strict=True)
                ],
            )
        await self.session.execute(
            text(
                """
                UPDATE rag.sources
                SET index_state = 'indexed', error = NULL, title = :title, version = :version,
                    content_hash = :hash, embedding_model = :model, chunk_count = :count,
                    indexed_at = now(), updated_at = now()
                WHERE id = :id
                """
            ),
            {
                "id": row_id,
                "title": source.title,
                "version": source.version,
                "hash": content_hash,
                "model": model_name,
                "count": len(chunks),
            },
        )

    async def list_source_states(
        self, source_type: str | None = None, ids: list[uuid.UUID] | None = None
    ) -> list[dict[str, Any]]:
        conditions, params = ["TRUE"], {}
        if source_type:
            conditions.append("source_type = :type")
            params["type"] = source_type
        if ids:
            conditions.append("source_id = ANY(:ids)")
            params["ids"] = ids
        rows = await self.session.execute(
            text(
                "SELECT source_type, source_id, index_state, error, chunk_count, version, "
                "indexed_at FROM rag.sources WHERE " + " AND ".join(conditions)
            ),
            params,
        )
        return [dict(row) for row in rows.mappings()]

    async def find_out_of_sync(self) -> list[tuple[str, uuid.UUID]]:
        """Источники, состояние индекса которых расходится с порталом (для сверки)."""
        rows = await self.session.execute(
            text(
                """
                -- актуальные docx-документы без индекса или с другой версией
                SELECT 'document' AS source_type, d.id AS source_id
                FROM public.documents d
                LEFT JOIN rag.sources s ON s.source_type = 'document' AND s.source_id = d.id
                WHERE d.rag_status = 'actual'
                  AND (s.id IS NULL
                       OR s.index_state IN ('pending', 'failed')
                       OR s.version IS DISTINCT FROM d.version)
                UNION ALL
                -- опубликованные статьи без индекса или изменённые после индексации
                SELECT 'article', a.id
                FROM public.knowledge_articles a
                LEFT JOIN rag.sources s ON s.source_type = 'article' AND s.source_id = a.id
                WHERE a.is_published
                  AND (s.id IS NULL
                       OR s.index_state IN ('pending', 'failed')
                       OR s.indexed_at < a.updated_at)
                UNION ALL
                -- проиндексированное, которого больше нет или которое перестало быть актуальным
                SELECT s.source_type, s.source_id
                FROM rag.sources s
                LEFT JOIN public.documents d
                  ON s.source_type = 'document' AND d.id = s.source_id
                LEFT JOIN public.knowledge_articles a
                  ON s.source_type = 'article' AND a.id = s.source_id
                WHERE (s.source_type = 'document' AND (d.id IS NULL OR d.rag_status <> 'actual'))
                   OR (s.source_type = 'article' AND (a.id IS NULL OR NOT a.is_published))
                """
            )
        )
        return [(row.source_type, row.source_id) for row in rows]

    # --- поиск ---------------------------------------------------------------------

    async def search(
        self, user_id: uuid.UUID, query_vector: list[float], top_k: int
    ) -> list[RetrievedChunk]:
        """Векторный поиск с проверкой прав в том же запросе.

        Название и версия берутся из public.* — это то, что пользователь увидит в портале.
        """
        rows = await self.session.execute(
            text(
                f"""
                WITH {REQUESTER_CTE}
                SELECT c.id AS chunk_id, s.source_type, s.source_id,
                       COALESCE(d.title, a.title, s.title) AS title,
                       CASE WHEN s.source_type = 'document' THEN d.version END AS version,
                       c.section_number, c.section_title, c.text,
                       1 - (c.embedding <=> CAST(:embedding AS vector)) AS score
                FROM rag.chunks c
                JOIN rag.sources s ON s.id = c.source
                CROSS JOIN requester r
                {SOURCE_JOINS}
                WHERE {VISIBLE_SOURCE_PREDICATE}
                ORDER BY c.embedding <=> CAST(:embedding AS vector)
                LIMIT :top_k
                """
            ),
            {"user_id": user_id, "embedding": to_pgvector(query_vector), "top_k": top_k},
        )
        return [
            RetrievedChunk(
                chunk_id=row.chunk_id,
                source_type=row.source_type,
                source_id=row.source_id,
                title=row.title,
                version=row.version,
                section_number=row.section_number,
                section_title=row.section_title,
                text=row.text,
                score=float(row.score),
            )
            for row in rows
        ]

    # --- rag.queries ---------------------------------------------------------------

    async def log_query(
        self,
        user_id: uuid.UUID,
        question: str,
        status: str,
        answer: dict[str, Any] | None,
        sources: list[dict[str, Any]],
        retrieved: list[RetrievedChunk],
        llm_provider: str | None,
        latency_ms: int,
        error: str | None = None,
    ) -> uuid.UUID:
        row = await self.session.execute(
            text(
                """
                INSERT INTO rag.queries
                  (user_id, question, answer_json, status, sources, retrieved, llm_provider,
                   latency_ms, error)
                VALUES
                  (:user_id, :question, CAST(:answer AS jsonb), :status, CAST(:sources AS jsonb),
                   CAST(:retrieved AS jsonb), :provider, :latency, :error)
                RETURNING id
                """
            ),
            {
                "user_id": user_id,
                "question": question,
                "answer": json.dumps(answer, ensure_ascii=False) if answer is not None else None,
                "status": status,
                "sources": json.dumps(sources, ensure_ascii=False),
                "retrieved": json.dumps(
                    [
                        {"chunk_id": str(chunk.chunk_id), "score": round(chunk.score, 4)}
                        for chunk in retrieved
                    ]
                ),
                "provider": llm_provider,
                "latency": latency_ms,
                "error": error,
            },
        )
        return row.scalar_one()

    async def set_feedback(self, query_id: uuid.UUID, user_id: uuid.UUID, value: int) -> bool:
        result = await self.session.execute(
            text("UPDATE rag.queries SET feedback = :value WHERE id = :id AND user_id = :user_id"),
            {"value": value, "id": query_id, "user_id": user_id},
        )
        return result.rowcount > 0

    async def list_queries(
        self, status: str | None, feedback: int | None, limit: int, offset: int
    ) -> tuple[list[dict[str, Any]], int]:
        conditions, params = ["TRUE"], {"limit": limit, "offset": offset}
        if status:
            conditions.append("q.status = :status")
            params["status"] = status
        if feedback is not None:
            conditions.append("q.feedback = :feedback")
            params["feedback"] = feedback
        where = " AND ".join(conditions)
        total = (
            await self.session.execute(
                text(f"SELECT count(*) FROM rag.queries q WHERE {where}"), params
            )
        ).scalar_one()
        rows = await self.session.execute(
            text(
                f"""
                SELECT q.id, q.user_id, q.question, q.status, q.answer_json, q.sources,
                       q.llm_provider, q.latency_ms, q.error, q.feedback, q.created_at
                FROM rag.queries q
                WHERE {where}
                ORDER BY q.created_at DESC
                LIMIT :limit OFFSET :offset
                """
            ),
            params,
        )
        return [dict(row) for row in rows.mappings()], int(total)

    async def frequent_questions(self, status: str | None, limit: int) -> list[dict[str, Any]]:
        """Частые вопросы: группировка по нормализованному тексту."""
        params: dict[str, Any] = {"limit": limit}
        condition = ""
        if status:
            condition = "WHERE status = :status"
            params["status"] = status
        rows = await self.session.execute(
            text(
                f"""
                SELECT min(question) AS question, count(*)::int AS total,
                       max(created_at) AS last_asked_at
                FROM rag.queries
                {condition}
                GROUP BY lower(regexp_replace(btrim(question), '[[:space:][:punct:]]+', ' ', 'g'))
                ORDER BY total DESC, last_asked_at DESC
                LIMIT :limit
                """
            ),
            params,
        )
        return [dict(row) for row in rows.mappings()]
