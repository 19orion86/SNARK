"""Модуль безопасности — шифрование данных и контроль доступа (ФЗ-152).

Предоставляет:
- SecurityContext — контекст безопасности текущего пользователя
- PermissionDependency — FastAPI dependency для проверки прав
- encrypt_data / decrypt_data — шифрование строковых данных (Fernet)
- encrypt_file / decrypt_file — шифрование файлов на диске
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import structlog
from cryptography.fernet import Fernet
from fastapi import Depends, HTTPException, status

from src.core.config import settings

logger = structlog.get_logger(__name__)


def _get_fernet() -> Fernet:
    """Возвращает Fernet-объект для шифрования/дешифрования."""
    if not settings.encryption_key:
        raise ValueError("ENCRYPTION_KEY не задан в переменных окружения")
    return Fernet(settings.encryption_key.encode())


def encrypt_data(data: str) -> str:
    """Зашифровать строковые данные (Fernet symmetric encryption).

    Args:
        data: исходная строка для шифрования.

    Returns:
        Зашифрованная строка в base64.
    """
    fernet = _get_fernet()
    return fernet.encrypt(data.encode()).decode()


def decrypt_data(encrypted: str) -> str:
    """Расшифровать строковые данные.

    Args:
        encrypted: зашифрованная строка в base64.

    Returns:
        Расшифрованная строка.
    """
    fernet = _get_fernet()
    return fernet.decrypt(encrypted.encode()).decode()


def encrypt_file(source_path: Path, dest_path: Path) -> Path:
    """Зашифровать файл и сохранить по указанному пути.

    Args:
        source_path: путь к исходному файлу.
        dest_path: путь для сохранения зашифрованного файла.

    Returns:
        Путь к зашифрованному файлу.
    """
    fernet = _get_fernet()
    data = source_path.read_bytes()
    encrypted = fernet.encrypt(data)
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    dest_path.write_bytes(encrypted)
    logger.info("Файл зашифрован", source=str(source_path), dest=str(dest_path))
    return dest_path


def decrypt_file(encrypted_path: Path, dest_path: Path) -> Path:
    """Расшифровать файл и сохранить по указанному пути.

    Args:
        encrypted_path: путь к зашифрованному файлу.
        dest_path: путь для сохранения расшифрованного файла.

    Returns:
        Путь к расшифрованному файлу.
    """
    fernet = _get_fernet()
    data = encrypted_path.read_bytes()
    decrypted = fernet.decrypt(data)
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    dest_path.write_bytes(decrypted)
    return dest_path


class SecurityContext:
    """Контекст безопасности текущего пользователя.

    Хранит информацию об аутентифицированном пользователе
    и его правах доступа для проверки на уровне бизнес-логики.

    Attributes:
        user_id: идентификатор пользователя.
        telegram_id: Telegram ID пользователя.
        roles: список ролей пользователя.
    """

    def __init__(
        self,
        user_id: int,
        telegram_id: int | None = None,
        roles: list[str] | None = None,
    ) -> None:
        self.user_id = user_id
        self.telegram_id = telegram_id
        self.roles = roles or []

    def has_role(self, role: str) -> bool:
        """Проверить наличие роли у пользователя.

        Args:
            role: название роли.

        Returns:
            True если роль есть, иначе False.
        """
        return role in self.roles

    def require_role(self, role: str) -> None:
        """Требовать наличие роли, иначе — исключение.

        Args:
            role: название требуемой роли.

        Raises:
            PermissionError: если роль отсутствует.
        """
        if not self.has_role(role):
            logger.warning(
                "Отказ в доступе",
                user_id=self.user_id,
                required_role=role,
            )
            raise PermissionError(
                f"Требуется роль '{role}' для выполнения операции"
            )


class PermissionDependency:
    """FastAPI dependency для проверки прав доступа.

    Использование:
        @router.post("/", dependencies=[Depends(PermissionDependency("admin"))])

    Args:
        required_role: роль, необходимая для доступа к эндпоинту.
    """

    def __init__(self, required_role: str) -> None:
        self.required_role = required_role

    async def __call__(self, **kwargs: Any) -> SecurityContext:
        """Проверить права доступа.

        Returns:
            SecurityContext текущего пользователя.

        Raises:
            HTTPException: 403 если нет нужной роли.
        """
        # TODO: извлекать SecurityContext из JWT-токена в заголовках
        context = SecurityContext(user_id=0, roles=[])
        if not context.has_role(self.required_role):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Недостаточно прав. Требуется роль: {self.required_role}",
            )
        return context
