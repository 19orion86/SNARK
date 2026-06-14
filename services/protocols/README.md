# СНАРК-бот (HR): Module 3 — Протоколы совещаний

Репозиторий содержит каркас проекта на **Python 3.12** и реализацию **Модуля 3**: пайплайн обработки аудиозаписей совещаний (STT + диаризация + LLM) с сохранением в PostgreSQL, уведомлениями в Telegram и созданием задач в 1С:ЗУП.

## Стек

- **Backend**: FastAPI (async)
- **Bot**: Aiogram 3.x
- **Очереди**: Celery + Redis
- **Хранилище**: PostgreSQL (SQLAlchemy 2.0 async)
- **STT**: faster-whisper (локально) / Yandex SpeechKit (по настройкам)
- **Diarization**: pyannote.audio (HF token)
- **LLM**: через `RAGService` (YandexGPT / GigaChat — stub, требуется подключение API)
- **Безопасность**: шифрование Fernet (ФЗ-152)
- **Логи**: structlog

## Структура

Ключевые файлы Модуля 3:

- `src/modules/protocols/models.py` — SQLAlchemy модели:
  - `MeetingProtocol`
  - `MeetingActionItem`
  - `MeetingToneAnalysis`
- `src/modules/protocols/schemas.py` — Pydantic v2 схемы (structured output и API)
- `src/modules/protocols/service.py` — `ProtocolService` (STT → diarization → LLM → 1С)
- `src/modules/protocols/tasks.py` — Celery tasks (обработка, уведомления, напоминания)
- `src/modules/protocols/handlers.py` — Aiogram Router: `/protocol`, загрузка файла, `/protocol_status`, `/my_protocols`
- `src/api/v1/protocols.py` — FastAPI endpoints:
  - `POST /api/v1/protocols/upload`
  - `GET /api/v1/protocols/`
  - `GET /api/v1/protocols/{id}`
  - `PATCH /api/v1/protocols/action-items/{id}/status`
- `src/modules/protocols/prompts/*.jinja2` — jinja2 промпты

Данные (аудио) сохраняются в `src/static/meetings/` **в зашифрованном виде**.

## Быстрый старт (локально)

### Подключение коллеги к проекту (Windows, 10 минут)

1. Установить инструменты:
   - Python 3.12
   - Docker Desktop
   - Git
2. Клонировать репозиторий:
   - `git clone <repo-url>`
   - `cd hr`
3. Выполнить bootstrap-скрипт:
   - `powershell -ExecutionPolicy Bypass -File .\scripts\bootstrap.ps1`
4. Открыть `.env` и заполнить обязательные ключи:
   - `TELEGRAM_BOT_TOKEN`
   - `ENCRYPTION_KEY`
   - `HF_TOKEN`
   - при необходимости ключи LLM/STT провайдеров
5. Запустить сервисы в отдельных терминалах:
   - API: `uvicorn src.main:app --reload --host 0.0.0.0 --port 8000`
   - Worker: `celery -A src.core.celery_app.app.celery_app worker -l info --pool=solo`
   - Bot: `python -m src.bots.telegram.bot`

Если Docker уже запущен и инфраструктура поднята, можно использовать:
`powershell -ExecutionPolicy Bypass -File .\scripts\bootstrap.ps1 -SkipDocker`

### 1) Требования

- Python **3.12**
- PostgreSQL
- Redis

### 2) Установка зависимостей

Рекомендуется venv.

```bash
python -m venv .venv
.\.venv\Scripts\activate
pip install -U pip
pip install -e .
```

### 3) Настройка окружения

1. Скопируйте `.env.example` → `.env`
2. Заполните минимум:
   - `DATABASE_URL`
   - `REDIS_URL`, `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`
   - `TELEGRAM_BOT_TOKEN`
   - `ENCRYPTION_KEY` (Fernet key)
   - `HF_TOKEN` (для pyannote)

Сгенерировать Fernet key можно так:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### 4) Миграции БД (Alembic)

Alembic уже настроен:
- `alembic.ini`
- `alembic/env.py`
- первая ревизия: `alembic/versions/20260410_000001_create_protocol_tables.py`

Применить миграции:

```bash
alembic upgrade head
```

Проверить текущую ревизию:

```bash
alembic current
```

### 5) Запуск Celery worker

```bash
celery -A src.core.celery_app.app.celery_app worker -l info
```

На **Windows** в `src/core/celery_app/app.py` по умолчанию выставлен пул **`solo`** (prefork/billiard часто даёт `PermissionError` на семафорах). При необходимости можно явно указать: `celery ... worker -l info --pool=solo`.

Опционально для периодических задач (напоминания/светофоры) нужно настроить Celery Beat.

### 6) Запуск инфраструктуры (Docker)

```bash
docker compose up -d
```

Это поднимет:
- PostgreSQL на `localhost:5432`
- Redis на `localhost:6379`

### 7) Запуск API и Telegram-бота

API (FastAPI):

```bash
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000

# Удобный веб-интерфейс загрузки и сравнения:
# http://localhost:8000/
```

Telegram-бот (Aiogram):

```bash
python -m src.bots.telegram.bot
```

### 8) Local Telegram Bot API Server (для файлов >20 МБ)

Стандартный Telegram Bot API ограничивает скачивание файлов **20 МБ**.
Для загрузки файлов до **2 ГБ** нужен локальный Bot API Server:

```bash
docker run -d --name telegram-bot-api \
  -p 8081:8081 \
  -e TELEGRAM_API_ID=<your_api_id> \
  -e TELEGRAM_API_HASH=<your_api_hash> \
  -e TELEGRAM_LOCAL=1 \
  -v telegram-bot-api-data:/var/lib/telegram-bot-api \
  aiogram/telegram-bot-api
```

Получить `TELEGRAM_API_ID` и `TELEGRAM_API_HASH`: [https://my.telegram.org/apps](https://my.telegram.org/apps).

Затем в `src/bots/telegram/bot.py` при создании `Bot` укажите `api` параметр:

```python
from aiogram.client.session.aiohttp import AiohttpSession

session = AiohttpSession(api=TelegramAPIServer.from_base("http://localhost:8081"))
bot = Bot(token=token, session=session)
```

## Использование (Telegram)

1. В Telegram выполните команду `/protocol`
2. Пройдите шаги: название → дата → участники → файл
3. Отправляйте аудио **как документ** (скрепка → Файл), чтобы сохранить качество
4. Проверка статуса: `/protocol_status <id>`
5. Список протоколов: `/my_protocols`

## Использование (API)

`POST /api/v1/protocols/upload` принимает `multipart/form-data`:
- `file` — аудиофайл
- `title` — название
- `meeting_date` — дата (YYYY-MM-DD)
- `participants` — строка через запятую
- `source` — `web` (по умолчанию)

Полезные endpoint'ы:
- `GET /api/v1/protocols/{id}` — детали протокола (включая `transcript_text` и `protocol_text`)
- `GET /api/v1/protocols/{id}/export-docx` — скачать готовый протокол в `.docx`

## Важно про 1С-коннектор

В структуре проекта сохранена папка `src/core/1c_connector/` для соответствия правилам, но **Python-пакет не может начинаться с цифры**.
Фактический импорт коннектора используется из `src/core/onec_connector/`.

## Что дальше

- Подключить реальные API для `RAGService` (YandexGPT/GigaChat) в `src/core/rag/service.py`
- Настроить Alembic и создать миграции под модели протоколов
- Настроить Celery Beat для напоминаний и светофоров
- Написать тесты (pytest) для `ProtocolRepository` и основных сценариев

