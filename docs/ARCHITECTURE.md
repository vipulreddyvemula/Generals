# Architecture Audit

## Overview
GenniaServer2 is a real-time multiplayer game inspired by Generals.io, utilizing a standard modern web stack.
The codebase is divided into two primary parts:
1. `client/` - A Next.js (React) web application.
2. `server/` - A Node.js backend using Express and Socket.IO for real-time communication, with Prisma as an ORM.

## Client Architecture
- **Framework**: Next.js (v13.5) with React (v18.2).
- **Styling**: Emotion (`@emotion/react`, `@emotion/styled`), standard CSS modules, and Material UI (`@mui/material`).
- **State/Communication**: `socket.io-client` for real-time connections with the server.
- **Key Components**:
  - `Game.tsx`, `GameMap.tsx`: Renders the main battlefield.
  - `ChatBox.tsx`: In-game chat.
  - `Lobby.tsx`, `GameRoom.tsx`: Matchmaking and waiting areas.
  - `LeaderBoard.tsx`, `PlayerTable.tsx`: UI for statistics.

## Server Architecture
- **Framework**: Express and Socket.IO (v4.8).
- **Database**: Prisma ORM, originally targeting PostgreSQL, but adapted to SQLite for MVP local development given infrastructure constraints.
- **Game Engine (server/src/lib)**:
  - `map.ts`: The core logic defining the game map, generation, and state manipulation (e.g. capturing territory, army movement).
  - `player.ts`: Represents a connected player and their properties (color, status, army count, etc.).
  - `server.ts`: The central orchestration file (864 lines) containing:
    - Express routes.
    - Socket.IO event handlers (`connection`, `join_room`, `move_army`, etc.).
    - The `GameLoop` defined via `setInterval`, managing game ticks, territory updates, and broadcasting state.

## Game Engine & Loop
- **Tick Rate**: Current tick rate and loop logic need to be profiled; it updates state and propagates to clients via socket broadcasts.
- **State Management**: The server is the absolute authority over game state (movement, territory, generals, fog of war).
- **Socket Events**: 
  - Client -> Server: Commands like `attack`, `set_team`, `surrender`, `force_start`.
  - Server -> Client: Broadcasts of game state deltas.

## Focus Areas for Commander Mode
1. **Mathematical Challenge Engine**: Needs to be built into `server/src/lib/` or `server/src/commander/` as a deterministic generator.
2. **Energy & Abilities**: Add tracking variables in `player.ts`. Implement abilities (Scout, Blitz, Reinforce, Fortify, Airstrike, Supply Surge) directly into the server's map and game loop logic.
3. **UI Overlay**: Build the Commander challenge panel and Abilities dashboard in `client/components/game/`.
4. **Tournament Engine**: Build a `TournamentManager` to wrap individual matches/rooms in `server.ts`.

## Implementation Strategy
We will strictly follow the 14-phase MVP strategy provided, avoiding a full rewrite and instead extending the stable baseline.
