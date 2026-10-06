"""Ответ ассистента: поиск с проверкой прав → промпт → LLM → проверка источников → журнал."""

from __future__ import annotations

import time
import uuid
from pathlib import Path
from typing import Any

import structlog
from jinja2 import Environment, FileSystemLoader, StrictUndefined

from src.core.config import settings
from src.core.rag import RAGService
from src.modules.assistant.chunker import QUERY_PREFIX
from src.modules.assistant.db import rag_session
from src.modules.assistant.embeddings import Embedder, get_embedder
from src.modules.assistant.repository import AssistantRepository, Requester, RetrievedChunk
from src.modules.assistant.schemas import AnswerStatus, AskResponse, LLMAnswer, SourceRef

logger = structlog.get_logger(__name__)

_PROMPTS = Environment(
    loader=FileSystemLoader(Path(__file__).parent / "prompts"),
    undefined=StrictUndefined,
    autoescape=False,
    trim_blocks=False,
)

NO_INFO_TEXT = (
    "В базе знаний портала нет документа, который отвечает на этот вопрос. "
    "Уточните формулировку или обратитесь в отдел кадров."
)

# Whitelist полей профиля, которые разрешено передавать в LLM.
# Любое новое поле добавляется сюда явно и проходит через test_profile_whitelist.
PROFILE_FIELDS: tuple[tuple[str, str], ...] = (
    ("position_title", "Должность"),
    ("department_name", "Отдел"),
    ("start_date", "Дата приёма"),
    ("contract_end_date", "Дата окончания договора"),
)


class UserNotFoundError(Exception):
    """Пользователь не найден или неактивен."""


class LLMUnavailableError(Exception):
    """LLM недоступна или вернула ответ не по схеме."""

    def __init__(self, message: str, query_id: uuid.UUID) -> None:
        super().__init__(message)
        self.query_id = query_id


def build_profile(requester: Requester) -> list[tuple[str, str]]:
    """Собрать профиль для промпта строго по whitelist."""
    profile: list[tuple[str, str]] = []
    for field, label in PROFILE_FIELDS:
        value = getattr(requester, field)
        if value is None or value == "":
            continue
        profile.append((label, value.isoformat() if hasattr(value, "isoformat") else str(value)))
    return profile


def render_prompt(question: str, requester: Requester, chunks: list[RetrievedChunk]) -> str:
    return _PROMPTS.get_template("answer.jinja2").render(
        question=question.strip(),
        profile=build_profile(requester),
        chunks=chunks,
    )


def verify_sources(
    answer: LLMAnswer, chunks: list[RetrievedChunk]
) -> tuple[AnswerStatus, list[SourceRef]]:
    """Оставить только ссылки на фрагменты, которые были в контексте.

    Ответ `answered` без единого подтверждённого источника превращается в `no_info`:
    так отсекаются выдуманные цитаты и ответы «из общих знаний».
    """
    refs: list[SourceRef] = []
    seen: set[tuple[str, uuid.UUID, str]] = set()
    for number in answer.sources:
        if not isinstance(number, int) or not 1 <= number <= len(chunks):
            continue
        chunk = chunks[number - 1]
        key = (chunk.source_type, chunk.source_id, chunk.section_label)
        if key in seen:
            continue
        seen.add(key)
        refs.append(
            SourceRef(
                source_type=chunk.source_type,  # type: ignore[arg-type]
                source_id=chunk.source_id,
                title=chunk.title,
                version=chunk.version,
                section=chunk.section_label,
            )
        )

    status = answer.status
    if status == AnswerStatus.NO_INFO:
        return status, []
    if not refs:
        return AnswerStatus.NO_INFO, []
    return status, refs


class AssistantService:
    def __init__(self, embedder: Embedder | None = None, llm: RAGService | None = None) -> None:
        self._embedder = embedder
        self._llm = llm

    @property
    def embedder(self) -> Embedder:
        return self._embedder or get_embedder()

    @property
    def llm(self) -> RAGService:
        if self._llm is None:
            self._llm = RAGService()
        return self._llm

    async def search(
        self, user_id: uuid.UUID, question: str, top_k: int | None = None
    ) -> list[RetrievedChunk]:
        """Чанки, которые пользователь имеет право видеть, по убыванию близости."""
        vector = self.embedder.encode([f"{QUERY_PREFIX}{question.strip()}"])[0]
        async with rag_session() as session:
            return await AssistantRepository(session).search(
                user_id, vector, top_k or settings.rag_top_k
            )

    async def ask(self, user_id: uuid.UUID, question: str) -> AskResponse:
        started = time.perf_counter()
        provider = settings.llm_provider.value

        async with rag_session() as session:
            repo = AssistantRepository(session)
            requester = await repo.get_requester(user_id)
            if requester is None:
                raise UserNotFoundError(str(user_id))

            vector = self.embedder.encode([f"{QUERY_PREFIX}{question.strip()}"])[0]
            chunks = await repo.search(user_id, vector, settings.rag_top_k)

            def elapsed() -> int:
                return int((time.perf_counter() - started) * 1000)

            async def finish(
                status: AnswerStatus,
                payload: dict[str, Any],
                sources: list[SourceRef],
                used_provider: str | None,
            ) -> AskResponse:
                query_id = await repo.log_query(
                    user_id=user_id,
                    question=question,
                    status=status.value,
                    answer=payload,
                    sources=[ref.model_dump(mode="json") for ref in sources],
                    retrieved=chunks,
                    llm_provider=used_provider,
                    latency_ms=elapsed(),
                )
                await session.commit()
                return AskResponse(
                    query_id=query_id,
                    status=status,
                    answer=payload["answer"],
                    steps=payload.get("steps", []),
                    responsible=payload.get("responsible"),
                    deadline=payload.get("deadline"),
                    sources=sources,
                )

            # Ниже порога релевантности LLM не вызывается вовсе.
            if not chunks or chunks[0].score < settings.rag_min_score:
                return await finish(AnswerStatus.NO_INFO, {"answer": NO_INFO_TEXT}, [], None)

            relevant = [chunk for chunk in chunks if chunk.score >= settings.rag_min_score]
            prompt = render_prompt(question, requester, relevant)

            try:
                answer = await self.llm.generate_structured(prompt, LLMAnswer)
            except Exception as exc:
                query_id = await repo.log_query(
                    user_id=user_id,
                    question=question,
                    status="error",
                    answer=None,
                    sources=[],
                    retrieved=chunks,
                    llm_provider=provider,
                    latency_ms=elapsed(),
                    error=f"{type(exc).__name__}: {exc}"[:1000],
                )
                await session.commit()
                logger.error(
                    "Ассистент: ошибка LLM", query_id=str(query_id), error=type(exc).__name__
                )
                raise LLMUnavailableError(
                    "LLM недоступна или вернула некорректный ответ", query_id
                ) from exc

            status, sources = verify_sources(answer, relevant)
            if status == AnswerStatus.NO_INFO:
                payload: dict[str, Any] = {"answer": NO_INFO_TEXT}
            else:
                payload = {
                    "answer": answer.answer.strip(),
                    "steps": [step.strip() for step in answer.steps if step.strip()],
                    "responsible": answer.responsible,
                    "deadline": answer.deadline,
                }
            return await finish(status, payload, sources, provider)
