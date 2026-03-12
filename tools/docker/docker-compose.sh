#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

source "$REPO_ROOT/tools/docker/docker-desktop-env.sh"

docker compose "$@"
