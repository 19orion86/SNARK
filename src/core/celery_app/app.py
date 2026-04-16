"""Конфигурация Celery для асинхронной обработки задач.

Celery используется для долгих операций:
- STT + диаризация аудиозаписей совещаний
- Генерация протоколов через LLM
- Отправка уведомлений
"""

from __future__ import annotations

import sys

from celery import Celery

from src.core.config import settings

celery_app = Celery(
    "snark_bot",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Europe/Moscow",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_soft_time_limit=600,
    task_time_limit=900,
)

if sys.platform == "win32":
    # Prefork (billiard) на Windows часто падает с PermissionError на semlock.
    # Solo выполняет задачи в процессе воркера без дочерних pool-процессов.
    celery_app.conf.worker_pool = "solo"

celery_app.autodiscover_tasks(
    [
        "src.modules.protocols.tasks",
    ],
)
