"""Unit-тесты без БД: whitelist профиля, проверка источников, правило доступа, fake-LLM."""

from __future__ import annotations

import dataclasses
import json
import uuid
from datetime import date

import pytest
from pydantic import ValidationError

from src.core.config import LLMProvider, settings
from src.core.rag import RAGService
from src.modules.assistant.acl import can_view_document
from src.modules.assistant.repository import Requester, RetrievedChunk
from src.modules.assistant.schemas import AnswerStatus, AskRequest, LLMAnswer
from src.modules.assistant.service import (
    PROFILE_FIELDS,
    build_profile,
    render_prompt,
    verify_sources,
)

DEPT_A = "11111111-1111-4111-8111-111111111111"
DEPT_B = "22222222-2222-4222-8222-222222222222"


def make_chunk(
    title: str = "Регламент адаптации", section: str = "2", text: str = "Текст"
) -> RetrievedChunk:
    return RetrievedChunk(
        chunk_id=uuid.uuid4(),
        source_type="document",
        source_id=uuid.uuid4(),
        title=title,
        version="1.2",
        section_number=section,
        section_title="Испытательный срок",
        text=text,
        score=0.9,
    )


def make_requester() -> Requester:
    return Requester(
        user_id=uuid.uuid4(),
        role="employee",
        position_title="Инженер-проектировщик",
        department_name="Проектный отдел",
        start_date=date(2026, 8, 3),
        contract_end_date=None,
    )


# --- whitelist ПДн -------------------------------------------------------------------


def test_profile_whitelist_is_exactly_four_fields() -> None:
    assert [field for field, _ in PROFILE_FIELDS] == [
        "position_title",
        "department_name",
        "start_date",
        "contract_end_date",
    ]


def test_requester_cannot_carry_personal_data() -> None:
    """Структура, из которой собирается промпт, не имеет полей с ПДн."""
    fields = {field.name for field in dataclasses.fields(Requester)}
    assert fields == {"user_id", "role", *(name for name, _ in PROFILE_FIELDS)}
    assert fields.isdisjoint({"inn", "snils", "address", "birth_date", "phone", "email"})


def test_profile_skips_empty_values() -> None:
    assert build_profile(make_requester()) == [
        ("Должность", "Инженер-проектировщик"),
        ("Отдел", "Проектный отдел"),
        ("Дата приёма", "2026-08-03"),
    ]


def test_prompt_contains_only_whitelisted_profile_and_context() -> None:
    requester = make_requester()
    prompt = render_prompt(
        "Когда заканчивается мой испытательный срок?",
        requester,
        [make_chunk(text="Испытательный срок составляет три месяца.")],
    )

    assert "Инженер-проектировщик" in prompt
    assert "Проектный отдел" in prompt
    assert "2026-08-03" in prompt
    assert (
        "[1] Документ: «Регламент адаптации», версия 1.2. Раздел: 2. Испытательный срок" in prompt
    )
    assert "Испытательный срок составляет три месяца." in prompt
    # Идентификаторы и роль в LLM не уходят.
    assert str(requester.user_id) not in prompt
    assert "employee" not in prompt


# --- проверка источников -------------------------------------------------------------


def test_verify_keeps_only_context_sources() -> None:
    chunks = [make_chunk(section="2"), make_chunk(title="Положение о наставничестве", section="1")]
    answer = LLMAnswer(status=AnswerStatus.ANSWERED, answer="Три месяца.", sources=[1, 7, 0, -3])

    status, refs = verify_sources(answer, chunks)

    assert status == AnswerStatus.ANSWERED
    assert [ref.title for ref in refs] == ["Регламент адаптации"]
    assert refs[0].section == "2. Испытательный срок"
    assert refs[0].source_id == chunks[0].source_id


def test_answer_with_only_invented_sources_becomes_no_info() -> None:
    answer = LLMAnswer(status=AnswerStatus.ANSWERED, answer="Из общих знаний…", sources=[5])
    assert verify_sources(answer, [make_chunk()]) == (AnswerStatus.NO_INFO, [])


def test_answer_without_sources_becomes_no_info() -> None:
    answer = LLMAnswer(status=AnswerStatus.ANSWERED, answer="Ответ без ссылок", sources=[])
    assert verify_sources(answer, [make_chunk()]) == (AnswerStatus.NO_INFO, [])


def test_contradiction_requires_sources_too() -> None:
    chunks = [make_chunk(section="2"), make_chunk(section="3")]
    kept = LLMAnswer(status=AnswerStatus.CONTRADICTION, answer="Расхождение", sources=[1, 2])
    lost = LLMAnswer(status=AnswerStatus.CONTRADICTION, answer="Расхождение", sources=[9])

    assert verify_sources(kept, chunks)[0] == AnswerStatus.CONTRADICTION
    assert len(verify_sources(kept, chunks)[1]) == 2
    assert verify_sources(lost, chunks) == (AnswerStatus.NO_INFO, [])


def test_no_info_drops_sources() -> None:
    answer = LLMAnswer(status=AnswerStatus.NO_INFO, sources=[1])
    assert verify_sources(answer, [make_chunk()]) == (AnswerStatus.NO_INFO, [])


def test_duplicate_citations_are_merged() -> None:
    chunk = make_chunk()
    answer = LLMAnswer(status=AnswerStatus.ANSWERED, answer="Ответ", sources=[1, 1])
    assert len(verify_sources(answer, [chunk])[1]) == 1


# --- контракт и правило доступа ------------------------------------------------------


def test_ask_request_rejects_access_fields() -> None:
    """Права из запроса не принимаются: лишние поля — ошибка валидации."""
    base = {"user_id": str(uuid.uuid4()), "question": "Вопрос"}
    AskRequest(**base)
    for extra in ({"role": "admin"}, {"department_id": DEPT_A}, {"is_admin": True}):
        with pytest.raises(ValidationError):
            AskRequest(**base, **extra)


@pytest.mark.parametrize(
    ("role", "user_dept", "access", "doc_dept", "expected"),
    [
        ("admin", None, "department", DEPT_B, True),
        ("hr_manager", DEPT_A, "department", DEPT_B, True),
        ("employee", DEPT_A, "public", None, True),
        ("employee", DEPT_A, "public", DEPT_B, True),
        ("employee", DEPT_A, "department", DEPT_A, True),
        ("employee", DEPT_A, "department", DEPT_B, False),
        ("employee", DEPT_A, "restricted", None, False),
        ("employee", None, "department", DEPT_B, False),
        # Поведение портала: сотрудник без отдела сравнивается с пустой строкой.
        ("employee", None, "department", "", True),
    ],
)
def test_access_rule_matrix(
    role: str, user_dept: str | None, access: str, doc_dept: str | None, expected: bool
) -> None:
    assert can_view_document(role, user_dept, access, doc_dept) is expected


# --- fake-провайдер ------------------------------------------------------------------


async def test_fake_provider_is_deterministic(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "llm_provider", LLMProvider.FAKE)
    prompt = render_prompt("Вопрос?", make_requester(), [make_chunk(text="Срок — три месяца.")])

    first = await RAGService().generate_structured(prompt, LLMAnswer)
    second = await RAGService().generate_structured(prompt, LLMAnswer)

    assert first == second
    assert first.status == AnswerStatus.ANSWERED
    assert first.answer == "Срок — три месяца."
    assert first.sources == [1]


async def test_fake_provider_plain_text(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "llm_provider", LLMProvider.FAKE)
    assert await RAGService().generate("Привет") == "fake-llm: ответ"
    assert json.loads(await RAGService().generate("Верни в формате JSON"))["status"] == "no_info"


async def test_structured_prompt_embeds_schema_as_json(monkeypatch: pytest.MonkeyPatch) -> None:
    # LLM копирует формат схемы из промпта: Python-repr с одинарными кавычками ломал разбор ответа.
    captured: list[str] = []

    async def fake_generate(self: RAGService, prompt: str, context: str | None = None) -> str:
        captured.append(prompt)
        return '{"status": "no_info", "answer": "Нет данных", "sources": []}'

    monkeypatch.setattr(RAGService, "generate", fake_generate)
    await RAGService().generate_structured("Вопрос?", LLMAnswer)

    schema_text = captured[0].split("по следующей схеме:\n", 1)[1]
    assert json.loads(schema_text) == LLMAnswer.model_json_schema()
