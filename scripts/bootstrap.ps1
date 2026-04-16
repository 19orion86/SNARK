Param(
    [switch]$SkipDocker
)

$ErrorActionPreference = "Stop"

Write-Host "==> Creating virtual environment (if needed)"
if (-not (Test-Path ".venv")) {
    python -m venv .venv
}

Write-Host "==> Activating virtual environment"
. .\.venv\Scripts\Activate.ps1

Write-Host "==> Installing dependencies"
python -m pip install -U pip
pip install -e .

Write-Host "==> Preparing .env file"
if (-not (Test-Path ".env")) {
    Copy-Item .env.example .env
    Write-Host "Created .env from .env.example. Fill secrets before run."
} else {
    Write-Host ".env already exists. Skipping copy."
}

if (-not $SkipDocker) {
    Write-Host "==> Starting infrastructure with docker compose"
    docker compose up -d
}

Write-Host "==> Running database migrations"
alembic upgrade head

Write-Host ""
Write-Host "Bootstrap complete."
Write-Host "Next steps:"
Write-Host "1) Fill required keys in .env (TELEGRAM_BOT_TOKEN, ENCRYPTION_KEY, HF_TOKEN, etc.)"
Write-Host "2) Start API: uvicorn src.main:app --reload --host 0.0.0.0 --port 8000"
Write-Host "3) Start worker: celery -A src.core.celery_app.app.celery_app worker -l info --pool=solo"
