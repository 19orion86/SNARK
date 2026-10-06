"""Нарезка разделов на чанки с учётом токенизатора модели эмбеддингов.

Правила:
- чанк не пересекает границу раздела;
- длина считается в токенах той же модели, которая строит эмбеддинг,
  вместе с префиксом `passage: ` и шапкой «Документ / Раздел»;
- соседние чанки одного раздела перекрываются целыми предложениями.
"""

from __future__ import annotations

import re
from collections.abc import Callable
from dataclasses import dataclass

from src.modules.assistant.docx_parser import Section

TokenCounter = Callable[[str], int]

PASSAGE_PREFIX = "passage: "
QUERY_PREFIX = "query: "

_SENTENCE_END = re.compile(r"(?<=[.!?…;])\s+")


@dataclass(frozen=True)
class ChunkDraft:
    """Чанк до записи в БД."""

    ordinal: int
    section_number: str
    section_title: str
    text: str
    embedding_input: str
    token_count: int


def chunk_header(document_title: str, section: Section) -> str:
    """Шапка чанка: по ней запрос находит раздел, даже если слов запроса нет в теле."""
    return f"Документ: {document_title}. Раздел: {section.label}."


def _split_units(block: str, budget: int, count: TokenCounter) -> list[str]:
    """Разбить блок на единицы не длиннее бюджета: предложения, затем слова."""
    if count(block) <= budget:
        return [block]
    units: list[str] = []
    for sentence in _SENTENCE_END.split(block):
        sentence = sentence.strip()
        if not sentence:
            continue
        if count(sentence) <= budget:
            units.append(sentence)
            continue
        current: list[str] = []
        for word in sentence.split():
            candidate = " ".join([*current, word])
            if current and count(candidate) > budget:
                units.append(" ".join(current))
                current = [word]
            else:
                current.append(word)
        if current:
            units.append(" ".join(current))
    return units


def chunk_sections(
    document_title: str,
    sections: list[Section],
    count: TokenCounter,
    max_tokens: int = 450,
    overlap_tokens: int = 64,
) -> list[ChunkDraft]:
    """Нарезать разделы на чанки.

    Args:
        document_title: название документа (попадает в шапку каждого чанка).
        sections: разделы из парсера.
        count: функция подсчёта токенов модели эмбеддингов.
        max_tokens: бюджет на вход модели, включая префикс и шапку.
        overlap_tokens: сколько токенов хвоста предыдущего чанка повторить в следующем.
    """
    chunks: list[ChunkDraft] = []

    for section in sections:
        header = chunk_header(document_title, section)
        budget = max_tokens - count(f"{PASSAGE_PREFIX}{header}\n")
        if budget < 32:
            raise ValueError(
                f"Шапка раздела «{section.label}» не оставляет места под текст "
                f"(max_tokens={max_tokens})"
            )

        units: list[str] = []
        for block in section.blocks:
            units.extend(_split_units(block, budget, count))

        current: list[str] = []
        for unit in units:
            candidate = "\n".join([*current, unit])
            if current and count(candidate) > budget:
                chunks.append(_make_chunk(len(chunks), section, header, current, count))
                current = _overlap_tail(current, overlap_tokens, budget, unit, count)
            current.append(unit)
        if current:
            chunks.append(_make_chunk(len(chunks), section, header, current, count))

    return chunks


def _overlap_tail(
    units: list[str], overlap_tokens: int, budget: int, next_unit: str, count: TokenCounter
) -> list[str]:
    """Хвост предыдущего чанка, который помещается в перекрытие и не вытесняет новый текст."""
    tail: list[str] = []
    for unit in reversed(units):
        candidate = [unit, *tail]
        if count("\n".join(candidate)) > overlap_tokens:
            break
        if count("\n".join([*candidate, next_unit])) > budget:
            break
        tail = candidate
    return tail


def _make_chunk(
    ordinal: int, section: Section, header: str, units: list[str], count: TokenCounter
) -> ChunkDraft:
    body = "\n".join(units)
    embedding_input = f"{PASSAGE_PREFIX}{header}\n{body}"
    return ChunkDraft(
        ordinal=ordinal,
        section_number=section.number,
        section_title=section.title,
        text=body,
        embedding_input=embedding_input,
        token_count=count(embedding_input),
    )
