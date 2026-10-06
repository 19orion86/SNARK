"""Сводка по e2e/.report/page-walk.json: LCP по страницам и замечания консоли.

    python scripts/page-walk-summary.py
"""

from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

report = json.loads(Path("e2e/.report/page-walk.json").read_text(encoding="utf-8"))

lcp: dict[str, dict[str, int | None]] = defaultdict(dict)
for row in report:
    if row["status"] == 200 and row["finalUrl"] == row["path"]:
        lcp[row["path"]][row["role"]] = row["lcpMs"]

print("| Страница | LCP admin, мс | LCP hr_manager, мс | LCP employee, мс |")
print("|---|---|---|---|")
for path, by_role in lcp.items():
    cells = [str(by_role.get(role, "—")) for role in ("admin", "hr_manager", "employee")]
    print(f"| `{path}` | " + " | ".join(cells) + " |")

print("\nЗамечания:")
seen: set[tuple[str, str]] = set()
for row in report:
    for kind in ("consoleErrors", "pageErrors", "serverErrors"):
        for message in row[kind]:
            key = (row["path"], message)
            if key in seen:
                continue
            seen.add(key)
            print(f"- [{kind}] {row['role']} {row['path']}: {message}")

print("\nДоступ (не 200 или редирект):")
for row in report:
    if row["status"] != 200 or row["finalUrl"] != row["path"]:
        print(f"- {row['role']} {row['path']}: HTTP {row['status']} → {row['finalUrl']}")
