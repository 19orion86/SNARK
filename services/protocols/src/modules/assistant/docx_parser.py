"""Разбор docx и markdown-статей на разделы.

Раздел docx начинается с абзаца стиля Heading1. Таблицы превращаются в строки
«Колонка: значение», чтобы в чанк попадал читаемый текст, а не поток ячеек.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from io import BytesIO

from docx import Document
from docx.document import Document as DocxDocument
from docx.table import Table
from docx.text.paragraph import Paragraph

# style_id не зависит от языка Word: в русской локали имя стиля «Заголовок 1»,
# а id остаётся Heading1.
SECTION_STYLE_IDS = {"Heading1"}

_NUMBER_PREFIX = re.compile(r"^\s*(?:раздел\s+)?(\d+(?:\.\d+)*)[.)]?\s+(.*\S)\s*$", re.IGNORECASE)
_MD_HEADING = re.compile(r"^(#{1,2})\s+(.*\S)\s*$")


@dataclass
class Section:
    """Раздел документа: номер, название и блоки текста в порядке следования."""

    number: str
    title: str
    blocks: list[str] = field(default_factory=list)

    @property
    def label(self) -> str:
        """Подпись для цитаты: «3. Испытательный срок»."""
        if self.number == "0":
            return self.title
        return f"{self.number}. {self.title}" if self.title else self.number

    @property
    def text(self) -> str:
        return "\n".join(self.blocks)


def split_heading(raw: str, ordinal: int) -> tuple[str, str]:
    """Вернуть (номер, название). Нет номера в тексте — используем порядковый."""
    match = _NUMBER_PREFIX.match(raw)
    if match:
        return match.group(1), match.group(2)
    return str(ordinal), raw.strip()


def table_to_lines(table: Table) -> list[str]:
    """Таблица → строки «Колонка: значение; Колонка: значение»."""
    rows: list[list[str]] = []
    for row in table.rows:
        cells: list[str] = []
        previous = None
        for cell in row.cells:
            # Объединённая ячейка возвращается несколько раз подряд одним объектом XML.
            if previous is not None and cell._tc is previous:
                continue
            previous = cell._tc
            cells.append(" ".join(cell.text.split()))
        if any(cells):
            rows.append(cells)

    if not rows:
        return []
    if len(rows) == 1:
        return ["; ".join(cell for cell in rows[0] if cell)]

    header, lines = rows[0], []
    for row in rows[1:]:
        pairs = []
        for index, value in enumerate(row):
            if not value:
                continue
            name = header[index] if index < len(header) and header[index] else ""
            pairs.append(f"{name}: {value}" if name else value)
        if pairs:
            lines.append("; ".join(pairs))
    return lines


def _iter_blocks(document: DocxDocument):  # type: ignore[no-untyped-def]
    """Абзацы и таблицы в порядке следования в теле документа."""
    for child in document.element.body.iterchildren():
        tag = child.tag.rsplit("}", 1)[-1]
        if tag == "p":
            yield Paragraph(child, document)
        elif tag == "tbl":
            yield Table(child, document)


def parse_docx(data: bytes, title: str) -> list[Section]:
    """Разобрать docx на разделы по Heading1.

    Текст до первого заголовка попадает в раздел «0» с названием документа.
    Пустые разделы отбрасываются.
    """
    document = Document(BytesIO(data))
    sections: list[Section] = [Section(number="0", title=title)]
    heading_count = 0

    for block in _iter_blocks(document):
        if isinstance(block, Table):
            sections[-1].blocks.extend(table_to_lines(block))
            continue

        text = " ".join(block.text.split())
        if not text:
            continue
        style_id = block.style.style_id if block.style is not None else ""
        if style_id in SECTION_STYLE_IDS:
            heading_count += 1
            number, heading = split_heading(text, heading_count)
            sections.append(Section(number=number, title=heading))
        else:
            sections[-1].blocks.append(text)

    return [section for section in sections if section.blocks]


def parse_markdown(content: str, title: str) -> list[Section]:
    """Разобрать статью базы знаний: разделы — заголовки `#` и `##`."""
    sections: list[Section] = [Section(number="0", title=title)]
    heading_count = 0
    paragraph: list[str] = []

    def flush() -> None:
        if paragraph:
            sections[-1].blocks.append(" ".join(paragraph))
            paragraph.clear()

    for raw_line in content.replace("\\n", "\n").splitlines():
        line = raw_line.strip()
        match = _MD_HEADING.match(line)
        if match:
            flush()
            heading_count += 1
            number, heading = split_heading(match.group(2), heading_count)
            sections.append(Section(number=number, title=heading))
        elif not line:
            flush()
        else:
            paragraph.append(line.lstrip("#").strip() if line.startswith("###") else line)
    flush()

    return [section for section in sections if section.blocks]
