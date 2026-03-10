#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

DEPLOY_HOST="${DEPLOY_HOST:-133.117.74.156}"
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_PORT="${DEPLOY_PORT:-22}"
DEPLOY_REMOTE_DIR="${DEPLOY_REMOTE_DIR:-/opt/infra-proxy}"
DEPLOY_SSH_KEY="${DEPLOY_SSH_KEY:-$REPO_ROOT/conoha.pem}"

if [[ ! -f "$DEPLOY_SSH_KEY" ]]; then
  echo "SSH秘密鍵が見つかりません: $DEPLOY_SSH_KEY" >&2
  exit 1
fi

chmod 600 "$DEPLOY_SSH_KEY"

SSH_OPTS=(
  -i "$DEPLOY_SSH_KEY"
  -p "$DEPLOY_PORT"
  -o BatchMode=yes
  -o StrictHostKeyChecking=accept-new
)

ssh_exec() {
  ssh "${SSH_OPTS[@]}" "${DEPLOY_USER}@${DEPLOY_HOST}" "$@"
}

echo "[infra-proxy] 接続確認"
ssh_exec "hostname >/dev/null"

echo "[infra-proxy] ディレクトリとネットワーク準備"
ssh_exec "
set -euo pipefail
mkdir -p '$DEPLOY_REMOTE_DIR/letsencrypt'
touch '$DEPLOY_REMOTE_DIR/letsencrypt/acme.json'
chmod 600 '$DEPLOY_REMOTE_DIR/letsencrypt/acme.json'
"

echo "[infra-proxy] 設定同期"
tar \
  --exclude=.git \
  --exclude=node_modules \
  --exclude=conoha.pem \
  -czf - deploy/infra-proxy | ssh_exec "
set -euo pipefail
mkdir -p '$DEPLOY_REMOTE_DIR'
tar -xzf - -C '$DEPLOY_REMOTE_DIR' --strip-components=2
cd '$DEPLOY_REMOTE_DIR'
if [ ! -f .env ]; then
  cp .env.example .env
fi
"

echo "[infra-proxy] 起動"
ssh_exec "
set -euo pipefail
cd '$DEPLOY_REMOTE_DIR'
docker compose up -d
docker compose ps
"

echo "[infra-proxy] 完了"
