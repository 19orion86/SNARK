# Корпоративный портал СНАРК

Внутренний портал компании: справочник сотрудников, новости, документы, заявки, **протоколы совещаний (аудио/видео → текст)**, **внутренний чат**, **таск-менеджер**, админ-панель.

Стек: Next.js 16 (App Router) · TypeScript · Tailwind + shadcn/ui · PostgreSQL (Drizzle ORM) · MinIO (S3) · JWT · Python FastAPI + Celery (модуль протоколов).

> Все секреты живут в `.env.local` — он **не** попадает в git. Локально и на сервере он свой.

---

## Архитектура

| Компонент | Путь | Порт |
|-----------|------|------|
| Портал (Next.js) | корень репозитория | 3000 |
| Протоколы (Python) | `services/protocols` | 8000 |
| PostgreSQL | Docker | 5432 |
| MinIO | Docker | 9000 / 9001 |
| Redis (Celery) | Docker | 6379 |

Портал проксирует запросы к Python-сервису через `PROTOCOLS_API_URL` (см. `.env.example`).

---

## Оркестратор разработки

Память проекта, playbook и промпты для AI-агентов — в [`orchestrator_doc/`](orchestrator_doc/README.md) (паттерн [muru-docs](https://github.com/VasiliiLbyte/muru-docs)).

| Workspace | Назначение |
|-----------|------------|
| `orchestrator_doc/` | Чат-оркестратор: план, промпты, PROGRESS |
| корень репо | Исполнитель portal (Plan mode) |
| `services/protocols/` | Исполнитель protocols (Plan mode) |

Стартовый промпт и workflow: [`orchestrator_doc/ORCHESTRATOR.md`](orchestrator_doc/ORCHESTRATOR.md).

---

## Локальный запуск (разработка)

**Требуется:** Node.js 22 LTS, pnpm, Docker Desktop, Python 3.12, ffmpeg (для видео).

### 1. Инфраструктура

```bash
docker compose up -d
```

Поднимает PostgreSQL, MinIO и Redis.

### 2. Портал

```bash
cp .env.example .env.local
# Отредактируйте DATABASE_URL, JWT_* , S3_*, PROTOCOLS_API_URL

pnpm install
pnpm db:migrate
pnpm init:users
pnpm dev
```

Портал: http://localhost:3000

MinIO-консоль: http://localhost:9001 (minioadmin / minioadmin123) → создайте бакет `snark-portal`.

### 3. Сервис протоколов (аудио/видео → текст → протокол)

```bash
cd services/protocols
cp .env.example .env.local
# Укажите DATABASE_URL, REDIS_URL, ключи STT/LLM

python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -e .

alembic upgrade head

# Терминал 1 — API
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000

# Терминал 2 — Celery worker
celery -A src.core.celery_app.app.celery_app worker -l info --pool=solo
```

Swagger: http://localhost:8000/docs

---

## Новые разделы портала

| Раздел | URL | Описание |
|--------|-----|----------|
| Протоколы | `/protocols` | Загрузка аудио/видео, просмотр протокола, экспорт DOCX |
| Задачи | `/tasks` | Создание и отслеживание поручений |
| Чат | `/chat` | Групповые каналы и переписка |

---

## Конфигурация режимов (Итерация 0 / безопасность)

| Переменная | Поведение |
|------------|-----------|
| `USE_MOCK_DB=true` | In-memory mock (только локальная разработка) |
| `USE_MOCK_DB` отсутствует / `false` / любое иное | Реальная PostgreSQL и auth |
| `NODE_ENV=production` + `USE_MOCK_DB=true` | Приложение **не стартует** (FATAL) |
| `COOKIE_SECURE=true\|false` | Явный Secure у cookie; без значения — как `NODE_ENV` |

Единая точка: `lib/config/mode.ts` (`isMockDb` / `isMockAuth`). Прямые чтения `process.env.USE_MOCK_DB` в репозиториях запрещены.

Dev-учётки: пароли только в `.env.local` (`DEV_*_PASSWORD`). Сид: `pnpm seed:dev-users` / `pnpm init:users`. Файла с паролями в репозитории нет.

**Drizzle:** новый индекс объявляется в `lib/db/schema.ts`, миграция — через `pnpm db:generate`. Ручной SQL для индексов не пишем.

**Перед коммитом:** `pnpm typecheck` (обязательно). Сборка без `ignoreBuildErrors`.

---

## Тестирование

### Быстрый старт (mock-режим, без БД)

```bash
# .env.local — обязательно явно:
USE_MOCK_DB=true
DEV_ADMIN_PASSWORD=...
DEV_HR_PASSWORD=...
DEV_EMPLOYEE_PASSWORD=...

pnpm typecheck
pnpm test
pnpm dev
```

Работают: задачи, чат (in-memory), остальной портал на моках. Протоколы требуют Python-сервис.

### Полный стек

1. `docker compose up -d`
2. `cp .env.example .env.local` — задать `DATABASE_URL`, JWT, `DEV_*_PASSWORD`
3. `USE_MOCK_DB=false` (или удалить переменную)
4. `pnpm db:migrate && pnpm seed:dev-users`
5. `pnpm typecheck && pnpm test && pnpm build`
6. `pnpm dev`
7. Запустите `services/protocols` (API + Celery)
8. Войдите на http://localhost:3000/login учётками из `.env.local`

**Проверка задач:** `/tasks` → создать задачу → сменить статус.

**Проверка чата:** `/chat` → «Создать групповой чат» → отправить сообщение.

**Проверка протоколов:** `/protocols` → загрузить короткий `.mp3`/`.webm` → дождаться статуса «Готов» → открыть детали → скачать DOCX.

**API вручную:**

```bash
# после login (cookies в браузере) или через curl с cookie
curl http://localhost:3000/api/tasks
curl http://localhost:3000/api/chat/channels
curl http://localhost:3000/api/protocols
```

**Typecheck и тесты портала:**

```bash
pnpm typecheck
pnpm test
```

`pnpm test` включает ACL-сетку `tests/acl` (аноним / employee / hr_manager / admin × все API) —
БД для неё не нужна.

### E2E на живом Postgres (Playwright)

```bash
pnpm exec playwright install chromium   # один раз
pnpm db:migrate && pnpm init:users
pnpm build
pnpm test:e2e                           # сам поднимет next start на :3100
```

| Сьют | Что проверяет |
|------|---------------|
| `e2e/core-flow.spec.ts` | login → dashboard → задача → чат → заявка → отпуск |
| `e2e/page-walk.spec.ts` | все страницы под тремя ролями: статус, ошибки JS, 5xx, LCP |
| `e2e/stand-verification.spec.ts` | пункты TZ v2 на реальной БД: проекты, опросы, поиск, комментарии к заявкам, согласование отпуска |

Если сервер уже запущен: `E2E_BASE_URL=http://127.0.0.1:3100 pnpm test:e2e`.

### Аудит и замеры

```bash
python scripts/audit-route-auth.py      # у каждого API-обработчика есть проверка доступа
python scripts/audit-live.py --runs 8   # статусы и TTFB по ролям (на production-сборке)
python scripts/page-walk-summary.py     # LCP и замечания после pnpm test:e2e
python scripts/pg-log-top.py <pg.log>   # топ SQL по логу Postgres
psql "$DATABASE_URL" -f scripts/seed-perf.sql   # нагрузочные данные (только dev/стенд)
```

Реестр находок — [`BUGS.md`](BUGS.md), baseline — [`orchestrator_doc/archive/PERF-BASELINE.md`](orchestrator_doc/archive/PERF-BASELINE.md).

### Без Docker

Если Docker недоступен, Postgres 16 с pgvector поднимается из pip-пакета `pgserver`:

```bash
pip install pgserver
POSTGRES_PASSWORD=<пароль из DATABASE_URL> SNARK_PGPORT=5433 python scripts/dev-postgres.py start
```

MinIO и Redis при этом не запускаются: файловое хранилище работает как mock, realtime — in-process.

---

## Сервер (Windows, продакшен)

Сервер: `192.168.1.236`. На сервере всё нативное, **без Docker**: PostgreSQL, MinIO, Redis и Python-сервис протоколов — отдельные процессы; портал держит **NSSM**-сервис `snark-portal` (`next start -p 3000`).

Подробный runbook: [`orchestrator_doc/DEPLOY.md`](orchestrator_doc/DEPLOY.md).

### Выкатка обновлений

```
cd C:\apps\snark-portal
git pull origin main
pnpm install
pnpm db:migrate
pnpm build
nssm restart snark-portal
# + перезапуск Python API и Celery worker
```

### Живёт только на сервере (нет в git)

- `.env.local` — секреты портала
- `services/protocols/.env.local` — секреты Python-сервиса
- `.bat`-скрипт деплоя

---

## Ассистент по базе знаний (RAG)

Раздел портала `/assistant`: сотрудник задаёт вопрос по регламентам и получает ответ со ссылкой на документ
и раздел. Поиск и эмбеддинги работают в своём контуре (pgvector в базе портала, локальная модель
`multilingual-e5-large`); наружу уходит только вызов LLM. Дизайн и открытые вопросы —
[`docs/DESIGN_ASSISTANT_RAG.md`](docs/DESIGN_ASSISTANT_RAG.md), контракт —
[`orchestrator_doc/API_CONTRACT.md`](orchestrator_doc/API_CONTRACT.md).

Запуск на стенде:

```bash
# 1. Портал: поле documents.rag_status
pnpm db:migrate

# 2. Роль БД и схема rag (один раз, от владельца базы портала)
psql "$DATABASE_URL" -v rag_password="'<пароль>'" -f scripts/rag-role.sql

# 3. Python-сервис: RAG_DATABASE_URL, INTERNAL_TOKEN, LLM_PROVIDER в services/protocols/.env
cd services/protocols
alembic -c alembic_rag.ini upgrade head
uvicorn src.main:app --port 8000
celery -A src.core.celery_app worker -B        # индексация и сверка; без Redis — CELERY_TASK_ALWAYS_EAGER=true

# 4. Документы
pnpm seed:content <каталог с docx> [manifest.json]
```

Дальше в `/admin/assistant` → «Документы и индексация» выставить документу статус «Актуален».
В индекс попадают только такие документы и опубликованные статьи базы знаний; формат файлов в v1 — docx.

Проверки:

```bash
cd services/protocols
pytest                                                   # unit; интеграционные пропускаются без БД
RAG_TEST_DATABASE_URL=postgresql+asyncpg://… pytest      # + права доступа, архив, дубли на пустой тестовой БД
pytest -m eval tests/eval -s                             # оценка качества на реальной LLM (платно)
python scripts/e5_smoke.py                               # проверка модели эмбеддингов
```

E2E портала `e2e/assistant.spec.ts` требует запущенный сервис и демо-документ
(`python services/protocols/scripts/make_demo_docx.py <dir> && pnpm seed:content <dir>`); без них пропускается.

Ограничения текущего состояния: системный промт — заготовка, порог релевантности не откалиброван,
оценка качества не проведена ([`docs/EVAL_ASSISTANT_RAG.md`](docs/EVAL_ASSISTANT_RAG.md)).

---

## О модуле протоколов

Исходный проект HR-бота (Module 3) интегрирован в `services/protocols/`:

- STT (faster-whisper / Yandex SpeechKit)
- Диаризация спикеров (pyannote)
- LLM-генерация протокола и поручений
- Шифрование файлов (FZ-152)
- Экспорт DOCX

Подробности: `services/protocols/README.md`
