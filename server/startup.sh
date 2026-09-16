#!/bin/sh
# Do NOT copy .env.example here — the real .env must be mounted/injected
# by the deployment environment. Overwriting it silently with example defaults
# would expose insecure credentials in production.

# Run pending migrations (deploy mode — never runs generators or dev seeds).
# Skip if DATABASE_URL is unset (e.g. no-database deployment).
if [ -n "$DATABASE_URL" ]; then
  npx prisma migrate deploy
fi

npm run start:prod
