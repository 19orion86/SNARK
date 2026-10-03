"""Проверка боевого эмбеддера multilingual-e5-large без БД.

    python scripts/e5_smoke.py

Первый запуск скачивает модель (~2,2 ГБ) с HuggingFace или берёт её из
EMBEDDING_MODEL_PATH. Печатает размерность, время загрузки и кодирования,
число токенов и близость «вопрос ↔ фрагмент» — чтобы оценить диапазон значений
для порога RAG_MIN_SCORE. Тексты синтетические; порог подбирается на eval-датасете.
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.modules.assistant.chunker import PASSAGE_PREFIX, QUERY_PREFIX  # noqa: E402
from src.modules.assistant.embeddings import E5Embedder  # noqa: E402

PASSAGES = [
    "Документ: Регламент адаптации. Раздел: 2. Испытательный срок.\n"
    "Испытательный срок для специалистов составляет три месяца. За две недели до окончания "
    "руководитель заполняет лист оценки.",
    "Документ: Положение о наставничестве. Раздел: 1. Назначение наставника.\n"
    "Наставник назначается приказом в первый рабочий день нового сотрудника.",
    "Документ: Положение об обучении. Раздел: 3. Оплата курсов.\n"
    "Компания оплачивает профильные курсы после согласования с руководителем отдела.",
]
QUERIES = [
    "Сколько длится испытательный срок?",
    "Кто назначает наставника новичку?",
    "Какая погода будет завтра в Казани?",
    "Как приготовить борщ?",
]


def dot(left: list[float], right: list[float]) -> float:
    return sum(a * b for a, b in zip(left, right, strict=True))


def main() -> None:
    started = time.perf_counter()
    embedder = E5Embedder()
    print(f"модель загружена за {time.perf_counter() - started:.1f} с")

    started = time.perf_counter()
    passages = embedder.encode([PASSAGE_PREFIX + text for text in PASSAGES])
    print(
        f"{len(PASSAGES)} фрагмента: {time.perf_counter() - started:.2f} с, dim={len(passages[0])}"
    )
    for text in PASSAGES:
        print(f"  токенов: {embedder.count_tokens(PASSAGE_PREFIX + text)}")

    for query in QUERIES:
        started = time.perf_counter()
        vector = embedder.encode([QUERY_PREFIX + query])[0]
        elapsed = time.perf_counter() - started
        scores = [dot(vector, passage) for passage in passages]
        best = max(range(len(scores)), key=scores.__getitem__)
        print(
            f"{elapsed:.2f} с | {query!r}: "
            + ", ".join(f"{score:.3f}" for score in scores)
            + f" → фрагмент {best + 1}"
        )


if __name__ == "__main__":
    main()
