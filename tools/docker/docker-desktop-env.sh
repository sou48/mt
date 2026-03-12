#!/usr/bin/env bash
set -euo pipefail

DOCKER_SOCKET_PATH="${DOCKER_SOCKET_PATH:-/mnt/wsl/docker-desktop-bind-mounts/Ubuntu/docker.sock}"

if [[ ! -S "$DOCKER_SOCKET_PATH" ]]; then
  if command -v wsl.exe >/dev/null 2>&1; then
    wsl.exe -d docker-desktop sh -lc 'true' >/dev/null 2>&1 || true
  fi
fi

if [[ ! -S "$DOCKER_SOCKET_PATH" ]]; then
  echo "Docker Desktop の共有ソケットが見つかりません: $DOCKER_SOCKET_PATH" >&2
  echo "Docker Desktop を起動し、必要なら WSL 連携を有効化してください。" >&2
  exit 1
fi

export DOCKER_HOST="unix://$DOCKER_SOCKET_PATH"

if [[ "${1:-}" == "--print" ]]; then
  echo "$DOCKER_HOST"
fi
