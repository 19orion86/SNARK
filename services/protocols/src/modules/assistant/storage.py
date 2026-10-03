"""Доступ к файлам документов портала по `documents.file_path` (ключ объекта)."""

from __future__ import annotations

from pathlib import Path
from typing import Protocol

from src.core.config import RagStorage, settings


class DocumentStorage(Protocol):
    def read(self, key: str) -> bytes: ...


class S3DocumentStorage:
    """MinIO / S3 портала (тот же бакет, что использует Next.js)."""

    def __init__(self) -> None:
        import boto3
        from botocore.config import Config

        self._bucket = settings.s3_bucket
        self._client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint,
            region_name=settings.s3_region,
            aws_access_key_id=settings.s3_access_key_id,
            aws_secret_access_key=settings.s3_secret_access_key,
            config=Config(s3={"addressing_style": "path"}),
        )

    def read(self, key: str) -> bytes:
        response = self._client.get_object(Bucket=self._bucket, Key=key)
        return response["Body"].read()


class LocalDocumentStorage:
    """Локальный каталог: dev без MinIO и тесты. Ключ — путь относительно каталога."""

    def __init__(self, root: Path | None = None) -> None:
        self._root = Path(root or settings.rag_local_storage_dir).resolve()

    def read(self, key: str) -> bytes:
        path = (self._root / key).resolve()
        if not path.is_relative_to(self._root):
            raise ValueError("Ключ файла выходит за пределы каталога хранилища")
        return path.read_bytes()


def get_storage() -> DocumentStorage:
    if settings.rag_storage == RagStorage.LOCAL:
        return LocalDocumentStorage()
    return S3DocumentStorage()
