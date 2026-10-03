"""Проверка shared-secret `X-Internal-Token` для вызовов портал ↔ сервис.

Правило fail-closed: если `INTERNAL_TOKEN` не настроен, внутренний маршрут
отвечает 401, а не пропускает запрос без проверки.
"""

from __future__ import annotations

import hmac

from fastapi import Header, HTTPException, status

from src.core.config import settings

INTERNAL_TOKEN_HEADER = "X-Internal-Token"


def is_valid_internal_token(provided: str | None) -> bool:
    """Сравнить токен из заголовка с настроенным (за постоянное время)."""
    expected = (settings.internal_token or "").strip()
    candidate = (provided or "").strip()
    if not expected or not candidate:
        return False
    return hmac.compare_digest(candidate.encode(), expected.encode())


async def require_internal_token(
    x_internal_token: str | None = Header(default=None, alias=INTERNAL_TOKEN_HEADER),
) -> None:
    """FastAPI dependency: пропускает только запросы с верным X-Internal-Token."""
    if not is_valid_internal_token(x_internal_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный внутренний токен",
        )
