"""SQLAlchemy-модели для модуля протоколов совещаний.

Содержит три основные модели:
- MeetingProtocol — запись о совещании и его протокол
- MeetingActionItem — задача/поручение из протокола
- MeetingToneAnalysis — анализ тональности совещания
"""

from __future__ import annotations

import enum
from datetime import date, datetime

from sqlalchemy import (
    JSON,
    Enum,
    Float,
    ForeignKey,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.core.database import Base


class ProtocolStatus(str, enum.Enum):
    """Статус обработки протокола совещания."""

    UPLOADED = "uploaded"
    PROCESSING = "processing"
    TRANSCRIBING = "transcribing"
    GENERATING = "generating"
    COMPLETED = "completed"
    FAILED = "failed"


class ActionItemStatus(str, enum.Enum):
    """Статус исполнения поручения из протокола."""

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    DONE = "done"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"


class ActionItemPriority(str, enum.Enum):
    """Приоритет поручения."""

    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class TrafficLightStatus(str, enum.Enum):
    """Светофор исполнения: зелёный / жёлтый / красный."""

    GREEN = "green"
    YELLOW = "yellow"
    RED = "red"


class MeetingProtocol(Base):
    """Протокол совещания.

    Хранит метаданные совещания, зашифрованный аудиофайл,
    транскрипт и сгенерированный протокол. Связан с поручениями
    (action_items) и анализом тональности (tone_analysis).

    Attributes:
        title: название совещания.
        meeting_date: дата проведения совещания.
        participants: список участников (JSON).
        source: источник загрузки (telegram / web).
        file_path: путь к зашифрованному аудиофайлу.
        file_original_name: оригинальное имя файла.
        duration_seconds: длительность аудиозаписи в секундах.
        transcript_encrypted: зашифрованный полный транскрипт.
        diarized_transcript: транскрипт с метками спикеров (JSON, зашифрован).
        protocol_text: текст сгенерированного протокола.
        agenda: повестка совещания (JSON).
        decisions: принятые решения (JSON).
        status: текущий статус обработки.
        error_message: сообщение об ошибке (если status=failed).
        uploaded_by_telegram_id: Telegram ID загрузившего пользователя.
        uploaded_by_user_id: ID пользователя в системе.
        celery_task_id: ID задачи Celery для отслеживания прогресса.
    """

    __tablename__ = "meeting_protocols"

    title: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )
    meeting_date: Mapped[date] = mapped_column(nullable=False)
    participants: Mapped[list | None] = mapped_column(
        JSON,
        nullable=True,
        default=list,
    )
    source: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="telegram",
    )

    file_path: Mapped[str] = mapped_column(
        String(1000),
        nullable=False,
    )
    file_original_name: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )
    duration_seconds: Mapped[int | None] = mapped_column(nullable=True)

    transcript_encrypted: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    diarized_transcript: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
    )
    protocol_text: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    agenda: Mapped[list | None] = mapped_column(
        JSON,
        nullable=True,
    )
    decisions: Mapped[list | None] = mapped_column(
        JSON,
        nullable=True,
    )

    status: Mapped[ProtocolStatus] = mapped_column(
        Enum(ProtocolStatus, native_enum=False, length=50),
        nullable=False,
        default=ProtocolStatus.UPLOADED,
    )
    error_message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    uploaded_by_telegram_id: Mapped[int | None] = mapped_column(
        nullable=True,
    )
    uploaded_by_user_id: Mapped[int | None] = mapped_column(
        nullable=True,
    )
    celery_task_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    action_items: Mapped[list[MeetingActionItem]] = relationship(
        "MeetingActionItem",
        back_populates="protocol",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    tone_analysis: Mapped[MeetingToneAnalysis | None] = relationship(
        "MeetingToneAnalysis",
        back_populates="protocol",
        uselist=False,
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return (
            f"<MeetingProtocol(id={self.id}, "
            f"title='{self.title}', "
            f"status={self.status})>"
        )


class MeetingActionItem(Base):
    """Поручение (action item) из протокола совещания.

    Привязано к протоколу через FK. Содержит текст задачи,
    ответственного, срок и статус исполнения. Может быть
    синхронизировано с 1С:ЗУП.

    Attributes:
        protocol_id: FK на MeetingProtocol.
        text: текст поручения.
        assignee: ФИО ответственного.
        assignee_position: должность ответственного.
        deadline: крайний срок исполнения.
        status: текущий статус.
        priority: приоритет поручения.
        traffic_light: светофор исполнения.
        onec_task_id: идентификатор задачи в 1С (Ref_Key).
        reminder_sent: было ли отправлено напоминание.
        completed_at: дата фактического выполнения.
    """

    __tablename__ = "meeting_action_items"

    protocol_id: Mapped[int] = mapped_column(
        ForeignKey("meeting_protocols.id", ondelete="CASCADE"),
        nullable=False,
    )
    text: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    assignee: Mapped[str] = mapped_column(
        String(300),
        nullable=False,
    )
    assignee_position: Mapped[str | None] = mapped_column(
        String(300),
        nullable=True,
    )
    deadline: Mapped[date | None] = mapped_column(nullable=True)
    status: Mapped[ActionItemStatus] = mapped_column(
        Enum(ActionItemStatus, native_enum=False, length=50),
        nullable=False,
        default=ActionItemStatus.PENDING,
    )
    priority: Mapped[ActionItemPriority] = mapped_column(
        Enum(ActionItemPriority, native_enum=False, length=50),
        nullable=False,
        default=ActionItemPriority.MEDIUM,
    )
    traffic_light: Mapped[TrafficLightStatus] = mapped_column(
        Enum(TrafficLightStatus, native_enum=False, length=50),
        nullable=False,
        default=TrafficLightStatus.GREEN,
    )
    onec_task_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    reminder_sent: Mapped[bool] = mapped_column(
        nullable=False,
        default=False,
    )
    completed_at: Mapped[datetime | None] = mapped_column(nullable=True)

    protocol: Mapped[MeetingProtocol] = relationship(
        "MeetingProtocol",
        back_populates="action_items",
    )

    def __repr__(self) -> str:
        return (
            f"<MeetingActionItem(id={self.id}, "
            f"assignee='{self.assignee}', "
            f"status={self.status})>"
        )


class MeetingToneAnalysis(Base):
    """Анализ тональности совещания.

    Оценка соответствия корпоративной культуре: общий балл,
    список нарушений и рекомендации. Один анализ на один протокол.

    Attributes:
        protocol_id: FK на MeetingProtocol.
        overall_score: общая оценка тональности (0.0–10.0).
        is_compliant: соответствует ли корпоративной культуре.
        violations: список нарушений (JSON).
        recommendations: рекомендации по улучшению (JSON).
        speaker_scores: оценки по каждому спикеру (JSON).
        positive_aspects: позитивные аспекты (JSON).
    """

    __tablename__ = "meeting_tone_analyses"

    protocol_id: Mapped[int] = mapped_column(
        ForeignKey("meeting_protocols.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    overall_score: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=0.0,
    )
    is_compliant: Mapped[bool] = mapped_column(
        nullable=False,
        default=True,
    )
    violations: Mapped[list | None] = mapped_column(
        JSON,
        nullable=True,
        default=list,
    )
    recommendations: Mapped[list | None] = mapped_column(
        JSON,
        nullable=True,
        default=list,
    )
    speaker_scores: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
    )
    positive_aspects: Mapped[list | None] = mapped_column(
        JSON,
        nullable=True,
        default=list,
    )

    protocol: Mapped[MeetingProtocol] = relationship(
        "MeetingProtocol",
        back_populates="tone_analysis",
    )

    def __repr__(self) -> str:
        return (
            f"<MeetingToneAnalysis(id={self.id}, "
            f"score={self.overall_score}, "
            f"compliant={self.is_compliant})>"
        )
