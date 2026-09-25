# Local Development

This guide takes a fresh clone to a working client, game server, and PostgreSQL
database. Azure services are not required for local development.

## Prerequisites

Install:

- Git
- Node.js 22 LTS
- pnpm 9 or newer
- Docker Desktop, or Docker Engine with the Compose plugin
- Bash and Make on macOS/Linux; use WSL or Git Bash on Windows

Check the tools before continuing:

```bash
node --version
pnpm --version
docker --version
docker compose version
```

If Node is installed but pnpm is not, either follow the
[pnpm installation guide](https://pnpm.io/installation) or use Corepack when it
is available in your Node installation:

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

## Automated setup

```bash
git clone https://github.com/vipulreddyvemula/Generals.git
cd Generals
make setup
make dev
```

`make setup` performs only local development tasks:

1. Copies `server/.env.example` to `server/.env` when the destination is absent.
2. Copies `client/.env.example` to `client/.env.local` when the destination is
   absent.
3. Installs the client and server dependencies from their pnpm lockfiles.
4. Starts the PostgreSQL service from `server/docker-compose.yml`.
5. Generates Prisma Client and applies committed migrations.

Existing environment files are never replaced. `make dev` starts both apps and
stops both when you press `Ctrl+C`.

Open:

- <http://localhost:3000> for the game
- <http://localhost:3001/health> for server diagnostics
- <http://localhost:3000/admin> for the admin dashboard

The local admin token is the `ADMIN_API_TOKEN` value in `server/.env`.

## Manual setup

Use these steps if Make or Bash is unavailable.

### 1. Create local configuration

From the repository root:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env.local
```

On Windows PowerShell, use:

```powershell
Copy-Item server/.env.example server/.env
Copy-Item client/.env.example client/.env.local
```

The example files work with the included local PostgreSQL container. Change the
ports or credentials in both `server/.env` and the Compose setup if they conflict
with services already running on your computer.

### 2. Install dependencies

```bash
cd server
pnpm install --frozen-lockfile
cd ../client
pnpm install --frozen-lockfile
cd ..
```

### 3. Start PostgreSQL and migrate the database

```bash
cd server
docker compose up -d --wait postgres
pnpm prisma generate
pnpm prisma migrate deploy
cd ..
```

If your Compose version does not support `--wait`, run `docker compose up -d
postgres`, wait until `docker compose ps` reports the service as healthy, and
then run the Prisma commands.

### 4. Start both applications

In terminal one:

```bash
cd server
pnpm run dev
```

In terminal two:

```bash
cd client
pnpm run dev
```

## Environment variables

### Client

`client/.env.local` contains browser-visible configuration:

| Variable | Local value | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SERVER_API` | `http://localhost:3001` | Express and Socket.IO origin |

Every `NEXT_PUBLIC_*` value is compiled into browser code. Never put a password,
admin token, or storage credential there. Restart the client after changing this
file.

### Server

The most important values in `server/.env` are:

| Variable | Local default | Purpose |
| --- | --- | --- |
| `NODE_ENV` | `development` | Selects development behavior and local replay storage |
| `PORT` | `3001` | HTTP and Socket.IO port |
| `CLIENT_URL` | `*` | Permits local browser origins; production forbids `*` |
| `DATABASE_URL` | PostgreSQL on `localhost:5432` | Prisma connection string |
| `ADMIN_API_TOKEN` | Example development token | Protects `/admin/*` APIs |
| `TOURNAMENT_EVENT_ID` | empty | Optionally associates new matches with an event UUID |
| `MAX_ROOMS` | `160` | Maximum in-memory room objects |
| `MAX_TOTAL_PLAYERS` | `300` | Maximum players across all rooms |
| `MAX_PLAYERS_PER_ROOM` | `12` | Maximum players in one room |

Application Insights and Azure Blob variables may stay empty in development.
The complete production list is in [MATCH_TRACKING.md](MATCH_TRACKING.md).

## Database and pgAdmin

Start or stop PostgreSQL from the repository root:

```bash
make db-up
make db-down
```

Start PostgreSQL and pgAdmin together:

```bash
make db-tools
```

Open <http://localhost:8555> and sign in with the `PGADMIN_DEFAULT_EMAIL` and
`PGADMIN_DEFAULT_PASSWORD` values from `server/.env`. When registering the
database inside pgAdmin, use `postgres` as the host because pgAdmin runs inside
the same Compose network.

After pulling a change that contains a Prisma migration, run:

```bash
make db-migrate
```

To inspect data without pgAdmin:

```bash
cd server
pnpm prisma studio
```

### Resetting disposable local data

Only use this for a local database whose contents can be deleted:

```bash
cd server
docker compose down -v
docker compose up -d --wait postgres
pnpm prisma migrate deploy
```

`down -v` permanently removes the Compose PostgreSQL and pgAdmin volumes. Never
use it against data you need to preserve.

## Tests, builds, and formatting

From the repository root:

```bash
make test
make build
```

Individual commands:

```bash
cd server
pnpm test --runInBand
pnpm run build

cd ../client
pnpm run lint
pnpm run format
pnpm run build
```

The server test suite contains unit and Socket.IO integration coverage. The
client currently relies on linting, TypeScript/Next.js build checks, and manual
browser testing.

## Replays and admin data

In development, completed replay JSON is saved under `server/records/` and is
ignored by Git. Match metadata and event timelines are saved in PostgreSQL.

To exercise the admin dashboard:

1. Start the database, server, and client.
2. Open <http://localhost:3000/admin>.
3. Enter the token from `server/.env`.
4. Complete a non-sandbox match.
5. Wait for the dashboard's next five-second refresh.

## Troubleshooting

### A port is already in use

The default ports are `3000`, `3001`, `5432`, and optional `8555`. Stop the
conflicting service or update the relevant environment/Compose configuration.
If the server port changes, also update `NEXT_PUBLIC_SERVER_API`.

### The client cannot reach the server

Confirm <http://localhost:3001/ping> responds, check the server terminal, and
verify `client/.env.local` points to the same server origin. Restart Next.js
after changing a `NEXT_PUBLIC_*` variable.

### Prisma cannot connect

Run `make db-up`, then inspect `cd server && docker compose ps` and `docker
compose logs postgres`. Verify that `DATABASE_URL` uses `localhost` when Prisma
runs on your laptop; the hostname `postgres` is only for another Compose
container.

### Docker reports a daemon or socket permission error

Start Docker Desktop or Docker Engine and verify that `docker info` succeeds for
your current user. On Linux, follow Docker's post-install instructions for
non-root access, then sign out and back in before retrying `make setup`.

### Migrations fail on an old disposable database

This repository replaced an older SQLite/custom-map history with a PostgreSQL
baseline. Reset only your disposable local Compose volumes using the procedure
above. Preserve and migrate any real data instead of deleting it.

### Codeforces challenges do not update

These challenges call the public Codeforces API, so they require internet
access and may be delayed by upstream rate limits. Math challenges and the rest
of the game remain local.
