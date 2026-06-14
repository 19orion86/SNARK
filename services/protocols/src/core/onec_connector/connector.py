"""Коннектор к 1С:ЗУП через HTTP/OData.

Предоставляет методы для создания задач, получения списка
сотрудников и других операций с 1С. COM-вызовы запрещены
в production-среде (только HTTP/OData).
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

import httpx
import structlog

from src.core.config import settings

logger = structlog.get_logger(__name__)


class OneCConnector:
    """Клиент для взаимодействия с 1С:ЗУП через OData API.

    Все вызовы выполняются по HTTP (синхронно, т.к. 1С
    не поддерживает async). Для использования в async-контексте
    рекомендуется оборачивать вызовы в asyncio.to_thread().

    Attributes:
        base_url: базовый URL OData-сервиса 1С.
        auth: кортеж (логин, пароль) для HTTP Basic Auth.
    """

    def __init__(self) -> None:
        self.base_url = settings.onec_base_url
        self.auth = (settings.onec_username, settings.onec_password)
        logger.info("OneCConnector инициализирован", base_url=self.base_url)

    def create_task(
        self,
        title: str,
        description: str,
        assignee_id: str,
        deadline: date | None = None,
        priority: str = "Обычный",
    ) -> dict[str, Any]:
        """Создать задачу в 1С:ЗУП.

        Args:
            title: заголовок задачи.
            description: описание задачи.
            assignee_id: идентификатор сотрудника в 1С.
            deadline: срок выполнения.
            priority: приоритет (Высокий, Обычный, Низкий).

        Returns:
            Ответ 1С с данными созданной задачи.
        """
        payload = {
            "Наименование": title,
            "Описание": description,
            "Исполнитель_Key": assignee_id,
            "Приоритет": priority,
        }
        if deadline:
            payload["СрокИсполнения"] = deadline.isoformat()

        logger.info("Создание задачи в 1С", title=title, assignee=assignee_id)

        try:
            response = httpx.post(
                f"{self.base_url}/Catalog_Задачи",
                json=payload,
                auth=self.auth,
                timeout=30,
            )
            response.raise_for_status()
            result: dict[str, Any] = response.json()
            logger.info("Задача создана в 1С", ref=result.get("Ref_Key"))
            return result
        except httpx.HTTPError as e:
            logger.error("Ошибка создания задачи в 1С", error=str(e))
            raise

    def get_employees(self) -> list[dict[str, Any]]:
        """Получить список сотрудников из 1С:ЗУП.

        Returns:
            Список сотрудников с полями Ref_Key, Наименование и др.
        """
        try:
            response = httpx.get(
                f"{self.base_url}/Catalog_Сотрудники",
                auth=self.auth,
                timeout=30,
                params={"$format": "json"},
            )
            response.raise_for_status()
            data: dict[str, Any] = response.json()
            return data.get("value", [])
        except httpx.HTTPError as e:
            logger.error("Ошибка получения сотрудников из 1С", error=str(e))
            raise

    def update_task_status(
        self,
        task_ref: str,
        new_status: str,
    ) -> dict[str, Any]:
        """Обновить статус задачи в 1С.

        Args:
            task_ref: Ref_Key задачи в 1С.
            new_status: новый статус (Выполнена, В работе и т.д.).

        Returns:
            Обновлённые данные задачи.
        """
        payload = {"Статус": new_status}

        try:
            response = httpx.patch(
                f"{self.base_url}/Catalog_Задачи(guid'{task_ref}')",
                json=payload,
                auth=self.auth,
                timeout=30,
            )
            response.raise_for_status()
            result: dict[str, Any] = response.json()
            logger.info(
                "Статус задачи обновлён в 1С",
                ref=task_ref,
                status=new_status,
            )
            return result
        except httpx.HTTPError as e:
            logger.error(
                "Ошибка обновления задачи в 1С",
                ref=task_ref,
                error=str(e),
            )
            raise
