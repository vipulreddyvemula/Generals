# Implementation Status

This document summarizes the current repository rather than a future phase plan.

## Implemented

### Core game

- Authoritative real-time rooms, maps, movement, combat, production, and win
  detection
- Configurable speed, map dimensions, terrain density, fog of war, General
  reveal, spectators, teams, and Warring States mode
- Chat, mobile drag controls, movement queues, half-army movement, surrender,
  zoom controls, result banners, and replay viewer
- Room/player allocation guards, Socket.IO event rate limits, protected host
  settings, and guarded room startup/ticks
- Room-scoped reconnect credentials with rotation and a reconnect grace period
- Garbage collection for empty rooms and unified match cleanup

### Commander Mode

- Server-side Math challenge selection and answer verification
- Shared, rate-limited Codeforces history and submission verification queue
- Energy and troop rewards, Codeforces problem skipping, and reconnect recovery
- Scout, Airstrike, and Reinforce abilities with authoritative targeting/effects
- Commander panel, visual effects, notifications, and tutorial coverage

### Learning and demos

- Interactive tutorial page
- Private 14×14 sandbox with fixed starting positions and a passive practice
  opponent
- KaTeX rendering for Math questions
- Desktop and mobile layouts

### Persistence and administration

- PostgreSQL/Prisma models and migrations for events, matches, player snapshots,
  and ordered match events
- Match recorder with per-match ordering, idempotency keys, and bounded retries
- Protected paginated admin APIs and a polling admin dashboard
- Local JSON replay storage in development
- Private Azure Blob replay storage in production through managed identity
- Replay storage references persisted with match records
- Health diagnostics, structured runtime metrics, and optional Application
  Insights telemetry

### Verification

- Jest unit and Socket.IO integration tests for game rules, abilities, Commander
  challenges, room creation, session/lifecycle security, match recording, replay
  storage, event safety, and admin APIs
- TypeScript builds for client and server
- Client lint and formatting scripts

## Current constraints

- Live rooms and reconnect sessions are held in one process and do not survive a
  game-server restart.
- The game server supports one authoritative instance only; horizontal scaling
  requires room ownership, distributed leases, command routing, and recovery.
- Configured room/player ceilings are safety guards, not a claim of tested
  concurrent capacity.
- Codeforces challenges depend on the public Codeforces API.
- The client does not currently have a dedicated automated test suite.
- Local PostgreSQL and replay files are developer-managed; production backup and
  retention must be configured in Azure.

## Recommended next work

1. Run and publish realistic multiplayer load-test results before raising the
   configured capacity ceilings.
2. Add client component/end-to-end tests for room, reconnect, Commander, replay,
   and admin flows.
3. Automate infrastructure provisioning, secret rotation, database backups, and
   deployment rollback.
4. Design durable room ownership and recovery before enabling multiple game
   server instances.
5. Continue accessibility, mobile-device, and cross-browser testing.

See [DEVELOPMENT.md](DEVELOPMENT.md) for local verification and
[MATCH_TRACKING.md](MATCH_TRACKING.md) for production operations.
