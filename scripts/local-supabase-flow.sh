#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ORIGINAL_ARGS=("$@")
START_DEV=1
RUN_SMOKE=0
RESET_DB=0
LOCAL_ONLY=0
REQUIRE_SUPABASE=0
ACTIVE_MODE="supabase"

for arg in "$@"; do
  case "$arg" in
    --no-dev)
      START_DEV=0
      ;;
    --smoke)
      START_DEV=0
      RUN_SMOKE=1
      ;;
    --local-only)
      LOCAL_ONLY=1
      ;;
    --require-supabase)
      REQUIRE_SUPABASE=1
      ;;
    --reset-db)
      RESET_DB=1
      ;;
    -h|--help)
      cat <<'USAGE'
Usage: scripts/local-supabase-flow.sh [--no-dev] [--smoke] [--local-only] [--require-supabase] [--reset-db]

Runs the local Supabase + Next.js setup for Agarwood AI.

Options:
  --no-dev             Prepare Supabase/.env.local only; do not start Next.js.
  --smoke              Start Next.js temporarily, upload sample knowledge, and call chat API.
  --local-only         Skip Supabase and start with local JSON/sample-data fallback.
  --require-supabase   Fail instead of falling back when Docker/Supabase is unavailable.
  --reset-db           Reset local Supabase DB and re-run schema. This deletes local Supabase data.
USAGE
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

require_command() {
  local name="$1"
  local install_hint="$2"
  if ! command_exists "$name"; then
    echo "Missing command: $name" >&2
    echo "$install_hint" >&2
    exit 1
  fi
}

check_node_version() {
  require_command node "Install Node.js 20.9.0+, then retry."

  local is_supported
  is_supported="$(node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.stdout.write(major > 20 || (major === 20 && minor >= 9) ? "yes" : "no")')"
  if [ "$is_supported" != "yes" ]; then
    if [ "${AGARWOOD_NODE_REEXEC:-0}" != "1" ]; then
      local candidate_dir
      for candidate_dir in \
        /opt/homebrew/opt/node@20/bin \
        /usr/local/opt/node@20/bin \
        "$HOME/.nvm/versions/node/v20/bin"; do
        if [ -x "${candidate_dir}/node" ]; then
          local candidate_supported
          candidate_supported="$("${candidate_dir}/node" -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.stdout.write(major > 20 || (major === 20 && minor >= 9) ? "yes" : "no")')"
          if [ "$candidate_supported" = "yes" ]; then
            echo "Switching to $(${candidate_dir}/node -v) from ${candidate_dir} ..."
            export PATH="${candidate_dir}:$PATH"
            export AGARWOOD_NODE_REEXEC=1
            exec "$0" "${ORIGINAL_ARGS[@]}"
          fi
        fi
      done
    fi

    echo "Node.js $(node -v) is too old. Use Node.js >=20.9.0, then retry." >&2
    exit 1
  fi

  require_command npm "Install npm with Node.js 20.9.0+, then retry."
}

read_env_value() {
  local key="$1"
  local default_value="$2"
  if [ -f .env.local ]; then
    local value
    value="$(grep -E "^${key}=" .env.local | tail -n 1 | cut -d '=' -f 2- || true)"
    if [ -n "$value" ]; then
      printf '%s' "$value"
      return
    fi
  fi
  if [ -f .env.example ]; then
    local value
    value="$(grep -E "^${key}=" .env.example | tail -n 1 | cut -d '=' -f 2- || true)"
    if [ -n "$value" ]; then
      printf '%s' "$value"
      return
    fi
  fi
  printf '%s' "$default_value"
}

wait_for_http() {
  local url="$1"
  local label="$2"
  local attempts="${3:-60}"
  local pid="${4:-}"
  local log_file="${5:-}"
  for _ in $(seq 1 "$attempts"); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "$label is ready: $url"
      return 0
    fi
    if [ -n "$pid" ] && ! kill -0 "$pid" >/dev/null 2>&1; then
      echo "$label exited before it became ready." >&2
      if [ -n "$log_file" ] && [ -f "$log_file" ]; then
        echo "Last log lines from $log_file:" >&2
        tail -n 80 "$log_file" >&2
      fi
      return 1
    fi
    sleep 1
  done
  echo "Timed out waiting for $label: $url" >&2
  if [ -n "$log_file" ] && [ -f "$log_file" ]; then
    echo "Last log lines from $log_file:" >&2
    tail -n 80 "$log_file" >&2
  fi
  return 1
}

raise_file_limit() {
  local current_limit
  current_limit="$(ulimit -n)"
  if [ "$current_limit" != "unlimited" ] && [ "$current_limit" -lt 8192 ] 2>/dev/null; then
    ulimit -n 8192 2>/dev/null || true
  fi
}

install_dependencies() {
  if [ ! -d node_modules ]; then
    echo "Installing npm dependencies..."
    npm install
  else
    echo "npm dependencies already installed."
  fi
}

write_local_only_env() {
  ACTIVE_MODE="local-only"
  local openai_chat_model
  local openai_embedding_model
  openai_chat_model="$(read_env_value OPENAI_CHAT_MODEL gpt-4o-mini)"
  openai_embedding_model="$(read_env_value OPENAI_EMBEDDING_MODEL text-embedding-3-small)"

  cat > .env.local <<EOF
OPENAI_API_KEY=
OPENAI_CHAT_MODEL=${openai_chat_model}
OPENAI_EMBEDDING_MODEL=${openai_embedding_model}

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
EOF

  echo "Wrote .env.local for local-only mode."
}

can_use_supabase() {
  command_exists docker && command_exists supabase && docker info >/dev/null 2>&1
}

prepare_supabase() {
  ACTIVE_MODE="supabase"
  require_command docker "Install Docker Desktop and start it, or run with --local-only."
  require_command supabase "Install Supabase CLI with: brew install supabase/tap/supabase"

  if ! docker info >/dev/null 2>&1; then
    echo "Docker is not running. Start Docker Desktop, or run with --local-only." >&2
    exit 1
  fi

  if [ ! -f supabase/config.toml ]; then
    echo "Initializing local Supabase project..."
    supabase init
  fi

  mkdir -p supabase/migrations
  cp supabase/schema.sql supabase/migrations/00000000000000_initial_schema.sql

  echo "Starting local Supabase..."
  supabase start

  if [ "$RESET_DB" -eq 1 ]; then
    echo "Resetting local Supabase database..."
    supabase db reset --local
  else
    echo "Applying local schema migrations..."
    if ! supabase migration up --local; then
      echo "Could not apply migrations incrementally."
      echo "Run again with --reset-db to rebuild the local database from supabase/schema.sql."
      exit 1
    fi
  fi

  local status_output
  local supabase_url
  local supabase_anon_key
  local supabase_service_role_key
  status_output="$(supabase status)"
  supabase_url="$(printf '%s\n' "$status_output" | awk -F': ' '/API URL/{print $2; exit}')"
  supabase_anon_key="$(printf '%s\n' "$status_output" | awk -F': ' '/anon key/{print $2; exit}')"
  supabase_service_role_key="$(printf '%s\n' "$status_output" | awk -F': ' '/service_role key/{print $2; exit}')"

  if [ -z "$supabase_url" ] || [ -z "$supabase_anon_key" ] || [ -z "$supabase_service_role_key" ]; then
    echo "Could not read local Supabase credentials from 'supabase status'." >&2
    echo "$status_output" >&2
    exit 1
  fi

  local openai_api_key
  local openai_chat_model
  local openai_embedding_model
  openai_api_key="$(read_env_value OPENAI_API_KEY "")"
  openai_chat_model="$(read_env_value OPENAI_CHAT_MODEL gpt-4o-mini)"
  openai_embedding_model="$(read_env_value OPENAI_EMBEDDING_MODEL text-embedding-3-small)"

  cat > .env.local <<EOF
OPENAI_API_KEY=${openai_api_key}
OPENAI_CHAT_MODEL=${openai_chat_model}
OPENAI_EMBEDDING_MODEL=${openai_embedding_model}

NEXT_PUBLIC_SUPABASE_URL=${supabase_url}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${supabase_anon_key}
SUPABASE_SERVICE_ROLE_KEY=${supabase_service_role_key}
EOF

  echo "Wrote .env.local for local Supabase:"
  echo "  NEXT_PUBLIC_SUPABASE_URL=${supabase_url}"
  echo "  NEXT_PUBLIC_SUPABASE_ANON_KEY=<local anon key>"
  echo "  SUPABASE_SERVICE_ROLE_KEY=<local service role key>"
}

run_smoke_test() {
  require_command curl "Install curl, then retry."
  LOG_FILE="${TMPDIR:-/tmp}/agarwood-ai-next.log"
  echo "Starting Next.js temporarily for smoke test..."
  raise_file_limit
  npm run dev >"$LOG_FILE" 2>&1 &
  DEV_PID="$!"
  trap 'kill "$DEV_PID" >/dev/null 2>&1 || true' EXIT

  wait_for_http "http://127.0.0.1:3000" "Next.js" 60 "$DEV_PID" "$LOG_FILE"

  echo "Uploading sample knowledge file..."
  curl -fsS \
    -F "file=@knowledge/agarwood-products.md;type=text/markdown" \
    "http://127.0.0.1:3000/api/knowledge/upload"
  echo

  echo "Reading knowledge records..."
  curl -fsS "http://127.0.0.1:3000/api/knowledge/documents"
  echo

  echo "Calling encyclopedia chat API..."
  curl -fsS \
    -H "Content-Type: application/json" \
    -d '{"module":"encyclopedia","message":"商品录入时需要记录哪些字段？"}' \
    "http://127.0.0.1:3000/api/chat" | sed -n '1,20p'
  echo
  echo "Smoke test complete. Next.js log: $LOG_FILE"
  exit 0
}

check_node_version
install_dependencies

if [ "$LOCAL_ONLY" -eq 1 ]; then
  write_local_only_env
elif can_use_supabase; then
  prepare_supabase
elif [ "$REQUIRE_SUPABASE" -eq 1 ]; then
  prepare_supabase
else
  echo "Docker/Supabase is unavailable; falling back to local-only mode."
  echo "Run with --require-supabase if you want this to fail instead."
  write_local_only_env
fi

if [ "$RUN_SMOKE" -eq 1 ]; then
  run_smoke_test
fi

if [ "$START_DEV" -eq 1 ]; then
  echo "Starting app at http://127.0.0.1:3000 ..."
  raise_file_limit
  exec npm run dev
fi

if [ "$ACTIVE_MODE" = "local-only" ]; then
  echo "Local-only environment is ready. Run 'npm run dev' to start the app."
else
  echo "Local Supabase is ready. Run 'npm run dev' to start the app."
fi
