"""Базовые компоненты для работы с PostgreSQL через SQLAlchemy 2.0 (async).

Предоставляет:
- Base — декларативная база для моделей
- async_session_maker — фабрика асинхронных сессий
- get_async_session — dependency для FastAPI
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from datetime import datetime

from sqlalchemy import func
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    mapped_column,
)
from sqlalchemy.pool import NullPool

from src.core.config import settings

engine = create_async_engine(
    settings.database_url,
    echo=False,
    poolclass=NullPool,
)

async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Базовый класс для всех SQLAlchemy-моделей проекта.

    Автоматически добавляет поля id, created_at, updated_at.
    """

    __abstract__ = True

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency — предоставляет асинхронную сессию БД.

    Yields:
        AsyncSession: сессия, которая автоматически закрывается после запроса.
    """
    async with async_session_maker() as session:
        yield session
