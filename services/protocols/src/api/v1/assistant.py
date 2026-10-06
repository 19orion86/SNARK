"""API ассистента по базе знаний. Все маршруты — внутренние (X-Internal-Token).

Портал вызывает их через прокси и сам отвечает за сессию пользователя.
Роль и отдел пользователя сервис читает из public.users, из запроса они не принимаются.
"""

from __future__ import annotations

import uuid
from typing import Literal

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from src.core.auth.internal_token import require_internal_token
from src.modules.assistant.db import rag_session
from src.modules.assistant.repository import AssistantRepository
from src.modules.assistant.schemas import (
    AskRequest,
    AskResponse,
    FeedbackRequest,
    FrequentQuestion,
    QueryLogItem,
    QueryLogResponse,
    ReindexResponse,
    SourceState,
)
from src.modules.assistant.service import AssistantService, LLMUnavailableError, UserNotFoundError
from src.modules.assistant.tasks import ingest_source_task

logger = structlog.get_logger(__name__)

router = APIRouter(
    prefix="/api/v1/assistant",
    tags=["assistant"],
    dependencies=[Depends(require_internal_token)],
)

SourceType = Literal["document", "article"]

_service = AssistantService()


def get_service() -> AssistantService:
    return _service


@router.post(
    "/sources/{source_type}/{source_id}/reindex",
    response_model=ReindexResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Поставить источник на индексацию",
)
async def reindex_source(source_type: SourceType, source_id: uuid.UUID) -> ReindexResponse:
    """Идемпотентно: задача сама решает, индексировать, удалить чанки или ничего не делать."""
    async with rag_session() as session:
        repo = AssistantRepository(session)
        source = await repo.get_portal_source(source_type, source_id)
        indexed = await repo.get_source_row(source_type, source_id)
    if source is None and indexed is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Источник не найден")

    task = ingest_source_task.delay(source_type, str(source_id))
    return ReindexResponse(
        source_type=source_type, source_id=source_id, index_state="pending", task_id=task.id
    )


@router.get("/sources", response_model=list[SourceState], summary="Состояние индексации")
async def list_sources(
    source_type: SourceType | None = Query(default=None, alias="type"),
    ids: list[uuid.UUID] | None = Query(default=None),
) -> list[SourceState]:
    async with rag_session() as session:
        rows = await AssistantRepository(session).list_source_states(source_type, ids)
    return [SourceState(**row) for row in rows]


@router.post("/ask", response_model=AskResponse, summary="Задать вопрос ассистенту")
async def ask(payload: AskRequest, service: AssistantService = Depends(get_service)) -> AskResponse:
    try:
        return await service.ask(payload.user_id, payload.question)
    except UserNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Пользователь не найден") from exc
    except LLMUnavailableError as exc:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            {"message": str(exc), "query_id": str(exc.query_id)},
        ) from exc


@router.post(
    "/queries/{query_id}/feedback",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Оценка ответа",
)
async def set_feedback(query_id: uuid.UUID, payload: FeedbackRequest) -> Response:
    async with rag_session() as session:
        updated = await AssistantRepository(session).set_feedback(
            query_id, payload.user_id, payload.value
        )
        await session.commit()
    if not updated:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Обращение не найдено")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/queries", response_model=QueryLogResponse, summary="Журнал обращений")
async def list_queries(
    status_filter: Literal["answered", "no_info", "contradiction", "error"] | None = Query(
        default=None, alias="status"
    ),
    feedback: Literal[1, -1] | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> QueryLogResponse:
    async with rag_session() as session:
        repo = AssistantRepository(session)
        rows, total = await repo.list_queries(status_filter, feedback, limit, offset)
        frequent = await repo.frequent_questions(status_filter, 10)
    return QueryLogResponse(
        items=[
            QueryLogItem(
                **{key: row[key] for key in row if key != "answer_json"},
                answer=(row["answer_json"] or {}).get("answer"),
            )
            for row in rows
        ],
        total=total,
        frequent=[FrequentQuestion(**item) for item in frequent],
    )
