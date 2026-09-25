# Documentation

This directory contains the maintained technical and operational documentation
for Generals.

## Start here

- [Local development](DEVELOPMENT.md) — prerequisites, first-time setup,
  environment variables, commands, and troubleshooting
- [Architecture](ARCHITECTURE.md) — client, server, game loop, persistence, and
  replay-storage boundaries
- [Implementation status](IMPLEMENTATION_STATUS.md) — what is implemented and
  which constraints remain

## Feature and operations guides

- [Commander Mode](COMMANDER_STATUS.md) — challenges, Energy, abilities, and
  security behavior
- [Match tracking and Azure operations](MATCH_TRACKING.md) — database records,
  admin APIs, production replay storage, monitoring, backups, and deployment
- [Session and lifecycle security](../server/SECURITY.md) — reconnect tokens,
  authorization, disconnect behavior, and host setting validation
- [Event safety](../server/EVENT_SAFETY.md) — room/player ceilings, Socket.IO rate
  limits, runtime guards, and diagnostics

The root [README](../README.md) is the short project overview and fastest route
from clone to a running local game. When code changes affect configuration,
ports, commands, public behavior, or deployment assumptions, update the relevant
guide in the same change.
