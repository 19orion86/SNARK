"""Эмбеддинги ассистента: локальная multilingual-e5 и fake-провайдер для тестов.

Префиксы `query: ` / `passage: ` добавляет вызывающий код (chunker, service):
эмбеддер кодирует строку как есть.
"""

from __future__ import annotations

import hashlib
import math
import re
import threading
from typing import Protocol

import structlog

from src.core.config import EmbeddingProvider, settings
from src.modules.assistant.models import EMBEDDING_DIM

logger = structlog.get_logger(__name__)

E5_MAX_INPUT_TOKENS = 512


class Embedder(Protocol):
    """Интерфейс эмбеддера."""

    model_name: str

    def encode(self, texts: list[str]) -> list[list[float]]: ...

    def count_tokens(self, text: str) -> int: ...


class E5Embedder:
    """multilingual-e5 через sentence-transformers (CPU). Модель грузится один раз на процесс."""

    def __init__(self) -> None:
        from sentence_transformers import SentenceTransformer

        source = settings.embedding_model_path.strip() or settings.embedding_model_name
        logger.info("Загрузка модели эмбеддингов", model=source)
        self._model = SentenceTransformer(source, device="cpu")
        self._model.max_seq_length = E5_MAX_INPUT_TOKENS
        self._tokenizer = self._model.tokenizer
        self.model_name = settings.embedding_model_name

        get_dim = getattr(self._model, "get_embedding_dimension", None) or (
            self._model.get_sentence_embedding_dimension
        )
        dim = get_dim()
        if dim != EMBEDDING_DIM:
            raise RuntimeError(
                f"Модель {source} даёт {dim} измерений, а колонка rag.chunks.embedding — "
                f"vector({EMBEDDING_DIM})"
            )

    def encode(self, texts: list[str]) -> list[list[float]]:
        vectors = self._model.encode(
            texts,
            batch_size=settings.embedding_batch_size,
            normalize_embeddings=True,
            show_progress_bar=False,
        )
        return [vector.tolist() for vector in vectors]

    def count_tokens(self, text: str) -> int:
        # Со служебными токенами <s> и </s>: именно столько попадёт в окно модели.
        return len(self._tokenizer.encode(text, add_special_tokens=True, truncation=False))


_WORD = re.compile(r"[0-9a-zа-яё]+", re.IGNORECASE)


class FakeEmbedder:
    """Детерминированный «мешок слов» в 1024 измерениях. Только для тестов и CI.

    Тексты с общими словами получают близкие векторы, поэтому на нём можно
    проверять конвейер и SQL поиска без скачивания модели. О качестве настоящего
    поиска он ничего не говорит.
    """

    model_name = "fake-bag-of-words"

    def encode(self, texts: list[str]) -> list[list[float]]:
        return [self._encode_one(text) for text in texts]

    def _encode_one(self, text: str) -> list[float]:
        vector = [0.0] * EMBEDDING_DIM
        body = text.split(": ", 1)[1] if text.startswith(("query: ", "passage: ")) else text
        for word in _WORD.findall(body.lower()):
            stem = word[:5]
            digest = hashlib.sha256(stem.encode()).digest()
            vector[int.from_bytes(digest[:4], "big") % EMBEDDING_DIM] += 1.0
        norm = math.sqrt(sum(value * value for value in vector))
        if norm == 0:
            vector[0] = 1.0
            return vector
        return [value / norm for value in vector]

    def count_tokens(self, text: str) -> int:
        # Грубая верхняя оценка: слово ≈ 2 токена SentencePiece для русского текста.
        return 2 + 2 * len(text.split())


_lock = threading.Lock()
_embedder: Embedder | None = None


def get_embedder() -> Embedder:
    """Singleton эмбеддера на процесс."""
    global _embedder
    if _embedder is None:
        with _lock:
            if _embedder is None:
                if settings.embedding_provider == EmbeddingProvider.FAKE:
                    _embedder = FakeEmbedder()
                else:
                    _embedder = E5Embedder()
    return _embedder


def reset_embedder() -> None:
    """Сбросить singleton (тесты)."""
    global _embedder
    _embedder = None


def to_pgvector(vector: list[float]) -> str:
    """Литерал pgvector: '[0.1,0.2,...]'."""
    return "[" + ",".join(f"{value:.7f}" for value in vector) + "]"
