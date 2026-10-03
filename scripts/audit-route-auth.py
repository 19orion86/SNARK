"""Статический аудит: у каждого HTTP-обработчика в app/api должна быть проверка доступа.

middleware.ts пропускает весь `/api/*` без проверки сессии, поэтому каждый
route handler обязан сам вызвать requireAuth / requireRole / проверку
X-Internal-Token. Скрипт печатает обработчики без такой проверки и завершается
с кодом 1, если найден обработчик вне списка осознанно публичных.

    python scripts/audit-route-auth.py
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

AUTH_PATTERN = re.compile(
    r"requireAuth|requireRole|assertInternalToken"
)
HANDLER_SPLIT = re.compile(r"\nexport async function (GET|POST|PUT|PATCH|DELETE)\b")

# Обработчики, которые обязаны работать без сессии.
PUBLIC_HANDLERS = {
    ("app/api/auth/login/route.ts", "POST"),
    ("app/api/auth/logout/route.ts", "POST"),
    ("app/api/auth/refresh/route.ts", "POST"),
}


def main() -> int:
    offenders: list[tuple[str, str]] = []
    for path in sorted(Path("app/api").rglob("route.ts")):
        rel = path.as_posix()
        parts = HANDLER_SPLIT.split(path.read_text(encoding="utf-8"))
        for index in range(1, len(parts), 2):
            method, body = parts[index], parts[index + 1]
            if AUTH_PATTERN.search(body):
                continue
            if (rel, method) in PUBLIC_HANDLERS:
                continue
            offenders.append((rel, method))

    for rel, method in offenders:
        print(f"NO AUTH: {method:6} {rel}")
    print(f"handlers without auth check: {len(offenders)}")
    return 1 if offenders else 0


if __name__ == "__main__":
    sys.exit(main())
