"""Конфигурация проекта СНАРК-бот.

Все настройки загружаются из переменных окружения (.env файл).
"""

from __future__ import annotations

from enum import Enum
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent


class STTProvider(str, Enum):
    """Провайдер распознавания речи."""

    FASTER_WHISPER = "faster_whisper"
    YANDEX_SPEECHKIT = "yandex_speechkit"


class LLMProvider(str, Enum):
    """Провайдер большой языковой модели."""

    YANDEX_GPT = "yandex_gpt"
    GIGACHAT = "gigachat"
    NVIDIA_NIM = "nvidia_nim"
    FAKE = "fake"


class EmbeddingProvider(str, Enum):
    """Провайдер эмбеддингов ассистента."""

    E5 = "e5"
    FAKE = "fake"


class RagStorage(str, Enum):
    """Откуда ассистент берёт файлы документов."""

    S3 = "s3"
    LOCAL = "local"


class Settings(BaseSettings):
    """Главный класс настроек проекта.

    Загружает все переменные окружения и предоставляет
    типизированный доступ к конфигурации.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- База данных ---
    database_url: str = Field(
        default="postgresql+asyncpg://user:password@localhost:5432/snark_bot",
    )

    # --- Redis / Celery ---
    redis_url: str = Field(default="redis://localhost:6379/0")
    celery_broker_url: str = Field(default="redis://localhost:6379/1")
    celery_result_backend: str = Field(default="redis://localhost:6379/2")

    # --- Telegram ---
    telegram_bot_token: str = Field(default="")

    # --- STT ---
    stt_provider: STTProvider = Field(default=STTProvider.FASTER_WHISPER)
    whisper_model_size: str = Field(default="large-v3")
    yandex_speechkit_api_key: str = Field(default="")
    yandex_speechkit_folder_id: str = Field(default="")

    # --- Diarization ---
    hf_token: str = Field(default="")

    # --- LLM ---
    llm_provider: LLMProvider = Field(default=LLMProvider.YANDEX_GPT)
    yandex_gpt_api_key: str = Field(default="")
    yandex_gpt_folder_id: str = Field(default="")
    yandex_gpt_model_name: str = Field(
        default="yandexgpt-lite",
        description=(
            "Имя модели в URI gpt://<folder>/<name>/latest "
            "(yandexgpt-lite, yandexgpt, ...)."
        ),
    )
    gigachat_credentials: str = Field(default="")
    gigachat_scope: str = Field(default="GIGACHAT_API_PERS")

    # --- NVIDIA NIM (build.nvidia.com, OpenAI-совместимый /v1/chat/completions) ---
    nvidia_api_key: str = Field(default="", description="API key с build.nvidia.com")
    nvidia_api_base_url: str = Field(
        default="https://integrate.api.nvidia.com/v1",
        description="База OpenAI-совместимого API без завершающего слэша.",
    )
    nvidia_chat_model: str = Field(
        default="google/gemma-4-31b-it",
        description="Имя модели в теле chat/completions.",
    )

    # --- 1С ---
    onec_base_url: str = Field(
        default="http://localhost/zup/odata/standard.odata",
    )
    onec_username: str = Field(default="admin")
    onec_password: str = Field(default="")

    # --- Портал SNARK (задачи из поручений) ---
    portal_internal_url: str = Field(
        default="http://localhost:3000",
        description="Базовый URL портала без завершающего слэша.",
    )
    internal_token: str = Field(
        default="",
        description="Shared-secret X-Internal-Token для sync с порталом.",
    )

    # --- Ассистент по базе знаний (RAG) ---
    rag_database_url: str = Field(
        default="",
        description=(
            "База портала под ролью snark_rag (SELECT на public.*, полный доступ к rag.*). "
            "Формат postgresql+asyncpg://..."
        ),
    )
    embedding_provider: EmbeddingProvider = Field(default=EmbeddingProvider.E5)
    embedding_model_name: str = Field(default="intfloat/multilingual-e5-large")
    embedding_model_path: str = Field(
        default="",
        description="Локальный каталог модели (закрытый контур без доступа к HuggingFace).",
    )
    embedding_batch_size: int = Field(default=16)
    rag_chunk_max_tokens: int = Field(default=450)
    rag_chunk_overlap_tokens: int = Field(default=64)
    rag_top_k: int = Field(default=6)
    rag_min_score: float = Field(
        default=0.80,
        description="Порог косинусной близости: ниже — ответ no_info без вызова LLM.",
    )
    rag_storage: RagStorage = Field(default=RagStorage.S3)
    rag_local_storage_dir: Path = Field(default=BASE_DIR / "storage")
    s3_endpoint: str = Field(default="http://localhost:9000")
    s3_region: str = Field(default="ru-central-1")
    s3_bucket: str = Field(default="snark-portal")
    s3_access_key_id: str = Field(default="")
    s3_secret_access_key: str = Field(default="")

    # --- Безопасность ---
    encryption_key: str = Field(default="")
    secret_key: str = Field(default="")

    # --- Пути ---
    static_dir: Path = Field(default=BASE_DIR / "src" / "static")
    meetings_dir: Path = Field(default=BASE_DIR / "src" / "static" / "meetings")


settings = Settings()
