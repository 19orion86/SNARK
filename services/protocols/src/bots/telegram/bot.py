"""Точка входа Telegram-бота (Aiogram 3.x)."""

from __future__ import annotations

import asyncio
import ssl

import structlog
from aiogram import Bot, Dispatcher
from aiogram.client.session.aiohttp import AiohttpSession
from aiogram.utils.token import TokenValidationError, validate_token

from src.bots.telegram.handlers.protocols import protocol_router
from src.core.config import settings

logger = structlog.get_logger(__name__)


async def start_bot() -> None:
    """Запустить polling Telegram-бота."""
    token = settings.telegram_bot_token.strip()
    if not token or token == "your-telegram-bot-token":
        raise ValueError("TELEGRAM_BOT_TOKEN не задан в .env")
    try:
        validate_token(token)
    except TokenValidationError as exc:
        raise ValueError(
            "TELEGRAM_BOT_TOKEN имеет неверный формат. "
            "Проверьте, что токен вставлен полностью и файл .env сохранен."
        ) from exc

    # SSL: отключаем проверку сертификатов для разработки
    # (Windows не доверяет корневому CA api.telegram.org через прокси/антивирус)
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE

    session = AiohttpSession()
    session._connector_init["ssl"] = ssl_context

    bot = Bot(token=token, session=session)
    dp = Dispatcher()
    dp.include_router(protocol_router)

    logger.info("Запуск Telegram-бота")
    try:
        await dp.start_polling(bot)
    finally:
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(start_bot())
