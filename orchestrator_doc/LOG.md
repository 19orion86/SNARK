# SNARK — Лог сессий

Append-only. **Новые записи — строго сверху.** Детальная инвентаризация — [`archive/`](archive/).
Горячее состояние — [`PROGRESS.md`](PROGRESS.md).

Формат: дата, ID промптов, verified (SHA/вывод), инциденты и откат, следующий шаг.

---

## 2026-10-03 — сессия [2026-10-03-02] ассистент по базе знаний (RAG), этапы 0–4

**Основание:** `14_09_2026_TASK_ASSISTANT_RAG.md` v1.0.
**Ветка:** `feature/assistant-rag` поверх `feature/portal-dorabotka` (локально, не запушена; PR не открыты).

**Сделано**
- Этап 0: `docs/DESIGN_ASSISTANT_RAG.md` — ответы на вопросы, DDL, контракт, риски, 8 вопросов ревьюеру.
  **Записка ревьюером не принята**; код этапов 1–4 написан до приёмки по просьбе исполнителя.
- Этап 1: `pgvector/pgvector:pg16` в compose; окружение `alembic_rag` (схема `rag`, своя таблица версий);
  `documents.rag_status` (`0023`, через `pnpm db:generate`); роль `snark_rag` (`scripts/rag-role.sql`); `pnpm seed:content`.
- Этап 2: `src/modules/assistant` — парсер docx по Heading1 и таблиц, нарезка по токенам e5, эмбеддинги,
  идемпотентная индексация, Celery-задача с backoff, сверка в beat, эндпоинт reindex.
- Этап 3: поиск с проверкой прав в одном SQL, whitelist профиля, структурированный ответ, проверка источников,
  `/ask`, журнал `rag.queries`, провайдер `fake`; раздел в `API_CONTRACT.md`.
- Этап 4: `/assistant`, `/admin/assistant`, прокси `app/api/assistant/*`, пункт навигации, E2E.
- Попутно закрыт IDOR при скачивании документов (BUGS B-22) — без него правило A6 не выполнялось бы.

**Verified (вывод команд, 03.10.2026):**

```
$ pnpm typecheck && pnpm lint                  (без ошибок)
$ pnpm test
 Test Files  16 passed (16)
      Tests  298 passed (298)
$ pnpm db:generate
No schema changes, nothing to migrate
$ python scripts/audit-route-auth.py
handlers without auth check: 0
$ pnpm test:e2e                                (production-сборка, Postgres, сервис ассистента запущен)
  15 passed (1.9m)
$ cd services/protocols && ruff check src/ tests/ scripts/ alembic_rag/
All checks passed!
$ RAG_TEST_DATABASE_URL=… pytest              (без переменной: 44 passed, 21 skipped)
65 passed, 1 warning in 12.09s
$ alembic -c alembic_rag.ini upgrade head && alembic -c alembic_rag.ini check
Running upgrade  -> 20261003_000001
No new upgrade operations detected.
$ python scripts/e5_smoke.py
dim=1024; запрос 0.13–0.21 с на CPU; близость: релевантные 0.85–0.86, посторонние 0.68–0.72
```

**Чего нет / не проверено**
- Вводные задания не получены: 14 документов, системный промт, 9 эталонных вопросов, ключи LLM, логи n8n.
  Тесты и E2E идут на синтетическом docx; промпт — заготовка; порог `RAG_MIN_SCORE=0.80` не откалиброван.
- С реальной LLM ассистент не запускался ни разу (только провайдер `fake`).
- Этап 5 не выполнен: `docs/EVAL_ASSISTANT_RAG.md` описывает только инструмент прогона.
- Celery-воркер с Redis не запускался (eager-режим); Docker-образ pgvector не проверялся на существующем volume.
- GitHub Actions на ветке не запускался (ветка не запушена).

**Следующий шаг:** ревью записки (§9, особенно вопросы 1–3: базы на проде, pgvector, RAM); передать вводные;
затем промпт, загрузка документов, eval и выбор провайдера.

---

## 2026-10-03 — сессия [2026-10-03-01] доработка по итогам проверки 18.08 (фазы 1–4)

**Основание:** документ «Портал ПКФ Снарк — итоги проверки и список доработок» (18.08.2026), база `025a79e`.
**Ветка:** `feature/portal-dorabotka` (локально, не запушена; PR не открыт).

**Фаза 1 — безопасность и аудит**
- `97b75c8` — убран fallback на mock в `portal-repository.drizzle.ts` (`getDashboardData`, `getSidebarItems`,
  `getProfileData`, `getCurrentUserProfile`); sidebar вынесен в `lib/navigation/sidebar-items.ts`;
  `WIDGET_TYPES` → `lib/dashboard/widget-types.ts`; удалены клиентский `portal-repository.ts` и `hooks/use-dashboard.ts`.
- `2bba5b5` — baseline-миграция `0022_snapshot_baseline` (db:generate пересоздавал 37 таблиц).
- `492752f` — `requireAuth` на `GET /api/news*`, `/api/knowledge*` (P0); шрифты из `@fontsource`; удалён Vercel Analytics.
- `b0a2bb6` — поиск по чату (500) и список чатов без последнего сообщения / непрочитанных на реальной БД.
- `1bb72f1` — демо-сотрудники больше не получают пароль из репозитория.
- документы чужого отдела по прямой ссылке (IDOR в `/api/documents/preview/[id]` и `/versions`) — закрыто правилом `lib/documents/access.ts`.
- `BUGS.md` — 22 находки: P0 1/1 закрыто, P1 10/9 закрыто, P2 11 открыто.
- `docs/launch-report.md` помечен устаревшим; приложение А `docs/TZ_TASKS_CHAT_V2.md` синхронизировано со стендом.

**Фаза 2 — тестовая сетка** (`f986bc5`)
- `tests/acl/routes-acl.test.ts` — аноним / employee / hr_manager / admin × все API (210 проверок).
- Playwright на живом Postgres: `e2e/core-flow`, `e2e/page-walk` (29 страниц × 3 роли), `e2e/stand-verification`.
- pytest `services/protocols`: internal-token auth (5) и webhook sync (6); из CI убран `pytest || test $? -eq 5`.
- CI: шаги route auth audit и schema drift, новая job `e2e` (Postgres service).

**Фаза 3 — baseline:** `orchestrator_doc/archive/PERF-BASELINE.md` (prod-сборка, нагрузочные данные `scripts/seed-perf.sql`).

**Фаза 4 — оптимизация** (`48c2837`, отдельным коммитом от багфиксов)

| Метрика | Было | Стало |
|---|---|---|
| Суммарное время SQL за прогон `audit-live.py` | 4 409 мс | 1 864 мс |
| `GET /api/chat/channels`, admin (медиана) | 61 мс | 21 мс |
| `GET /api/chat/channels`, employee (медиана) | 72 мс | 33 мс |
| `/chat`, ответ целиком, employee | 89 мс | 59 мс |

**Verified (вывод команд, 03.10.2026):**

```
$ pnpm build
▲ Next.js 16.2.4 (Turbopack)
✓ Compiled successfully in 6.8s
✓ Generating static pages using 19 workers (67/67) in 410ms

$ pnpm typecheck
> tsc --noEmit                      (без ошибок)

$ pnpm lint
> eslint .                          (без замечаний)

$ pnpm test
 Test Files  16 passed (16)
      Tests  276 passed (276)

$ pnpm db:migrate                   (чистая БД, миграции 0000–0022)
[✓] migrations applied successfully!

$ pnpm db:generate                  (drizzle-kit generate)
No schema changes, nothing to migrate 😴

$ python scripts/audit-route-auth.py
handlers without auth check: 0

$ pnpm test:e2e                     (production-сборка, Postgres, USE_MOCK_DB=false)
  10 passed (1.9m)

$ cd services/protocols && ruff check src/ && pytest
All checks passed!
11 passed, 1 warning in 1.03s
```

До правок на том же коммите `025a79e`: `pnpm test` — 53 теста; `pnpm db:generate` создавал
`0022_*.sql` с 37 `CREATE TABLE`; `pnpm build` падал при недоступном `fonts.gstatic.com`.

**Инциденты / ограничения стенда:**
- Docker Desktop на машине исполнителя не стартует (виртуализация отключена). Postgres 16 + pgvector
  поднят через `scripts/dev-postgres.py` (pip-пакет `pgserver`), порт 5433. MinIO и Redis не запускались:
  файловое хранилище — mock, realtime — in-process.
- GitHub Actions на этой ветке не запускался: ветка не запушена (у исполнителя права READ на `19orion86/SNARK`).
  «CI зелёный» подтверждён только локальным прогоном тех же команд. Job `e2e` в CI ни разу не выполнялась.
- Миграции 0020/0021/0022 прогнаны на локальном стенде, на prod — нет.

**Откат:** `git revert` коммитов ветки в обратном порядке; `0022_snapshot_baseline` не содержит DDL.

**Следующий шаг:** согласовать `BUGS.md` и целевые числа `PERF-BASELINE.md` §6; решение по B-10
(токен на всех маршрутах Python-сервиса); пункты 2–5 плана оптимизации отдельными PR.

---

## 2026-07-15 — сессия 2 [2026-07-15-02] CI-ROOT

**Промпты:** `2026-07-15-02`

**Verified:**
- Commit `dce5861`: `.github/workflows/ci.yml` (jobs changes/portal/protocols, dorny/paths-filter@v3)
- Удалён `services/protocols/.github/workflows/ci.yml`
- Lint fix: `hooks/use-realtime-events.ts`; ruff import sort + pyproject ignores
- GitHub Actions run [29410282859](https://github.com/VasiliiLbyte/v0-project-snark/actions/runs/29410282859): **changes ✓ portal ✓ protocols ✓** (push `main`)
- Локально (исполнитель): typecheck/test 52/52/lint OK; ruff OK; pytest 0 collected (exit 5)

**Инциденты / откат:**
- Annotations: Node.js 20 deprecation warnings на actions (не блокер)
- Откат: `git revert dce5861` + push

**Следующий шаг:** SYNC-SERVER (оператор); DEPLOY §7 ответы

---

## 2026-07-15 — сессия CORR [2026-07-15-CORR]

**Промпты:** мета-сессия (без executor)

**Verified:**
- Аудит F1–F4 принят: незакоммиченный хаб, PM2 в docs vs NSSM на prod, мёртвый CI в `services/protocols/.github/`
- PROGRESS разбит на hot/archive/LOG; DEPLOY переписан под NSSM
- ORCHESTRATOR + mdc обновлены; относительные пути
- Commits `3cb3bbf` + `c3f71d5` pushed на `origin/main` (оператор)

**Инциденты / откат:**
- Нет runtime-инцидентов (только документация)
- Откат коммита: `git revert <sha>` или `git reset` до push

**Следующий шаг:**
1. Оператор: `git push` после «go»
2. Оператор: SYNC-SERVER (NSSM-скрипты с `192.168.1.236`)
3. Executor: `2026-07-15-02` CI-ROOT

---

## 2026-07-15 — сессия 1 [2026-07-15-01]

**Промпты:** `2026-07-15-01`

**Verified:**
- `docs/phase2-app-router-dod.md` — 16/18 пунктов закрыты (read: `app/page.tsx`, `middleware.ts`, `sidebar.tsx`, repositories, tests)
- Workflow валидирован → [`VALIDATION.md`](VALIDATION.md)

**Инциденты / откат:** нет

**Следующий шаг:** инициализация оркестратора (сессия 0) + CORR

---

## 2026-07-15 — сессия 0 (инициализация)

**Промпты:** —

**Verified:**
- Создан хаб `orchestrator_doc/`: ORCHESTRATOR, PROGRESS, SPEC, API_CONTRACT, DEPLOY, `60-orchestrator.mdc`
- Executor rules: `55-executor-portal.mdc`, `55-executor-protocols.mdc`
- Обновлены `development-workflow.mdc`, `architecture-and-routes.mdc`, root README

**Инциденты / откат:** хаб не был закоммичен до CORR (F1 аудита)

**Следующий шаг:** `2026-07-15-01` phase2 DoD sync
