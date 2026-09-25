#!/usr/bin/env bash

set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"

for command_name in node pnpm docker; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name" >&2
    echo "See docs/DEVELOPMENT.md for installation instructions." >&2
    exit 1
  fi
done

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose is required. Install the Docker Compose plugin and retry." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker is installed, but the daemon is unavailable to this user." >&2
  echo "Start Docker Desktop/Engine or fix Docker socket permissions, then retry." >&2
  exit 1
fi

if [[ ! -f server/.env ]]; then
  cp server/.env.example server/.env
  echo "Created server/.env"
else
  echo "Keeping existing server/.env"
fi

if [[ ! -f client/.env.local ]]; then
  cp client/.env.example client/.env.local
  echo "Created client/.env.local"
else
  echo "Keeping existing client/.env.local"
fi

echo "Installing client dependencies..."
(cd client && pnpm install --frozen-lockfile)

echo "Installing server dependencies..."
(cd server && pnpm install --frozen-lockfile)

echo "Starting PostgreSQL..."
(cd server && docker compose up -d --wait postgres)

echo "Preparing the database..."
(cd server && pnpm prisma generate && pnpm prisma migrate deploy)

echo
echo "Setup complete. Run 'make dev', then open http://localhost:3000."
