# SNARK — Прогресс (hot state)

Горячий слой: ≤150 строк. Обновляется каждую сессию. Коммитится в `main` после сессии.
Лог сессий → [`LOG.md`](LOG.md). Детальная карта → [`archive/STATE-2026-07.md`](archive/STATE-2026-07.md).

Последнее обновление: 2026-10-03 (доработка по итогам проверки 18.08, ветка `feature/portal-dorabotka`)

## Архитектура

Монорепо `VasiliiLbyte/v0-project-snark` (`main`): **snark-portal** (Next.js :3000) + **snark-protocols** (FastAPI :8000), PostgreSQL / MinIO / Redis.
Prod portal: NSSM `snark-portal` на `192.168.1.236`. Оркестрация: `orchestrator_doc/`.
CI: корневой [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (portal + protocols, paths-filter).
Порядок зависимостей: protocols API → portal UI/proxy → prod deploy.

## Текущая фаза

**Доработка по плану 4 фаз** (безопасность → тесты → baseline → оптимизация). Код и документы — в ветке
`feature/portal-dorabotka`, ждут ревью: [`BUGS.md`](../BUGS.md), [`archive/PERF-BASELINE.md`](archive/PERF-BASELINE.md),
запись [2026-10-03-01] в [`LOG.md`](LOG.md). Гейты фаз 1–3 закрываются согласованием ревьюера.

## Сделано (итог)

MVP портала live: auth, 33 страницы, 74 API routes, tasks/chat/protocols, 20 миграций.
Оркестратор: хаб + hot PROGRESS/LOG/archive (2026-07-15).
**CI-ROOT** `dce5861`: корневой workflow, мёртвый nested CI удалён; GitHub run [#29410282859](https://github.com/VasiliiLbyte/v0-project-snark/actions/runs/29410282859) — portal + protocols OK.
Детали → [`archive/STATE-2026-07.md`](archive/STATE-2026-07.md).

## Следующее

1. Ревью ветки `feature/portal-dorabotka`; согласовать `BUGS.md` и цели `PERF-BASELINE.md` §6
2. Решение по BUGS B-10: `X-Internal-Token` на всех маршрутах Python-сервиса
3. Оптимизации 2–5 из baseline (пагинация админ-списков, индекс поиска по чату) — отдельными PR
4. Закрыть P2 из `BUGS.md`
5. **SYNC-SERVER** (оператор): серверные правки с `192.168.1.236` → git. **До этого — никаких DEP.**
6. Прогнать миграции 0020–0022 на prod (ops)
7. `/booking` — реализация (сейчас заглушка)
8. Ассистент по базе знаний (RAG): [`docs/DESIGN_ASSISTANT_RAG.md`](../docs/DESIGN_ASSISTANT_RAG.md) — после гейта фазы 1
9. Ответить на вопросы оператору в [`DEPLOY.md`](DEPLOY.md) §7

## Блокеры

| Блокер | Основание |
|--------|-----------|
| **SYNC-SERVER не выполнен** | Серверные NSSM-правки не запушены с прода; DEPLOY/README локально опережают git |
| Python protocols — внешние зависимости | ffmpeg, HF_TOKEN, STT/LLM ключи |

## Ожидает деплоя (Pending deploy)

**Правило:** никаких DEP до завершения SYNC-SERVER. Детали — [`DEPLOY.md`](DEPLOY.md).

| ID | Описание | Target | Статус | Дата |
|----|----------|--------|--------|------|
| — | Нет открытых DEP | — | — | — |
