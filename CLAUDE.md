# Repository Guide

This file provides concise repository context for coding assistants. Human setup
and operational instructions live in [docs/README.md](docs/README.md).

## Project

Generals (Gennia) is a real-time multiplayer strategy game inspired by
generals.io.

- **Client:** Next.js 13, React 18, TypeScript, Material UI, Emotion, and
  Socket.IO client
- **Server:** Express, Socket.IO, TypeScript, Prisma, and PostgreSQL
- **Live state:** authoritative and in memory in one game-server process
- **Durable state:** event/match metadata in PostgreSQL; replay JSON on local
  disk in development or private Azure Blob Storage in production

## First-time setup

Use Node.js 22, pnpm 9+, and Docker Compose.

```bash
make setup
make dev
```

Do not overwrite existing `server/.env` or `client/.env.local`. The setup
script intentionally preserves them. Full instructions are in
[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Repository map

```text
client/
  components/              shared UI, room shell, and game UI
  components/game/         map, replay, Commander, tutorial, and result UI
  context/                 game context and reducer
  lib/                     client domain types and map/player helpers
  pages/                   Next.js routes, including /admin and /replays
server/
  src/server.ts            Express/Socket.IO composition and event handlers
  src/lib/                 game domain, lifecycle, security, persistence
  src/lib/commander/       Math and Codeforces services
  prisma/                  PostgreSQL schema and committed migrations
  __tests__/               Jest unit and Socket.IO integration tests
docs/                      development, architecture, status, and operations
scripts/                   fresh-clone setup and combined dev launcher
```

## Common commands

```bash
make dev                 # client and server
make test                # server Jest suite, in band
make build               # TypeScript server + Next.js production build
make db-up               # PostgreSQL
make db-tools            # PostgreSQL + pgAdmin
make db-migrate          # Prisma generate + migrate deploy
```

Client-only checks:

```bash
cd client
pnpm run lint
pnpm run format
pnpm run build
```

Server-only checks:

```bash
cd server
pnpm test --runInBand
pnpm run build
```

## Architecture rules

- The server is authoritative for players, movement, combat, challenges, Energy,
  abilities, match outcome, and session ownership.
- Resolve mutating actions from the socket-to-player association. A public player
  ID is never authorization.
- Keep active rooms and tick state in memory. Do not add database work to every
  game tick.
- Start and finish matches through the guarded lifecycle helpers so intervals,
  reconnect timers, Commander state, match recording, and replay cleanup remain
  idempotent.
- Filter room/map state per player for fog of war.
- Use `MapDiff` for incremental updates rather than broadcasting full maps on
  every tick.
- Keep Math answers, admin tokens, reconnect credentials, database credentials,
  Azure credentials, and authorization headers out of client payloads and
  telemetry.
- Production supports exactly one authoritative game-server instance. Do not
  imply that a Socket.IO adapter alone makes the room model horizontally safe.

## Commander Mode

Current abilities are only `Scout`, `Reinforce`, and `Airstrike`. Blitz,
Fortify, and Supply Surge are intentionally removed from the active enums and UI.

Commander configuration is centralized in
`server/src/lib/commander/config.ts`. The client receives public configuration
from the server; server validation remains authoritative. Math challenge
`correctAnswer` must never survive player serialization. Codeforces requests
must continue to use the shared queue and its caching/backoff behavior.

See [docs/COMMANDER_STATUS.md](docs/COMMANDER_STATUS.md).

## Persistence and replays

Prisma models cover `Event`, `Match`, `MatchPlayer`, and `MatchEvent`.
`MatchRecorder` serializes writes per match and uses idempotency constraints.
Use committed migrations with `prisma migrate deploy` for normal setup and
production; do not use `migrate dev` in deployment workflows.

Development selects `LocalReplayStorage` and writes under `server/records/`.
Production selects `AzureBlobReplayStorage` and authenticates with managed
identity. Replay content is served through backend routes, not public Blob URLs.

See [docs/MATCH_TRACKING.md](docs/MATCH_TRACKING.md).

## HTTP and Socket.IO surface

Public HTTP routes include `/ping`, `/health`, `/get_rooms`,
`/create_room`, `/create_sandbox`, and `/get_replay/:replayId`. Admin routes
under `/admin` require bearer authentication.

Important client-to-server events include room info/leave, team/host/settings,
chat, start, attack, surrender, Codeforces handle updates, Math and Codeforces
challenge operations, and `activate_ability`.

When adding a mutating event, apply authentication through the current socket,
validate payload types and bounds, consider rate limits, and add focused tests.

## Documentation expectations

When changing setup, ports, variables, migrations, public behavior, enabled
abilities, or deployment constraints, update the relevant file linked from
[docs/README.md](docs/README.md). Keep the root README focused on a reliable
fresh-clone path.
