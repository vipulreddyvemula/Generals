# Match Tracking, Tournament Administration, and Azure Operations

## 1. Architecture

The four kinds of state deliberately have different owners:

```text
LIVE GAME STATE             = one game-server process, in memory
TOURNAMENT/MATCH RECORD     = PostgreSQL through Prisma
TECHNICAL TELEMETRY         = Azure Monitor / Application Insights
REPLAY                      = local files in development; private Azure Blob Storage in production
```

The game loop, `roomPool`, `Room`, `GameMap`, and `Player` remain authoritative for active gameplay. PostgreSQL is not read during movement and is never written on a game tick. `MatchRecorder` records only lifecycle events through an ordered background queue.

```text
Browser (game and /admin)
        | HTTPS / Socket.IO
        v
Azure App Service (exactly one game-server instance)
        |-- roomPool / live Room / game tick
        |-- MatchRecorder ---------> Azure Database for PostgreSQL
        |-- ReplayStorage ---------> local files (development)
        |                       `--> private Azure Blob container (production)
        `-- metrics/events --------> Azure Monitor / Application Insights
```

The `/admin` page polls protected endpoints every five seconds. It does not join the public gameplay Socket.IO flow and no admin payload is broadcast to ordinary players.

## 2. Database schema

- `Event`: tournament/event name, status, lifecycle timestamps.
- `Match`: durable UUID distinct from `roomId`, optional event, status, timestamps, authoritative winner player/team, final turn, duration, and replay ID/storage type/object key.
- `MatchPlayer`: immutable identity snapshot (player ID/name, Codeforces handle, team, color, spectator flag) plus placement, winner, and elimination result.
- `MatchEvent`: ordered meaningful events with timestamp and JSON payload.

Uniqueness constraints prevent duplicate `(matchId, playerId)`, `(matchId, sequenceNumber)`, and `(matchId, idempotencyKey)` records. Indexed filters cover event, room, status, start time, player ID/handle, event type, sequence, and timestamp.

The PostgreSQL baseline is `server/prisma/migrations/20260923000000_init_match_tracking/migration.sql`. Replay reference fields are migrated by `20260923010000_add_replay_storage_fields/migration.sql`. Obsolete SQLite/custom-map migrations and `dev.db` artifacts remain removed.

## 3. Match lifecycle

1. `checkForcedStart` passes existing team and Codeforces checks.
2. `startRoomOnce` calls `handleGame` once.
3. After map and replay initialization, the server generates a UUID match ID, snapshots non-spectating players, queues `Match`, `MatchPlayer`, `MATCH_STARTED`, and initial `PLAYER_JOINED` rows, then begins gameplay.
4. A player joining an already-running room is a spectator and receives a snapshot plus `PLAYER_JOINED` event.
5. General capture, explicit surrender, AFK surrender, reconnect expiry, and invalid-General safety record the authoritative turn/reason/captor before cleanup can erase live state.
6. `finishGame` claims termination once, gets the winner from `getGameOutcome`, serializes the unchanged replay payload before player cleanup, then asynchronously stores it through `ReplayStorage` and attaches its durable reference.
7. `cleanupFinishedRoom` clears both gameplay transients and the active match handle idempotently.

Recorder writes are serialized per match. Database constraints protect against process-path duplicates. Critical start/elimination/completion writes use bounded exponential retries; failures are logged as critical and emitted to telemetry without blocking the game loop.

## 4. Event lifecycle

Recorded types are:

- `MATCH_STARTED`
- `PLAYER_JOINED`
- `GENERAL_CAPTURED`
- `PLAYER_ELIMINATED`
- `PLAYER_SURRENDERED`
- `MATCH_FINISHED`
- `MATCH_ABORTED`

There are no per-tick database writes and no map snapshots in PostgreSQL. General capture records captured player, captor, room, match, turn, and timestamp. Elimination records victim, known killer, reason, placement, turn, and timestamp.

## 5. Admin API

All endpoints require `Authorization: Bearer <ADMIN_API_TOKEN>` and share an IP token-bucket rate limit. Missing credentials return `401`, invalid credentials return `403`, and an unconfigured production credential prevents server startup.

- `GET /admin/matches?page=1&pageSize=25`
- `GET /admin/matches/live`
- `GET /admin/matches/:matchId`
- `GET /admin/matches/:matchId/replay`
- `GET /admin/matches/:matchId/events?page=1&pageSize=100`
- `GET /admin/events/:eventId/matches?page=1&pageSize=25`
- `GET /admin/events?page=1&pageSize=25`
- `POST /admin/events`
- `GET /admin/stats`

Match list filters: `status`, `eventId`, `roomId`, `from`, `to`, `playerName`, and `codeforcesHandle`. Page size is capped at 100. Responses are explicit DTOs: Prisma row IDs and event idempotency keys are not returned.

Replay metadata contains `available`, `replayId`, `storageType`, and `objectKey`. The replay download endpoint is admin-authenticated and streams replay JSON through the backend; it never returns an Azure URL, SAS token, access key, or credential.

## 6. Admin authentication and dashboard

The dashboard is `/admin`. The token is entered by the operator and kept in browser session storage; it is not compiled into frontend source or placed in `NEXT_PUBLIC_*`. Use HTTPS in production, use a unique high-entropy token of at least 32 characters, and rotate it through App Service settings when event staff changes.

The dashboard shows summary totals, live matches and turns, recent results, match/player details, Codeforces snapshots, placements, winner, and the event timeline. Live data uses five-second polling to avoid changing the stable public Socket.IO topology.

## 7. Required environment variables

Server:

| Variable | Requirement |
| --- | --- |
| `NODE_ENV` | `production` on Azure |
| `PORT` | Game container port, normally `3001` |
| `CLIENT_URL` | Explicit space-separated frontend origins; `*` is rejected in production |
| `DATABASE_URL` | PostgreSQL URL with `sslmode=require` on Azure |
| `ADMIN_API_TOKEN` | Secret, minimum 32 characters in production |
| `TOURNAMENT_EVENT_ID` | Optional UUID from `Event`; omit for unassigned matches |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | Application Insights connection string |
| `APPLICATIONINSIGHTS_LIVE_METRICS` | Optional `true`/`false` |
| `APPLICATIONINSIGHTS_SAMPLING_PERCENTAGE` | Optional `0`-`100`, default `100` |
| `AZURE_STORAGE_ACCOUNT_NAME` | Production-only storage account name |
| `AZURE_REPLAY_CONTAINER` | Production-only private replay container name |
| `MAX_ROOMS` | Optional in-memory room ceiling, default `160` |
| `MAX_TOTAL_PLAYERS` | Optional total player ceiling, default `300` |
| `MAX_PLAYERS_PER_ROOM` | Optional per-room ceiling, default/hard maximum `12` |

Client build:

| Variable | Requirement |
| --- | --- |
| `NEXT_PUBLIC_SERVER_API` | Public HTTPS game-server origin; this is public configuration, never a secret |

## 8. Local development

The supported fresh-clone workflow is:

```bash
git clone https://github.com/vipulreddyvemula/Generals.git
cd Generals
make setup
make dev
```

This starts PostgreSQL through Docker Compose and runs the server on port 3001
and client on port 3000. Azure variables may remain empty: when `NODE_ENV` is
not `production`, `LocalReplayStorage` writes the existing JSON format to
`server/records/<matchId>.json`. Production selects `AzureBlobReplayStorage` and
uses the exact object key `replays/<matchId>.json`.

Open the admin dashboard:

- Open `http://localhost:3000/admin`.
- Enter the `ADMIN_API_TOKEN` from `server/.env`.
- Play and finish a non-sandbox match.
- Wait for the next five-second dashboard poll.

Initial players appear as immutable snapshots; the result and timeline appear
after the next poll. Manual setup, environment details, Windows instructions,
database reset steps, and troubleshooting are in [DEVELOPMENT.md](DEVELOPMENT.md).

If a disposable local PostgreSQL database was previously initialized from the retired SQLite/custom-map migration history, recreate that local database or its Docker volume before running `prisma migrate deploy`. Do not delete the current migrations directory. Preserve and migrate any real data instead of resetting a non-disposable database.

## 9. Azure deployment

This phase supports **one game-server instance only**. Do not enable App Service autoscale or more than one worker for the game server. The separate frontend may scale independently.

### Current production deployment

The production environment was provisioned on 2026-09-24 with Azure CLI:

| Resource | Name | Region / configuration |
| --- | --- | --- |
| Resource group | `generals-prod-rg` | Resource-group metadata in Central India |
| App Service plan | `generals-prod-plan` | Linux Basic B1, one worker, India South Central |
| Game server | `generals-game-baa829` | Node 22, Always On, WebSockets enabled |
| Frontend | `generals-web-baa829` | Node 22, Next.js standalone |
| PostgreSQL | `generals-pg-baa829` | PostgreSQL 16, Burstable B1ms, 32 GB |
| Storage account | `generalsbaa829replays` | Standard LRS, HTTPS-only, public Blob access disabled |
| Replay container | `generals-replays` | Private; game-server managed identity has Blob Data Contributor |
| Package container | `app-packages` | Private deployment artifacts |
| Application Insights | `generals-prod-insights` | Workspace-backed in UAE North |
| Log Analytics | `generals-prod-law` | UAE North |

Production URLs:

- Frontend: `https://generals-web-baa829.azurewebsites.net`
- Game server: `https://generals-game-baa829.azurewebsites.net`
- Admin dashboard: `https://generals-web-baa829.azurewebsites.net/admin`

The Azure for Students subscription blocks ACR Tasks, so this environment does not use ACR. The backend is deployed as a prebuilt flattened ZIP. The frontend runs from the private `generals-client-npm-20260924.zip` package because App Service/Oryx does not preserve pnpm symlink topology reliably.

The frontend package uses a read-only package SAS that expires on **2027-09-24**. Redeploy or renew `WEBSITE_RUN_FROM_PACKAGE` before that date. This package credential is separate from replay access: production replay uploads/downloads continue to use the game server's system-assigned managed identity and `DefaultAzureCredential`.

Production requirements:

- create or select an Azure Storage account;
- create the container named by `AZURE_REPLAY_CONTAINER` with public access disabled;
- enable a managed identity on the game-server App Service;
- grant that identity the **Storage Blob Data Contributor** role, scoped as narrowly as practical;
- configure `AZURE_STORAGE_ACCOUNT_NAME` and `AZURE_REPLAY_CONTAINER` as server-side App Service settings;
- keep account keys, connection strings, SAS tokens, and storage credentials out of the client and repository;
- retain exactly one realtime game-server instance.

`AzureBlobReplayStorage` authenticates with `DefaultAzureCredential`. On Azure this resolves the App Service managed identity. The application deliberately does not create the container or change its access policy; the private container is provisioned by infrastructure.

Production replay objects use `replays/<matchId>.json`. The container is private, and replay content is retrieved through authenticated backend routes rather than public Blob URLs.

## 10. Monitoring

Application Insights automatically collects HTTP requests, dependencies, performance, and unhandled exceptions when its connection string is configured. Custom low-volume telemetry includes:

- gauges: sockets, rooms, matches, players, tick duration, prevented overlap, event-loop lag, memory, Socket.IO throughput, Codeforces queue depth;
- counters/errors: Socket.IO errors, reconnects, Codeforces latency/failures, database query/write failures, replay write failures;
- events: `match_started`, `match_finished`, `match_aborted`, `player_eliminated`, `general_captured`.

Never add reconnect tokens, session hashes, passwords, admin tokens, Codeforces submission secrets, or raw authorization headers as telemetry properties.

Suggested alerts: HTTP 5xx rate, uncaught exceptions, database write failures, replay failures, event-loop lag, tick overlap growth, stuck rooms, and zero successful match completions during an active event window.

## 11. Backup and recovery

Use PostgreSQL Flexible Server automated backups according to event policy and test point-in-time restore before the tournament. Export final tournament results after an event as an additional logical backup. Database recovery restores replay references; Blob lifecycle, retention, versioning, and recovery must be configured separately on the storage account.

Development replay files remain local and disposable. Production replay JSON is durable in the private Blob container, while PostgreSQL stores its storage type and object key.

## 12. Current limitation and future multi-instance architecture

The authoritative game server must remain at one instance. Multiple instances would have independent `roomPool` maps, intervals, and Socket.IO clients; merely adding a Socket.IO Redis adapter would not make game authority safe.

A future multi-instance design requires explicit room ownership/sharding, distributed leases, Socket.IO pub/sub, a durable command/event outbox, and recovery snapshots. Blob replay storage is already instance-independent, but it does not solve realtime room authority. PostgreSQL should remain the tournament record rather than becoming a 500 ms game-state sink.
