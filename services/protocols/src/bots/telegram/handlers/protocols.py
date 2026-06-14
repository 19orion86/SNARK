"""Re-export Aiogram router из модуля протоколов.

Этот файл обеспечивает соответствие структуре проекта,
где все Telegram handlers находятся в bots/telegram/handlers/.
Основная логика — в modules/protocols/handlers.py.
"""

from __future__ import annotations

from src.modules.protocols.handlers import protocol_router

__all__ = ["protocol_router"]
