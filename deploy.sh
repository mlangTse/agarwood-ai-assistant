#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-agarwood-ai}"
APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
PORT="${PORT:-3000}"
BASE_PATH="${NEXT_PUBLIC_BASE_PATH:-/agarwood}"
DOMAIN="${DOMAIN:-mlangtse.top}"
LOG_FILE="${LOG_FILE:-$APP_DIR/nextjs.log}"
PID_FILE="${PID_FILE:-$APP_DIR/.next-server.pid}"
LOCAL_ONLY=0
SKIP_MIGRATE=0
SKIP_WIKI_SYNC=0
SKIP_START=0

usage() {
  cat <<EOF
Usage: ./deploy.sh [--local] [--skip-migrate] [--skip-wiki-sync] [--skip-start]

Builds and starts Agarwood AI.

Environment is read from .env.production first, then .env.local.
Required for PostgreSQL RAG sync:
  DATABASE_URL

Options:
  --local          Use .env.local and skip pm2/nohup start.
  --skip-migrate  Do not run db/schema.sql.
  --skip-wiki-sync
                   Do not rebuild knowledge/wiki or sync it to PostgreSQL RAG tables.
  --skip-start    Build only; do not start/reload the app process.
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

echo "=========================================="
echo "Deploy started: $(date '+%Y-%m-%d %H:%M:%S')"
echo "App directory: $APP_DIR"
echo "Base path: ${NEXT_PUBLIC_BASE_PATH}"
echo "=========================================="

echo "[1/8] Cleaning old build files and caches..."
rm -rf .next tsconfig.tsbuildinfo

echo "[2/8] Installing dependencies..."
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

if [ "$SKIP_MIGRATE" -eq 0 ]; then
  echo "[3/8] Applying PostgreSQL schema..."
  if [ -n "${DATABASE_URL:-}" ] && command -v psql >/dev/null 2>&1; then
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/schema.sql
  else
    echo "Skipping schema migration. Install psql and set DATABASE_URL to enable it."
  fi
else
  echo "[3/8] Skipping PostgreSQL schema migration."
fi

if [ "$SKIP_WIKI_SYNC" -eq 0 ]; then
  echo "[4/8] Building LLM Wiki from knowledge/raw..."
  npm run wiki:build
  echo "[5/8] Checking fixed topic RAG routing..."
  npm run wiki:check-routing
  if [ -n "${DATABASE_URL:-}" ]; then
    echo "[6/8] Syncing LLM Wiki into PostgreSQL RAG tables..."
    npm run wiki:sync
  else
    echo "[6/8] DATABASE_URL is not set; LLM Wiki will use local fallback mode only."
  fi
else
  echo "[4/8] Skipping LLM Wiki build and PostgreSQL RAG sync."
  echo "[5/8] Skipping fixed topic RAG routing check."
  echo "[6/8] Skipping PostgreSQL RAG sync."
fi

echo "[7/8] Building Next.js app..."
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

echo "[8/8] Starting app..."
if command -v pm2 >/dev/null 2>&1; then
  pm2 start npm --name "$APP_NAME" -- run start --update-env || pm2 reload "$APP_NAME" --update-env
  pm2 save
else
  echo "pm2 is not installed; using nohup fallback."
  if [ -f "$PID_FILE" ]; then
    OLD_PID="$(cat "$PID_FILE" || true)"
    if [ -n "$OLD_PID" ]; then
      kill "$OLD_PID" 2>/dev/null || true
      sleep 2
    fi
    rm -f "$PID_FILE"
  fi

  if command -v lsof >/dev/null 2>&1; then
    PORT_PIDS="$(lsof -ti:"$PORT" 2>/dev/null || true)"
    if [ -n "$PORT_PIDS" ]; then
      echo "Stopping processes listening on port ${PORT}: ${PORT_PIDS}"
      echo "$PORT_PIDS" | xargs kill 2>/dev/null || true
      sleep 2
    fi
  elif command -v fuser >/dev/null 2>&1; then
    PORT_PIDS="$(fuser "${PORT}/tcp" 2>/dev/null || true)"
    if [ -n "$PORT_PIDS" ]; then
      echo "Stopping processes listening on port ${PORT}: ${PORT_PIDS}"
      fuser -k "${PORT}/tcp" 2>/dev/null || true
      sleep 2
    fi
  fi
  nohup npm run start > "$LOG_FILE" 2>&1 &
  echo "$!" > "$PID_FILE"
fi

echo "Deploy complete:"
echo "  App:    http://127.0.0.1:${PORT}${NEXT_PUBLIC_BASE_PATH}"
echo "  Health: http://127.0.0.1:${PORT}${NEXT_PUBLIC_BASE_PATH}/api/health"
echo "  Nginx:  deploy/nginx-agarwood.conf"
