#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

DEPLOY_HOST="${DEPLOY_HOST:-133.117.74.156}"
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_PORT="${DEPLOY_PORT:-22}"
DEPLOY_REMOTE_DIR="${DEPLOY_REMOTE_DIR:-/opt/mt}"
DEPLOY_SSH_KEY="${DEPLOY_SSH_KEY:-$REPO_ROOT/conoha.pem}"

if [[ ! -f "$DEPLOY_SSH_KEY" ]]; then
  echo "SSH秘密鍵が見つかりません: $DEPLOY_SSH_KEY" >&2
  exit 1
fi

chmod 600 "$DEPLOY_SSH_KEY"

ssh -i "$DEPLOY_SSH_KEY" \
  -p "$DEPLOY_PORT" \
  -o BatchMode=yes \
  -o StrictHostKeyChecking=accept-new \
  "${DEPLOY_USER}@${DEPLOY_HOST}" \
  "set -euo pipefail; cd '$DEPLOY_REMOTE_DIR'; docker compose -f docker-compose.yml -f docker-compose.prod.yml ps; docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T mt-web wget -qO- http://127.0.0.1/health"
