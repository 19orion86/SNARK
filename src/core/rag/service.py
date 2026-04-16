"""RAG-сервис — LangChain + ChromaDB для работы с корпоративной базой знаний.

Предоставляет:
- Генерацию ответов по корпоративным документам (RAG)
- Структурированный output через Pydantic-модели
- Поддержку YandexGPT, GigaChat и NVIDIA NIM (HTTP API)
"""

from __future__ import annotations

import threading
import time
import uuid
from typing import Any, TypeVar

import httpx
import structlog
from pydantic import BaseModel

from src.core.config import LLMProvider, settings

logger = structlog.get_logger(__name__)

T = TypeVar("T", bound=BaseModel)

_YANDEX_COMPLETION_URL = (
    "https://llm.api.cloud.yandex.net/foundationModels/v1/completion"
)
_GIGACHAT_OAUTH_URL = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth"
_GIGACHAT_CHAT_URL = "https://gigachat.devices.sberbank.ru/api/v1/chat/completions"

_gigachat_lock = threading.Lock()
_gigachat_token: str | None = None
_gigachat_token_deadline: float = 0.0


def _merge_prompt_with_context(prompt: str, context: str | None) -> str:
    if not context:
        return prompt
    return f"Контекст:\n{context}\n\nЗапрос:\n{prompt}"


def _strip_json_fences(raw: str) -> str:
    text = raw.strip()
    if not text.startswith("```"):
        return text
    lines = text.splitlines()
    if lines and lines[0].startswith("```"):
        lines = lines[1:]
    if lines and lines[-1].strip() == "```":
        lines = lines[:-1]
    return "\n".join(lines).strip()


class RAGService:
    """Сервис Retrieval-Augmented Generation.

    Использует LangChain для генерации ответов на основе
    корпоративной базы знаний (ChromaDB) с поддержкой
    структурированного вывода через Pydantic-схемы.

    Attributes:
        provider: провайдер LLM (yandex_gpt, gigachat, nvidia_nim).
    """

    def __init__(self) -> None:
        self.provider = settings.llm_provider
        logger.info("RAGService инициализирован", provider=self.provider.value)

    async def generate(
        self,
        prompt: str,
        context: str | None = None,
    ) -> str:
        """Генерировать текстовый ответ через LLM.

        Args:
            prompt: текст промпта.
            context: дополнительный контекст из базы знаний.

        Returns:
            Сгенерированный текст.
        """
        logger.info("Генерация текста", provider=self.provider.value)

        if self.provider == LLMProvider.YANDEX_GPT:
            return await self._generate_yandex(prompt, context)
        if self.provider == LLMProvider.GIGACHAT:
            return await self._generate_gigachat(prompt, context)
        if self.provider == LLMProvider.NVIDIA_NIM:
            return await self._generate_nvidia_nim(prompt, context)
        raise ValueError(f"Неизвестный LLM-провайдер: {self.provider}")

    async def generate_structured(
        self,
        prompt: str,
        output_schema: type[T],
        context: str | None = None,
    ) -> T:
        """Генерировать структурированный ответ через LLM.

        Использует Pydantic-схему для валидации и парсинга
        ответа от LLM. LLM получает JSON-schema из output_schema
        и возвращает валидный JSON.

        Args:
            prompt: текст промпта (должен содержать инструкцию
                    вернуть JSON по заданной схеме).
            output_schema: Pydantic-модель для парсинга ответа.
            context: дополнительный контекст из базы знаний.

        Returns:
            Экземпляр output_schema с данными из LLM.
        """
        logger.info(
            "Генерация структурированного ответа",
            schema=output_schema.__name__,
            provider=self.provider.value,
        )
        json_schema = output_schema.model_json_schema()
        full_prompt = (
            f"{prompt}\n\n"
            f"Верни ответ строго в формате JSON по следующей схеме:\n"
            f"{json_schema}"
        )
        raw = await self.generate(full_prompt, context)
        cleaned = _strip_json_fences(raw)
        return output_schema.model_validate_json(cleaned)

    async def search_knowledge_base(
        self,
        query: str,
        top_k: int = 5,
    ) -> list[dict[str, Any]]:
        """Поиск по корпоративной базе знаний (ChromaDB).

        Args:
            query: поисковый запрос.
            top_k: количество результатов.

        Returns:
            Список документов с метаданными.
        """
        # TODO: реализовать подключение к ChromaDB
        logger.info("Поиск в базе знаний", query=query[:50], top_k=top_k)
        return []

    async def _generate_yandex(
        self,
        prompt: str,
        context: str | None,
    ) -> str:
        """Генерация через YandexGPT API (Foundation Models completion)."""
        if not settings.yandex_gpt_api_key.strip():
            raise ValueError("Задайте YANDEX_GPT_API_KEY в .env")
        if not settings.yandex_gpt_folder_id.strip():
            raise ValueError("Задайте YANDEX_GPT_FOLDER_ID в .env")

        folder = settings.yandex_gpt_folder_id.strip()
        model_name = settings.yandex_gpt_model_name.strip() or "yandexgpt-lite"
        model_uri = f"gpt://{folder}/{model_name}/latest"
        user_text = _merge_prompt_with_context(prompt, context)

        payload: dict[str, Any] = {
            "modelUri": model_uri,
            "completionOptions": {
                "stream": False,
                "temperature": 0.3,
                "maxTokens": "8000",
            },
            "messages": [
                {"role": "user", "text": user_text},
            ],
        }

        headers = {
            "Authorization": f"Api-Key {settings.yandex_gpt_api_key.strip()}",
            "Content-Type": "application/json",
            "x-folder-id": folder,
        }

        logger.info("Вызов YandexGPT", model_uri=model_uri)

        async with httpx.AsyncClient(timeout=httpx.Timeout(120.0)) as client:
            resp = await client.post(
                _YANDEX_COMPLETION_URL,
                headers=headers,
                json=payload,
            )

        if resp.status_code >= 400:
            logger.error(
                "YandexGPT HTTP ошибка",
                status=resp.status_code,
                body=resp.text[:2000],
            )
            resp.raise_for_status()

        data = resp.json()
        try:
            return str(data["result"]["alternatives"][0]["message"]["text"])
        except (KeyError, IndexError, TypeError) as exc:
            logger.error("Неожиданный ответ YandexGPT", data=data)
            raise RuntimeError("Неожиданная структура ответа YandexGPT") from exc

    async def _gigachat_access_token(self) -> str:
        creds = settings.gigachat_credentials.strip()
        if not creds:
            raise ValueError("Задайте GIGACHAT_CREDENTIALS в .env (ключ авторизации)")

        global _gigachat_token, _gigachat_token_deadline
        global _gigachat_token, _gigachat_token_deadline

        now = time.monotonic()
        with _gigachat_lock:
            if _gigachat_token and now < _gigachat_token_deadline - 30:
                return _gigachat_token

            rq_uid = str(uuid.uuid4())
            headers = {
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json",
                "RqUID": rq_uid,
                "Authorization": f"Basic {creds}",
            }
            async with httpx.AsyncClient(timeout=httpx.Timeout(60.0), verify=False) as client:
                resp = await client.post(
                    _GIGACHAT_OAUTH_URL,
                    headers=headers,
                    data={
                        "scope": settings.gigachat_scope.strip() or "GIGACHAT_API_PERS",
                    },
                )

            if resp.status_code >= 400:
                logger.error(
                    "GigaChat OAuth ошибка",
                    status=resp.status_code,
                    body=resp.text[:2000],
                )
                resp.raise_for_status()

            token_data = resp.json()
            token = token_data.get("access_token")
            if not token or not isinstance(token, str):
                raise RuntimeError("GigaChat OAuth: нет access_token в ответе")

            expires_raw = token_data.get("expires_at")
            if isinstance(expires_raw, (int, float)):
                deadline_wall = float(expires_raw) / 1000.0 if expires_raw > 1e12 else float(expires_raw)
                ttl = max(60.0, deadline_wall - time.time())
            else:
                ttl = float(token_data.get("expires_in", 1800))

            _gigachat_token = token
            _gigachat_token_deadline = time.monotonic() + ttl
            return token

    async def _generate_gigachat(
        self,
        prompt: str,
        context: str | None,
    ) -> str:
        """Генерация через GigaChat API (chat completions)."""
        token = await self._gigachat_access_token()
        user_text = _merge_prompt_with_context(prompt, context)

        payload = {
            "model": "GigaChat",
            "messages": [{"role": "user", "content": user_text}],
            "temperature": 0.3,
        }

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

        logger.info("Вызов GigaChat")

        async with httpx.AsyncClient(timeout=httpx.Timeout(120.0), verify=False) as client:
            resp = await client.post(
                _GIGACHAT_CHAT_URL,
                headers=headers,
                json=payload,
            )

        if resp.status_code >= 400:
            logger.error(
                "GigaChat HTTP ошибка",
                status=resp.status_code,
                body=resp.text[:2000],
            )
            resp.raise_for_status()

        data = resp.json()
        try:
            return str(data["choices"][0]["message"]["content"])
        except (KeyError, IndexError, TypeError) as exc:
            logger.error("Неожиданный ответ GigaChat", data=data)
            raise RuntimeError("Неожиданная структура ответа GigaChat") from exc

    async def _generate_nvidia_nim(
        self,
        prompt: str,
        context: str | None,
    ) -> str:
        """Генерация через NVIDIA NIM (OpenAI-совместимый chat/completions).

        Ключ и модели: https://build.nvidia.com/ (например google/gemma-4-31b-it).
        """
        key = settings.nvidia_api_key.strip()
        if not key:
            raise ValueError("Задайте NVIDIA_API_KEY в .env (ключ с build.nvidia.com)")

        base = settings.nvidia_api_base_url.strip().rstrip("/")
        url = f"{base}/chat/completions"
        model = settings.nvidia_chat_model.strip() or "google/gemma-4-31b-it"
        user_text = _merge_prompt_with_context(prompt, context)

        payload: dict[str, Any] = {
            "model": model,
            "messages": [{"role": "user", "content": user_text}],
            "temperature": 0.3,
            "max_tokens": 8192,
        }

        headers = {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }

        logger.info("Вызов NVIDIA NIM", url=url, model=model)

        async with httpx.AsyncClient(timeout=httpx.Timeout(180.0)) as client:
            resp = await client.post(url, headers=headers, json=payload)

        if resp.status_code >= 400:
            logger.error(
                "NVIDIA NIM HTTP ошибка",
                status=resp.status_code,
                body=resp.text[:2000],
            )
            resp.raise_for_status()

        data = resp.json()
        try:
            return str(data["choices"][0]["message"]["content"])
        except (KeyError, IndexError, TypeError) as exc:
            logger.error("Неожиданный ответ NVIDIA NIM", data=data)
            raise RuntimeError("Неожиданная структура ответа NVIDIA NIM") from exc
