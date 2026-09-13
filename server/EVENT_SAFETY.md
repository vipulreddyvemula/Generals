# Single-process event safety

This server remains one authoritative Socket.IO process with in-memory rooms. These limits are allocation guards, **not** a claim of load-tested capacity.

| Environment variable | Default | Meaning |
| --- | ---: | --- |
| `MAX_ROOMS` | 160 | Maximum room objects, including the two built-in rooms. |
| `MAX_TOTAL_PLAYERS` | 300 | Maximum Player records across all rooms, including spectators and players in reconnect grace. |
| `MAX_PLAYERS_PER_ROOM` | 12 | Per-room ceiling, additionally bounded by the existing 12-color/team/start table model. |

With defaults, 150 1v1 tournament rooms plus two built-in rooms fit the room allocation ceiling, and 100 three-player tournament rooms fit the 300-player allocation ceiling. A normal room still starts with an eight-player setting; hosts may set a supported value up to the configured cap. Actual 200/300-client performance must be measured in the later load-test phase.

## Socket event limits

Limits use one in-process token-bucket implementation keyed by current room/player identity. Rejected packets never enter their event handlers. The values are bursts, refilled over the listed period.

| Event | Burst / refill period |
| --- | --- |
| `attack` | 16 / 1 second |
| `surrender` | 1 / 10 seconds |
| `set_team` | 6 / 10 seconds |
| `change_room_setting` | 24 / 1 second (permits slider dragging) |
| `player_message` | 6 / 5 seconds; maximum 500 characters |
| `activate_ability` | 6 / 3 seconds |
| `force_start`, `change_host` | 4 / 10 seconds each |
| `get_room_info` | 10 / 1 second |
| `get_commander_config` | 5 / 1 second |

Connection attempts are limited to 600/minute per source IP (large enough for a same-host event test) and 8/minute per source-IP/player-ID reconnect claim. The existing reconnect credential is still required. Codeforces handlers and queue behavior are intentionally unchanged by this phase at the user's direction.

## Room runtime and diagnostics

A room-local startup guard is acquired before any startup work. Only one force-start transition can initialize a room. A separate room-local tick guard prevents another tick while a previous asynchronous tick is pending; an exception releases the guard. Termination invalidates outstanding tick generations, so a stale continuation cannot mutate a reused room.

`GET /health` and a structured log every 15 seconds report connected sockets, active rooms/matches/players, tick duration, prevented overlaps, event-loop lag, Socket.IO event and approximate transport byte rates, reconnects, exceptions, game ends, process memory, and rooms with no successful tick for 15 seconds. The endpoint contains no session tokens. Codeforces queue internals are not instrumented here because that code was explicitly left untouched.

## Retired Custom Maps

The normal random-map engine and replay renderer remain. The Custom Map routes, screens, room setting, persistence code, and exclusive Prisma models are removed. The new migration drops `StarUsers` and `CustomMapData`; export/back up those tables before deployment if their historical data must be kept.
