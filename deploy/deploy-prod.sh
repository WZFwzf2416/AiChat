#!/usr/bin/env bash

set -Eeuo pipefail

APP_DIR="${APP_DIR:-/srv/aichat}"
BRANCH="${BRANCH:-master}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

cd "$APP_DIR"

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "Missing compose file: $APP_DIR/$COMPOSE_FILE" >&2
  exit 1
fi

if [ ! -f ".env.production" ]; then
  echo "Missing env file: $APP_DIR/.env.production" >&2
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Working tree is dirty. Commit or discard local changes before deploying." >&2
  exit 1
fi

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

set -a
source .env.production
set +a

docker-compose -f "$COMPOSE_FILE" run --rm migrate
docker-compose -f "$COMPOSE_FILE" up -d --build

docker-compose -f "$COMPOSE_FILE" ps
