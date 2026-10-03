"""Auth внутреннего маршрута: PATCH /api/v1/protocols/action-items/{id}/status."""

from __future__ import annotations

from datetime import datetime
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from src.core.config import settings
from src.core.database import get_async_session
from src.main import app
from src.modules.protocols.models import ActionItemStatus
from src.modules.protocols.repository import ProtocolRepository

TOKEN = "test-internal-token"
URL = "/api/v1/protocols/action-items/7/status"


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    async def fake_session():  # type: ignore[no-untyped-def]
        yield None

    async def fake_update(self, item_id: int, status: ActionItemStatus):  # type: ignore[no-untyped-def]
        if item_id != 7:
            return None
        return SimpleNamespace(id=item_id, status=status, updated_at=datetime(2026, 9, 1, 12, 0))

    monkeypatch.setattr(settings, "internal_token", TOKEN)
    monkeypatch.setattr(ProtocolRepository, "update_action_item_status", fake_update)
    app.dependency_overrides[get_async_session] = fake_session
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_rejects_request_without_token(client: TestClient) -> None:
    response = client.patch(URL, params={"new_status": "done"})
    assert response.status_code == 401


def test_rejects_wrong_token(client: TestClient) -> None:
    response = client.patch(
        URL, params={"new_status": "done"}, headers={"X-Internal-Token": "nope"}
    )
    assert response.status_code == 401


def test_accepts_valid_token(client: TestClient) -> None:
    response = client.patch(URL, params={"new_status": "done"}, headers={"X-Internal-Token": TOKEN})
    assert response.status_code == 200
    assert response.json() == {"id": 7, "status": "done", "updated_at": "2026-09-01T12:00:00"}


def test_unknown_item_returns_404(client: TestClient) -> None:
    response = client.patch(
        "/api/v1/protocols/action-items/999/status",
        params={"new_status": "done"},
        headers={"X-Internal-Token": TOKEN},
    )
    assert response.status_code == 404


def test_fails_closed_when_token_not_configured(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "internal_token", "")
    response = client.patch(URL, params={"new_status": "done"}, headers={"X-Internal-Token": ""})
    assert response.status_code == 401
    response = client.patch(URL, params={"new_status": "done"})
    assert response.status_code == 401
