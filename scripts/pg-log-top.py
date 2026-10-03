"""Топ SQL-запросов по логу Postgres (замена pg_stat_statements для dev-стенда).

Перед замером включить логирование длительности:
    ALTER SYSTEM SET log_min_duration_statement = 0; SELECT pg_reload_conf();
После замера вернуть: ALTER SYSTEM RESET log_min_duration_statement; SELECT pg_reload_conf();

    python scripts/pg-log-top.py <postgres.log> [--top 15] [--since-offset BYTES]
"""

from __future__ import annotations

import argparse
import re
from collections import defaultdict
from pathlib import Path

ENTRY = re.compile(r"duration: ([\d.]+) ms\s+(?:statement|execute [^:]*): (.*)")


def normalize(sql: str) -> str:
    sql = re.sub(r"\s+", " ", sql).strip()
    sql = re.sub(r"'(?:[^']|'')*'", "?", sql)
    sql = re.sub(r"\$\d+", "?", sql)
    sql = re.sub(r"\b\d+\b", "?", sql)
    sql = re.sub(r"\((?:\?,\s*)+\?\)", "(?…)", sql)
    return sql


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("log")
    parser.add_argument("--top", type=int, default=15)
    parser.add_argument("--since-offset", type=int, default=0)
    args = parser.parse_args()

    raw = Path(args.log).read_bytes()[args.since_offset:].decode("utf-8", errors="replace")
    stats: dict[str, list[float]] = defaultdict(list)
    current: list[str] | None = None
    duration = 0.0

    def flush() -> None:
        if current is not None:
            stats[normalize(" ".join(current))].append(duration)

    for line in raw.splitlines():
        match = ENTRY.search(line)
        if match:
            flush()
            duration = float(match.group(1))
            current = [match.group(2)]
        elif current is not None and line.startswith(("\t", " ")):
            current.append(line.strip())
        else:
            flush()
            current = None
    flush()

    total = sum(sum(values) for values in stats.values()) or 1.0
    ranked = sorted(stats.items(), key=lambda item: sum(item[1]), reverse=True)
    print(f"запросов: {sum(len(v) for v in stats.values())}, уникальных: {len(stats)}, суммарно {total:.0f} мс\n")
    print("| # | Вызовов | Сумма, мс | Доля | Среднее, мс | Макс, мс | Запрос |")
    print("|---|---|---|---|---|---|---|")
    for index, (sql, values) in enumerate(ranked[: args.top], start=1):
        print(
            f"| {index} | {len(values)} | {sum(values):.0f} | {sum(values) / total:.0%} | "
            f"{sum(values) / len(values):.1f} | {max(values):.1f} | `{sql[:230]}` |"
        )


if __name__ == "__main__":
    main()
