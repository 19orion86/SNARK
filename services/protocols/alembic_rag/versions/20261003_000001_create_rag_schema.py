"""Схема rag: sources, chunks (pgvector, HNSW), queries.

Revision ID: 20261003_000001
Revises:
Create Date: 2026-10-03
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "20261003_000001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Расширение ставит владелец базы (scripts/rag-role.sql). Здесь — для dev-стенда,
    # где миграцию запускает пользователь с нужными правами; иначе шаг ничего не делает.
    op.execute(
        """
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
            CREATE EXTENSION vector;
          END IF;
        END $$;
        """
    )

    op.execute(
        """
        CREATE TABLE rag.sources (
          id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          source_type     text NOT NULL,
          source_id       uuid NOT NULL,
          title           text NOT NULL,
          version         text,
          content_hash    text,
          index_state     text NOT NULL DEFAULT 'pending',
          error           text,
          chunk_count     integer NOT NULL DEFAULT 0,
          embedding_model text,
          indexed_at      timestamptz,
          created_at      timestamptz NOT NULL DEFAULT now(),
          updated_at      timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT sources_type_id_key UNIQUE (source_type, source_id),
          CONSTRAINT sources_type_check CHECK (source_type IN ('document', 'article')),
          CONSTRAINT sources_state_check
            CHECK (index_state IN ('pending', 'indexing', 'indexed', 'failed'))
        )
        """
    )

    op.execute(
        """
        CREATE TABLE rag.chunks (
          id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          source         uuid NOT NULL REFERENCES rag.sources(id) ON DELETE CASCADE,
          ordinal        integer NOT NULL,
          section_number text,
          section_title  text,
          text           text NOT NULL,
          token_count    integer NOT NULL,
          embedding      vector(1024) NOT NULL,
          CONSTRAINT chunks_source_ordinal_key UNIQUE (source, ordinal)
        )
        """
    )
    op.execute(
        "CREATE INDEX chunks_embedding_hnsw ON rag.chunks USING hnsw (embedding vector_cosine_ops)"
    )

    op.execute(
        """
        CREATE TABLE rag.queries (
          id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id      uuid NOT NULL,
          question     text NOT NULL,
          answer_json  jsonb,
          status       text NOT NULL,
          sources      jsonb NOT NULL DEFAULT '[]'::jsonb,
          retrieved    jsonb NOT NULL DEFAULT '[]'::jsonb,
          llm_provider text,
          latency_ms   integer,
          error        text,
          feedback     smallint,
          created_at   timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT queries_feedback_check CHECK (feedback IN (-1, 1))
        )
        """
    )
    op.execute("CREATE INDEX queries_created_idx ON rag.queries (created_at DESC)")
    op.execute("CREATE INDEX queries_status_idx ON rag.queries (status, created_at DESC)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS rag.queries")
    op.execute("DROP TABLE IF EXISTS rag.chunks")
    op.execute("DROP TABLE IF EXISTS rag.sources")
