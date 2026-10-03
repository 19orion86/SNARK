"""Оценка качества ассистента на eval-датасете. Запуск отдельно: стоит денег на реальной LLM.

    EVAL_USERS='{"employee": "<uuid>", "admin": "<uuid>"}' pytest -m eval tests/eval -s

Работает с базой из RAG_DATABASE_URL и провайдером из LLM_PROVIDER (yandex_gpt | gigachat | fake).
Пишет отчёт в tests/eval/report-<provider>.json и печатает сводку метрик:
- hit@5: ожидаемый документ попал в top-5 поиска (K2);
- status: статус ответа совпал с ожидаемым (K3 для no_answer);
- sources: у ответа answered есть источник из ожидаемых документов и разделов (K5);
- leaks: в ответе нет запрещённых подстрок (K4);
- латентность p50 / p95 (K8).
"""

from __future__ import annotations

import json
import os
import statistics
import time
import uuid
from pathlib import Path

import pytest
import yaml

from src.core.config import settings
from src.modules.assistant.service import AssistantService

pytestmark = pytest.mark.eval

DATASET = Path(__file__).with_name("dataset.yaml")


def load_cases() -> list[dict]:
    return yaml.safe_load(DATASET.read_text(encoding="utf-8"))["cases"]


def percentile(values: list[float], share: float) -> float:
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, int(round(share * (len(ordered) - 1))))]


async def test_eval_dataset() -> None:
    users_raw = os.environ.get("EVAL_USERS")
    if not users_raw:
        pytest.skip("EVAL_USERS не задан: {роль из датасета: uuid пользователя портала}")
    users = {role: uuid.UUID(value) for role, value in json.loads(users_raw).items()}

    service = AssistantService()
    provider = settings.llm_provider.value
    rows: list[dict] = []

    for case in load_cases():
        user_id = users.get(case["as"])
        if user_id is None:
            rows.append(
                {"id": case["id"], "category": case["category"], "skipped": "нет пользователя"}
            )
            continue
        expect = case["expect"]

        retrieved = await service.search(user_id, case["question"], top_k=5)
        started = time.perf_counter()
        try:
            response = await service.ask(user_id, case["question"])
            error = None
        except Exception as exc:  # ошибка LLM — тоже результат оценки
            response, error = None, f"{type(exc).__name__}: {exc}"
        latency = (time.perf_counter() - started) * 1000

        answer_text = response.answer if response else ""
        sources = response.sources if response else []
        haystack = (
            answer_text + " " + " ".join(s.title + " " + s.section for s in sources)
        ).lower()
        expected_docs = expect.get("documents", [])

        source_ok = None
        if expect["status"] == "answered" and response is not None:
            source_ok = any(
                s.title in expected_docs
                and (not expect.get("section") or s.section == expect["section"])
                and (not expect.get("version") or s.version == expect["version"])
                for s in sources
            )

        rows.append(
            {
                "id": case["id"],
                "category": case["category"],
                "status_expected": expect["status"],
                "status_actual": response.status.value if response else "error",
                "status_ok": bool(response) and response.status.value == expect["status"],
                "hit_at_5": (
                    any(chunk.title in expected_docs for chunk in retrieved)
                    if expected_docs
                    else None
                ),
                "source_ok": source_ok,
                "facts_ok": all(fact.lower() in haystack for fact in expect.get("facts", [])),
                "leak": [item for item in expect.get("forbidden", []) if item.lower() in haystack],
                "top_score": round(retrieved[0].score, 3) if retrieved else None,
                "latency_ms": round(latency),
                "error": error,
            }
        )

    done = [row for row in rows if "skipped" not in row]
    assert done, "ни один случай не выполнен"

    def share(key: str, subset: list[dict]) -> str:
        scoped = [row for row in subset if row.get(key) is not None]
        if not scoped:
            return "—"
        return f"{sum(bool(row[key]) for row in scoped)}/{len(scoped)}"

    latencies = [row["latency_ms"] for row in done]
    summary = {
        "provider": provider,
        "embedding_model": service.embedder.model_name,
        "min_score": settings.rag_min_score,
        "cases": len(done),
        "skipped": len(rows) - len(done),
        "hit_at_5": share("hit_at_5", done),
        "status_ok": share("status_ok", done),
        "no_answer_refusals": share(
            "status_ok", [row for row in done if row["category"] == "no_answer"]
        ),
        "source_ok": share("source_ok", done),
        "leaks": sum(len(row["leak"]) for row in done),
        "latency_p50_ms": round(statistics.median(latencies)),
        "latency_p95_ms": round(percentile(latencies, 0.95)),
    }

    report = Path(__file__).with_name(f"report-{provider}.json")
    report.write_text(
        json.dumps({"summary": summary, "cases": rows}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print("\n" + json.dumps(summary, ensure_ascii=False, indent=2))
    for row in done:
        flags = [
            key
            for key in ("status_ok", "hit_at_5", "source_ok", "facts_ok")
            if row.get(key) is False
        ]
        if flags or row["leak"] or row["error"]:
            print(f"  ! {row['id']}: {flags} leak={row['leak']} error={row['error']}")

    # Жёсткие критерии приёмки, которые не смягчаются: K4 (утечки) и K5 (источники).
    assert summary["leaks"] == 0, "утечки ПДн или документов чужого отдела"
    assert all(row["source_ok"] is not False for row in done), (
        "ответ answered без верного источника"
    )
