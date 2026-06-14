"""Репозиторий для работы с моделями протоколов совещаний.

Предоставляет async CRUD-операции для MeetingProtocol,
MeetingActionItem и MeetingToneAnalysis через SQLAlchemy 2.0.
"""

from __future__ import annotations

from datetime import date, datetime

import structlog
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.modules.protocols.models import (
    ActionItemPriority,
    ActionItemStatus,
    MeetingActionItem,
    MeetingProtocol,
    MeetingToneAnalysis,
    ProtocolStatus,
    TrafficLightStatus,
)

logger = structlog.get_logger(__name__)


class ProtocolRepository:
    """Репозиторий для CRUD-операций с протоколами совещаний.

    Все методы — async, принимают AsyncSession из FastAPI dependency
    или создают собственную через async_session_maker.

    Args:
        session: асинхронная сессия SQLAlchemy.
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # --- MeetingProtocol ---

    async def create_protocol(
        self,
        title: str,
        meeting_date: date,
        file_path: str,
        file_original_name: str,
        source: str = "telegram",
        participants: list[str] | None = None,
        uploaded_by_telegram_id: int | None = None,
        uploaded_by_user_id: int | None = None,
    ) -> MeetingProtocol:
        """Создать запись о новом протоколе совещания.

        Args:
            title: название совещания.
            meeting_date: дата проведения.
            file_path: путь к зашифрованному аудиофайлу.
            file_original_name: оригинальное имя файла.
            source: источник (telegram / web).
            participants: список участников.
            uploaded_by_telegram_id: Telegram ID загрузившего.
            uploaded_by_user_id: ID пользователя в системе.

        Returns:
            Созданный MeetingProtocol.
        """
        protocol = MeetingProtocol(
            title=title,
            meeting_date=meeting_date,
            file_path=file_path,
            file_original_name=file_original_name,
            source=source,
            participants=participants or [],
            uploaded_by_telegram_id=uploaded_by_telegram_id,
            uploaded_by_user_id=uploaded_by_user_id,
            status=ProtocolStatus.UPLOADED,
        )
        self.session.add(protocol)
        await self.session.commit()
        await self.session.refresh(protocol)
        logger.info("Протокол создан", protocol_id=protocol.id, title=title)
        return protocol

    async def get_protocol_by_id(
        self,
        protocol_id: int,
    ) -> MeetingProtocol | None:
        """Получить протокол по ID с загрузкой связанных данных.

        Args:
            protocol_id: идентификатор протокола.

        Returns:
            MeetingProtocol или None.
        """
        stmt = (
            select(MeetingProtocol)
            .where(MeetingProtocol.id == protocol_id)
            .options(
                selectinload(MeetingProtocol.action_items),
                selectinload(MeetingProtocol.tone_analysis),
            )
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_protocols_list(
        self,
        limit: int = 50,
        offset: int = 0,
        status: ProtocolStatus | None = None,
    ) -> list[MeetingProtocol]:
        """Получить список протоколов с пагинацией.

        Args:
            limit: максимальное количество записей.
            offset: смещение.
            status: фильтр по статусу.

        Returns:
            Список MeetingProtocol.
        """
        stmt = (
            select(MeetingProtocol)
            .options(
                selectinload(MeetingProtocol.action_items),
                selectinload(MeetingProtocol.tone_analysis),
            )
            .order_by(MeetingProtocol.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        if status:
            stmt = stmt.where(MeetingProtocol.status == status)

        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def update_protocol_status(
        self,
        protocol_id: int,
        status: ProtocolStatus,
        error_message: str | None = None,
    ) -> MeetingProtocol | None:
        """Обновить статус протокола.

        Args:
            protocol_id: идентификатор протокола.
            status: новый статус.
            error_message: сообщение об ошибке (при status=FAILED).

        Returns:
            Обновлённый MeetingProtocol или None.
        """
        protocol = await self.get_protocol_by_id(protocol_id)
        if not protocol:
            return None

        protocol.status = status
        if error_message:
            protocol.error_message = error_message

        await self.session.commit()
        await self.session.refresh(protocol)
        logger.info(
            "Статус протокола обновлён",
            protocol_id=protocol_id,
            status=status.value,
        )
        return protocol

    async def save_protocol_results(
        self,
        protocol_id: int,
        transcript_encrypted: str,
        diarized_transcript: dict,
        protocol_text: str,
        agenda: list[str],
        decisions: list[str],
        duration_seconds: int | None = None,
    ) -> MeetingProtocol | None:
        """Сохранить результаты обработки протокола.

        Вызывается после завершения STT + LLM пайплайна.

        Args:
            protocol_id: идентификатор протокола.
            transcript_encrypted: зашифрованный транскрипт.
            diarized_transcript: транскрипт с диаризацией (JSON).
            protocol_text: сгенерированный текст протокола.
            agenda: повестка совещания.
            decisions: принятые решения.
            duration_seconds: длительность аудио.

        Returns:
            Обновлённый MeetingProtocol или None.
        """
        protocol = await self.get_protocol_by_id(protocol_id)
        if not protocol:
            return None

        protocol.transcript_encrypted = transcript_encrypted
        protocol.diarized_transcript = diarized_transcript
        protocol.protocol_text = protocol_text
        protocol.agenda = agenda
        protocol.decisions = decisions
        protocol.duration_seconds = duration_seconds
        protocol.status = ProtocolStatus.COMPLETED

        await self.session.commit()
        await self.session.refresh(protocol)
        logger.info(
            "Результаты протокола сохранены",
            protocol_id=protocol_id,
        )
        return protocol

    async def set_celery_task_id(
        self,
        protocol_id: int,
        celery_task_id: str,
    ) -> None:
        """Привязать ID задачи Celery к протоколу.

        Args:
            protocol_id: идентификатор протокола.
            celery_task_id: ID задачи Celery.
        """
        stmt = (
            update(MeetingProtocol)
            .where(MeetingProtocol.id == protocol_id)
            .values(celery_task_id=celery_task_id)
        )
        await self.session.execute(stmt)
        await self.session.commit()

    # --- MeetingActionItem ---

    async def create_action_items(
        self,
        protocol_id: int,
        items: list[dict],
    ) -> list[MeetingActionItem]:
        """Массово создать поручения для протокола.

        Args:
            protocol_id: идентификатор протокола.
            items: список словарей с данными поручений.

        Returns:
            Список созданных MeetingActionItem.
        """
        action_items = []
        for item_data in items:
            action_item = MeetingActionItem(
                protocol_id=protocol_id,
                text=item_data["text"],
                assignee=item_data["assignee"],
                assignee_position=item_data.get("assignee_position"),
                deadline=item_data.get("deadline"),
                status=ActionItemStatus(
                    item_data.get("status", "pending")
                ),
                priority=ActionItemPriority(
                    item_data.get("priority", "medium")
                ),
            )
            self.session.add(action_item)
            action_items.append(action_item)

        await self.session.commit()
        for item in action_items:
            await self.session.refresh(item)

        logger.info(
            "Поручения созданы",
            protocol_id=protocol_id,
            count=len(action_items),
        )
        return action_items

    async def update_action_item_status(
        self,
        item_id: int,
        status: ActionItemStatus,
        onec_task_id: str | None = None,
    ) -> MeetingActionItem | None:
        """Обновить статус поручения.

        Args:
            item_id: идентификатор поручения.
            status: новый статус.
            onec_task_id: ID задачи в 1С (если создана).

        Returns:
            Обновлённый MeetingActionItem или None.
        """
        stmt = select(MeetingActionItem).where(
            MeetingActionItem.id == item_id
        )
        result = await self.session.execute(stmt)
        item = result.scalar_one_or_none()
        if not item:
            return None

        item.status = status
        if onec_task_id:
            item.onec_task_id = onec_task_id
        if status == ActionItemStatus.DONE:
            item.completed_at = datetime.now()

        await self.session.commit()
        await self.session.refresh(item)
        return item

    async def get_overdue_action_items(self) -> list[MeetingActionItem]:
        """Получить просроченные поручения (для напоминаний).

        Returns:
            Список поручений с истёкшим дедлайном и статусом != done/cancelled.
        """
        today = date.today()
        stmt = (
            select(MeetingActionItem)
            .where(
                MeetingActionItem.deadline < today,
                MeetingActionItem.status.in_([
                    ActionItemStatus.PENDING,
                    ActionItemStatus.IN_PROGRESS,
                ]),
            )
            .options(selectinload(MeetingActionItem.protocol))
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_pending_reminders(self) -> list[MeetingActionItem]:
        """Получить поручения, по которым нужно отправить напоминания.

        Выбираются поручения со статусом pending/in_progress,
        у которых reminder_sent=False и дедлайн в ближайшие 2 дня.

        Returns:
            Список MeetingActionItem для напоминаний.
        """
        today = date.today()
        from datetime import timedelta

        threshold = today + timedelta(days=2)
        stmt = (
            select(MeetingActionItem)
            .where(
                MeetingActionItem.deadline <= threshold,
                MeetingActionItem.deadline >= today,
                MeetingActionItem.reminder_sent.is_(False),
                MeetingActionItem.status.in_([
                    ActionItemStatus.PENDING,
                    ActionItemStatus.IN_PROGRESS,
                ]),
            )
            .options(selectinload(MeetingActionItem.protocol))
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def mark_reminder_sent(self, item_id: int) -> None:
        """Отметить, что напоминание по поручению отправлено.

        Args:
            item_id: идентификатор поручения.
        """
        stmt = (
            update(MeetingActionItem)
            .where(MeetingActionItem.id == item_id)
            .values(reminder_sent=True)
        )
        await self.session.execute(stmt)
        await self.session.commit()

    async def update_traffic_lights(self) -> int:
        """Обновить светофоры для всех активных поручений.

        Логика:
        - GREEN: дедлайн > 2 дней
        - YELLOW: дедлайн <= 2 дней
        - RED: дедлайн просрочен

        Returns:
            Количество обновлённых записей.
        """
        today = date.today()
        from datetime import timedelta

        threshold = today + timedelta(days=2)
        updated = 0

        stmt = select(MeetingActionItem).where(
            MeetingActionItem.status.in_([
                ActionItemStatus.PENDING,
                ActionItemStatus.IN_PROGRESS,
            ]),
            MeetingActionItem.deadline.isnot(None),
        )
        result = await self.session.execute(stmt)
        items = result.scalars().all()

        for item in items:
            if item.deadline < today:
                new_light = TrafficLightStatus.RED
                new_status = ActionItemStatus.OVERDUE
            elif item.deadline <= threshold:
                new_light = TrafficLightStatus.YELLOW
                new_status = item.status
            else:
                new_light = TrafficLightStatus.GREEN
                new_status = item.status

            if item.traffic_light != new_light or item.status != new_status:
                item.traffic_light = new_light
                item.status = new_status
                updated += 1

        if updated:
            await self.session.commit()
            logger.info("Светофоры обновлены", updated_count=updated)

        return updated

    # --- MeetingToneAnalysis ---

    async def save_tone_analysis(
        self,
        protocol_id: int,
        overall_score: float,
        is_compliant: bool,
        violations: list | None = None,
        recommendations: list | None = None,
        speaker_scores: dict | None = None,
        positive_aspects: list | None = None,
    ) -> MeetingToneAnalysis:
        """Сохранить результат анализа тональности.

        Args:
            protocol_id: идентификатор протокола.
            overall_score: общая оценка (0–10).
            is_compliant: соответствие корпкультуре.
            violations: список нарушений.
            recommendations: рекомендации.
            speaker_scores: оценки по спикерам.
            positive_aspects: позитивные аспекты.

        Returns:
            Созданный MeetingToneAnalysis.
        """
        analysis = MeetingToneAnalysis(
            protocol_id=protocol_id,
            overall_score=overall_score,
            is_compliant=is_compliant,
            violations=violations or [],
            recommendations=recommendations or [],
            speaker_scores=speaker_scores,
            positive_aspects=positive_aspects or [],
        )
        self.session.add(analysis)
        await self.session.commit()
        await self.session.refresh(analysis)
        logger.info(
            "Анализ тональности сохранён",
            protocol_id=protocol_id,
            score=overall_score,
        )
        return analysis
