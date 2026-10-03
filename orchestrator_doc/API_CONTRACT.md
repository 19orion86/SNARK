# SNARK — API Contract: Portal ↔ Protocols

Контракт между **snark-portal** (Next.js) и **snark-protocols** (Python FastAPI).
Источники: `lib/protocols/client.ts`, `app/api/protocols/*`, `services/protocols/src/api/v1/protocols.py`.

При изменении API — **сначала** `snark-protocols`, **затем** portal proxy и UI.

---

## 1. Транспорт и конфигурация

| Переменная | Где | Назначение |
|------------|-----|------------|
| `PROTOCOLS_API_URL` | portal `.env.local` | Base URL Python API (default `http://localhost:8000`) |
| `PORTAL_INTERNAL_URL` | protocols `.env.local` | URL портала для webhook sync |
| `INTERNAL_TOKEN` | оба сервиса | Shared secret для internal routes |

Прокси-клиент: `lib/protocols/client.ts` → `proxyProtocolsRequest(path, init)`.

---

## 2. Публичный поток (browser → portal → Python)

Все маршруты портала требуют **JWT-сессию** (`requireAuth`). Портал добавляет поля при upload.

### 2.1 Upload

| Portal | Python |
|--------|--------|
| `POST /api/protocols/upload` | `POST /api/v1/protocols/upload` |

**Portal добавляет в FormData:**
- `source` = `"web"`
- `uploaded_by_user_id` = JWT `userId`

**Python принимает (multipart/form-data):**
- `file` — аудио/видео (max 2 GB)
- `title`, `meeting_date`, `participants` (опционально)
- `source`: `telegram` | `web`
- `uploaded_by_user_id` (для web)

**Ответ:** `201` + `ProtocolUploadResponseSchema` (`id`, `status`, …)

**Ошибки portal:**
- `503` + `PROTOCOLS_UNAVAILABLE` — Python не запущен
- `PROTOCOLS_UPLOAD_FAILED` — upstream error

### 2.2 List

| Portal | Python |
|--------|--------|
| `GET /api/protocols?...` | `GET /api/v1/protocols/?...` |

Query params пробрасываются как есть.

### 2.3 Detail

| Portal | Python |
|--------|--------|
| `GET /api/protocols/{id}` | `GET /api/v1/protocols/{id}` |

Включает `transcript_text`, `protocol_text`, action items.

### 2.4 Export DOCX

| Portal | Python |
|--------|--------|
| `GET /api/protocols/{id}/export-docx` | `GET /api/v1/protocols/{id}/export-docx` (или stream через Python) |

Возвращает `application/vnd.openxmlformats-officedocument.wordprocessingml.document`.

---

## 3. Python-only endpoints (прямой доступ / Telegram)

Доступны на `:8000` без portal proxy (для бота и отладки):

| Method | Path | Назначение |
|--------|------|------------|
| GET | `/api/v1/protocols/{id}/celery-status` | Статус Celery-задачи |
| POST | `/api/v1/protocols/{id}/retry-processing` | Повторная обработка |
| PATCH | `/api/v1/protocols/action-items/{id}/status` | Статус поручения |

При добавлении в UI портала — создать соответствующий `app/api/protocols/...` proxy.

---

## 4. Internal webhook (Python → Portal)

| Caller | Endpoint | Auth |
|--------|----------|------|
| Python `ProtocolService` | `POST /api/internal/protocols/action-items/sync` | `X-Internal-Token` |

**Payload (JSON):**

```json
{
  "protocolId": 1,
  "protocolTitle": "Совещание",
  "meetingDate": "2026-07-15",
  "actionItems": [
    {
      "id": 1,
      "text": "Подготовить отчёт",
      "assignee": "Иванов Иван Иванович",
      "deadline": "2026-07-20",
      "priority": "high"
    }
  ]
}
```

**Поведение portal:** `syncProtocolActionItems()` — создаёт задачи, матчинг assignee по точному ФИО (`lib/protocols/match-assignee.ts`).

**Ошибки:**
- `401` — неверный `X-Internal-Token`
- `400` — `INVALID_PAYLOAD`

---

## 5. Статусы и enum

### ProtocolStatus

`uploaded` → `processing` → `transcribing` → `generating` → `completed` | `failed`

### ActionItemStatus

`pending` | `in_progress` | `done` | `overdue` | `cancelled`

### UploadSource

`telegram` | `web`

Схемы: `services/protocols/src/modules/protocols/schemas.py` (`ProtocolStatusEnum`, `ActionItemStatusEnum`).

---

## 6. Пайплайн обработки (справка)

1. Upload → encrypt file (FZ-152) → Celery `process_meeting_audio`
2. STT → diarization → LLM (protocol + action items)
3. On `completed` → webhook sync → portal tasks

---

## 7. Verify при изменениях

**Protocols-first:**
```bash
cd services/protocols
ruff check src/
# pytest when available
curl http://localhost:8000/docs
```

**Portal:**
```bash
pnpm typecheck
pnpm test
# Manual: /protocols → upload → wait completed → tasks created
```

---

*При расхождении с кодом — код является источником истины; обновите этот контракт в той же сессии.*

---

## Ассистент по базе знаний (RAG)

Источники: `services/protocols/src/api/v1/assistant.py`, `lib/assistant/client.ts`, `app/api/assistant/*`,
`app/api/admin/assistant/*`, `app/api/admin/documents/[id]/*`. Дизайн: [`docs/DESIGN_ASSISTANT_RAG.md`](../docs/DESIGN_ASSISTANT_RAG.md).

Порядок изменений прежний: сначала Python API, затем прокси портала и UI.

### Конфигурация

| Переменная | Где | Назначение |
|------------|-----|------------|
| `RAG_DATABASE_URL` | protocols `.env` | база **портала** под ролью `snark_rag` (`scripts/rag-role.sql`) |
| `INTERNAL_TOKEN` | оба сервиса | обязателен: все маршруты ассистента отвечают 401 без `X-Internal-Token` |
| `EMBEDDING_PROVIDER` | protocols | `e5` (боевой) или `fake` (тесты, CI) |
| `LLM_PROVIDER` | protocols | `yandex_gpt`, `gigachat`, `nvidia_nim`, `fake` |
| `RAG_MIN_SCORE`, `RAG_TOP_K` | protocols | порог близости и число фрагментов |
| `RAG_STORAGE`, `S3_*`, `RAG_LOCAL_STORAGE_DIR` | protocols | откуда брать файлы по `documents.file_path` |

Миграции: `pnpm db:migrate` (поле `documents.rag_status`), затем
`alembic -c alembic_rag.ini upgrade head` (схема `rag`).

### Python (внутренние маршруты, `X-Internal-Token`)

| Маршрут | Запрос | Ответ |
|---------|--------|-------|
| `POST /api/v1/assistant/ask` | `{"user_id": uuid, "question": "1..2000"}`; лишние поля → 422 | 200 `AskResponse`; 404 пользователь не найден или неактивен; 502 ошибка LLM (обращение записано со статусом `error`) |
| `POST /api/v1/assistant/sources/{document\|article}/{id}/reindex` | — | 202 `{source_type, source_id, index_state: "pending", task_id}`; 404 источника нет ни в портале, ни в индексе |
| `GET /api/v1/assistant/sources?type=&ids=` | — | `[{source_type, source_id, index_state, error, chunk_count, version, indexed_at}]` |
| `POST /api/v1/assistant/queries/{id}/feedback` | `{"user_id": uuid, "value": 1 \| -1}` | 204; 404 обращение не принадлежит пользователю |
| `GET /api/v1/assistant/queries?status=&feedback=&limit=&offset=` | — | `{items, total, frequent}` |

`AskResponse`:

```json
{
  "query_id": "uuid",
  "status": "answered | no_info | contradiction",
  "answer": "…",
  "steps": ["…"],
  "responsible": "… | null",
  "deadline": "… | null",
  "sources": [{"source_type": "document", "source_id": "uuid", "title": "…", "version": "1.2", "section": "3. …"}]
}
```

Гарантии сервиса:

- роль и отдел читаются из `public.users`; полей с правами в запросе нет;
- проверка прав выполняется в том же SQL, что и векторный поиск; в LLM попадают только разрешённые фрагменты;
- `no_info` — ответ 200; ниже порога релевантности LLM не вызывается;
- у ответа `answered` и `contradiction` всегда есть источник из переданного контекста, иначе статус меняется на `no_info`;
- каждое обращение записывается в `rag.queries`, включая ошибки.

### Портал

| Маршрут портала | Доступ | Python |
|-----------------|--------|--------|
| `POST /api/assistant/ask` `{question}` | `requireAuth`; `user_id` берётся из JWT | `POST /ask` |
| `POST /api/assistant/feedback` `{queryId, value}` | `requireAuth` | `POST /queries/{id}/feedback` |
| `GET /api/admin/assistant/queries?status=&feedback=&page=` | admin, hr_manager | `GET /queries` + ФИО из `users` |
| `GET /api/admin/assistant/documents` | admin, hr_manager | документы портала + `GET /sources?type=document` |
| `PATCH /api/admin/documents/{id}/rag-status` `{ragStatus}` | admin, hr_manager | обновляет `documents.rag_status`, затем `POST /sources/document/{id}/reindex` |
| `POST /api/admin/documents/{id}/reindex` | admin, hr_manager | `POST /sources/document/{id}/reindex` |

Ошибки портала: `503 ASSISTANT_UNAVAILABLE` (сервис не запущен или нет `INTERNAL_TOKEN`),
`502 ASSISTANT_LLM_ERROR`, `400 INVALID_PAYLOAD`.

Создание, изменение и удаление статьи базы знаний (`/api/admin/knowledge*`) вызывает
`POST /sources/article/{id}/reindex`. Недоступность ассистента публикацию не блокирует:
расхождения подбирает периодическая сверка `assistant.reconcile` (Celery beat, раз в 10 минут).
