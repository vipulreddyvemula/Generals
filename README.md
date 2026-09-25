# Generals (Gennia)

<p align="center">
  <img src="client/public/img/favicon.png" height="90" alt="Gennia icon">
  <br>
  <img src="client/public/img/gennia-logo.png" height="30" alt="Gennia logo">
</p>

Generals is a real-time multiplayer strategy game inspired by
[generals.io](https://generals.io). Capture territory, grow armies, solve
Commander challenges, and take the opposing General before yours is captured.

The project includes a Next.js web client, an authoritative Express/Socket.IO
game server, PostgreSQL match tracking, replays, an admin dashboard, and a
guided practice sandbox.

## Quick start

### Prerequisites

- Git
- [Node.js 22 LTS](https://nodejs.org/)
- [pnpm](https://pnpm.io/installation) 9 or newer
- [Docker](https://docs.docker.com/get-docker/) with Docker Compose
- Bash and Make on macOS/Linux, or WSL/Git Bash on Windows

Clone and set up the project:

```bash
git clone https://github.com/vipulreddyvemula/Generals.git
cd Generals
make setup
```

The setup command creates local environment files, installs both applications,
starts PostgreSQL, generates the Prisma client, and applies database migrations.
It does not overwrite an existing `.env` file.

Start the client and server together:

```bash
make dev
```

Then open:

- Game: <http://localhost:3000>
- Server health: <http://localhost:3001/health>
- Admin dashboard: <http://localhost:3000/admin>
- pgAdmin, when started separately with `make db-tools`: <http://localhost:8555>

Stop the apps with `Ctrl+C`. Stop PostgreSQL with `make db-down`.

If you do not have Make or prefer to run each step yourself, follow the
[manual setup guide](docs/DEVELOPMENT.md#manual-setup).

## What is included

- Real-time multiplayer rooms with configurable maps, speed, teams, fog of war,
  spectators, and Warring States mode
- Server-authoritative movement, combat, reconnect sessions, and rate limits
- Commander Mode with Math and Codeforces challenges
- Scout, Airstrike, and Reinforce abilities powered by earned Energy
- Interactive tutorial and a private sandbox for learning the controls
- Mobile drag controls, keyboard controls, chat, zoom, and surrender flow
- Match history, event administration, protected admin APIs, and dashboard
- Local JSON replays in development and private Azure Blob replay storage in
  production
- PostgreSQL/Prisma persistence for tournament and match metadata

## How to play

Capture every opposing General without losing your own.

- Generals and cities produce one unit every turn.
- Owned plains produce one unit every 25 turns.
- Movement can be queued between adjacent tiles.
- Capturing a General transfers that player's territory and halves the captured
  armies.

| Action | Control |
| --- | --- |
| Move selection | `W`, `A`, `S`, `D` |
| Mobile movement | Touch and drag |
| Open chat | `Enter` |
| Undo queued move | `E` |
| Clear queued moves | `Q` |
| Select General | `G` |
| Center on home | `H` |
| Center map | `C` |
| Toggle half army | `Z` |
| Use zoom preset | `1`, `2`, `3` |
| Zoom | Mouse wheel or map controls |
| Cancel targeting / surrender | `Escape` |

Use **Interactive Tutorial** on the home page for a guided match that covers
movement, army splitting, troop growth, chat, challenges, abilities, and
capturing a General.

## Common development commands

Run these from the repository root:

| Command | Purpose |
| --- | --- |
| `make setup` | Prepare a fresh clone for local development |
| `make dev` | Run the client and server together |
| `make db-up` | Start only PostgreSQL |
| `make db-tools` | Start PostgreSQL and pgAdmin |
| `make db-migrate` | Generate Prisma Client and apply migrations |
| `make test` | Run the server test suite |
| `make build` | Build the client and server |
| `make db-down` | Stop local database containers |
| `make help` | Show all available commands |

Local development uses these defaults:

| Service | Address |
| --- | --- |
| Next.js client | `http://localhost:3000` |
| Express/Socket.IO server | `http://localhost:3001` |
| PostgreSQL | `localhost:5432` |
| pgAdmin | `http://localhost:8555` |

Azure credentials are not required for local development. Replays are written
to `server/records/` locally.

## Repository layout

```text
Generals/
├── client/                 # Next.js frontend and admin dashboard
├── server/                 # Express, Socket.IO, game engine, and Prisma
│   ├── prisma/             # PostgreSQL schema and migrations
│   ├── src/lib/commander/  # Math and Codeforces challenge services
│   └── __tests__/          # Server unit and integration tests
├── docs/                   # Architecture, development, and operations guides
├── scripts/                # Local setup and combined development launcher
└── Makefile                # Shortcuts for common workflows
```

## Documentation

- [Documentation index](docs/README.md)
- [Local development guide](docs/DEVELOPMENT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Commander Mode](docs/COMMANDER_STATUS.md)
- [Implementation status](docs/IMPLEMENTATION_STATUS.md)
- [Match tracking, admin, replay storage, and Azure operations](docs/MATCH_TRACKING.md)
- [Session and lifecycle security](server/SECURITY.md)
- [Event safety and capacity guards](server/EVENT_SAFETY.md)

## Production deployment

Production requires explicit CORS origins, a strong admin token, PostgreSQL,
and exactly one authoritative game-server instance. The current Azure topology,
required environment variables, replay-storage design, migration procedure, and
monitoring guidance are documented in [MATCH_TRACKING.md](docs/MATCH_TRACKING.md).

Do not deploy with the example credentials from `server/.env.example`.

## Contributing

Before opening a pull request, run:

```bash
make test
make build
```

Keep secrets out of the repository and update the relevant documentation when
changing environment variables, ports, migrations, or public behavior.

## License

Distributed under the GNU General Public License v3.0. See [LICENSE](LICENSE).

## Acknowledgments

- [MadJS](https://github.com/fluffybeastgames/MadJS/)
- [generals-io-webapp](https://github.com/dhyegocalota/generals-io-webapp)
