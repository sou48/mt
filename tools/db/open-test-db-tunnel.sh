#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

DEPLOY_HOST="${DEPLOY_HOST:-133.117.74.156}"
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_PORT="${DEPLOY_PORT:-22}"
DEPLOY_REMOTE_DIR="${DEPLOY_REMOTE_DIR:-/opt/mt}"
DEPLOY_SSH_KEY="${DEPLOY_SSH_KEY:-$REPO_ROOT/conoha.pem}"
LOCAL_DB_PORT="${LOCAL_DB_PORT:-55432}"

if [[ ! -f "$DEPLOY_SSH_KEY" ]]; then
  echo "SSH秘密鍵が見つかりません: $DEPLOY_SSH_KEY" >&2
  exit 1
fi

chmod 600 "$DEPLOY_SSH_KEY"

if ss -ltn | grep -q ":${LOCAL_DB_PORT} "; then
  echo "ローカル ${LOCAL_DB_PORT} 番ポートは既に使用中です。既存トンネルまたは PostgreSQL を確認してください。"
  exit 0
fi

SSH_OPTS=(
  -i "$DEPLOY_SSH_KEY"
  -p "$DEPLOY_PORT"
  -o BatchMode=yes
  -o ExitOnForwardFailure=yes
  -o ServerAliveInterval=30
  -o ServerAliveCountMax=3
  -o StrictHostKeyChecking=accept-new
)

DB_CONTAINER_IP="$(
  ssh "${SSH_OPTS[@]}" "${DEPLOY_USER}@${DEPLOY_HOST}" \
    "cd '$DEPLOY_REMOTE_DIR' && docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' mt-db"
)"

if [[ -z "$DB_CONTAINER_IP" ]]; then
  echo "mt-db コンテナの IP を取得できませんでした。" >&2
  exit 1
fi

echo "テストDBトンネルを開始します: 127.0.0.1:${LOCAL_DB_PORT} -> ${DB_CONTAINER_IP}:5432"
exec ssh "${SSH_OPTS[@]}" -N -L "${LOCAL_DB_PORT}:${DB_CONTAINER_IP}:5432" "${DEPLOY_USER}@${DEPLOY_HOST}"
