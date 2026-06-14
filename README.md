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

## Тестирование

### Быстрый старт (mock-режим, без БД)

```bash
# .env.local
USE_MOCK_DB=true
pnpm dev
```

Работают: задачи, чат (in-memory), остальной портал на моках. Протоколы требуют Python-сервис.

### Полный стек

1. `docker compose up -d`
2. `pnpm db:migrate && pnpm init:users`
3. `USE_MOCK_DB=false` в `.env.local`
4. `pnpm dev`
5. Запустите `services/protocols` (API + Celery)
6. Войдите на http://localhost:3000/login

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

---

## Сервер (Windows, продакшен)

На сервере всё нативное, **без Docker**: PostgreSQL, MinIO, Redis и Python-сервис протоколов — отдельные процессы; портал держит PM2.

### Выкатка обновлений

```
cd C:\apps\snark-portal
git pull origin main
pnpm install
pnpm db:migrate
pnpm build
pm2 restart snark-portal
# + перезапуск Python API, Celery worker
```

### Живёт только на сервере (нет в git)

- `.env.local` — секреты портала
- `services/protocols/.env.local` — секреты Python-сервиса
- `ecosystem.config.js` — конфиг PM2

---

## О модуле протоколов

Исходный проект HR-бота (Module 3) интегрирован в `services/protocols/`:

- STT (faster-whisper / Yandex SpeechKit)
- Диаризация спикеров (pyannote)
- LLM-генерация протокола и поручений
- Шифрование файлов (FZ-152)
- Экспорт DOCX

Подробности: `services/protocols/README.md`
