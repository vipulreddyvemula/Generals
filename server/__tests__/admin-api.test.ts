import express from 'express';
import http from 'http';
import { AddressInfo } from 'net';
import { createAdminRouter, parsePagination } from '../src/lib/admin-api';
import { ReplayStorage, ReplayStorageResolver } from '../src/lib/replay-storage';

const TOKEN = 'test-admin-token-with-enough-entropy';

function fakeDatabase() {
  const calls: any[] = [];
  const player = {
    playerId: 'p1', playerName: 'Vipul', codeforcesHandle: 'tourist', team: 1, color: 1,
    isSpectator: false, isWinner: true, placement: 1, joinedAt: new Date(), eliminatedAt: null,
    eliminationReason: null, createdAt: new Date(),
  };
  const match = {
    id: '76fca46d-350e-4d5b-9912-bf0023a7855f', eventId: null, roomId: 'room-1', status: 'COMPLETED',
    startedAt: new Date(), endedAt: new Date(), durationSeconds: 60, finalTurn: 12,
    winnerPlayerId: 'p1', winnerTeam: 1,
    replayId: '76fca46d-350e-4d5b-9912-bf0023a7855f', replayStorageType: 'AZURE_BLOB',
    replayObjectKey: 'replays/76fca46d-350e-4d5b-9912-bf0023a7855f.json', players: [player],
  };
  return {
    calls,
    match: {
      count: jest.fn(async (args?: any) => { calls.push(['count', args]); return 1; }),
      aggregate: jest.fn(async () => ({ _avg: { durationSeconds: 60 } })),
      findMany: jest.fn(async (args: any) => { calls.push(['findMany', args]); return [match]; }),
      findUnique: jest.fn(async () => match),
    },
    matchEvent: {
      count: jest.fn(async () => 2),
      findMany: jest.fn(async () => [{
        sequenceNumber: 1, type: 'MATCH_STARTED', playerId: null, timestamp: new Date(), payload: {},
      }]),
    },
    event: { count: jest.fn(async () => 0), findMany: jest.fn(async () => []), create: jest.fn() },
  };
}

async function withServer(
  run: (baseUrl: string, db: ReturnType<typeof fakeDatabase>) => Promise<void>,
  resolveReplayStorage?: ReplayStorageResolver
) {
  const prior = process.env.ADMIN_API_TOKEN;
  process.env.ADMIN_API_TOKEN = TOKEN;
  const db = fakeDatabase();
  const app = express();
  app.use(express.json());
  const fallbackStorage: ReplayStorage = {
    storageType: 'AZURE_BLOB',
    objectKey: (matchId) => `replays/${matchId}.json`,
    saveReplay: jest.fn(),
    readReplay: jest.fn(async () => JSON.stringify({ players: [], gameRecordTurns: [] })),
  };
  app.use('/admin', createAdminRouter({}, db as any, resolveReplayStorage || (() => fallbackStorage)));
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  try {
    await run(`http://127.0.0.1:${port}`, db);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (prior === undefined) delete process.env.ADMIN_API_TOKEN;
    else process.env.ADMIN_API_TOKEN = prior;
  }
}

describe('admin match API', () => {
  it('rejects missing and invalid admin credentials with 401/403', async () => {
    await withServer(async (baseUrl) => {
      expect((await fetch(`${baseUrl}/admin/stats`)).status).toBe(401);
      expect((await fetch(`${baseUrl}/admin/stats`, { headers: { Authorization: 'Bearer wrong' } })).status).toBe(403);
    });
  });

  it('returns dashboard stats, match DTOs, and timeline data to an authenticated admin', async () => {
    await withServer(async (baseUrl) => {
      const headers = { Authorization: `Bearer ${TOKEN}` };
      const statsResponse = await fetch(`${baseUrl}/admin/stats`, { headers });
      expect(statsResponse.status).toBe(200);
      await expect(statsResponse.json()).resolves.toMatchObject({ completedMatches: 1, eliminations: 2 });

      const matches = await (await fetch(`${baseUrl}/admin/matches?pageSize=10`, { headers })).json() as any;
      expect(matches.items[0]).toMatchObject({ roomId: 'room-1', winner: { playerName: 'Vipul' } });
      expect(matches.items[0].replay).toEqual({
        available: true,
        replayId: '76fca46d-350e-4d5b-9912-bf0023a7855f',
        storageType: 'AZURE_BLOB',
        objectKey: 'replays/76fca46d-350e-4d5b-9912-bf0023a7855f.json',
      });
      expect(matches.items[0].players[0]).not.toHaveProperty('id');

      const events = await (await fetch(`${baseUrl}/admin/matches/76fca46d-350e-4d5b-9912-bf0023a7855f/events`, { headers })).json() as any;
      expect(events.items[0]).toMatchObject({ sequenceNumber: 1, type: 'MATCH_STARTED' });
      expect(events.items[0]).not.toHaveProperty('idempotencyKey');
    });
  });

  it('bounds pagination and applies historical filters', async () => {
    expect(parsePagination({ page: '2', pageSize: '1000' })).toEqual({ page: 2, pageSize: 100, skip: 100 });
    await withServer(async (baseUrl, db) => {
      const query = new URLSearchParams({
        page: '2', pageSize: '2', status: 'COMPLETED', roomId: 'room-1', playerName: 'Vip', codeforcesHandle: 'tour',
      });
      const response = await fetch(`${baseUrl}/admin/matches?${query}`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      expect(response.status).toBe(200);
      const findCall = db.calls.find(([name]) => name === 'findMany');
      expect(findCall[1]).toMatchObject({
        skip: 2,
        take: 2,
        where: { status: 'COMPLETED', roomId: 'room-1', players: { some: expect.any(Object) } },
      });
    });
  });

  it('downloads an available replay through the authenticated backend', async () => {
    const replayJson = JSON.stringify({ players: [{ username: 'Vipul' }], gameRecordTurns: [] });
    const readReplay = jest.fn(async () => replayJson);
    const storage: ReplayStorage = {
      storageType: 'AZURE_BLOB',
      objectKey: (matchId) => `replays/${matchId}.json`,
      saveReplay: jest.fn(),
      readReplay,
    };
    await withServer(async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/admin/matches/76fca46d-350e-4d5b-9912-bf0023a7855f/replay`,
        { headers: { Authorization: `Bearer ${TOKEN}` } }
      );
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/json');
      expect(await response.text()).toBe(replayJson);
      expect(readReplay).toHaveBeenCalledWith('replays/76fca46d-350e-4d5b-9912-bf0023a7855f.json');
    }, () => storage);
  });

  it('rejects unauthorized replay downloads before accessing storage', async () => {
    const readReplay = jest.fn();
    const storage: ReplayStorage = {
      storageType: 'AZURE_BLOB',
      objectKey: (matchId) => `replays/${matchId}.json`,
      saveReplay: jest.fn(),
      readReplay,
    };
    await withServer(async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/admin/matches/76fca46d-350e-4d5b-9912-bf0023a7855f/replay`
      );
      expect(response.status).toBe(401);
      expect(readReplay).not.toHaveBeenCalled();
    }, () => storage);
  });

  it('returns 404 when the match has no replay reference', async () => {
    await withServer(async (baseUrl, db) => {
      db.match.findUnique.mockResolvedValueOnce({
        replayId: null,
        replayStorageType: null,
        replayObjectKey: null,
      } as any);
      const response = await fetch(
        `${baseUrl}/admin/matches/76fca46d-350e-4d5b-9912-bf0023a7855f/replay`,
        { headers: { Authorization: `Bearer ${TOKEN}` } }
      );
      expect(response.status).toBe(404);
    });
  });

  it('returns 404 when the referenced replay object is missing', async () => {
    const storage: ReplayStorage = {
      storageType: 'AZURE_BLOB',
      objectKey: (matchId) => `replays/${matchId}.json`,
      saveReplay: jest.fn(),
      readReplay: jest.fn(async () => null),
    };
    await withServer(async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/admin/matches/76fca46d-350e-4d5b-9912-bf0023a7855f/replay`,
        { headers: { Authorization: `Bearer ${TOKEN}` } }
      );
      expect(response.status).toBe(404);
    }, () => storage);
  });
});
