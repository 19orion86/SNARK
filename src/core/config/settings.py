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
        description="Имя модели в URI gpt://<folder>/<name>/latest (yandexgpt-lite, yandexgpt, ...).",
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

    # --- Безопасность ---
    encryption_key: str = Field(default="")
    secret_key: str = Field(default="")

    # --- Пути ---
    static_dir: Path = Field(default=BASE_DIR / "src" / "static")
    meetings_dir: Path = Field(default=BASE_DIR / "src" / "static" / "meetings")


settings = Settings()
