# Commander Mode

## Current status

Commander Mode is implemented in the live game loop. Challenge answers, Energy,
rewards, targeting, and ability effects are validated by the server; the client
only renders public state and sends requests.

## Challenges and Energy

Players earn Energy and troops through two challenge sources:

- **Math** selects a server-side problem, sends the question without its answer,
  and applies rewards only after server verification. A cooldown limits repeated
  requests.
- **Codeforces** validates each player's handle, reads solved history through a
  shared rate-limited API queue, assigns eligible unsolved problems, and verifies
  accepted submissions made after assignment. Problems can be skipped for an
  increasing Energy cost.

Energy is capped at 100. Current reward values and cooldowns live in
`server/src/lib/commander/config.ts` and are returned to the client through the
public Commander configuration event.

## Active abilities

| Ability | Cost | Effect |
| --- | ---: | --- |
| Scout | 20 Energy | Temporarily reveals a 5×5 area to the player's team |
| Airstrike | 40 Energy | After a short delay, halves enemy troops in a targeted 3×3 area |
| Reinforce | 50 Energy | Adds 40 troops to one owned tile |

Blitz, Fortify, and Supply Surge are intentionally not active abilities. The
server enum and client UI expose only Scout, Airstrike, and Reinforce.

## Authority and safety

- `Player.toJSON()` removes each Math challenge's `correctAnswer` before room
  state is emitted.
- Challenge rewards, Energy caps, ability costs, valid targets, and effects are
  enforced on the server.
- Codeforces handles must be valid and unique among active match players.
- Codeforces traffic passes through one shared queue with request spacing,
  caching, backoff, and timeouts.
- Delayed Airstrike and Scout effects are part of authoritative map state and are
  processed by the room tick.
- Commander events use the same per-socket player association and rate-limiting
  layer as other mutating game events.
- Active challenges are restored to an authenticated reconnecting player.

## Client behavior

The Commander panel has separate Challenges and Abilities views, shows Energy,
challenge status, rewards, Codeforces verification progress, and target mode.
Map navigation is suppressed while targeting an ability, and `Escape` cancels
targeting. The interactive tutorial provides guided lessons for each active
ability.

## External dependency

Codeforces challenges require access to the public Codeforces API and inherit
its availability and rate limits. Math challenges and core gameplay do not
depend on Codeforces. No Codeforces credential is stored by this application.
