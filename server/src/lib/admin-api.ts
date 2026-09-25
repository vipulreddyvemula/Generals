import crypto from 'crypto';
import { EventStatus, MatchEventType, MatchStatus, Prisma, PrismaClient } from '@prisma/client';
import { NextFunction, Request, Response, Router } from 'express';
import { RoomPool } from './types';
import { prisma } from './prisma';
import { RatePolicy, SocketRateLimiter } from './socket-rate-limit';
import { trackException, trackMetric } from './telemetry';
import {
  createReplayStorageFromEnvironment,
  createReplayStorageResolver,
  ReplayStorageResolver,
} from './replay-storage';

const ADMIN_RATE_POLICY: RatePolicy = { burst: 120, refillMs: 60_000 };
const MAX_PAGE_SIZE = 100;

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer as any, rightBuffer as any);
}

export function adminAuthentication(expectedToken = process.env.ADMIN_API_TOKEN || '') {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!expectedToken) {
      res.status(503).json({ error: 'Admin API is not configured.' });
      return;
    }
    const authorization = req.header('authorization') || '';
    if (!authorization.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Admin authentication is required.' });
      return;
    }
    if (!safeEqual(authorization.slice(7), expectedToken)) {
      res.status(403).json({ error: 'Admin authentication failed.' });
      return;
    }
    next();
  };
}

export function parsePagination(query: Request['query']): { page: number; pageSize: number; skip: number } {
  const page = Math.max(1, Number.parseInt(String(query.page || '1'), 10) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number.parseInt(String(query.pageSize || '25'), 10) || 25));
  return { page, pageSize, skip: (page - 1) * pageSize };
}

function optionalDate(value: unknown): Date | undefined {
  if (typeof value !== 'string' || !value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function matchPlayerDto(player: any) {
  return {
    playerId: player.playerId,
    playerName: player.playerName,
    codeforcesHandle: player.codeforcesHandle,
    team: player.team,
    color: player.color,
    isSpectator: player.isSpectator,
    isWinner: player.isWinner,
    placement: player.placement,
    joinedAt: player.joinedAt,
    eliminatedAt: player.eliminatedAt,
    eliminationReason: player.eliminationReason,
  };
}

function matchDto(match: any) {
  const winner = match.players?.find((player: any) => player.playerId === match.winnerPlayerId) || null;
  return {
    matchId: match.id,
    eventId: match.eventId,
    roomId: match.roomId,
    status: match.status,
    startedAt: match.startedAt,
    endedAt: match.endedAt,
    durationSeconds: match.durationSeconds,
    finalTurn: match.finalTurn,
    winnerPlayerId: match.winnerPlayerId,
    winnerTeam: match.winnerTeam,
    winner: winner ? { playerId: winner.playerId, playerName: winner.playerName } : null,
    replay: {
      available: Boolean(match.replayId && match.replayStorageType && match.replayObjectKey),
      replayId: match.replayId || null,
      storageType: match.replayStorageType || null,
      objectKey: match.replayObjectKey || null,
    },
    players: match.players?.map(matchPlayerDto) || [],
  };
}

function eventDto(event: any) {
  return {
    sequenceNumber: event.sequenceNumber,
    type: event.type,
    playerId: event.playerId,
    timestamp: event.timestamp,
    payload: event.payload,
  };
}

function tournamentEventDto(event: any) {
  return {
    eventId: event.id,
    name: event.name,
    status: event.status,
    startedAt: event.startedAt,
    endedAt: event.endedAt,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  };
}

function asyncRoute(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    void handler(req, res).catch(next);
  };
}

function buildMatchWhere(query: Request['query']): Prisma.MatchWhereInput {
  const where: Prisma.MatchWhereInput = {};
  const status = typeof query.status === 'string' ? query.status.toUpperCase() : '';
  if (Object.values(MatchStatus).includes(status as MatchStatus)) where.status = status as MatchStatus;
  if (typeof query.eventId === 'string' && query.eventId) where.eventId = query.eventId;
  if (typeof query.roomId === 'string' && query.roomId) where.roomId = query.roomId;
  const from = optionalDate(query.from);
  const to = optionalDate(query.to);
  if (from || to) where.startedAt = { gte: from, lte: to };
  const playerName = typeof query.playerName === 'string' ? query.playerName.trim() : '';
  const codeforcesHandle = typeof query.codeforcesHandle === 'string' ? query.codeforcesHandle.trim() : '';
  if (playerName || codeforcesHandle) {
    where.players = {
      some: {
        ...(playerName ? { playerName: { contains: playerName, mode: 'insensitive' } } : {}),
        ...(codeforcesHandle ? { codeforcesHandle: { contains: codeforcesHandle, mode: 'insensitive' } } : {}),
      },
    };
  }
  return where;
}

export function createAdminRouter(
  roomPool: RoomPool,
  db: PrismaClient = prisma,
  resolveReplayStorage: ReplayStorageResolver = createReplayStorageResolver(
    createReplayStorageFromEnvironment(process.env, process.cwd()),
    process.env,
    process.cwd()
  )
): Router {
  const router = Router();
  const limiter = new SocketRateLimiter();

  router.use((req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    if (!limiter.allow(`admin:${ip}`, 'request', ADMIN_RATE_POLICY)) {
      res.status(429).json({ error: 'Too many admin requests.' });
      return;
    }
    next();
  });
  router.use(adminAuthentication());

  router.get(
    '/matches/live',
    asyncRoute(async (_req, res) => {
      const liveRooms = Object.values(roomPool).filter((room) => room.gameStarted && room.activeMatchId);
      const persisted = liveRooms.length
        ? await db.match.findMany({
            where: { id: { in: liveRooms.map((room) => room.activeMatchId!) } },
            include: { players: { orderBy: { createdAt: 'asc' } } },
          })
        : [];
      const byId = new Map(persisted.map((match) => [match.id, matchDto(match)]));
      const items = liveRooms.map((room) => {
        const stored = byId.get(room.activeMatchId!);
        return {
          ...(stored || {
            matchId: room.activeMatchId,
            eventId: room.activeEventId,
            roomId: room.id,
            status: MatchStatus.ACTIVE,
            startedAt: room.activeMatchStartedAt ? new Date(room.activeMatchStartedAt) : null,
            endedAt: null,
            durationSeconds: null,
            finalTurn: null,
            winnerPlayerId: null,
            winnerTeam: null,
            winner: null,
            replay: { available: false, replayId: null, storageType: null, objectKey: null },
            players: room.players.map((player) => matchPlayerDto({
              playerId: player.id,
              playerName: player.username,
              codeforcesHandle: player.codeforcesHandle || null,
              team: player.team,
              color: player.color,
              isSpectator: player.spectating(),
              isWinner: false,
              placement: null,
              joinedAt: new Date(room.activeMatchStartedAt || Date.now()),
              eliminatedAt: null,
              eliminationReason: null,
            })),
          }),
          currentTurn: room.map?.turn || 0,
          liveDurationSeconds: room.activeMatchStartedAt
            ? Math.max(0, Math.floor((Date.now() - room.activeMatchStartedAt) / 1000))
            : 0,
        };
      });
      res.json({ items, total: items.length });
    })
  );

  router.get(
    '/stats',
    asyncRoute(async (_req, res) => {
      const [completedMatches, eliminations, duration] = await Promise.all([
        db.match.count({ where: { status: MatchStatus.COMPLETED } }),
        db.matchEvent.count({ where: { type: MatchEventType.PLAYER_ELIMINATED } }),
        db.match.aggregate({ where: { status: MatchStatus.COMPLETED }, _avg: { durationSeconds: true } }),
      ]);
      const rooms = Object.values(roomPool);
      const liveRooms = rooms.filter((room) => room.gameStarted);
      res.json({
        activePlayers: liveRooms.reduce(
          (total, room) => total + room.players.filter((player) => !player.isDead && !player.spectating()).length,
          0
        ),
        activeMatches: liveRooms.length,
        completedMatches,
        rooms: rooms.filter((room) => room.players.length > 0).length,
        eliminations,
        averageMatchDurationSeconds: Math.round(duration._avg.durationSeconds || 0),
      });
    })
  );

  router.get(
    '/matches',
    asyncRoute(async (req, res) => {
      const { page, pageSize, skip } = parsePagination(req.query);
      const where = buildMatchWhere(req.query);
      const [total, matches] = await Promise.all([
        db.match.count({ where }),
        db.match.findMany({
          where,
          include: { players: { orderBy: { createdAt: 'asc' } } },
          orderBy: { startedAt: 'desc' },
          skip,
          take: pageSize,
        }),
      ]);
      res.json({ items: matches.map(matchDto), page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
    })
  );

  router.get(
    '/matches/:matchId/replay',
    asyncRoute(async (req, res) => {
      const match = await db.match.findUnique({
        where: { id: req.params.matchId },
        select: { replayId: true, replayStorageType: true, replayObjectKey: true },
      });
      if (!match?.replayId || !match.replayStorageType || !match.replayObjectKey) {
        res.status(404).json({ error: 'Replay is not available.' });
        return;
      }
      const replayJson = await resolveReplayStorage(match.replayStorageType).readReplay(match.replayObjectKey);
      if (replayJson === null) {
        res.status(404).json({ error: 'Replay is not available.' });
        return;
      }
      res.setHeader('Content-Disposition', `inline; filename="${match.replayId}.json"`);
      res.type('application/json').status(200).send(replayJson);
    })
  );

  router.get(
    '/matches/:matchId/events',
    asyncRoute(async (req, res) => {
      const { page, pageSize, skip } = parsePagination(req.query);
      const where = { matchId: req.params.matchId };
      const [total, events] = await Promise.all([
        db.matchEvent.count({ where }),
        db.matchEvent.findMany({ where, orderBy: { sequenceNumber: 'asc' }, skip, take: pageSize }),
      ]);
      res.json({ items: events.map(eventDto), page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
    })
  );

  router.get(
    '/matches/:matchId',
    asyncRoute(async (req, res) => {
      const match = await db.match.findUnique({
        where: { id: req.params.matchId },
        include: { players: { orderBy: { createdAt: 'asc' } } },
      });
      if (!match) {
        res.status(404).json({ error: 'Match not found.' });
        return;
      }
      res.json(matchDto(match));
    })
  );

  router.get(
    '/events',
    asyncRoute(async (req, res) => {
      const { page, pageSize, skip } = parsePagination(req.query);
      const [total, events] = await Promise.all([
        db.event.count(),
        db.event.findMany({ orderBy: { createdAt: 'desc' }, skip, take: pageSize }),
      ]);
      res.json({ items: events.map(tournamentEventDto), page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
    })
  );

  router.post(
    '/events',
    asyncRoute(async (req, res) => {
      const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
      if (!name || name.length > 120) {
        res.status(400).json({ error: 'Event name must contain 1-120 characters.' });
        return;
      }
      const status = String(req.body?.status || EventStatus.PLANNED).toUpperCase();
      if (!Object.values(EventStatus).includes(status as EventStatus)) {
        res.status(400).json({ error: 'Invalid event status.' });
        return;
      }
      const event = await db.event.create({
        data: {
          name,
          status: status as EventStatus,
          startedAt: optionalDate(req.body?.startedAt),
          endedAt: optionalDate(req.body?.endedAt),
        },
      });
      res.status(201).json(tournamentEventDto(event));
    })
  );

  router.get(
    '/events/:eventId/matches',
    asyncRoute(async (req, res) => {
      const { page, pageSize, skip } = parsePagination(req.query);
      const where: Prisma.MatchWhereInput = { ...buildMatchWhere(req.query), eventId: req.params.eventId };
      const [total, matches] = await Promise.all([
        db.match.count({ where }),
        db.match.findMany({
          where,
          include: { players: { orderBy: { createdAt: 'asc' } } },
          orderBy: { startedAt: 'desc' },
          skip,
          take: pageSize,
        }),
      ]);
      res.json({ items: matches.map(matchDto), page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
    })
  );

  router.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    trackMetric('database_query_failures', 1, { source: 'admin_api' });
    trackException(error, { source: 'admin_api' });
    console.error('[admin-api] request failed:', error);
    res.status(500).json({ error: 'Unable to query tournament records.' });
  });

  return router;
}
