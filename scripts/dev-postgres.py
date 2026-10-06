"""Локальный Postgres 16 + pgvector без Docker (для машин без виртуализации).

Использование (из venv сервиса протоколов, пакет pgserver):
    python scripts/dev-postgres.py start   # поднять сервер на 127.0.0.1:5432
    python scripts/dev-postgres.py stop

Основной способ по-прежнему `docker compose up -d postgres`. Этот скрипт нужен
только там, где Docker Desktop недоступен. Каталог данных задаётся переменной
SNARK_PGDATA. Пути к данным и к бинарникам должны быть ASCII: initdb падает с
`invalid byte sequence for encoding "UTF8"`, если в пути есть кириллица. В таком
случае скопируйте `<venv>/Lib/site-packages/pgserver/pginstall` в ASCII-каталог
и укажите его в SNARK_PGHOME.
"""

from __future__ import annotations

import os
import subprocess
import sys
import tempfile
from pathlib import Path

import pgserver

PORT = os.environ.get("SNARK_PGPORT", "5432")
DB_NAME = "portal_dev"
DB_USER = "portal_dev"


def data_dir() -> Path:
    raw = os.environ.get("SNARK_PGDATA")
    return Path(raw) if raw else Path(tempfile.gettempdir()) / "snark-pgdata"


def bin_path(name: str) -> str:
    # SNARK_PGHOME: копия pginstall в ASCII-каталоге, если venv лежит в пути с кириллицей.
    home = os.environ.get("SNARK_PGHOME")
    root = Path(home) if home else Path(pgserver.__file__).parent / "pginstall"
    return str(root / "bin" / name)


def run(args: list[str], check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, check=check, text=True, capture_output=True)


def start() -> None:
    pgdata = data_dir()
    password = os.environ.get("POSTGRES_PASSWORD", "")
    if not password:
        sys.exit("POSTGRES_PASSWORD не задан (тот же, что в DATABASE_URL из .env.local)")

    if not (pgdata / "PG_VERSION").exists():
        pgdata.mkdir(parents=True, exist_ok=True)
        pwfile = pgdata.parent / "snark-pgpass.tmp"
        pwfile.write_text(password, encoding="utf-8")
        try:
            run(
                [
                    bin_path("initdb"),
                    "-D", str(pgdata),
                    "-U", DB_USER,
                    "--auth=scram-sha-256",
                    f"--pwfile={pwfile}",
                    "--encoding=UTF8",
                    "--locale=C",
                ]
            )
        finally:
            pwfile.unlink(missing_ok=True)

    status = run([bin_path("pg_ctl"), "-D", str(pgdata), "status"], check=False)
    if status.returncode != 0:
        subprocess.run(
            [
                bin_path("pg_ctl"),
                "-D", str(pgdata),
                "-l", str(pgdata.parent / "snark-postgres.log"),
                "-o", f"-p {PORT} -c listen_addresses=127.0.0.1",
                "-w", "start",
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

    env = {**os.environ, "PGPASSWORD": password}
    exists = subprocess.run(
        [bin_path("psql"), "-h", "127.0.0.1", "-p", PORT, "-U", DB_USER, "-d", "postgres",
         "-tAc", f"SELECT 1 FROM pg_database WHERE datname='{DB_NAME}'"],
        env=env, text=True, capture_output=True, check=True,
    ).stdout.strip()
    if exists != "1":
        subprocess.run(
            [bin_path("createdb"), "-h", "127.0.0.1", "-p", PORT, "-U", DB_USER, DB_NAME],
            env=env, check=True,
        )
    print(f"postgres ready: 127.0.0.1:{PORT}/{DB_NAME} (data: {pgdata})")


def stop() -> None:
    subprocess.run([bin_path("pg_ctl"), "-D", str(data_dir()), "-m", "fast", "stop"], check=False)


if __name__ == "__main__":
    command = sys.argv[1] if len(sys.argv) > 1 else "start"
    {"start": start, "stop": stop}.get(command, start)()
