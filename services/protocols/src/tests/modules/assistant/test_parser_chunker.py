"""Unit-тесты парсера docx и нарезки на чанки (синтетические docx, см. conftest)."""

from __future__ import annotations

from src.modules.assistant.chunker import PASSAGE_PREFIX, chunk_sections
from src.modules.assistant.docx_parser import (
    Section,
    parse_docx,
    parse_markdown,
    split_heading,
)
from src.modules.assistant.embeddings import FakeEmbedder
from src.tests.modules.assistant.conftest import build_docx


def test_sections_follow_heading1(adaptation_docx: bytes) -> None:
    sections = parse_docx(adaptation_docx, "Регламент адаптации")

    assert [section.number for section in sections] == ["0", "1", "2", "3"]
    assert sections[0].title == "Регламент адаптации"
    assert sections[0].blocks == ["Утверждено приказом директора."]
    assert sections[2].title == "Испытательный срок"
    assert sections[2].label == "2. Испытательный срок"


def test_table_becomes_column_value_lines(adaptation_docx: bytes) -> None:
    trial = parse_docx(adaptation_docx, "Регламент адаптации")[2]

    assert (
        "Категория: Специалист; Срок испытания: 3 месяца; Ответственный: Руководитель отдела"
        in trial.blocks
    )
    assert (
        "Категория: Руководитель; Срок испытания: 6 месяцев; "
        "Ответственный: Директор по персоналу" in trial.blocks
    )
    # Шапка таблицы не дублируется отдельной строкой «Категория; Срок испытания; …».
    assert not any(block.startswith("Категория; ") for block in trial.blocks)


def test_table_keeps_position_inside_section(adaptation_docx: bytes) -> None:
    trial = parse_docx(adaptation_docx, "Регламент адаптации")[2]
    assert trial.blocks[0].startswith("Испытательный срок для специалистов")
    assert trial.blocks[-1].startswith("Категория: Руководитель")


def test_heading_without_number_gets_ordinal() -> None:
    data = build_docx([("Общие положения", ["Текст."]), ("Отпуска", ["Текст про отпуск."])])
    sections = parse_docx(data, "Документ")
    assert [(section.number, section.title) for section in sections] == [
        ("1", "Общие положения"),
        ("2", "Отпуска"),
    ]


def test_split_heading_variants() -> None:
    assert split_heading("3. Наставничество", 9) == ("3", "Наставничество")
    assert split_heading("3.1 Наставник", 9) == ("3.1", "Наставник")
    assert split_heading("Раздел 4 Обучение", 9) == ("4", "Обучение")
    assert split_heading("Обучение", 9) == ("9", "Обучение")


def test_empty_sections_are_dropped() -> None:
    data = build_docx([("1. Пустой", []), ("2. С текстом", ["Абзац."])])
    assert [section.number for section in parse_docx(data, "Документ")] == ["2"]


def test_markdown_article_sections() -> None:
    sections = parse_markdown(
        "Вступление.\n\n## Как оформить отпуск\n\nПодайте заявление.\nЗа две недели.\n\n"
        "## Больничный\n\nСообщите руководителю.",
        "Памятка",
    )
    assert [(section.number, section.title) for section in sections] == [
        ("0", "Памятка"),
        ("1", "Как оформить отпуск"),
        ("2", "Больничный"),
    ]
    assert sections[1].blocks == ["Подайте заявление. За две недели."]


def words(text: str) -> int:
    return len(text.split())


def test_chunk_never_crosses_section_boundary(adaptation_docx: bytes) -> None:
    sections = parse_docx(adaptation_docx, "Регламент адаптации")
    chunks = chunk_sections("Регламент адаптации", sections, FakeEmbedder().count_tokens)

    assert [chunk.ordinal for chunk in chunks] == list(range(len(chunks)))
    for chunk in chunks:
        section = next(item for item in sections if item.number == chunk.section_number)
        for line in chunk.text.split("\n"):
            assert line in section.text


def test_chunk_respects_token_budget_and_overlaps() -> None:
    sentences = [
        f"Предложение номер {index} описывает шаг процесса адаптации." for index in range(60)
    ]
    section = Section(number="5", title="Длинный раздел", blocks=[" ".join(sentences)])

    chunks = chunk_sections("Документ", [section], words, max_tokens=80, overlap_tokens=16)

    assert len(chunks) > 3
    assert all(chunk.token_count <= 80 for chunk in chunks)
    assert all(chunk.section_number == "5" for chunk in chunks)
    for previous, current in zip(chunks, chunks[1:], strict=False):
        # Перекрытие 16 «токенов» = два предложения по 7 слов: хвост повторяется в начале.
        assert current.text.split("\n")[:2] == previous.text.split("\n")[-2:]
    # Ничего не потеряно: каждое предложение попало хотя бы в один чанк.
    joined = "\n".join(chunk.text for chunk in chunks)
    assert all(sentence in joined for sentence in sentences)


def test_embedding_input_has_prefix_and_section_header() -> None:
    section = Section(number="2", title="Испытательный срок", blocks=["Срок — три месяца."])
    chunk = chunk_sections("Регламент адаптации", [section], words)[0]

    assert chunk.embedding_input.startswith(
        f"{PASSAGE_PREFIX}Документ: Регламент адаптации. Раздел: 2. Испытательный срок.\n"
    )
    assert chunk.text == "Срок — три месяца."
    assert not chunk.text.startswith(PASSAGE_PREFIX)


def test_oversized_sentence_is_split_by_words() -> None:
    section = Section(number="1", title="Список", blocks=[" ".join(["слово"] * 400)])
    chunks = chunk_sections("Документ", [section], words, max_tokens=100, overlap_tokens=0)
    assert len(chunks) >= 4
    assert all(chunk.token_count <= 100 for chunk in chunks)
