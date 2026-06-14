# Contributing

Thank you for your interest in improving this project.

## Development setup

1. Create and activate virtual environment.
2. Install dependencies:
   - `pip install -U pip`
   - `pip install -e .`
3. Copy `.env.example` to `.env` and fill required values.
4. Start infrastructure with `docker compose up -d`.
5. Apply DB migrations with `alembic upgrade head`.

## Pull requests

- Create a feature branch from `main`.
- Keep changes focused and small.
- Add or update tests when behavior changes.
- Ensure code quality checks pass before opening a PR.

## Code style

- Follow project standards in `CODING_STANDARDS.md`.
- Use clear naming and keep functions focused.

## Commit messages

Use concise messages describing intent and impact.
