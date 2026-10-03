"""Живой обход портала: статусы и TTFB страниц и GET-API для каждой роли.

Запускать против production-сборки (`next build && next start`), не против
`pnpm dev`: dev-замеры не годятся как baseline.

    python scripts/audit-live.py --base http://127.0.0.1:3100 --runs 5 --out audit.json

Учётки берутся из .env.local (DEV_*_EMAIL / DEV_*_PASSWORD), в вывод не попадают.
"""

from __future__ import annotations

import argparse
import http.cookiejar
import json
import statistics
import time
import urllib.error
import urllib.request
from pathlib import Path

PAGES = [
    "/dashboard", "/news", "/contacts", "/structure", "/documents", "/knowledge",
    "/protocols", "/tasks", "/crm", "/chat", "/profile", "/support", "/calendar",
    "/booking", "/about", "/vacations/calendar",
    "/admin", "/admin/users", "/admin/employees", "/admin/departments", "/admin/news",
    "/admin/knowledge", "/admin/tickets", "/admin/ticket-sla", "/admin/support-categories",
    "/admin/vacations", "/admin/tasks", "/admin/chat", "/admin/structure-import",
]

API_GET = [
    "/api/dashboard", "/api/dashboard/widgets", "/api/users/me", "/api/birthdays",
    "/api/employees", "/api/departments/tree", "/api/documents", "/api/news", "/api/knowledge",
    "/api/events?year=2026&month=10", "/api/notifications", "/api/notifications/preferences",
    "/api/tasks", "/api/tasks/stats", "/api/tasks/dashboard", "/api/task-projects",
    "/api/task-templates", "/api/automation-rules", "/api/chat/channels", "/api/chat/folders",
    "/api/chat/search?q=test", "/api/deals", "/api/deal-stages", "/api/tickets",
    "/api/ticket-categories", "/api/vacations", "/api/vacations/balance",
    "/api/vacations/calendar", "/api/protocols", "/api/push/vapid-public-key",
    "/api/admin/users", "/api/admin/employees", "/api/admin/departments", "/api/admin/news",
    "/api/admin/knowledge", "/api/admin/tickets", "/api/admin/ticket-categories",
    "/api/admin/ticket-sla", "/api/admin/vacations", "/api/admin/events",
]

ROLES = {"admin": "DEV_ADMIN", "hr_manager": "DEV_HR", "employee": "DEV_EMPLOYEE"}


def read_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key, value = line.split("=", 1)
            env[key.strip()] = value.strip()
    return env


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):  # noqa: ANN002, ANN003
        return None


def make_opener() -> urllib.request.OpenerDirector:
    jar = http.cookiejar.CookieJar()
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar), NoRedirect())


def fetch(opener: urllib.request.OpenerDirector, url: str) -> tuple[int, float, int, str]:
    """Возвращает (status, ttfb_ms, bytes, location)."""
    started = time.perf_counter()
    try:
        with opener.open(urllib.request.Request(url), timeout=60) as response:
            first = response.read(1)
            ttfb = (time.perf_counter() - started) * 1000
            body = first + response.read()
            return response.status, ttfb, len(body), ""
    except urllib.error.HTTPError as error:
        ttfb = (time.perf_counter() - started) * 1000
        return error.code, ttfb, 0, error.headers.get("location", "")


def login(base: str, email: str, password: str) -> urllib.request.OpenerDirector | None:
    opener = make_opener()
    request = urllib.request.Request(
        f"{base}/api/auth/login",
        data=json.dumps({"email": email, "password": password}).encode(),
        headers={"content-type": "application/json"},
        method="POST",
    )
    try:
        with opener.open(request, timeout=60) as response:
            return opener if response.status == 200 else None
    except urllib.error.HTTPError:
        return None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://127.0.0.1:3100")
    parser.add_argument("--runs", type=int, default=5)
    parser.add_argument("--out", default="")
    args = parser.parse_args()

    env = read_env(Path(".env.local"))
    sessions: dict[str, urllib.request.OpenerDirector | None] = {"anonymous": make_opener()}
    for role, prefix in ROLES.items():
        sessions[role] = login(args.base, env[f"{prefix}_EMAIL"], env[f"{prefix}_PASSWORD"])
        print(f"login {role}: {'ok' if sessions[role] else 'FAILED'}")

    results = []
    for kind, paths in (("page", PAGES), ("api", API_GET)):
        for path in paths:
            row: dict[str, object] = {"kind": kind, "path": path}
            for role, opener in sessions.items():
                if opener is None:
                    row[role] = {"status": None}
                    continue
                samples = [fetch(opener, args.base + path) for _ in range(args.runs)]
                ttfbs = sorted(sample[1] for sample in samples[1:] or samples)
                row[role] = {
                    "status": samples[-1][0],
                    "ttfb_ms_median": round(statistics.median(ttfbs), 1),
                    "ttfb_ms_max": round(ttfbs[-1], 1),
                    "bytes": samples[-1][2],
                    "location": samples[-1][3],
                }
            results.append(row)
            cells = "  ".join(
                f"{role[:5]}={row[role]['status']}/{row[role].get('ttfb_ms_median', '-')}"  # type: ignore[index, union-attr]
                for role in sessions
            )
            print(f"{kind:4} {path:42} {cells}")

    if args.out:
        Path(args.out).write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
