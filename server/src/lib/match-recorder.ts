import crypto from 'crypto';
import { MatchEventType, MatchStatus, Prisma, PrismaClient } from '@prisma/client';
import Player from './player';
import { prisma } from './prisma';
import { trackEvent, trackException, trackMetric } from './telemetry';
import type { ReplayStorageReference } from './replay-storage';

export type EliminationReason =
  | 'GENERAL_CAPTURED'
  | 'SURRENDERED'
  | 'AFK_SURRENDERED'
  | 'DISCONNECT_TIMEOUT'
  | 'INVALID_GENERAL_STATE';

export interface PlayerSnapshot {
  playerId: string;
  playerName: string;
  codeforcesHandle: string | null;
  team: number;
  color: number;
  isSpectator: boolean;
  joinedAt: Date;
}

export interface StartMatchInput {
  roomId: string;
  eventId?: string | null;
  startedAt?: Date;
  players: PlayerSnapshot[];
}

export interface MatchEventInput {
  type: MatchEventType;
  idempotencyKey: string;
  playerId?: string | null;
  timestamp?: Date;
  payload?: Prisma.InputJsonValue;
}

export interface EliminationInput {
  playerId: string;
  killerPlayerId?: string | null;
  turn: number;
  reason: EliminationReason;
  placement?: number | null;
  timestamp?: Date;
}

export interface FinishMatchInput {
  winnerPlayerId?: string | null;
  winnerPlayerIds: string[];
  winnerTeam?: number | null;
  finalTurn: number;
  endedAt?: Date;
}

export interface MatchStore {
  startMatch(matchId: string, input: Required<Pick<StartMatchInput, 'roomId' | 'players'>> & StartMatchInput): Promise<void>;
  addPlayer(matchId: string, player: PlayerSnapshot, timestamp: Date): Promise<void>;
  appendEvent(matchId: string, event: MatchEventInput): Promise<void>;
  eliminatePlayer(matchId: string, input: EliminationInput): Promise<void>;
  finishMatch(matchId: string, input: FinishMatchInput): Promise<void>;
  abortMatch(matchId: string, reason: string, finalTurn: number | null, endedAt: Date): Promise<void>;
  attachReplay(matchId: string, replay: ReplayStorageReference): Promise<void>;
}

async function createEvent(tx: any, matchId: string, input: MatchEventInput): Promise<void> {
  const existing = await tx.matchEvent.findUnique({
    where: { matchId_idempotencyKey: { matchId, idempotencyKey: input.idempotencyKey } },
    select: { id: true },
  });
  if (existing) return;
  const latest = await tx.matchEvent.findFirst({
    where: { matchId },
    orderBy: { sequenceNumber: 'desc' },
    select: { sequenceNumber: true },
  });
  await tx.matchEvent.create({
    data: {
      matchId,
      sequenceNumber: (latest?.sequenceNumber || 0) + 1,
      idempotencyKey: input.idempotencyKey,
      type: input.type,
      playerId: input.playerId || null,
      timestamp: input.timestamp || new Date(),
      payload: input.payload || {},
    },
  });
}

export class PrismaMatchStore implements MatchStore {
  constructor(private readonly db: PrismaClient = prisma) {}

  async startMatch(matchId: string, input: StartMatchInput): Promise<void> {
    const startedAt = input.startedAt || new Date();
    await this.db.$transaction(async (tx) => {
      await tx.match.upsert({
        where: { id: matchId },
        update: {},
        create: {
          id: matchId,
          roomId: input.roomId,
          eventId: input.eventId || null,
          status: MatchStatus.ACTIVE,
          startedAt,
        },
      });
      await tx.matchPlayer.createMany({
        data: input.players.map((player) => ({ matchId, ...player })),
        skipDuplicates: true,
      });
      await createEvent(tx, matchId, {
        type: MatchEventType.MATCH_STARTED,
        idempotencyKey: 'match-started',
        timestamp: startedAt,
        payload: { roomId: input.roomId, eventId: input.eventId || null, playerCount: input.players.length },
      });
      for (const player of input.players) {
        await createEvent(tx, matchId, {
          type: MatchEventType.PLAYER_JOINED,
          idempotencyKey: `player-joined:${player.playerId}`,
          playerId: player.playerId,
          timestamp: player.joinedAt,
          payload: { team: player.team, color: player.color, isSpectator: player.isSpectator },
        });
      }
    });
  }

  async addPlayer(matchId: string, player: PlayerSnapshot, timestamp: Date): Promise<void> {
    await this.db.$transaction(async (tx) => {
      await tx.matchPlayer.upsert({
        where: { matchId_playerId: { matchId, playerId: player.playerId } },
        update: {},
        create: { matchId, ...player },
      });
      await createEvent(tx, matchId, {
        type: MatchEventType.PLAYER_JOINED,
        idempotencyKey: `player-joined:${player.playerId}`,
        playerId: player.playerId,
        timestamp,
        payload: { team: player.team, color: player.color, isSpectator: player.isSpectator },
      });
    });
  }

  async appendEvent(matchId: string, event: MatchEventInput): Promise<void> {
    await this.db.$transaction((tx) => createEvent(tx, matchId, event));
  }

  async eliminatePlayer(matchId: string, input: EliminationInput): Promise<void> {
    const timestamp = input.timestamp || new Date();
    await this.db.$transaction(async (tx) => {
      await tx.matchPlayer.updateMany({
        where: { matchId, playerId: input.playerId, eliminatedAt: null },
        data: {
          eliminatedAt: timestamp,
          eliminationReason: input.reason,
          placement: input.placement ?? undefined,
        },
      });
      await createEvent(tx, matchId, {
        type: MatchEventType.PLAYER_ELIMINATED,
        idempotencyKey: `player-eliminated:${input.playerId}`,
        playerId: input.playerId,
        timestamp,
        payload: {
          eliminatedPlayerId: input.playerId,
          killerPlayerId: input.killerPlayerId || null,
          turn: input.turn,
          reason: input.reason,
          placement: input.placement ?? null,
        },
      });
    });
  }

  async finishMatch(matchId: string, input: FinishMatchInput): Promise<void> {
    const endedAt = input.endedAt || new Date();
    await this.db.$transaction(async (tx) => {
      const match = await tx.match.findUnique({ where: { id: matchId }, select: { startedAt: true } });
      if (!match) throw new Error(`Match ${matchId} was not found while finishing`);
      const durationSeconds = Math.max(0, Math.round((endedAt.getTime() - match.startedAt.getTime()) / 1000));
      await tx.match.updateMany({
        where: { id: matchId, status: MatchStatus.ACTIVE },
        data: {
          status: MatchStatus.COMPLETED,
          endedAt,
          durationSeconds,
          finalTurn: input.finalTurn,
          winnerPlayerId: input.winnerPlayerId || null,
          winnerTeam: input.winnerTeam ?? null,
        },
      });
      if (input.winnerPlayerIds.length > 0) {
        await tx.matchPlayer.updateMany({
          where: { matchId, playerId: { in: input.winnerPlayerIds } },
          data: { isWinner: true, placement: 1 },
        });
      }
      await createEvent(tx, matchId, {
        type: MatchEventType.MATCH_FINISHED,
        idempotencyKey: 'match-finished',
        playerId: input.winnerPlayerId || null,
        timestamp: endedAt,
        payload: {
          winnerPlayerId: input.winnerPlayerId || null,
          winnerPlayerIds: input.winnerPlayerIds,
          winnerTeam: input.winnerTeam ?? null,
          finalTurn: input.finalTurn,
          durationSeconds,
        },
      });
    });
  }

  async abortMatch(matchId: string, reason: string, finalTurn: number | null, endedAt: Date): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const match = await tx.match.findUnique({ where: { id: matchId }, select: { startedAt: true } });
      if (!match) return;
      const durationSeconds = Math.max(0, Math.round((endedAt.getTime() - match.startedAt.getTime()) / 1000));
      await tx.match.updateMany({
        where: { id: matchId, status: MatchStatus.ACTIVE },
        data: { status: MatchStatus.ABORTED, endedAt, durationSeconds, finalTurn },
      });
      await createEvent(tx, matchId, {
        type: MatchEventType.MATCH_ABORTED,
        idempotencyKey: 'match-aborted',
        timestamp: endedAt,
        payload: { reason, finalTurn, durationSeconds },
      });
    });
  }

  async attachReplay(matchId: string, replay: ReplayStorageReference): Promise<void> {
    await this.db.match.updateMany({
      where: { id: matchId },
      data: {
        replayId: replay.replayId,
        replayStorageType: replay.storageType,
        replayObjectKey: replay.objectKey,
      },
    });
  }
}

export function snapshotPlayer(player: Player, joinedAt = new Date()): PlayerSnapshot {
  return {
    playerId: player.id,
    playerName: player.username,
    codeforcesHandle: player.codeforcesHandle || null,
    team: player.team,
    color: player.color,
    isSpectator: player.spectating(),
    joinedAt,
  };
}

export class MatchRecorder {
  private readonly pending = new Map<string, Promise<void>>();

  constructor(
    private readonly store: MatchStore = new PrismaMatchStore(),
    private readonly retryBaseMs = 250
  ) {}

  startMatch(input: StartMatchInput): string {
    const matchId = crypto.randomUUID();
    const startedAt = input.startedAt || new Date();
    this.enqueue(matchId, 'start_match', true, () => this.store.startMatch(matchId, { ...input, startedAt }), 8);
    trackEvent('match_started', { matchId, roomId: input.roomId, eventId: input.eventId || null }, { players: input.players.length });
    return matchId;
  }

  recordPlayerJoined(matchId: string, player: PlayerSnapshot, timestamp = new Date()): void {
    this.enqueue(matchId, 'player_joined', false, () => this.store.addPlayer(matchId, player, timestamp));
  }

  recordMatchEvent(matchId: string, event: MatchEventInput): void {
    this.enqueue(matchId, event.type.toLowerCase(), false, () => this.store.appendEvent(matchId, event));
  }

  recordPlayerEliminated(matchId: string, input: EliminationInput): void {
    this.enqueue(matchId, 'player_eliminated', true, () => this.store.eliminatePlayer(matchId, input));
    trackEvent('player_eliminated', {
      matchId,
      playerId: input.playerId,
      killerPlayerId: input.killerPlayerId,
      reason: input.reason,
      turn: input.turn,
    });
  }

  recordGeneralCaptured(
    matchId: string,
    capturedPlayerId: string,
    captorPlayerId: string,
    turn: number,
    roomId: string,
    timestamp = new Date()
  ): void {
    this.recordMatchEvent(matchId, {
      type: MatchEventType.GENERAL_CAPTURED,
      idempotencyKey: `general-captured:${capturedPlayerId}`,
      playerId: capturedPlayerId,
      timestamp,
      payload: { capturedPlayerId, captorPlayerId, turn, roomId, matchId },
    });
    trackEvent('general_captured', { matchId, roomId, capturedPlayerId, captorPlayerId, turn });
  }

  recordPlayerSurrendered(
    matchId: string,
    playerId: string,
    turn: number,
    reason: 'SURRENDERED' | 'AFK_SURRENDERED',
    timestamp = new Date()
  ): void {
    this.recordMatchEvent(matchId, {
      type: MatchEventType.PLAYER_SURRENDERED,
      idempotencyKey: `player-surrendered:${playerId}`,
      playerId,
      timestamp,
      payload: { playerId, turn, reason },
    });
  }

  finishMatch(matchId: string, input: FinishMatchInput): void {
    this.enqueue(matchId, 'finish_match', true, () => this.store.finishMatch(matchId, input), 8);
    trackEvent('match_finished', {
      matchId,
      winnerPlayerId: input.winnerPlayerId,
      winnerTeam: input.winnerTeam,
      finalTurn: input.finalTurn,
    });
  }

  abortMatch(matchId: string, reason: string, finalTurn: number | null, endedAt = new Date()): void {
    this.enqueue(matchId, 'abort_match', true, () => this.store.abortMatch(matchId, reason, finalTurn, endedAt), 8);
    trackEvent('match_aborted', { matchId, reason, finalTurn });
  }

  attachReplay(matchId: string, replay: ReplayStorageReference): void {
    this.enqueue(matchId, 'attach_replay', false, () => this.store.attachReplay(matchId, replay));
  }

  async flush(matchId?: string): Promise<void> {
    if (matchId) await (this.pending.get(matchId) || Promise.resolve());
    else await Promise.all(this.pending.values());
  }

  private enqueue(
    matchId: string,
    operation: string,
    critical: boolean,
    write: () => Promise<void>,
    attempts = critical ? 4 : 2
  ): void {
    const previous = this.pending.get(matchId) || Promise.resolve();
    const next = previous
      .then(() => this.withRetry(matchId, operation, write, attempts))
      .catch((error) => {
        trackException(error, { source: 'match_recorder', matchId, operation, critical });
        trackMetric('database_write_failures', 1, { operation, critical });
        console.error(`[match-recorder] ${critical ? 'CRITICAL ' : ''}${operation} failed for ${matchId}:`, error);
      })
      .finally(() => {
        if (this.pending.get(matchId) === next) this.pending.delete(matchId);
      });
    this.pending.set(matchId, next);
  }

  private async withRetry(
    matchId: string,
    operation: string,
    write: () => Promise<void>,
    attempts: number
  ): Promise<void> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        await write();
        return;
      } catch (error) {
        lastError = error;
        trackMetric('database_write_failures', 1, { operation, attempt });
        if (attempt < attempts) {
          const delayMs = Math.min(4000, this.retryBaseMs * 2 ** (attempt - 1));
          console.warn(`[match-recorder] ${operation} retry ${attempt}/${attempts} for ${matchId}`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }
    throw lastError;
  }
}

export const matchRecorder = new MatchRecorder();
