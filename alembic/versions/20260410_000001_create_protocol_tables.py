"""create protocol tables

Revision ID: 20260410_000001
Revises:
Create Date: 2026-04-10 16:00:00
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260410_000001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create Module 3 protocol tables."""
    op.create_table(
        "meeting_protocols",
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("meeting_date", sa.Date(), nullable=False),
        sa.Column("participants", sa.JSON(), nullable=True),
        sa.Column("source", sa.String(length=50), nullable=False),
        sa.Column("file_path", sa.String(length=1000), nullable=False),
        sa.Column("file_original_name", sa.String(length=500), nullable=False),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("transcript_encrypted", sa.Text(), nullable=True),
        sa.Column("diarized_transcript", sa.JSON(), nullable=True),
        sa.Column("protocol_text", sa.Text(), nullable=True),
        sa.Column("agenda", sa.JSON(), nullable=True),
        sa.Column("decisions", sa.JSON(), nullable=True),
        sa.Column(
            "status",
            sa.Enum(
                "UPLOADED",
                "PROCESSING",
                "TRANSCRIBING",
                "GENERATING",
                "COMPLETED",
                "FAILED",
                name="protocolstatus",
                native_enum=False,
                length=50,
            ),
            nullable=False,
        ),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("uploaded_by_telegram_id", sa.Integer(), nullable=True),
        sa.Column("uploaded_by_user_id", sa.Integer(), nullable=True),
        sa.Column("celery_task_id", sa.String(length=255), nullable=True),
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "meeting_action_items",
        sa.Column("protocol_id", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("assignee", sa.String(length=300), nullable=False),
        sa.Column("assignee_position", sa.String(length=300), nullable=True),
        sa.Column("deadline", sa.Date(), nullable=True),
        sa.Column(
            "status",
            sa.Enum(
                "PENDING",
                "IN_PROGRESS",
                "DONE",
                "OVERDUE",
                "CANCELLED",
                name="actionitemstatus",
                native_enum=False,
                length=50,
            ),
            nullable=False,
        ),
        sa.Column(
            "priority",
            sa.Enum(
                "HIGH",
                "MEDIUM",
                "LOW",
                name="actionitempriority",
                native_enum=False,
                length=50,
            ),
            nullable=False,
        ),
        sa.Column(
            "traffic_light",
            sa.Enum(
                "GREEN",
                "YELLOW",
                "RED",
                name="trafficlightstatus",
                native_enum=False,
                length=50,
            ),
            nullable=False,
        ),
        sa.Column("onec_task_id", sa.String(length=255), nullable=True),
        sa.Column("reminder_sent", sa.Boolean(), nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["protocol_id"],
            ["meeting_protocols.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "meeting_tone_analyses",
        sa.Column("protocol_id", sa.Integer(), nullable=False),
        sa.Column("overall_score", sa.Float(), nullable=False),
        sa.Column("is_compliant", sa.Boolean(), nullable=False),
        sa.Column("violations", sa.JSON(), nullable=True),
        sa.Column("recommendations", sa.JSON(), nullable=True),
        sa.Column("speaker_scores", sa.JSON(), nullable=True),
        sa.Column("positive_aspects", sa.JSON(), nullable=True),
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["protocol_id"],
            ["meeting_protocols.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("protocol_id"),
    )

    op.create_index(
        "ix_meeting_protocols_status",
        "meeting_protocols",
        ["status"],
        unique=False,
    )
    op.create_index(
        "ix_meeting_action_items_deadline",
        "meeting_action_items",
        ["deadline"],
        unique=False,
    )
    op.create_index(
        "ix_meeting_action_items_status",
        "meeting_action_items",
        ["status"],
        unique=False,
    )


def downgrade() -> None:
    """Drop Module 3 protocol tables."""
    op.drop_index("ix_meeting_action_items_status", table_name="meeting_action_items")
    op.drop_index("ix_meeting_action_items_deadline", table_name="meeting_action_items")
    op.drop_index("ix_meeting_protocols_status", table_name="meeting_protocols")

    op.drop_table("meeting_tone_analyses")
    op.drop_table("meeting_action_items")
    op.drop_table("meeting_protocols")
