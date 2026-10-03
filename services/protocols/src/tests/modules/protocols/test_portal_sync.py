"""Webhook sync: Python → POST {PORTAL}/api/internal/protocols/action-items/sync."""

from __future__ import annotations

import json
from datetime import date
from types import SimpleNamespace

import httpx
import pytest

from src.core.config import settings
from src.modules.protocols.models import ActionItemPriority
from src.modules.protocols.service import ProtocolService

TOKEN = "test-internal-token"


class Recorder:
    """Подменяет httpx.AsyncClient: запоминает запросы и отдаёт заданный ответ."""

    def __init__(self, status_code: int = 200, error: Exception | None = None) -> None:
        self.status_code = status_code
        self.error = error
        self.requests: list[httpx.Request] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if self.error:
            raise self.error
        return httpx.Response(self.status_code, json={"created": 1})

    def install(self, monkeypatch: pytest.MonkeyPatch) -> None:
        transport = httpx.MockTransport(self.handler)
        original = httpx.AsyncClient

        def factory(*args, **kwargs):  # type: ignore[no-untyped-def]
            kwargs["transport"] = transport
            return original(*args, **kwargs)

        monkeypatch.setattr(httpx, "AsyncClient", factory)


def make_service() -> ProtocolService:
    return ProtocolService.__new__(ProtocolService)


def make_items() -> list[SimpleNamespace]:
    return [
        SimpleNamespace(
            id=11,
            text="Подготовить смету",
            assignee="Иванов Иван",
            deadline=date(2026, 10, 15),
            priority=ActionItemPriority.HIGH,
        ),
        SimpleNamespace(
            id=12, text="Согласовать график", assignee=None, deadline=None, priority="medium"
        ),
    ]


@pytest.fixture(autouse=True)
def configured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "internal_token", TOKEN)
    monkeypatch.setattr(settings, "portal_internal_url", "http://portal.test/")


async def test_sync_posts_payload_with_internal_token(monkeypatch: pytest.MonkeyPatch) -> None:
    recorder = Recorder()
    recorder.install(monkeypatch)

    await make_service()._sync_portal_tasks(5, "Планёрка", "2026-10-01", make_items())

    assert len(recorder.requests) == 1
    request = recorder.requests[0]
    assert request.method == "POST"
    assert str(request.url) == "http://portal.test/api/internal/protocols/action-items/sync"
    assert request.headers["X-Internal-Token"] == TOKEN
    assert json.loads(request.content) == {
        "protocolId": 5,
        "protocolTitle": "Планёрка",
        "meetingDate": "2026-10-01",
        "actionItems": [
            {
                "id": 11,
                "text": "Подготовить смету",
                "assignee": "Иванов Иван",
                "deadline": "2026-10-15",
                "priority": "high",
            },
            {
                "id": 12,
                "text": "Согласовать график",
                "assignee": None,
                "deadline": None,
                "priority": "medium",
            },
        ],
    }


async def test_sync_skipped_without_token(monkeypatch: pytest.MonkeyPatch) -> None:
    recorder = Recorder()
    recorder.install(monkeypatch)
    monkeypatch.setattr(settings, "internal_token", "")

    await make_service()._sync_portal_tasks(5, "Планёрка", None, make_items())

    assert recorder.requests == []


async def test_sync_skipped_without_portal_url(monkeypatch: pytest.MonkeyPatch) -> None:
    recorder = Recorder()
    recorder.install(monkeypatch)
    monkeypatch.setattr(settings, "portal_internal_url", "")

    await make_service()._sync_portal_tasks(5, "Планёрка", None, make_items())

    assert recorder.requests == []


@pytest.mark.parametrize("status_code", [401, 500])
async def test_portal_rejection_does_not_break_pipeline(
    monkeypatch: pytest.MonkeyPatch, status_code: int
) -> None:
    recorder = Recorder(status_code=status_code)
    recorder.install(monkeypatch)

    await make_service()._sync_portal_tasks(5, "Планёрка", None, make_items())

    assert len(recorder.requests) == 1


async def test_portal_unreachable_does_not_break_pipeline(monkeypatch: pytest.MonkeyPatch) -> None:
    recorder = Recorder(error=httpx.ConnectError("portal down"))
    recorder.install(monkeypatch)

    await make_service()._sync_portal_tasks(5, "Планёрка", None, make_items())

    assert len(recorder.requests) == 1
