#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

DEPLOY_HOST="${DEPLOY_HOST:-133.117.74.156}"
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_PORT="${DEPLOY_PORT:-22}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
DEPLOY_REMOTE_DIR="${DEPLOY_REMOTE_DIR:-/opt/mt}"
DEPLOY_REPO_URL="${DEPLOY_REPO_URL:-https://github.com/sou48/mt.git}"
DEPLOY_SSH_KEY="${DEPLOY_SSH_KEY:-$REPO_ROOT/conoha.pem}"
DEPLOY_SYNC_MODE="${DEPLOY_SYNC_MODE:-local}"

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

echo "[deploy] 接続確認"
ssh_exec "hostname >/dev/null"

echo "[deploy] 配置先準備: $DEPLOY_REMOTE_DIR"
ssh_exec "mkdir -p '$DEPLOY_REMOTE_DIR'"

echo "[deploy] 共有ネットワーク確認"
ssh_exec "docker network inspect shared_proxy_net >/dev/null 2>&1 || docker network create shared_proxy_net >/dev/null"

if [[ "$DEPLOY_SYNC_MODE" == "git" ]]; then
  echo "[deploy] Git同期"
  ssh_exec "
  set -euo pipefail
  if [ ! -d '$DEPLOY_REMOTE_DIR/.git' ]; then
    git clone --branch '$DEPLOY_BRANCH' '$DEPLOY_REPO_URL' '$DEPLOY_REMOTE_DIR'
  else
    cd '$DEPLOY_REMOTE_DIR'
    git fetch origin '$DEPLOY_BRANCH'
    git checkout '$DEPLOY_BRANCH'
    git pull --ff-only origin '$DEPLOY_BRANCH'
  fi
  "
else
  echo "[deploy] ローカル作業ツリー同期"
  tar \
    --exclude=.git \
    --exclude=node_modules \
    --exclude=conoha.pem \
    --exclude='.env' \
    --exclude='.env.local' \
    --exclude='.env.*.local' \
    -czf - . | ssh_exec "tar -xzf - -C '$DEPLOY_REMOTE_DIR'"
fi

echo "[deploy] 本番用 .env 準備"
ssh_exec "
set -euo pipefail
cd '$DEPLOY_REMOTE_DIR'
mkdir -p deploy/mt
if [ ! -f .env ]; then
  cp deploy/mt/.env.example .env
fi
"

echo "[deploy] Docker再構築"
ssh_exec "
set -euo pipefail
cd '$DEPLOY_REMOTE_DIR'
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
"

echo "[deploy] ヘルスチェック"
ssh_exec "cd '$DEPLOY_REMOTE_DIR' && docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T mt-web wget -qO- http://127.0.0.1/health"

echo "[deploy] 完了"
