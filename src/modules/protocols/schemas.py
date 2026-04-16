"""Pydantic v2 схемы для модуля протоколов совещаний.

Содержит схемы для:
- Загрузки аудиофайла (MeetingUploadSchema)
- Сегментов транскрипта с диаризацией (SpeakerSegmentSchema)
- Поручений / action items (ActionItemSchema)
- Анализа тональности (ToneAnalysisSchema)
- Полного протокола (MeetingProtocolSchema)
- API-ответов (ProtocolResponseSchema, ProtocolListResponseSchema)
"""

from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ProtocolStatusEnum(str, Enum):
    """Статус обработки протокола (для API)."""

    UPLOADED = "uploaded"
    PROCESSING = "processing"
    TRANSCRIBING = "transcribing"
    GENERATING = "generating"
    COMPLETED = "completed"
    FAILED = "failed"


class ActionItemStatusEnum(str, Enum):
    """Статус исполнения поручения (для API)."""

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    DONE = "done"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"


class ActionItemPriorityEnum(str, Enum):
    """Приоритет поручения (для API)."""

    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class TrafficLightEnum(str, Enum):
    """Светофор исполнения (для API)."""

    GREEN = "green"
    YELLOW = "yellow"
    RED = "red"


class UploadSourceEnum(str, Enum):
    """Источник загрузки аудиофайла."""

    TELEGRAM = "telegram"
    WEB = "web"


# --- Входные схемы ---


class MeetingUploadSchema(BaseModel):
    """Схема данных при загрузке аудиофайла совещания.

    Attributes:
        title: название совещания.
        meeting_date: дата проведения.
        participants: список участников (ФИО).
        source: откуда загружен файл (telegram / web).
    """

    model_config = ConfigDict(
        str_strip_whitespace=True,
        json_schema_extra={
            "example": {
                "title": "Совещание по проекту СНАРК",
                "meeting_date": "2026-04-09",
                "participants": ["Иванов И.И.", "Петрова А.С."],
                "source": "telegram",
            }
        },
    )

    title: str = Field(
        ...,
        min_length=3,
        max_length=500,
        description="Название совещания",
    )
    meeting_date: date = Field(
        ...,
        description="Дата проведения совещания",
    )
    participants: list[str] = Field(
        default_factory=list,
        description="Список участников (ФИО)",
    )
    source: UploadSourceEnum = Field(
        default=UploadSourceEnum.TELEGRAM,
        description="Источник загрузки файла",
    )


# --- Сегменты транскрипта ---


class SpeakerSegmentSchema(BaseModel):
    """Сегмент транскрипта с привязкой к спикеру.

    Один непрерывный фрагмент речи одного спикера.

    Attributes:
        speaker: идентификатор или имя спикера.
        text: текст высказывания.
        start_time: начало сегмента в секундах.
        end_time: конец сегмента в секундах.
    """

    model_config = ConfigDict(str_strip_whitespace=True)

    speaker: str = Field(
        ...,
        description="Идентификатор или имя спикера",
    )
    text: str = Field(
        ...,
        description="Текст высказывания",
    )
    start_time: float = Field(
        ...,
        ge=0,
        description="Начало сегмента (секунды)",
    )
    end_time: float = Field(
        ...,
        ge=0,
        description="Конец сегмента (секунды)",
    )


# --- Поручения (Action Items) ---


class ActionItemSchema(BaseModel):
    """Поручение, извлечённое из протокола совещания.

    Attributes:
        text: текст поручения.
        assignee: ФИО ответственного.
        assignee_position: должность ответственного.
        deadline: крайний срок исполнения.
        priority: приоритет (high / medium / low).
        status: текущий статус исполнения.
        traffic_light: светофор (green / yellow / red).
    """

    model_config = ConfigDict(
        str_strip_whitespace=True,
        json_schema_extra={
            "example": {
                "text": "Подготовить отчёт по KPI за Q1",
                "assignee": "Иванов И.И.",
                "assignee_position": "Руководитель отдела",
                "deadline": "2026-04-15",
                "priority": "high",
                "status": "pending",
                "traffic_light": "green",
            }
        },
    )

    text: str = Field(
        ...,
        min_length=5,
        description="Текст поручения",
    )
    assignee: str = Field(
        ...,
        description="ФИО ответственного",
    )
    assignee_position: str | None = Field(
        default=None,
        description="Должность ответственного",
    )
    deadline: date | None = Field(
        default=None,
        description="Крайний срок исполнения",
    )
    priority: ActionItemPriorityEnum = Field(
        default=ActionItemPriorityEnum.MEDIUM,
        description="Приоритет",
    )
    status: ActionItemStatusEnum = Field(
        default=ActionItemStatusEnum.PENDING,
        description="Статус исполнения",
    )
    traffic_light: TrafficLightEnum = Field(
        default=TrafficLightEnum.GREEN,
        description="Светофор исполнения",
    )


# --- Анализ тональности ---


class ToneViolationSchema(BaseModel):
    """Конкретное нарушение тональности на совещании.

    Attributes:
        speaker: кто допустил нарушение.
        description: описание нарушения.
        quote: цитата из транскрипта.
        severity: серьёзность (1–5).
    """

    model_config = ConfigDict(str_strip_whitespace=True)

    speaker: str = Field(..., description="Спикер, допустивший нарушение")
    description: str = Field(..., description="Описание нарушения")
    quote: str = Field(..., description="Цитата из транскрипта")
    severity: int = Field(
        ...,
        ge=1,
        le=5,
        description="Серьёзность нарушения (1–5)",
    )


class ToneAnalysisSchema(BaseModel):
    """Результат анализа тональности совещания.

    Оценка tone-of-voice и соответствия корпоративной культуре.

    Attributes:
        overall_score: общая оценка (0.0–10.0, где 10 — идеально).
        is_compliant: соответствует ли корпоративным стандартам.
        violations: список нарушений.
        recommendations: рекомендации по улучшению.
        positive_aspects: позитивные аспекты совещания.
        speaker_scores: оценки по каждому спикеру.
    """

    model_config = ConfigDict(
        str_strip_whitespace=True,
        json_schema_extra={
            "example": {
                "overall_score": 7.5,
                "is_compliant": True,
                "violations": [],
                "recommendations": [
                    "Рекомендуется больше внимания уделять таймингу"
                ],
                "positive_aspects": [
                    "Конструктивный тон обсуждения"
                ],
                "speaker_scores": {
                    "Иванов И.И.": 8.0,
                    "Петрова А.С.": 7.0,
                },
            }
        },
    )

    overall_score: float = Field(
        ...,
        ge=0.0,
        le=10.0,
        description="Общая оценка тональности (0–10)",
    )
    is_compliant: bool = Field(
        ...,
        description="Соответствие корпоративной культуре",
    )
    violations: list[ToneViolationSchema] = Field(
        default_factory=list,
        description="Нарушения тональности",
    )
    recommendations: list[str] = Field(
        default_factory=list,
        description="Рекомендации по улучшению",
    )
    positive_aspects: list[str] = Field(
        default_factory=list,
        description="Позитивные аспекты",
    )
    speaker_scores: dict[str, float] = Field(
        default_factory=dict,
        description="Оценки по спикерам",
    )


# --- Полный протокол (LLM output) ---


class MeetingProtocolSchema(BaseModel):
    """Полный структурированный протокол совещания.

    Генерируется LLM на основе диаризированного транскрипта.
    Используется как structured output от LLM.

    Attributes:
        agenda: повестка совещания (список пунктов).
        discussion: ход обсуждения (сегменты с привязкой к спикерам).
        decisions: принятые решения (список).
        action_items: поручения с ответственными и сроками.
        summary: краткое резюме совещания.
        next_meeting_date: дата следующего совещания (если обсуждалось).
    """

    model_config = ConfigDict(
        str_strip_whitespace=True,
        json_schema_extra={
            "example": {
                "agenda": [
                    "Обсуждение KPI за Q1",
                    "Планирование Q2",
                ],
                "discussion": [
                    {
                        "speaker": "Иванов И.И.",
                        "text": "Предлагаю рассмотреть результаты...",
                        "start_time": 0.0,
                        "end_time": 45.5,
                    }
                ],
                "decisions": [
                    "Утвердить план KPI на Q2",
                ],
                "action_items": [
                    {
                        "text": "Подготовить отчёт по KPI за Q1",
                        "assignee": "Иванов И.И.",
                        "deadline": "2026-04-15",
                        "priority": "high",
                        "status": "pending",
                        "traffic_light": "green",
                    }
                ],
                "summary": "Обсудили результаты Q1, утвердили план на Q2.",
                "next_meeting_date": "2026-04-16",
            }
        },
    )

    agenda: list[str] = Field(
        default_factory=list,
        description="Повестка совещания",
    )
    discussion: list[SpeakerSegmentSchema] = Field(
        default_factory=list,
        description="Ход обсуждения по спикерам",
    )
    decisions: list[str] = Field(
        default_factory=list,
        description="Принятые решения",
    )
    action_items: list[ActionItemSchema] = Field(
        default_factory=list,
        description="Поручения с ответственными и сроками",
    )
    summary: str = Field(
        default="",
        description="Краткое резюме совещания",
    )
    next_meeting_date: date | None = Field(
        default=None,
        description="Дата следующего совещания",
    )


# --- API Response схемы ---


class ActionItemResponseSchema(BaseModel):
    """Поручение в ответе API (с id и метаданными).

    Attributes:
        id: идентификатор поручения в БД.
        text: текст поручения.
        assignee: ФИО ответственного.
        deadline: срок исполнения.
        status: статус.
        priority: приоритет.
        traffic_light: светофор.
        onec_task_id: ID задачи в 1С.
        created_at: дата создания.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    text: str
    assignee: str
    assignee_position: str | None = None
    deadline: date | None = None
    status: ActionItemStatusEnum
    priority: ActionItemPriorityEnum
    traffic_light: TrafficLightEnum
    onec_task_id: str | None = None
    reminder_sent: bool = False
    completed_at: datetime | None = None
    created_at: datetime


class ToneAnalysisResponseSchema(BaseModel):
    """Анализ тональности в ответе API.

    Attributes:
        id: идентификатор в БД.
        overall_score: оценка тональности.
        is_compliant: соответствие корпкультуре.
        violations: нарушения.
        recommendations: рекомендации.
        positive_aspects: позитивные аспекты.
        speaker_scores: оценки по спикерам.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    overall_score: float
    is_compliant: bool
    violations: list | None = None
    recommendations: list | None = None
    positive_aspects: list | None = None
    speaker_scores: dict | None = None


class ProtocolResponseSchema(BaseModel):
    """Полный ответ API с данными протокола.

    Attributes:
        id: идентификатор протокола в БД.
        title: название совещания.
        meeting_date: дата проведения.
        participants: участники.
        status: статус обработки.
        protocol_text: текст протокола.
        agenda: повестка.
        decisions: решения.
        action_items: поручения.
        tone_analysis: анализ тональности.
        duration_seconds: длительность аудио.
        created_at: дата загрузки.
        updated_at: дата обновления.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    meeting_date: date
    participants: list | None = None
    source: str
    status: ProtocolStatusEnum
    protocol_text: str | None = None
    agenda: list | None = None
    decisions: list | None = None
    action_items: list[ActionItemResponseSchema] = []
    tone_analysis: ToneAnalysisResponseSchema | None = None
    duration_seconds: int | None = None
    error_message: str | None = None
    created_at: datetime
    updated_at: datetime


class ProtocolListResponseSchema(BaseModel):
    """Список протоколов (краткая информация для списка).

    Attributes:
        id: идентификатор.
        title: название.
        meeting_date: дата.
        status: статус.
        action_items_count: количество поручений.
        overall_tone_score: оценка тональности.
        created_at: дата создания.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    meeting_date: date
    status: ProtocolStatusEnum
    action_items_count: int = 0
    overall_tone_score: float | None = None
    created_at: datetime


class ProtocolUploadResponseSchema(BaseModel):
    """Ответ API после успешной загрузки аудиофайла.

    Attributes:
        protocol_id: ID созданного протокола.
        status: начальный статус.
        celery_task_id: ID задачи Celery для отслеживания.
        message: сообщение пользователю.
    """

    protocol_id: int
    status: ProtocolStatusEnum = ProtocolStatusEnum.UPLOADED
    celery_task_id: str | None = None
    message: str = "Файл загружен. Обработка начата."


class ProtocolCeleryRetryResponseSchema(BaseModel):
    """Ответ API: протокол снова поставлен в очередь Celery."""

    protocol_id: int = Field(..., description="ID протокола.")
    previous_status: str = Field(
        ...,
        description="Статус протокола в БД до постановки задачи.",
    )
    celery_task_id: str = Field(..., description="Новый ID задачи Celery.")
    message: str = Field(
        default="Обработка снова поставлена в очередь.",
        description="Краткое сообщение.",
    )


class ProtocolCeleryStatusResponseSchema(BaseModel):
    """Ответ API: состояние Celery-задачи по протоколу."""

    protocol_id: int = Field(..., description="ID протокола в БД.")
    protocol_status: str = Field(
        ...,
        description="Статус протокола в БД: uploaded, processing, completed, ...",
    )
    celery_task_id: str | None = Field(
        default=None,
        description="ID задачи Celery (если уже создана).",
    )
    celery_state: str | None = Field(
        default=None,
        description="Состояние задачи: PENDING, STARTED, SUCCESS, FAILURE, RETRY, ...",
    )
    celery_ready: bool | None = Field(
        default=None,
        description="True, если задача завершена (успех или ошибка).",
    )
    celery_info: dict[str, Any] | str | None = Field(
        default=None,
        description="Краткий результат или метаданные (dict при успехе, текст при ошибке).",
    )
    detail: str | None = Field(
        default=None,
        description="Пояснение, если для протокола ещё не задан celery_task_id.",
    )
