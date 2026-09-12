# Session and match lifecycle security

## Player sessions

Player IDs are public identifiers, not credentials. On initial join, the server generates a 256-bit random reconnect token and sends it only to that socket in `player_session`. The server stores only its SHA-256 hash on the `Player`; session hashes, deadlines, and timer handles are excluded from serialized room state.

The client stores the credential under a room-scoped browser key and supplies it through the Socket.IO authentication payload. A reconnect is accepted only when the token matches in constant time, the player is currently disconnected, no old socket is active, and the 30-second reconnect deadline has not expired. A successful reconnect rotates the token. Attempts to take over an active session are rejected; the server never silently replaces a connected socket.

All mutating handlers derive the acting player from the current socket association. A public player ID cannot authorize surrender, team changes, attacks, or room-setting changes.

This is deliberately an in-memory, single-process model. Sessions and grace timers do not survive a server restart and are not shared between server instances.

## Disconnect and game termination

An active player remains in the authoritative game state during a 30-second disconnect grace period. Reconnecting cancels the timer. Expiry invalidates the reconnect credential and neutralizes the player once. Late disconnects from an old socket are ignored because the socket ID must still match the player's current association.

All zero-team and one-team terminal outcomes use the same idempotent finish path. It claims termination once, emits the result, clears the game interval, effects, reconnect timers, map/diff/replay references, Commander queue state, and disconnected players, then returns connected players to the lobby.

## Host settings

Only the current authenticated host may change settings, and only before match start. The explicit allowlist is: `roomName`, `mapId`, `maxPlayers`, `gameSpeed`, `mapWidth`, `mapHeight`, `mountain`, `city`, `swamp`, `fogOfWar`, `revealKing`, `warringStatesMode`, and `deathSpectator`. Each setting is type- and range-validated before an explicit assignment. Internal room state is never assignable through this event.
