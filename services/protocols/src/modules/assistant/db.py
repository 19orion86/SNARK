"""Подключение ассистента к базе портала (роль snark_rag)."""

from __future__ import annotations

from functools import lru_cache

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from src.core.config import settings


@lru_cache(maxsize=1)
def get_rag_engine() -> AsyncEngine:
    if not settings.rag_database_url:
        raise RuntimeError("RAG_DATABASE_URL не задан: ассистент работает с базой портала")
    # NullPool, как и в протоколах: Celery запускает корутины в разных event loop.
    return create_async_engine(settings.rag_database_url, echo=False, poolclass=NullPool)


def rag_session() -> AsyncSession:
    """Новая сессия. Использовать как `async with rag_session() as session`."""
    return async_sessionmaker(get_rag_engine(), class_=AsyncSession, expire_on_commit=False)()
