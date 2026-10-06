#!/usr/bin/env bash
# Пересобирает портал и перезапускает production-сервер на порту E2E (по умолчанию 3100).
#   bash scripts/restart-prod.sh [--no-build]
set -euo pipefail

PORT="${E2E_PORT:-3100}"
LOG="${TMPDIR:-${TEMP:-/tmp}}/snark-next-start.log"

if command -v powershell.exe >/dev/null 2>&1; then
  powershell.exe -NoProfile -Command \
    "Get-NetTCPConnection -LocalPort ${PORT} -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id \$_.OwningProcess -Force -ErrorAction SilentlyContinue }" \
    >/dev/null 2>&1 || true
else
  (lsof -ti "tcp:${PORT}" | xargs -r kill -9) 2>/dev/null || true
fi

if [ "${1:-}" != "--no-build" ]; then
  pnpm build >"${LOG}.build" 2>&1 || { tail -30 "${LOG}.build"; exit 1; }
fi

if command -v powershell.exe >/dev/null 2>&1; then
  # Git Bash не отпускает вызывающую оболочку, пока жив фоновый потомок:
  # на Windows сервер запускается отдельным процессом через PowerShell.
  powershell.exe -NoProfile -Command     "Start-Process -WindowStyle Hidden -FilePath node -ArgumentList 'node_modules/next/dist/bin/next','start','-p','${PORT}'"     >/dev/null 2>&1
else
  nohup pnpm exec next start -p "${PORT}" >"${LOG}" 2>&1 &
fi

for _ in $(seq 1 60); do
  if curl -s -o /dev/null "http://127.0.0.1:${PORT}/login"; then
    echo "portal ready on :${PORT}"
    exit 0
  fi
  sleep 1
done
echo "portal did not start, see ${LOG}" >&2
exit 1
