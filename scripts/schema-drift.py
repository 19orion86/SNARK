"""Сравнивает структуру двух дампов `pg_dump -s` (построчно, по колонкам и объектам).

Использование:
    python scripts/schema-drift.py <dump_мигрированной_БД.sql> <dump_эталона_schema_ts.sql>

Нужен для контроля дрейфа: миграции, написанные руками, должны давать ту же
структуру, что и `lib/db/schema.ts`.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path


def split_columns(body: str) -> list[str]:
    cols: list[str] = []
    depth = 0
    cur = ""
    for ch in body:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == "," and depth == 0:
            cols.append(cur.strip())
            cur = ""
        else:
            cur += ch
    cols.append(cur.strip())
    return cols


def normalize(path: str) -> set[str]:
    text = Path(path).read_text(encoding="utf-8")
    out: set[str] = set()
    for raw in re.split(r";\n", text):
        lines = [ln for ln in raw.splitlines() if ln.strip() and not ln.startswith("--")]
        stmt = re.sub(r"\s+", " ", " ".join(lines)).strip()
        if not stmt or stmt.startswith(("SET ", "SELECT pg_catalog", chr(92))):
            continue
        if "drizzle" in stmt:
            continue
        # Имена ограничений различаются у ручных миграций (`_fkey`) и drizzle (`_fk`):
        # это косметика, сравниваем только определение.
        stmt = re.sub(r"ADD CONSTRAINT \S+ ", "ADD CONSTRAINT * ", stmt)
        match = re.match(r"CREATE TABLE (\S+) \((.*)\)$", stmt)
        if match:
            for col in split_columns(match.group(2)):
                col = re.sub(r"^CONSTRAINT \S+ ", "CONSTRAINT * ", col)
                out.add(f"COLUMN {match.group(1)}: {col}")
        else:
            out.add(stmt)
    return out


def main() -> int:
    migrated, reference = normalize(sys.argv[1]), normalize(sys.argv[2])
    only_db = sorted(migrated - reference)
    only_schema = sorted(reference - migrated)
    print(f"=== только в мигрированной БД (нет в schema.ts): {len(only_db)} ===")
    for item in only_db:
        print("  " + item[:300])
    print(f"=== только в schema.ts (нет в мигрированной БД): {len(only_schema)} ===")
    for item in only_schema:
        print("  " + item[:300])
    return 1 if (only_db or only_schema) else 0


if __name__ == "__main__":
    sys.exit(main())
