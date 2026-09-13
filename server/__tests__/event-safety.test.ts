import fs from 'fs';
import path from 'path';
import Player from '../src/lib/player';
import { Room } from '../src/lib/types';
import {
  canJoinRoom,
  configuredInteger,
  countRoomPlayers,
  EVENT_LIMITS,
  HARD_PLAYER_LIMIT_PER_ROOM,
} from '../src/lib/event-limits';
import { createRoom, roomPool } from '../src/lib/room-pool';
import { runRoomTick, roomRuntimeSnapshot, resetRoomRuntime, startRoomOnce } from '../src/lib/room-runtime';
import { SESSION_CLAIM_POLICY, SESSION_IP_POLICY, SOCKET_EVENT_POLICIES, SocketRateLimiter } from '../src/lib/socket-rate-limit';
import { EventMetrics } from '../src/lib/observability';
import { validateRoomSetting } from '../src/lib/security';
import GameMap from '../src/lib/map';

const root = path.resolve(__dirname, '../..');

function player(id: string): Player {
  return new Player(id, `socket-${id}`, id, 1, 1);
}

async function withTournamentRooms(roomCount: number, playersPerRoom: number, run: () => void): Promise<void> {
  const roomIds: string[] = [];
  try {
    for (let index = 0; index < roomCount; index++) {
      const id = `event-safety-${roomCount}-${playersPerRoom}-${index}`;
      const result = await createRoom(id);
      expect(result.success).toBe(true);
      roomIds.push(id);
      const room = roomPool[id];
      for (let participant = 0; participant < playersPerRoom; participant++) {
        expect(canJoinRoom(roomPool, room)).toBe(true);
        room.players.push(player(`${id}-${participant}`));
      }
    }
    run();
  } finally {
    for (const id of roomIds) delete roomPool[id];
  }
}

describe('explicit event topology limits', () => {
  it('accepts supported configuration and rejects values below the built-in-room minimum', () => {
    const previous = process.env.MAX_ROOMS;
    try {
      process.env.MAX_ROOMS = '130';
      expect(configuredInteger('MAX_ROOMS', 160, 2, 1000)).toBe(130);
      process.env.MAX_ROOMS = '1';
      expect(() => configuredInteger('MAX_ROOMS', 160, 2, 1000)).toThrow('MAX_ROOMS');
    } finally {
      if (previous === undefined) delete process.env.MAX_ROOMS;
      else process.env.MAX_ROOMS = previous;
    }
  });

  it('allows 100 simultaneous 1v1 rooms without claiming load-tested performance', async () => {
    await withTournamentRooms(100, 2, () => {
      expect(countRoomPlayers(roomPool)).toBe(200);
      expect(EVENT_LIMITS.maxRooms).toBeGreaterThanOrEqual(102);
    });
  });

  it('allocates 150 simultaneous 1v1 rooms within the default room and player limits', async () => {
    await withTournamentRooms(150, 2, () => {
      expect(countRoomPlayers(roomPool)).toBe(300);
      expect(Object.keys(roomPool)).toHaveLength(152);
    });
  });

  it('allows the intended 100 three-player rooms within the 300-player allocation ceiling', async () => {
    await withTournamentRooms(100, 3, () => {
      expect(countRoomPlayers(roomPool)).toBe(300);
      const extraRoom = new Room('extra');
      expect(canJoinRoom(roomPool, extraRoom)).toBe(false);
    });
  });

  it('enforces the configured per-room cap and rejects unsupported settings', () => {
    expect(HARD_PLAYER_LIMIT_PER_ROOM).toBe(12);
    expect(EVENT_LIMITS.maxPlayersPerRoom).toBeLessThanOrEqual(HARD_PLAYER_LIMIT_PER_ROOM);
    const room = new Room('cap');
    room.maxPlayers = HARD_PLAYER_LIMIT_PER_ROOM + 1;
    room.players = Array.from({ length: EVENT_LIMITS.maxPlayersPerRoom }, (_, index) => player(`cap-${index}`));
    const pool = { cap: room };
    expect(canJoinRoom(pool, room)).toBe(false);
    expect(validateRoomSetting(room, 'maxPlayers', HARD_PLAYER_LIMIT_PER_ROOM + 1)).toMatchObject({ ok: false });
  });
});

describe('per-player Socket.IO limits', () => {
  it('allows ordinary gameplay command frequency and rejects flooding without mutating state', () => {
    const limiter = new SocketRateLimiter();
    const policy = SOCKET_EVENT_POLICIES.attack;
    const gameState = { troops: 20 };
    for (let index = 0; index < policy.burst; index++) {
      if (limiter.allow('player:a', 'attack', policy, 1000)) gameState.troops -= 1;
    }
    expect(gameState.troops).toBe(4);
    expect(limiter.allow('player:a', 'attack', policy, 1000)).toBe(false);
    expect(gameState.troops).toBe(4);
    expect(limiter.allow('player:a', 'attack', policy, 2000)).toBe(true);
  });

  it('isolates players and event classes and bounds reconnect attempts', () => {
    const limiter = new SocketRateLimiter();
    expect(limiter.allow('player:a', 'surrender', SOCKET_EVENT_POLICIES.surrender, 0)).toBe(true);
    expect(limiter.allow('player:a', 'surrender', SOCKET_EVENT_POLICIES.surrender, 0)).toBe(false);
    expect(limiter.allow('player:b', 'surrender', SOCKET_EVENT_POLICIES.surrender, 0)).toBe(true);
    expect(limiter.allow('player:a', 'set_team', SOCKET_EVENT_POLICIES.set_team, 0)).toBe(true);
    expect(SESSION_IP_POLICY.burst).toBeGreaterThanOrEqual(300);
    expect(SESSION_CLAIM_POLICY.burst).toBeLessThan(SESSION_IP_POLICY.burst);
  });
});

describe('per-room asynchronous tick safety', () => {
  it('prevents overlapping ticks in one room without blocking another room', async () => {
    const first = new Room('tick-a');
    const second = new Room('tick-b');
    first.gameStarted = true;
    second.gameStarted = true;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let firstRuns = 0;
    const delayed = runRoomTick(first, async () => {
      firstRuns += 1;
      await gate;
    });
    const overlap = await runRoomTick(first, () => {
      firstRuns += 1;
    });
    const otherRoom = await runRoomTick(second, () => undefined);
    expect(overlap).toBe(false);
    expect(otherRoom).toBe(true);
    expect(firstRuns).toBe(1);
    expect(roomRuntimeSnapshot(first).preventedOverlaps).toBe(1);
    release();
    expect(await delayed).toBe(true);
    expect(roomRuntimeSnapshot(first).ticking).toBe(false);
  });

  it('releases locks after failure and invalidates a stale tick after cleanup', async () => {
    const room = new Room('tick-failure');
    room.gameStarted = true;
    await expect(
      runRoomTick(room, () => {
        throw new Error('tick failed');
      })
    ).rejects.toThrow('tick failed');
    expect(roomRuntimeSnapshot(room).ticking).toBe(false);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let staleCanMutate = true;
    const pending = runRoomTick(room, async (isCurrent) => {
      await gate;
      staleCanMutate = isCurrent();
    });
    room.gameStarted = false;
    resetRoomRuntime(room);
    room.gameStarted = true;
    release();
    await pending;
    expect(staleCanMutate).toBe(false);
    expect(await runRoomTick(room, () => undefined)).toBe(true);
  });
});

describe('idempotent room startup', () => {
  it('makes simultaneous start requests create exactly one interval and one transition', async () => {
    const room = new Room('start-race');
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let transitions = 0;
    let intervals = 0;
    const start = async () => {
      await gate;
      room.gameStarted = true;
      transitions += 1;
      room.gameLoop = setInterval(() => undefined, 1000);
      intervals += 1;
    };
    const first = startRoomOnce(room, start);
    const second = startRoomOnce(room, start);
    release();
    expect(await Promise.all([first, second])).toEqual([true, false]);
    expect(transitions).toBe(1);
    expect(intervals).toBe(1);
    expect(room.gameLoop).not.toBeNull();
    clearInterval(room.gameLoop);
    room.gameLoop = null;
    room.gameStarted = false;
    resetRoomRuntime(room);
  });
});

describe('normal map preservation and Custom Map removal', () => {
  it('still generates a normal random game map', () => {
    const participants = [player('map-a'), player('map-b')];
    participants[0].team = 1;
    participants[1].team = 2;
    const map = new GameMap('random', 'Random', 20, 20, 0, 0, 0, participants, false);
    map.generate();
    expect(map.map).toHaveLength(20);
    expect(participants.every((participant) => participant.king !== null)).toBe(true);
  });

  it('has no Custom Map API, pages, or active Prisma models', () => {
    const server = fs.readFileSync(path.join(root, 'server/src/server.ts'), 'utf8');
    const schema = fs.readFileSync(path.join(root, 'server/prisma/schema.prisma'), 'utf8');
    expect(server).not.toMatch(/app\.(get|post|put|delete)\('\/(maps|new|best|hot|search|toggleStar|starredMaps)/);
    expect(server).not.toContain('prisma.customMapData');
    expect(schema).not.toContain('model CustomMapData');
    expect(schema).not.toContain('model StarUsers');
    expect(fs.existsSync(path.join(root, 'client/pages/mapcreator.tsx'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'client/pages/maps/[mapId].tsx'))).toBe(false);
  });
});

describe('lightweight observability', () => {
  it('reports room/player counts and tick overlap prevention without exposing session tokens', async () => {
    const room = new Room('metrics');
    room.gameStarted = true;
    room.players = [player('metrics-player')];
    await runRoomTick(room, () => undefined);
    const metrics = new EventMetrics();
    metrics.recordEvent();
    metrics.recordBytes('in', 25);
    const snapshot = metrics.snapshot({ metrics: room }, 1);
    expect(snapshot).toMatchObject({ connectedSockets: 1, activeMatches: 1, activePlayers: 1 });
    expect(snapshot.eventsPerSecond).toBeGreaterThan(0);
    expect(JSON.stringify(snapshot)).not.toContain('sessionTokenHash');
  });
});
