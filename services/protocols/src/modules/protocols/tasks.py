"""Celery-задачи для модуля протоколов совещаний.

Содержит долгие задачи обработки аудио, которые выполняются
асинхронно через Celery worker:
- process_meeting_audio — основной пайплайн (STT + LLM)
- send_protocol_notification — отправка протокола в Telegram
- check_overdue_action_items — проверка просроченных поручений
- update_traffic_lights — обновление светофоров
"""

from __future__ import annotations

import asyncio

import structlog
from celery import shared_task

from src.core.celery_app import celery_app
from src.core.database import async_session_maker

logger = structlog.get_logger(__name__)


def _run_async(coro):  # type: ignore[no-untyped-def]
    """Запустить async-корутину из синхронного контекста Celery.

    Создаёт новый event loop если его нет, иначе использует
    существующий через asyncio.run().
    """
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as pool:
            future = pool.submit(asyncio.run, coro)
            return future.result()
    else:
        return asyncio.run(coro)


@celery_app.task(
    bind=True,
    name="protocols.process_meeting_audio",
    max_retries=2,
    default_retry_delay=60,
    soft_time_limit=600,
    time_limit=900,
)
def process_meeting_audio(
    self,  # type: ignore[no-untyped-def]
    protocol_id: int,
    encrypted_file_path: str,
) -> dict:
    """Обработать аудиозапись совещания (основная Celery-задача).

    Выполняет полный пайплайн: STT → диаризация → LLM → сохранение.
    После завершения отправляет уведомление в Telegram.

    Args:
        protocol_id: идентификатор протокола в БД.
        encrypted_file_path: путь к зашифрованному аудиофайлу.

    Returns:
        Словарь с результатом обработки.
    """
    logger.info(
        "Celery: начало обработки аудио",
        protocol_id=protocol_id,
        task_id=self.request.id,
    )

    async def _process() -> dict:
        async with async_session_maker() as session:
            from src.modules.protocols.service import ProtocolService

            service = ProtocolService(session)
            await service.process_audio(protocol_id, encrypted_file_path)

        return {
            "protocol_id": protocol_id,
            "status": "completed",
        }

    try:
        result = _run_async(_process())
        send_protocol_notification.delay(protocol_id)
        logger.info(
            "Celery: обработка аудио завершена",
            protocol_id=protocol_id,
        )
        return result
    except Exception as exc:
        logger.error(
            "Celery: ошибка обработки аудио",
            protocol_id=protocol_id,
            error=str(exc),
            exc_info=True,
        )
        raise self.retry(exc=exc)


@celery_app.task(
    name="protocols.send_protocol_notification",
    max_retries=3,
    default_retry_delay=30,
)
def send_protocol_notification(protocol_id: int) -> dict:
    """Отправить готовый протокол пользователю в Telegram.

    Загружает протокол из БД и отправляет форматированное
    сообщение через Telegram Bot API.

    Args:
        protocol_id: идентификатор протокола.

    Returns:
        Словарь с результатом отправки.
    """
    logger.info(
        "Celery: отправка уведомления о протоколе",
        protocol_id=protocol_id,
    )

    async def _send() -> dict:
        async with async_session_maker() as session:
            from src.modules.protocols.repository import ProtocolRepository

            repo = ProtocolRepository(session)
            protocol = await repo.get_protocol_by_id(protocol_id)

            if not protocol:
                logger.warning(
                    "Протокол не найден для уведомления",
                    protocol_id=protocol_id,
                )
                return {"status": "not_found"}

            if not protocol.uploaded_by_telegram_id:
                logger.info(
                    "Нет Telegram ID для уведомления",
                    protocol_id=protocol_id,
                )
                return {"status": "no_telegram_id"}

            from aiogram import Bot
            from src.core.config import settings

            bot = Bot(token=settings.telegram_bot_token)

            message_text = _format_notification(protocol)

            try:
                await bot.send_message(
                    chat_id=protocol.uploaded_by_telegram_id,
                    text=message_text,
                    parse_mode="HTML",
                )
                logger.info(
                    "Уведомление отправлено",
                    protocol_id=protocol_id,
                    telegram_id=protocol.uploaded_by_telegram_id,
                )
                return {"status": "sent"}
            finally:
                await bot.session.close()

    return _run_async(_send())


def _format_notification(protocol) -> str:  # type: ignore[no-untyped-def]
    """Отформатировать уведомление о готовом протоколе для Telegram.

    Args:
        protocol: объект MeetingProtocol.

    Returns:
        HTML-форматированный текст сообщения.
    """
    lines = [
        f"<b>Протокол совещания готов</b>",
        f"<b>{protocol.title}</b>",
        f"Дата: {protocol.meeting_date}",
        "",
    ]

    if protocol.agenda:
        lines.append("<b>Повестка:</b>")
        for i, item in enumerate(protocol.agenda, 1):
            lines.append(f"  {i}. {item}")
        lines.append("")

    if protocol.decisions:
        lines.append("<b>Решения:</b>")
        for i, decision in enumerate(protocol.decisions, 1):
            lines.append(f"  {i}. {decision}")
        lines.append("")

    if protocol.action_items:
        lines.append(f"<b>Поручения ({len(protocol.action_items)}):</b>")
        for item in protocol.action_items:
            light = {"green": "\u2705", "yellow": "\u26a0\ufe0f", "red": "\u274c"}.get(
                item.traffic_light.value, ""
            )
            deadline_str = str(item.deadline) if item.deadline else "—"
            lines.append(
                f"  {light} {item.assignee}: {item.text} "
                f"(до {deadline_str})"
            )
        lines.append("")

    if protocol.tone_analysis:
        score = protocol.tone_analysis.overall_score
        compliant = "\u2705" if protocol.tone_analysis.is_compliant else "\u274c"
        lines.append(
            f"<b>Тональность:</b> {score}/10 {compliant}"
        )

    return "\n".join(lines)


@celery_app.task(name="protocols.check_overdue_action_items")
def check_overdue_action_items() -> dict:
    """Проверить просроченные поручения и обновить статусы.

    Запускается по расписанию (Celery Beat). Находит поручения
    с истёкшим дедлайном и отправляет напоминания.

    Returns:
        Статистика обработки.
    """
    logger.info("Celery: проверка просроченных поручений")

    async def _check() -> dict:
        async with async_session_maker() as session:
            from src.modules.protocols.repository import ProtocolRepository

            repo = ProtocolRepository(session)

            updated = await repo.update_traffic_lights()

            reminders = await repo.get_pending_reminders()
            sent = 0
            for item in reminders:
                if (
                    item.protocol
                    and item.protocol.uploaded_by_telegram_id
                ):
                    _send_reminder.delay(
                        item.id,
                        item.protocol.uploaded_by_telegram_id,
                        item.text,
                        item.assignee,
                        str(item.deadline) if item.deadline else "—",
                    )
                    await repo.mark_reminder_sent(item.id)
                    sent += 1

            return {
                "traffic_lights_updated": updated,
                "reminders_sent": sent,
            }

    return _run_async(_check())


@celery_app.task(name="protocols.send_reminder")
def _send_reminder(
    item_id: int,
    telegram_id: int,
    task_text: str,
    assignee: str,
    deadline: str,
) -> dict:
    """Отправить напоминание о приближающемся дедлайне.

    Args:
        item_id: ID поручения.
        telegram_id: Telegram ID получателя.
        task_text: текст поручения.
        assignee: ответственный.
        deadline: дедлайн.

    Returns:
        Результат отправки.
    """

    async def _send() -> dict:
        from aiogram import Bot
        from src.core.config import settings

        bot = Bot(token=settings.telegram_bot_token)
        text = (
            f"\u26a0\ufe0f <b>Напоминание о поручении</b>\n\n"
            f"<b>Задача:</b> {task_text}\n"
            f"<b>Ответственный:</b> {assignee}\n"
            f"<b>Срок:</b> {deadline}\n\n"
            f"Пожалуйста, проверьте статус выполнения."
        )
        try:
            await bot.send_message(
                chat_id=telegram_id,
                text=text,
                parse_mode="HTML",
            )
            return {"status": "sent", "item_id": item_id}
        finally:
            await bot.session.close()

    return _run_async(_send())
