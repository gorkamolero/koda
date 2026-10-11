#!/bin/bash
# Runs the collaborator's side of the two-machine recording on this machine:
# its own Koda sidecar and frontend, plus a headless Chromium whose debugging
# port stays on localhost (the director reaches it through an SSH tunnel).
# Usage: collaborator.sh start|stop|status
set -euo pipefail
export PATH="/opt/homebrew/bin:$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
STATE="${KODA_DEMO_DIR:-$HOME/koda-demo}"
RPC_PORT="${KODA_DEMO_RPC_PORT:-3949}"
VITE_PORT="${KODA_DEMO_VITE_PORT:-5273}"
BROWSER_PORT="${KODA_DEMO_BROWSER_PORT:-9333}"

kill_tree() {
  local child
  for child in $(pgrep -P "$1"); do kill_tree "$child"; done
  kill -TERM "$1" 2>/dev/null || true
}

stop_one() {
  local file="$STATE/$1.pid"
  [ -f "$file" ] || return 0
  local pid; pid="$(cat "$file")"
  if kill -0 "$pid" 2>/dev/null; then kill_tree "$pid"; fi
  rm -f "$file"
}

start() {
  mkdir -p "$STATE/data"
  export KODA_DATA_DIR="$STATE/data" KODA_DB_PATH="$STATE/data/koda.db" KODA_SOCKET="$STATE/koda.sock"
  export KODA_USER_NAME="${KODA_USER_NAME:-Alex}" KODA_HTTP_HOST=localhost KODA_HTTP_PORT="$RPC_PORT"
  export KODA_COLLAB_MODE=development
  export KODA_MODE=local KODA_AUTH_ENABLED=false GIT_TERMINAL_PROMPT=0
  export VITE_PORT="$VITE_PORT" VITE_HTTP_RPC_PORT="$RPC_PORT" KODA_CORS_ORIGINS="http://localhost:$VITE_PORT"
  local chrome
  chrome="$(ls -d "$HOME"/Library/Caches/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-mac-arm64/chrome-headless-shell | tail -1)"
  cd "$ROOT"
  # The project launcher loads the collaborator's own env file.
  nohup node scripts/run.mjs sidecar < /dev/null > "$STATE/sidecar.log" 2>&1 & echo $! > "$STATE/sidecar.pid"
  (cd apps/desktop && nohup node node_modules/vite/bin/vite.js --host localhost --port "$VITE_PORT" --strictPort < /dev/null > "$STATE/frontend.log" 2>&1 & echo $! > "$STATE/frontend.pid")
  # 1.5× device scale: each 1280×1440 page renders and captures at 1920×2160.
  nohup "$chrome" --remote-debugging-port="$BROWSER_PORT" --force-device-scale-factor=1.5 --user-data-dir="$STATE/browser-profile" \
    --no-first-run --no-default-browser-check about:blank < /dev/null > "$STATE/browser.log" 2>&1 & echo $! > "$STATE/browser.pid"
  for _ in $(seq 1 60); do
    if curl -fs "http://localhost:$RPC_PORT/rpc" -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"ping"}' >/dev/null 2>&1 \
      && curl -fs "http://localhost:$VITE_PORT" >/dev/null 2>&1 \
      && curl -fs "http://127.0.0.1:$BROWSER_PORT/json/version" >/dev/null 2>&1; then
      echo "ready rpc=$RPC_PORT frontend=$VITE_PORT browser=$BROWSER_PORT"
      exit 0
    fi
    sleep 1
  done
  echo "collaborator did not start; see $STATE/*.log" >&2
  exit 1
}

stop() {
  stop_one browser; stop_one frontend; stop_one sidecar
  echo stopped
}

status() {
  for name in sidecar frontend browser; do
    if [ -f "$STATE/$name.pid" ] && kill -0 "$(cat "$STATE/$name.pid")" 2>/dev/null; then echo "$name running"; else echo "$name stopped"; fi
  done
}

case "${1:-}" in
  start) start ;;
  stop) stop ;;
  status) status ;;
  *) echo "usage: $0 start|stop|status" >&2; exit 2 ;;
esac
