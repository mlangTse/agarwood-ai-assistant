#!/usr/bin/env bash
set -euo pipefail

APP_NAME="agarwood-ai"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-3000}"
BASE_PATH="${NEXT_PUBLIC_BASE_PATH:-/agarwood}"
DOMAIN="${DOMAIN:-mlangtse.top}"
LOCAL_ONLY=0
SKIP_MIGRATE=0
SKIP_WIKI_SYNC=0
SKIP_START=0

usage() {
  cat <<EOF
Usage: scripts/deploy-tencent.sh [--local] [--skip-migrate] [--skip-wiki-sync] [--skip-start]

Builds and starts Agarwood AI for Tencent Cloud behind:
  https://${DOMAIN}${BASE_PATH}

Environment is read from .env.production first, then .env.local.
Required for production:
  DATABASE_URL
  MODEL_API_BASE_URL
  MODEL_API_KEY

Options:
  --local         Use .env.local and skip pm2 start; useful on a developer machine.
  --skip-migrate Do not run db/schema.sql.
  --skip-wiki-sync
                  Do not rebuild knowledge/wiki or sync it to PostgreSQL RAG tables.
  --skip-start   Build only; do not start/reload the app process.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --local)
      LOCAL_ONLY=1
      ;;
    --skip-migrate)
      SKIP_MIGRATE=1
      ;;
    --skip-wiki-sync)
      SKIP_WIKI_SYNC=1
      ;;
    --skip-start)
      SKIP_START=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
  shift
done

cd "$APP_DIR"

ENV_FILE=".env.production"
if [ "$LOCAL_ONLY" -eq 1 ] || [ ! -f "$ENV_FILE" ]; then
  ENV_FILE=".env.local"
fi

if [ ! -f "$ENV_FILE" ]; then
  cp .env.example "$ENV_FILE"
  echo "Created ${ENV_FILE}. Fill in DATABASE_URL and MODEL_API_KEY, then rerun this script."
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

export NEXT_TELEMETRY_DISABLED=1
export NEXT_PUBLIC_BASE_PATH="${NEXT_PUBLIC_BASE_PATH:-$BASE_PATH}"
export PORT

echo "Installing dependencies..."
npm ci

if [ "$SKIP_MIGRATE" -eq 0 ]; then
  if [ -n "${DATABASE_URL:-}" ] && command -v psql >/dev/null 2>&1; then
    echo "Applying PostgreSQL schema..."
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/schema.sql
  else
    echo "Skipping schema migration. Install psql and set DATABASE_URL to enable it."
  fi
fi

if [ "$SKIP_WIKI_SYNC" -eq 0 ]; then
  echo "Building LLM Wiki from knowledge/raw..."
  npm run wiki:build
  if [ -n "${DATABASE_URL:-}" ]; then
    echo "Syncing LLM Wiki into PostgreSQL RAG tables..."
    npm run wiki:sync
  else
    echo "DATABASE_URL is not set; LLM Wiki will be used in local fallback mode only."
  fi
fi

echo "Building Next.js app for ${NEXT_PUBLIC_BASE_PATH}..."
npm run build

mkdir -p deploy
cat > deploy/nginx-agarwood.conf <<EOF
server {
  listen 80;
  server_name ${DOMAIN} www.${DOMAIN};

  client_max_body_size 25m;

  location = ${NEXT_PUBLIC_BASE_PATH} {
    proxy_pass http://127.0.0.1:${PORT};
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_buffering off;
  }

  location ${NEXT_PUBLIC_BASE_PATH}/ {
    proxy_pass http://127.0.0.1:${PORT};
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_buffering off;
  }
}
EOF

if [ "$SKIP_START" -eq 1 ] || [ "$LOCAL_ONLY" -eq 1 ]; then
  echo "Build complete. Start manually with: PORT=${PORT} npm run start"
  echo "Nginx config written to deploy/nginx-agarwood.conf"
  exit 0
fi

if command -v pm2 >/dev/null 2>&1; then
  echo "Starting app with pm2..."
  pm2 start npm --name "$APP_NAME" -- run start --update-env || pm2 reload "$APP_NAME" --update-env
  pm2 save
else
  echo "pm2 is not installed. Start manually with: PORT=${PORT} npm run start"
fi

echo "Deploy complete:"
echo "  App:    http://127.0.0.1:${PORT}${NEXT_PUBLIC_BASE_PATH}"
echo "  Health: http://127.0.0.1:${PORT}${NEXT_PUBLIC_BASE_PATH}/api/health"
echo "  Nginx:  deploy/nginx-agarwood.conf"
