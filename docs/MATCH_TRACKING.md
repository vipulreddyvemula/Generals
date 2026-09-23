# Match Tracking, Tournament Administration, and Azure Operations

## 1. Architecture

The four kinds of state deliberately have different owners:

```text
LIVE GAME STATE             = one game-server process, in memory
TOURNAMENT/MATCH RECORD     = PostgreSQL through Prisma
TECHNICAL TELEMETRY         = Azure Monitor / Application Insights
REPLAY                      = current local JSON files; Azure Blob is future work
```

The game loop, `roomPool`, `Room`, `GameMap`, and `Player` remain authoritative for active gameplay. PostgreSQL is not read during movement and is never written on a game tick. `MatchRecorder` records only lifecycle events through an ordered background queue.

```text
Browser (game and /admin)
        | HTTPS / Socket.IO
        v
Azure App Service (exactly one game-server instance)
        |-- roomPool / live Room / game tick
        |-- MatchRecorder ---------> Azure Database for PostgreSQL
        |-- replay JSON -----------> local App Service filesystem (temporary)
        `-- metrics/events --------> Azure Monitor / Application Insights
```

The `/admin` page polls protected endpoints every five seconds. It does not join the public gameplay Socket.IO flow and no admin payload is broadcast to ordinary players.

## 2. Database schema

- `Event`: tournament/event name, status, lifecycle timestamps.
- `Match`: durable UUID distinct from `roomId`, optional event, status, timestamps, authoritative winner player/team, final turn, duration, and replay reference.
- `MatchPlayer`: immutable identity snapshot (player ID/name, Codeforces handle, team, color, spectator flag) plus placement, winner, and elimination result.
- `MatchEvent`: ordered meaningful events with timestamp and JSON payload.

Uniqueness constraints prevent duplicate `(matchId, playerId)`, `(matchId, sequenceNumber)`, and `(matchId, idempotencyKey)` records. Indexed filters cover event, room, status, start time, player ID/handle, event type, sequence, and timestamp.

The migration is `server/prisma/migrations/20260923000000_add_match_tracking/migration.sql`. The older unused custom-map migrations were converted from the stale SQLite scaffold to valid PostgreSQL SQL so a clean PostgreSQL `prisma migrate deploy` succeeds.

## 3. Match lifecycle

1. `checkForcedStart` passes existing team and Codeforces checks.
2. `startRoomOnce` calls `handleGame` once.
3. After map and replay initialization, the server generates a UUID match ID, snapshots non-spectating players, queues `Match`, `MatchPlayer`, `MATCH_STARTED`, and initial `PLAYER_JOINED` rows, then begins gameplay.
4. A player joining an already-running room is a spectator and receives a snapshot plus `PLAYER_JOINED` event.
5. General capture, explicit surrender, AFK surrender, reconnect expiry, and invalid-General safety record the authoritative turn/reason/captor before cleanup can erase live state.
6. `finishGame` claims termination once, gets the winner from `getGameOutcome`, queues completion, writes the replay asynchronously, and attaches its replay reference when available.
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
- `GET /admin/matches/:matchId/events?page=1&pageSize=100`
- `GET /admin/events/:eventId/matches?page=1&pageSize=25`
- `GET /admin/events?page=1&pageSize=25`
- `POST /admin/events`
- `GET /admin/stats`

Match list filters: `status`, `eventId`, `roomId`, `from`, `to`, `playerName`, and `codeforcesHandle`. Page size is capped at 100. Responses are explicit DTOs: Prisma row IDs and event idempotency keys are not returned.

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

Client build:

| Variable | Requirement |
| --- | --- |
| `NEXT_PUBLIC_SERVER_API` | Public HTTPS game-server origin; this is public configuration, never a secret |

## 8. Local development

Use Node 22 and pnpm. Start PostgreSQL, apply migrations, then start each app:

```bash
cd server
docker compose up -d postgres
cp .env.example .env
pnpm install
pnpm prisma generate
pnpm prisma migrate deploy
pnpm run dev
```

In a second terminal:

```bash
cd client
cp .env.example .env.local
pnpm install
pnpm run dev
```

Open `http://localhost:3000/admin`, enter the `ADMIN_API_TOKEN` from `server/.env`, then play and finish a non-sandbox match. Initial players appear as immutable snapshots; the result and timeline appear after the next poll.

## 9. Azure deployment

This phase supports **one game-server instance only**. Do not enable App Service autoscale or more than one worker for the game server. The separate frontend may scale independently.

The following Azure CLI sequence uses two Linux Web Apps, Azure Container Registry, PostgreSQL Flexible Server, and Application Insights. Replace every placeholder and keep passwords/tokens in a secure shell or Key Vault-backed deployment pipeline.

```bash
az login

AZ_LOCATION=centralindia
AZ_RESOURCE_GROUP=generals-prod-rg
AZ_ACR=generalsprodregistry
AZ_PLAN=generals-prod-plan
AZ_SERVER_APP=generals-game-prod
AZ_CLIENT_APP=generals-web-prod
AZ_POSTGRES=generals-prod-pg
AZ_DATABASE=generals
AZ_PG_ADMIN=generalsadmin
AZ_INSIGHTS=generals-prod-insights
IMAGE_TAG=$(git rev-parse --short HEAD)

az group create --name "$AZ_RESOURCE_GROUP" --location "$AZ_LOCATION"
az acr create --resource-group "$AZ_RESOURCE_GROUP" --name "$AZ_ACR" --sku Basic
az appservice plan create --resource-group "$AZ_RESOURCE_GROUP" --name "$AZ_PLAN" --is-linux --sku P1v3

az postgres flexible-server create \
  --resource-group "$AZ_RESOURCE_GROUP" --name "$AZ_POSTGRES" --location "$AZ_LOCATION" \
  --admin-user "$AZ_PG_ADMIN" --admin-password "$AZ_PG_PASSWORD" \
  --database-name "$AZ_DATABASE" --version 16 --tier GeneralPurpose \
  --sku-name Standard_D2ds_v5 --storage-size 128 --backup-retention 14 \
  --public-access 0.0.0.0

az monitor app-insights component create \
  --resource-group "$AZ_RESOURCE_GROUP" --location "$AZ_LOCATION" \
  --app "$AZ_INSIGHTS" --application-type web

az acr build --registry "$AZ_ACR" --image "generals-server:$IMAGE_TAG" ./server
az acr build --registry "$AZ_ACR" --image "generals-client:$IMAGE_TAG" \
  --build-arg "NEXT_PUBLIC_SERVER_API=https://$AZ_SERVER_APP.azurewebsites.net" ./client

az webapp create --resource-group "$AZ_RESOURCE_GROUP" --plan "$AZ_PLAN" \
  --name "$AZ_SERVER_APP" \
  --deployment-container-image-name "$AZ_ACR.azurecr.io/generals-server:$IMAGE_TAG"
az webapp create --resource-group "$AZ_RESOURCE_GROUP" --plan "$AZ_PLAN" \
  --name "$AZ_CLIENT_APP" \
  --deployment-container-image-name "$AZ_ACR.azurecr.io/generals-client:$IMAGE_TAG"

ACR_ID=$(az acr show --resource-group "$AZ_RESOURCE_GROUP" --name "$AZ_ACR" --query id -o tsv)
SERVER_PRINCIPAL=$(az webapp identity assign --resource-group "$AZ_RESOURCE_GROUP" --name "$AZ_SERVER_APP" --query principalId -o tsv)
CLIENT_PRINCIPAL=$(az webapp identity assign --resource-group "$AZ_RESOURCE_GROUP" --name "$AZ_CLIENT_APP" --query principalId -o tsv)
az role assignment create --assignee-object-id "$SERVER_PRINCIPAL" --assignee-principal-type ServicePrincipal --scope "$ACR_ID" --role AcrPull
az role assignment create --assignee-object-id "$CLIENT_PRINCIPAL" --assignee-principal-type ServicePrincipal --scope "$ACR_ID" --role AcrPull
az webapp config set --resource-group "$AZ_RESOURCE_GROUP" --name "$AZ_SERVER_APP" --generic-configurations '{"acrUseManagedIdentityCreds": true}'
az webapp config set --resource-group "$AZ_RESOURCE_GROUP" --name "$AZ_CLIENT_APP" --generic-configurations '{"acrUseManagedIdentityCreds": true}'

AI_CONNECTION=$(az monitor app-insights component show --resource-group "$AZ_RESOURCE_GROUP" --app "$AZ_INSIGHTS" --query connectionString -o tsv)
DATABASE_URL="postgresql://$AZ_PG_ADMIN:$AZ_PG_PASSWORD@$AZ_POSTGRES.postgres.database.azure.com:5432/$AZ_DATABASE?sslmode=require&schema=public"

az webapp config appsettings set --resource-group "$AZ_RESOURCE_GROUP" --name "$AZ_SERVER_APP" --settings \
  NODE_ENV=production PORT=3001 WEBSITES_PORT=3001 \
  CLIENT_URL="https://$AZ_CLIENT_APP.azurewebsites.net" \
  DATABASE_URL="$DATABASE_URL" ADMIN_API_TOKEN="$ADMIN_API_TOKEN" \
  APPLICATIONINSIGHTS_CONNECTION_STRING="$AI_CONNECTION" \
  APPLICATIONINSIGHTS_LIVE_METRICS=true

az webapp config appsettings set --resource-group "$AZ_RESOURCE_GROUP" --name "$AZ_CLIENT_APP" --settings \
  NODE_ENV=production PORT=3000 WEBSITES_PORT=3000

az webapp config set --resource-group "$AZ_RESOURCE_GROUP" --name "$AZ_SERVER_APP" \
  --web-sockets-enabled true --always-on true --number-of-workers 1
az webapp update --resource-group "$AZ_RESOURCE_GROUP" --name "$AZ_SERVER_APP" --https-only true
az webapp update --resource-group "$AZ_RESOURCE_GROUP" --name "$AZ_CLIENT_APP" --https-only true

az webapp restart --resource-group "$AZ_RESOURCE_GROUP" --name "$AZ_SERVER_APP"
az webapp restart --resource-group "$AZ_RESOURCE_GROUP" --name "$AZ_CLIENT_APP"
```

The server container runs `prisma migrate deploy` before starting Node. For a controlled pre-deployment migration, run this from a trusted CI runner with the Azure `DATABASE_URL`:

```bash
cd server
pnpm install --frozen-lockfile
pnpm prisma generate
pnpm prisma migrate deploy
```

If a database password contains URI-reserved characters, percent-encode it before constructing `DATABASE_URL`. Prefer private networking for the final production network design; `--public-access 0.0.0.0` is the shortest Azure-services quickstart configuration, not the strongest isolation.

## 10. Monitoring

Application Insights automatically collects HTTP requests, dependencies, performance, and unhandled exceptions when its connection string is configured. Custom low-volume telemetry includes:

- gauges: sockets, rooms, matches, players, tick duration, prevented overlap, event-loop lag, memory, Socket.IO throughput, Codeforces queue depth;
- counters/errors: Socket.IO errors, reconnects, Codeforces latency/failures, database query/write failures, replay write failures;
- events: `match_started`, `match_finished`, `match_aborted`, `player_eliminated`, `general_captured`.

Never add reconnect tokens, session hashes, passwords, admin tokens, Codeforces submission secrets, or raw authorization headers as telemetry properties.

Suggested alerts: HTTP 5xx rate, uncaught exceptions, database write failures, replay failures, event-loop lag, tick overlap growth, stuck rooms, and zero successful match completions during an active event window.

## 11. Backup and recovery

Use PostgreSQL Flexible Server automated backups with 14-35 day retention according to event policy, enable zone-redundant high availability for important events, and test point-in-time restore before the tournament. Export final tournament results after an event as an additional logical backup. Database recovery restores match records but not local replay files.

The current local replay directory is **not durable across App Service instance replacement, rescheduling, or redeployment**. Match records retain the local replay ID/storage type so a later `ReplayStorage` implementation can move files to Azure Blob Storage without changing tournament history.

## 12. Current limitation and future multi-instance architecture

The authoritative game server must remain at one instance. Multiple instances would have independent `roomPool` maps, intervals, Socket.IO clients, and replay files; merely adding a Socket.IO Redis adapter would not make game authority safe.

A future multi-instance design requires explicit room ownership/sharding, distributed leases, Socket.IO pub/sub, a durable command/event outbox, recovery snapshots, and Blob replay storage. PostgreSQL should remain the tournament record rather than becoming a 500 ms game-state sink.
