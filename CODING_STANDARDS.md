### 3. Файл: CODING_STANDARDS.md

```markdown
# СТАНДАРТЫ КОДИРОВАНИЯ

## Python
- Python 3.12
- async/await везде, где возможно (кроме 1С-коннектора)
- Все эндпоинты FastAPI — async
- Pydantic v2 (model_config = ConfigDict(...))

## FastAPI
- Все роуты в api/v1/
- Использовать APIRouter с префиксом
- Response модели всегда указывать

## Aiogram 3
- Все handlers в bots/telegram/handlers/
- Использовать Router + include_router
- Состояния — через FSMContext (отдельный класс в core)

## LangChain / RAG
- Все промпты выносить в prompts/ как .txt или .jinja2
- Использовать только существующий RAGService
- Не создавать новые цепочки без согласования

## 1С интеграция
- Использовать только OneCConnector из core
- Все вызовы — через HTTP/OData (COM запрещён в проде)

## База данных
- SQLAlchemy 2.0 style (async)
- Миграции — Alembic
- Никаких raw SQL без необходимости

## Логирование
- structlog
- Уровень INFO и выше — только важные события
- Ошибки — с полным traceback

## Именование
- Модели БД: EmployeeOnboarding
- Схемы: OnboardingCreateSchema
- Сервисы: OnboardingService
- Handlers: onboarding_router

## Коммиты
Формат:
feat(onboarding): добавить персонализированный welcome-message
fix(protocols): исправить парсинг action items