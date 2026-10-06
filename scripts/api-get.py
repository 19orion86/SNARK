"""GET к API портала под dev-учёткой (для ручной проверки на стенде).

    python scripts/api-get.py employee /api/chat/channels [--base http://127.0.0.1:3100]

Печатает статус и начало JSON. Пароль берётся из .env.local и не выводится.
"""

from __future__ import annotations

import http.cookiejar
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

PREFIX = {"admin": "DEV_ADMIN", "hr_manager": "DEV_HR", "employee": "DEV_EMPLOYEE"}


def main() -> None:
    role, path = sys.argv[1], sys.argv[2]
    base = sys.argv[4] if len(sys.argv) > 4 and sys.argv[3] == "--base" else "http://127.0.0.1:3100"
    env = dict(
        line.split("=", 1)
        for line in Path(".env.local").read_text(encoding="utf-8").splitlines()
        if "=" in line and not line.startswith("#")
    )
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    credentials = {"email": env[f"{PREFIX[role]}_EMAIL"], "password": env[f"{PREFIX[role]}_PASSWORD"]}
    opener.open(
        urllib.request.Request(
            f"{base}/api/auth/login",
            data=json.dumps(credentials).encode(),
            headers={"content-type": "application/json"},
        )
    )
    try:
        with opener.open(f"{base}{path}") as response:
            print(response.status, response.read().decode("utf-8")[:3000])
    except urllib.error.HTTPError as error:
        print(error.code, error.read().decode("utf-8")[:1000])


if __name__ == "__main__":
    main()
