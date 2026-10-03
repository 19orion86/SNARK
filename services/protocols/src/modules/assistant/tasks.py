"""Celery-задачи ассистента: индексация источника и периодическая сверка."""

from __future__ import annotations

import asyncio
import concurrent.futures
import uuid

import structlog

from src.core.celery_app import celery_app
from src.modules.assistant.db import rag_session
from src.modules.assistant.ingest import ingest_source
from src.modules.assistant.repository import AssistantRepository

logger = structlog.get_logger(__name__)

RECONCILE_INTERVAL_SECONDS = 600


def _run(coro):  # type: ignore[no-untyped-def]
    """Выполнить корутину из Celery-задачи.

    В обычном воркере event loop нет. В eager-режиме задача вызывается из
    async-обработчика FastAPI — тогда корутина уходит в отдельный поток.
    """
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(coro)
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        return pool.submit(asyncio.run, coro).result()


@celery_app.task(
    bind=True,
    name="assistant.ingest_source",
    max_retries=3,
    soft_time_limit=900,
    time_limit=1200,
)
def ingest_source_task(self, source_type: str, source_id: str) -> dict:  # type: ignore[no-untyped-def]
    """Проиндексировать источник. Временные ошибки повторяются с экспоненциальной задержкой."""
    try:
        result = _run(ingest_source(source_type, uuid.UUID(source_id)))
    except Exception as exc:
        delay = 30 * 2**self.request.retries
        logger.warning(
            "Индексация не удалась, повтор",
            source_type=source_type,
            source_id=source_id,
            retry_in=delay,
            error=str(exc)[:300],
        )
        raise self.retry(exc=exc, countdown=delay) from exc
    return {"action": result.action, "chunks": result.chunks, "error": result.error}


@celery_app.task(name="assistant.reconcile")
def reconcile_task() -> dict:
    """Найти расхождения между порталом и индексом и поставить их на индексацию."""

    async def _find() -> list[tuple[str, uuid.UUID]]:
        async with rag_session() as session:
            return await AssistantRepository(session).find_out_of_sync()

    pending = _run(_find())
    for source_type, source_id in pending:
        ingest_source_task.delay(source_type, str(source_id))
    if pending:
        logger.info("Сверка индекса: поставлено на индексацию", count=len(pending))
    return {"queued": len(pending)}


celery_app.conf.beat_schedule = {
    **(celery_app.conf.beat_schedule or {}),
    "assistant-reconcile": {
        "task": "assistant.reconcile",
        "schedule": RECONCILE_INTERVAL_SECONDS,
    },
}
