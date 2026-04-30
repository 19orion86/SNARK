#!/usr/bin/env bash
set -euo pipefail

git add -A

git -c user.name="Vasilii" -c user.email="ig9573407@gmail.com" commit -m "$(cat <<'EOF'
feat: expand real-data architecture to documents and profile

Add server-first documents/profile integration with typed API contracts, mock/drizzle repository parity, RBAC-protected endpoints, audit logging, and storage abstraction stubs for future S3 presigned upload support.
EOF
)"
