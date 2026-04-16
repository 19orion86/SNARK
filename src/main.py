from fastapi import FastAPI

from src.api.v1.protocols import router as protocols_router

app = FastAPI(
    title="SNARK HR Bot API",
    version="0.1.0",
    description=(
        "API сервиса автоматизации HR-процессов.\n\n"
        "Быстрый старт:\n"
        "1. Откройте раздел `protocols`.\n"
        "2. Выберите `POST /api/v1/protocols/upload`.\n"
        "3. Нажмите `Try it out`, затем выберите файл в поле `file`.\n"
        "4. Заполните `title` и `meeting_date` и отправьте запрос."
    ),
    swagger_ui_parameters={
        "docExpansion": "list",
        "defaultModelsExpandDepth": -1,
        "displayRequestDuration": True,
        "filter": True,
        "persistAuthorization": True,
    },
)

app.include_router(protocols_router)


@app.get("/health", tags=["system"])
async def health() -> dict[str, str]:
    return {"status": "ok"}
