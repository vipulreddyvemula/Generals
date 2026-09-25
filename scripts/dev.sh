#!/usr/bin/env bash

set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"

if [[ ! -f server/.env || ! -f client/.env.local ]]; then
  echo "Local environment files are missing. Run 'make setup' first." >&2
  exit 1
fi

children=()

stop_children() {
  trap - EXIT INT TERM
  for child in "${children[@]:-}"; do
    if kill -0 "$child" 2>/dev/null; then
      kill "$child" 2>/dev/null || true
    fi
  done
  wait 2>/dev/null || true
}

trap stop_children EXIT INT TERM

echo "Starting server on http://localhost:3001 ..."
(cd server && pnpm run dev) &
children+=("$!")

echo "Starting client on http://localhost:3000 ..."
(cd client && pnpm run dev) &
children+=("$!")

while true; do
  for child in "${children[@]}"; do
    if ! kill -0 "$child" 2>/dev/null; then
      wait "$child"
      exit $?
    fi
  done
  sleep 1
done
