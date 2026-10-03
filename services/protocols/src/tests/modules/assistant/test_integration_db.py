"""Интеграционные тесты ассистента на тестовой БД (Postgres + pgvector).

Запуск: RAG_TEST_DATABASE_URL=postgresql+asyncpg://user:pass@host:port/пустая_база pytest
Эмбеддинги — FakeEmbedder (мешок слов), LLM — провайдер fake.
"""

from __future__ import annotations

import uuid
from datetime import date

import pytest
from fastapi.testclient import TestClient

from src.core.config import settings
from src.core.rag import RAGService
from src.modules.assistant.ingest import ingest_source
from src.modules.assistant.schemas import AnswerStatus
from src.modules.assistant.service import NO_INFO_TEXT, AssistantService, LLMUnavailableError
from src.tests.modules.assistant.conftest import (
    ADAPTATION_DOCX_SECTIONS,
    FINANCE_DOCX_SECTIONS,
    build_docx,
)

pytestmark = pytest.mark.integration

TRIAL_QUESTION = "Какой испытательный срок у специалиста?"
BONUS_QUESTION = "Как рассчитывается квартальная премия бухгалтерии?"


def chunk_count(db, source_id: uuid.UUID) -> int:  # type: ignore[no-untyped-def]
    return db.execute(
        "SELECT count(*) FROM rag.chunks c JOIN rag.sources s ON s.id = c.source "
        "WHERE s.source_id = %s",
        (source_id,),
    )[0][0]


# --- индексация ----------------------------------------------------------------------


async def test_ingest_indexes_sections(rag_db) -> None:  # type: ignore[no-untyped-def]
    doc_id = rag_db.add_document("Регламент адаптации", build_docx(ADAPTATION_DOCX_SECTIONS))

    result = await ingest_source("document", doc_id)

    assert result.action == "indexed"
    rows = rag_db.execute(
        "SELECT c.section_number, c.section_title, c.token_count FROM rag.chunks c "
        "JOIN rag.sources s ON s.id = c.source WHERE s.source_id = %s ORDER BY c.ordinal",
        (doc_id,),
    )
    assert [(row[0], row[1]) for row in rows] == [
        ("1", "Общие положения"),
        ("2", "Испытательный срок"),
        ("3", "Наставничество"),
    ]
    state = rag_db.execute(
        "SELECT index_state, chunk_count, embedding_model, error FROM rag.sources "
        "WHERE source_id = %s",
        (doc_id,),
    )[0]
    assert state == ("indexed", 3, "fake-bag-of-words", None)


async def test_republish_without_changes_creates_no_duplicates(rag_db) -> None:  # type: ignore[no-untyped-def]
    """K7: повторная публикация не создаёт дублей чанков."""
    doc_id = rag_db.add_document("Регламент адаптации", build_docx(ADAPTATION_DOCX_SECTIONS))

    first = await ingest_source("document", doc_id)
    ids_before = rag_db.execute("SELECT id FROM rag.chunks ORDER BY id")
    second = await ingest_source("document", doc_id)
    forced = await ingest_source("document", doc_id, force=True)

    assert (first.action, second.action, forced.action) == ("indexed", "unchanged", "indexed")
    assert rag_db.execute("SELECT id FROM rag.chunks ORDER BY id") != ids_before  # force пересоздал
    assert chunk_count(rag_db, doc_id) == 3
    assert rag_db.execute("SELECT count(*) FROM rag.sources")[0][0] == 1


async def test_new_version_replaces_chunks(rag_db) -> None:  # type: ignore[no-untyped-def]
    doc_id = rag_db.add_document("Регламент адаптации", build_docx(ADAPTATION_DOCX_SECTIONS))
    await ingest_source("document", doc_id)

    key = rag_db.execute("SELECT file_path FROM documents WHERE id = %s", (doc_id,))[0][0]
    (rag_db.storage_dir / key).write_bytes(
        build_docx([("1. Испытательный срок", ["Испытательный срок теперь четыре месяца."])])
    )
    rag_db.execute("UPDATE documents SET version = '1.2' WHERE id = %s", (doc_id,))

    result = await ingest_source("document", doc_id)

    assert result.action == "indexed"
    assert chunk_count(rag_db, doc_id) == 1
    assert rag_db.execute("SELECT version FROM rag.sources")[0][0] == "1.2"
    assert "четыре месяца" in rag_db.execute("SELECT text FROM rag.chunks")[0][0]


@pytest.mark.parametrize("status", ["archived", "excluded", "draft"])
async def test_non_actual_status_removes_chunks(rag_db, status: str) -> None:  # type: ignore[no-untyped-def]
    doc_id = rag_db.add_document("Регламент адаптации", build_docx(ADAPTATION_DOCX_SECTIONS))
    await ingest_source("document", doc_id)
    rag_db.execute("UPDATE documents SET rag_status = %s WHERE id = %s", (status, doc_id))

    result = await ingest_source("document", doc_id)

    assert result.action == "removed"
    assert chunk_count(rag_db, doc_id) == 0
    assert rag_db.execute("SELECT count(*) FROM rag.sources")[0][0] == 0


async def test_non_docx_is_marked_failed(rag_db) -> None:  # type: ignore[no-untyped-def]
    doc_id = rag_db.add_document("Скан приказа", b"%PDF-1.7")
    rag_db.execute(
        "UPDATE documents SET content_type = 'application/pdf', file_name = 'scan.pdf' "
        "WHERE id = %s",
        (doc_id,),
    )

    result = await ingest_source("document", doc_id)

    assert result.action == "failed"
    state, error = rag_db.execute("SELECT index_state, error FROM rag.sources")[0]
    assert state == "failed"
    assert "только docx" in error


async def test_failed_reindex_keeps_previous_chunks(rag_db) -> None:  # type: ignore[no-untyped-def]
    """Сбой при переиндексации не оставляет пустой индекс."""
    doc_id = rag_db.add_document("Регламент адаптации", build_docx(ADAPTATION_DOCX_SECTIONS))
    await ingest_source("document", doc_id)

    class BrokenEmbedder:
        model_name = "broken"

        def count_tokens(self, text: str) -> int:
            return len(text.split())

        def encode(self, texts: list[str]) -> list[list[float]]:
            raise RuntimeError("модель недоступна")

    with pytest.raises(RuntimeError):
        await ingest_source("document", doc_id, embedder=BrokenEmbedder(), force=True)

    assert chunk_count(rag_db, doc_id) == 3
    assert rag_db.execute("SELECT index_state FROM rag.sources")[0][0] == "failed"


async def test_published_article_is_indexed_and_unpublished_removed(rag_db) -> None:  # type: ignore[no-untyped-def]
    article_id = rag_db.execute(
        "INSERT INTO knowledge_articles (title, content, is_published) "
        "VALUES ('Памятка по отпуску', '## Заявление\n\nЗаявление на отпуск подаётся за две "
        "недели.', true) RETURNING id"
    )[0][0]

    assert (await ingest_source("article", article_id)).action == "indexed"
    assert chunk_count(rag_db, article_id) == 1

    rag_db.execute(
        "UPDATE knowledge_articles SET is_published = false WHERE id = %s", (article_id,)
    )
    assert (await ingest_source("article", article_id)).action == "removed"
    assert chunk_count(rag_db, article_id) == 0


# --- права доступа -------------------------------------------------------------------


@pytest.fixture
async def two_departments(rag_db):  # type: ignore[no-untyped-def]
    dept_a = rag_db.add_department("Проектный отдел")
    dept_b = rag_db.add_department("Бухгалтерия")
    public_doc = rag_db.add_document("Регламент адаптации", build_docx(ADAPTATION_DOCX_SECTIONS))
    finance_doc = rag_db.add_document(
        "Положение о премировании бухгалтерии",
        build_docx(FINANCE_DOCX_SECTIONS),
        access="department",
        department_id=dept_b,
    )
    await ingest_source("document", public_doc)
    await ingest_source("document", finance_doc)
    return {
        "dept_a": dept_a,
        "dept_b": dept_b,
        "public_doc": public_doc,
        "finance_doc": finance_doc,
        "employee_a": rag_db.add_user("employee", dept_a),
        "employee_b": rag_db.add_user("employee", dept_b),
        "no_dept": rag_db.add_user("employee", None),
        "hr": rag_db.add_user("hr_manager", dept_a),
        "admin": rag_db.add_user("admin", None),
    }


async def test_employee_never_gets_chunks_of_other_department(rag_db, two_departments) -> None:  # type: ignore[no-untyped-def]
    """Сотрудник отдела A не получает чанки документа отдела B даже по точному запросу."""
    service = AssistantService()
    data = two_departments

    for user in ("employee_a", "no_dept"):
        found = await service.search(data[user], BONUS_QUESTION, top_k=50)
        assert found, "публичные документы должны находиться"
        assert data["finance_doc"] not in {chunk.source_id for chunk in found}

    for user in ("employee_b", "hr", "admin"):
        found = await service.search(data[user], BONUS_QUESTION, top_k=50)
        assert found[0].source_id == data["finance_doc"]


async def test_restricted_question_returns_no_info_without_leak(rag_db, two_departments) -> None:  # type: ignore[no-untyped-def]
    response = await AssistantService().ask(two_departments["employee_a"], BONUS_QUESTION)

    assert two_departments["finance_doc"] not in {ref.source_id for ref in response.sources}
    assert "преми" not in response.answer.lower()
    logged = rag_db.execute("SELECT answer_json::text, sources::text FROM rag.queries")[0]
    assert str(two_departments["finance_doc"]) not in logged[1]
    assert "преми" not in logged[0].lower()


async def test_archived_document_is_not_found_even_before_reindex(rag_db, two_departments) -> None:  # type: ignore[no-untyped-def]
    """K6: фильтр по rag_status стоит в самом поиске и не ждёт удаления чанков."""
    service = AssistantService()
    user = two_departments["employee_a"]
    assert (await service.search(user, TRIAL_QUESTION))[0].source_id == two_departments[
        "public_doc"
    ]

    rag_db.execute(
        "UPDATE documents SET rag_status = 'archived' WHERE id = %s",
        (two_departments["public_doc"],),
    )

    assert chunk_count(rag_db, two_departments["public_doc"]) == 3  # чанки ещё на месте
    found = await service.search(user, TRIAL_QUESTION, top_k=50)
    assert two_departments["public_doc"] not in {chunk.source_id for chunk in found}


async def test_inactive_or_unknown_user_gets_nothing(rag_db, two_departments) -> None:  # type: ignore[no-untyped-def]
    service = AssistantService()
    rag_db.execute("UPDATE users SET is_active = false WHERE id = %s", (two_departments["admin"],))

    assert await service.search(two_departments["admin"], TRIAL_QUESTION) == []
    assert await service.search(uuid.uuid4(), TRIAL_QUESTION) == []


# --- ответ ---------------------------------------------------------------------------


async def test_answer_cites_document_and_section_and_is_logged(rag_db, two_departments) -> None:  # type: ignore[no-untyped-def]
    response = await AssistantService().ask(two_departments["employee_a"], TRIAL_QUESTION)

    assert response.status == AnswerStatus.ANSWERED
    assert response.sources[0].source_id == two_departments["public_doc"]
    assert response.sources[0].title == "Регламент адаптации"
    assert response.sources[0].section == "2. Испытательный срок"
    assert "три месяца" in response.answer

    row = rag_db.execute(
        "SELECT user_id, status, llm_provider, jsonb_array_length(retrieved), latency_ms "
        "FROM rag.queries WHERE id = %s",
        (response.query_id,),
    )[0]
    assert row[0] == two_departments["employee_a"]
    assert row[1:3] == ("answered", "fake")
    assert row[3] > 0 and row[4] >= 0


async def test_below_threshold_is_no_info_without_llm_call(
    rag_db, two_departments, monkeypatch
) -> None:  # type: ignore[no-untyped-def]
    async def must_not_be_called(*args, **kwargs):  # type: ignore[no-untyped-def]
        raise AssertionError("LLM не должна вызываться ниже порога релевантности")

    monkeypatch.setattr(RAGService, "generate", must_not_be_called)

    response = await AssistantService().ask(
        two_departments["employee_a"], "Какая погода ожидается в Казани завтра?"
    )

    assert response.status == AnswerStatus.NO_INFO
    assert response.answer == NO_INFO_TEXT
    assert response.sources == []
    assert rag_db.execute("SELECT status, llm_provider FROM rag.queries")[0] == ("no_info", None)


async def test_invented_citation_is_downgraded_to_no_info(
    rag_db, two_departments, monkeypatch
) -> None:  # type: ignore[no-untyped-def]
    async def hallucinating(self, prompt: str, context: str | None = None) -> str:  # type: ignore[no-untyped-def]
        return '{"status": "answered", "answer": "По закону срок 5 лет.", "sources": [42]}'

    monkeypatch.setattr(RAGService, "generate", hallucinating)

    response = await AssistantService().ask(two_departments["employee_a"], TRIAL_QUESTION)

    assert response.status == AnswerStatus.NO_INFO
    assert response.sources == []
    assert "5 лет" not in response.answer


async def test_llm_failure_is_logged_as_error(rag_db, two_departments, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    async def broken(self, prompt: str, context: str | None = None) -> str:  # type: ignore[no-untyped-def]
        return "это не JSON"

    monkeypatch.setattr(RAGService, "generate", broken)

    with pytest.raises(LLMUnavailableError):
        await AssistantService().ask(two_departments["employee_a"], TRIAL_QUESTION)

    assert rag_db.execute("SELECT status, error IS NOT NULL FROM rag.queries")[0] == ("error", True)


async def test_personal_data_never_reaches_prompt(rag_db, two_departments, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    """ПДн из employee_profiles (в т.ч. чужие) не попадают в промпт."""
    dept = two_departments["dept_a"]
    secrets = {
        "inn": "770123456789",
        "snils": "123-456-789 00",
        "address": "Казань, ул. Секретная, 7",
        "phone": "+7 (900) 555-44-33",
        "birth_date": date(1988, 4, 12),
    }
    asker = rag_db.add_user(
        "employee", dept, position_title="Инженер", start_date=date(2026, 8, 3), **secrets
    )
    rag_db.add_user(
        "employee",
        dept,
        position_title="Сметчик",
        inn="500987654321",
        address="Москва, пер. Чужой, 1",
        start_date=date(2026, 9, 1),
    )
    prompts: list[str] = []

    async def capture(self, prompt: str, context: str | None = None) -> str:  # type: ignore[no-untyped-def]
        prompts.append(prompt)
        return '{"status": "no_info", "answer": "", "sources": []}'

    monkeypatch.setattr(RAGService, "generate", capture)

    await AssistantService().ask(asker, "Когда заканчивается испытательный срок у Иванова?")

    prompt = prompts[0]
    assert "Инженер" in prompt and "2026-08-03" in prompt and "Проектный отдел" in prompt
    for leaked in (
        "770123456789",
        "123-456-789",
        "Секретная",
        "555-44-33",
        "1988",
        "Сметчик",
        "500987654321",
        "Чужой",
        "2026-09-01",
        str(asker),
    ):
        assert leaked not in prompt, leaked


# --- HTTP-контракт -------------------------------------------------------------------


@pytest.fixture
def client(rag_db, monkeypatch):  # type: ignore[no-untyped-def]
    from src.main import app

    monkeypatch.setattr(settings, "internal_token", "test-internal-token")
    return TestClient(app)


AUTH = {"X-Internal-Token": "test-internal-token"}


def test_api_requires_internal_token(client: TestClient) -> None:
    body = {"user_id": str(uuid.uuid4()), "question": "Вопрос"}
    assert client.post("/api/v1/assistant/ask", json=body).status_code == 401
    assert client.get("/api/v1/assistant/queries").status_code == 401
    assert client.get("/api/v1/assistant/sources").status_code == 401
    assert (
        client.post(f"/api/v1/assistant/sources/document/{uuid.uuid4()}/reindex").status_code == 401
    )


def test_api_ask_validation_and_unknown_user(client: TestClient) -> None:
    user_id = str(uuid.uuid4())
    assert (
        client.post(
            "/api/v1/assistant/ask", json={"user_id": user_id, "question": ""}, headers=AUTH
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/v1/assistant/ask",
            json={"user_id": user_id, "question": "Вопрос", "role": "admin"},
            headers=AUTH,
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/v1/assistant/ask", json={"user_id": user_id, "question": "Вопрос"}, headers=AUTH
        ).status_code
        == 404
    )


def test_api_reindex_unknown_source_is_404(client: TestClient) -> None:
    response = client.post(
        f"/api/v1/assistant/sources/document/{uuid.uuid4()}/reindex", headers=AUTH
    )
    assert response.status_code == 404
    assert (
        client.post(
            f"/api/v1/assistant/sources/pdf/{uuid.uuid4()}/reindex", headers=AUTH
        ).status_code
        == 422
    )
