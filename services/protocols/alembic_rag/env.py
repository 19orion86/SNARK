"""Alembic-окружение схемы `rag` (ассистент по базе знаний).

Отдельно от `alembic/` протоколов:
- URL берётся из RAG_DATABASE_URL (база портала), а не DATABASE_URL сервиса;
- таблица версий — `rag.alembic_version`;
- в сравнение попадают только объекты схемы `rag`, поэтому autogenerate
  не видит таблицы портала в `public` и не может сгенерировать для них DROP.

    alembic -c alembic_rag.ini upgrade head
"""

from __future__ import annotations

from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool, text

from alembic import context
from src.core.config import settings
from src.modules.assistant.models import RAG_SCHEMA, RagBase

config = context.config

if not settings.rag_database_url:
    raise RuntimeError("RAG_DATABASE_URL не задан: миграции схемы rag идут в базу портала")

config.set_main_option("sqlalchemy.url", settings.rag_database_url.replace("+asyncpg", "+psycopg"))

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = RagBase.metadata


def include_object(obj, name, type_, reflected, compare_to):  # type: ignore[no-untyped-def]
    """Пропускать всё, что лежит вне схемы rag."""
    if type_ == "table":
        return obj.schema == RAG_SCHEMA
    table = getattr(obj, "table", None)
    if table is not None:
        return table.schema == RAG_SCHEMA
    return True


def include_name(name, type_, parent_names):  # type: ignore[no-untyped-def]
    if type_ == "schema":
        return name == RAG_SCHEMA
    return True


def run_migrations_offline() -> None:
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        version_table_schema=RAG_SCHEMA,
        include_schemas=True,
        include_object=include_object,
        include_name=include_name,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        # Схему создаёт владелец базы (scripts/rag-role.sql). Создание здесь — для dev,
        # где миграции запускает сам владелец.
        # Проверяем наличие явно: CREATE SCHEMA IF NOT EXISTS требует права CREATE
        # на базу даже тогда, когда схема уже есть, а у snark_rag его нет.
        exists = connection.execute(
            text("SELECT 1 FROM information_schema.schemata WHERE schema_name = :name"),
            {"name": RAG_SCHEMA},
        ).scalar()
        if not exists:
            connection.execute(text(f"CREATE SCHEMA {RAG_SCHEMA}"))
        connection.commit()
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            version_table_schema=RAG_SCHEMA,
            include_schemas=True,
            include_object=include_object,
            include_name=include_name,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
