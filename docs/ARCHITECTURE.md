# Architecture

## System overview

Generals has two independently built Node.js applications and one PostgreSQL
database:

```text
Browser
  |-- HTTP pages and API calls ----------> Next.js client (port 3000)
  |-- HTTP and Socket.IO ----------------> Game server (port 3001)
                                               |-- live rooms and game loops (memory)
                                               |-- match metadata (PostgreSQL)
                                               `-- replay JSON (local disk or Azure Blob)
```

The game server is authoritative. Clients request actions; they do not decide
movement, combat, rewards, ability effects, winners, or session ownership.

## Client

The `client/` application uses Next.js 13, React 18, TypeScript, Material UI,
Emotion, CSS modules, and `socket.io-client`.

Important areas:

- `pages/index.tsx`, `create-room.tsx`, and `join-room.tsx`: entry and room flows
- `pages/rooms/[roomId].tsx`: live game route
- `pages/replays/[replayId].tsx`: replay viewer
- `pages/admin/index.tsx`: protected tournament dashboard
- `components/GameRoom.tsx`: Socket.IO connection and room lifecycle
- `components/game/Game.tsx` and `GameMap.tsx`: battlefield interaction and rendering
- `components/game/CommanderPanel.tsx`: Math, Codeforces, Energy, and abilities
- `context/GameContext.tsx` and `GameReducer.tsx`: client-side room/game view state

`NEXT_PUBLIC_SERVER_API` supplies the public backend origin at build/runtime.
Because it is a `NEXT_PUBLIC_*` value, it must never contain secrets.

## Server

The `server/` application uses Express, Socket.IO, TypeScript, Prisma, and
PostgreSQL. `src/server.ts` wires HTTP routes, Socket.IO handlers, room startup,
the game tick, Commander events, replay storage, and shutdown behavior.

Core libraries include:

- `room-pool.ts`: active room registry and built-in rooms
- `map.ts`, `block.ts`, and `player.ts`: authoritative game domain
- `map-diff.ts`: incremental player-specific map updates
- `lifecycle.ts` and `room-runtime.ts`: guarded startup, ticks, and cleanup
- `security.ts` and `session.ts`: host validation and reconnect credentials
- `event-limits.ts` and `socket-rate-limit.ts`: allocation and event limits
- `commander/`: Math generation and Codeforces queues/catalogue
- `match-recorder.ts`: ordered background persistence of match lifecycle events
- `replay-storage.ts`: local filesystem and Azure Blob replay implementations
- `admin-api.ts`: bearer-protected match/event administration endpoints
- `observability.ts` and `telemetry.ts`: health metrics and Application Insights

## Game and connection lifecycle

1. A browser creates or selects a room through HTTP.
2. The browser connects to Socket.IO with room/player data and, on reconnect, a
   room-scoped credential.
3. The server associates the socket with one authoritative `Player`.
4. A guarded start path generates the map, initializes replay and match records,
   then begins one interval-driven game loop for that room.
5. Each tick updates production, queued movement, delayed effects, win state,
   replay data, and player-specific map diffs.
6. Commands such as `attack`, `surrender`, room settings, challenges, and
   abilities are validated against the socket's player and current room state.
7. The shared finish path records the result, serializes the replay, clears
   timers and transient state, and returns connected players to the lobby.

## State ownership

| State | Owner | Lifetime |
| --- | --- | --- |
| Rooms, players, maps, ticks, active challenges | One game-server process | Until match end or process restart |
| Event, match, player snapshot, match timeline | PostgreSQL through Prisma | Durable |
| Replay payload | Local files in development; private Azure Blob in production | Storage-policy dependent |
| Admin token | Server environment and dashboard session storage | Deployment/browser session |
| Reconnect token hash | In-memory `Player` | Session/grace period |
| Technical telemetry | Process metrics and optional Application Insights | Monitoring-policy dependent |

PostgreSQL is intentionally not part of the movement/tick hot path. Match
lifecycle writes are queued and retried without blocking the game loop.

## Public HTTP surface

Gameplay routes include `/ping`, `/health`, `/get_rooms`, `/create_room`,
`/create_sandbox`, and `/get_replay/:replayId`. Administrative routes under
`/admin` require a bearer token and are documented in
[MATCH_TRACKING.md](MATCH_TRACKING.md).

Socket.IO carries room updates, gameplay commands, chat, reconnect behavior,
Math/Codeforces challenges, and Commander abilities. Event ceilings and rate
limits are documented in [EVENT_SAFETY.md](../server/EVENT_SAFETY.md).

## Deployment constraints

Active game state is in memory, so the authoritative game server must run as
exactly one instance. Multiple frontend instances are safe, but multiple game
servers would create independent room pools and ticks. A Redis Socket.IO adapter
alone would not make game authority distributed or recoverable.

Production additionally requires explicit CORS origins, PostgreSQL, a strong
admin token, private replay storage, and HTTPS. See
[MATCH_TRACKING.md](MATCH_TRACKING.md) for the supported Azure topology.
