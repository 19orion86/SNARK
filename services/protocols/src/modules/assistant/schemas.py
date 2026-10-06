"""Pydantic-схемы ассистента: ответ LLM и контракт API."""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class AnswerStatus(str, Enum):
    ANSWERED = "answered"
    NO_INFO = "no_info"
    CONTRADICTION = "contradiction"


class LLMAnswer(BaseModel):
    """Структурированный ответ, который возвращает LLM.

    `sources` — номера фрагментов из контекста (1, 2, …), а не идентификаторы
    документов: так модель не может сослаться на то, чего ей не показывали.
    """

    status: AnswerStatus
    answer: str = ""
    steps: list[str] = Field(default_factory=list)
    responsible: str | None = None
    deadline: str | None = None
    sources: list[int] = Field(default_factory=list)


class SourceRef(BaseModel):
    source_type: Literal["document", "article"]
    source_id: uuid.UUID
    title: str
    version: str | None = None
    section: str = ""


class AskRequest(BaseModel):
    user_id: uuid.UUID
    question: str = Field(min_length=1, max_length=2000)

    model_config = {"extra": "forbid"}


class AskResponse(BaseModel):
    query_id: uuid.UUID
    status: AnswerStatus
    answer: str
    steps: list[str] = Field(default_factory=list)
    responsible: str | None = None
    deadline: str | None = None
    sources: list[SourceRef] = Field(default_factory=list)


class FeedbackRequest(BaseModel):
    user_id: uuid.UUID
    value: Literal[1, -1]

    model_config = {"extra": "forbid"}


class ReindexResponse(BaseModel):
    source_type: str
    source_id: uuid.UUID
    index_state: str
    task_id: str | None = None


class SourceState(BaseModel):
    source_type: str
    source_id: uuid.UUID
    index_state: str
    error: str | None = None
    chunk_count: int = 0
    version: str | None = None
    indexed_at: datetime | None = None


class QueryLogItem(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    question: str
    status: str
    answer: str | None = None
    sources: list[dict] = Field(default_factory=list)
    llm_provider: str | None = None
    latency_ms: int | None = None
    error: str | None = None
    feedback: int | None = None
    created_at: datetime


class FrequentQuestion(BaseModel):
    question: str
    total: int
    last_asked_at: datetime


class QueryLogResponse(BaseModel):
    items: list[QueryLogItem]
    total: int
    frequent: list[FrequentQuestion]
