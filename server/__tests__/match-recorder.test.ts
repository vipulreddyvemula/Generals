import { MatchEventType } from '@prisma/client';
import Player from '../src/lib/player';
import {
  EliminationInput,
  FinishMatchInput,
  MatchEventInput,
  MatchRecorder,
  MatchStore,
  PlayerSnapshot,
  PrismaMatchStore,
  StartMatchInput,
  snapshotPlayer,
} from '../src/lib/match-recorder';
import { ReplayStorageReference } from '../src/lib/replay-storage';

type StoredMatch = {
  id: string;
  roomId: string;
  eventId: string | null;
  status: 'ACTIVE' | 'COMPLETED' | 'ABORTED';
  startedAt: Date;
  endedAt: Date | null;
  winnerPlayerId: string | null;
  winnerTeam: number | null;
  finalTurn: number | null;
  replayId: string | null;
  replayStorageType: string | null;
  replayObjectKey: string | null;
  players: Map<string, PlayerSnapshot & {
    eliminatedAt: Date | null;
    eliminationReason: string | null;
    placement: number | null;
    isWinner: boolean;
  }>;
  events: MatchEventInput[];
};

class InMemoryMatchStore implements MatchStore {
  matches = new Map<string, StoredMatch>();
  writes = 0;

  async startMatch(matchId: string, input: StartMatchInput): Promise<void> {
    if (this.matches.has(matchId)) return;
    const players = new Map();
    input.players.forEach((player) => players.set(player.playerId, {
      ...player,
      eliminatedAt: null,
      eliminationReason: null,
      placement: null,
      isWinner: false,
    }));
    const match: StoredMatch = {
      id: matchId,
      roomId: input.roomId,
      eventId: input.eventId || null,
      status: 'ACTIVE',
      startedAt: input.startedAt || new Date(),
      endedAt: null,
      winnerPlayerId: null,
      winnerTeam: null,
      finalTurn: null,
      replayId: null,
      replayStorageType: null,
      replayObjectKey: null,
      players,
      events: [],
    };
    this.matches.set(matchId, match);
    this.addEvent(match, { type: MatchEventType.MATCH_STARTED, idempotencyKey: 'match-started' });
    input.players.forEach((player) => this.addEvent(match, {
      type: MatchEventType.PLAYER_JOINED,
      idempotencyKey: `player-joined:${player.playerId}`,
      playerId: player.playerId,
    }));
    this.writes += 1;
  }

  async addPlayer(matchId: string, player: PlayerSnapshot): Promise<void> {
    const match = this.get(matchId);
    if (!match.players.has(player.playerId)) match.players.set(player.playerId, {
      ...player,
      eliminatedAt: null,
      eliminationReason: null,
      placement: null,
      isWinner: false,
    });
    this.addEvent(match, {
      type: MatchEventType.PLAYER_JOINED,
      idempotencyKey: `player-joined:${player.playerId}`,
      playerId: player.playerId,
    });
  }

  async appendEvent(matchId: string, event: MatchEventInput): Promise<void> {
    this.addEvent(this.get(matchId), event);
  }

  async eliminatePlayer(matchId: string, input: EliminationInput): Promise<void> {
    const match = this.get(matchId);
    const player = match.players.get(input.playerId);
    if (player && !player.eliminatedAt) {
      player.eliminatedAt = input.timestamp || new Date();
      player.eliminationReason = input.reason;
      player.placement = input.placement || null;
    }
    this.addEvent(match, {
      type: MatchEventType.PLAYER_ELIMINATED,
      idempotencyKey: `player-eliminated:${input.playerId}`,
      playerId: input.playerId,
      payload: { killerPlayerId: input.killerPlayerId || null, turn: input.turn, reason: input.reason },
    });
  }

  async finishMatch(matchId: string, input: FinishMatchInput): Promise<void> {
    const match = this.get(matchId);
    if (match.status === 'ACTIVE') {
      match.status = 'COMPLETED';
      match.endedAt = input.endedAt || new Date();
      match.winnerPlayerId = input.winnerPlayerId || null;
      match.winnerTeam = input.winnerTeam || null;
      match.finalTurn = input.finalTurn;
      input.winnerPlayerIds.forEach((id) => {
        const player = match.players.get(id);
        if (player) {
          player.isWinner = true;
          player.placement = 1;
        }
      });
    }
    this.addEvent(match, { type: MatchEventType.MATCH_FINISHED, idempotencyKey: 'match-finished' });
  }

  async abortMatch(matchId: string, reason: string, finalTurn: number | null, endedAt: Date): Promise<void> {
    const match = this.get(matchId);
    if (match.status === 'ACTIVE') {
      match.status = 'ABORTED';
      match.endedAt = endedAt;
      match.finalTurn = finalTurn;
    }
    this.addEvent(match, {
      type: MatchEventType.MATCH_ABORTED,
      idempotencyKey: 'match-aborted',
      payload: { reason },
    });
  }

  async attachReplay(matchId: string, replay: ReplayStorageReference): Promise<void> {
    const match = this.get(matchId);
    match.replayId = replay.replayId;
    match.replayStorageType = replay.storageType;
    match.replayObjectKey = replay.objectKey;
  }

  protected get(matchId: string): StoredMatch {
    const match = this.matches.get(matchId);
    if (!match) throw new Error(`Unknown match ${matchId}`);
    return match;
  }

  private addEvent(match: StoredMatch, event: MatchEventInput): void {
    if (!match.events.some((existing) => existing.idempotencyKey === event.idempotencyKey)) match.events.push({ ...event });
  }
}

function participants() {
  const first = new Player('p1', 'socket-1', 'Vipul', 1, 1);
  first.codeforcesHandle = 'old_handle';
  const second = new Player('p2', 'socket-2', 'Opponent', 2, 2);
  second.codeforcesHandle = 'rival';
  return { first, second };
}

describe('MatchRecorder tournament lifecycle', () => {
  it('records the complete start -> capture -> elimination -> finish vertical slice idempotently', async () => {
    const store = new InMemoryMatchStore();
    const recorder = new MatchRecorder(store, 1);
    const { first, second } = participants();
    const startedAt = new Date('2026-09-23T10:00:00.000Z');
    const matchId = recorder.startMatch({
      roomId: 'final-room',
      eventId: null,
      startedAt,
      players: [snapshotPlayer(first, startedAt), snapshotPlayer(second, startedAt)],
    });

    first.codeforcesHandle = 'new_handle';
    recorder.recordGeneralCaptured(matchId, second.id, first.id, 42, 'final-room');
    recorder.recordPlayerEliminated(matchId, {
      playerId: second.id,
      killerPlayerId: first.id,
      turn: 42,
      reason: 'GENERAL_CAPTURED',
      placement: 2,
    });
    recorder.recordPlayerEliminated(matchId, {
      playerId: second.id,
      killerPlayerId: first.id,
      turn: 42,
      reason: 'GENERAL_CAPTURED',
      placement: 2,
    });
    const finish = {
      winnerPlayerId: first.id,
      winnerPlayerIds: [first.id],
      winnerTeam: first.team,
      finalTurn: 42,
      endedAt: new Date('2026-09-23T10:05:00.000Z'),
    };
    recorder.finishMatch(matchId, finish);
    recorder.finishMatch(matchId, finish);
    await recorder.flush(matchId);

    const match = store.matches.get(matchId)!;
    expect(match.roomId).toBe('final-room');
    expect(match.status).toBe('COMPLETED');
    expect(match.winnerPlayerId).toBe('p1');
    expect(match.finalTurn).toBe(42);
    expect(match.players.size).toBe(2);
    expect(match.players.get('p1')).toMatchObject({ playerName: 'Vipul', codeforcesHandle: 'old_handle', isWinner: true, placement: 1 });
    expect(match.players.get('p2')).toMatchObject({ eliminationReason: 'GENERAL_CAPTURED', placement: 2 });
    expect(match.events.filter((event) => event.type === MatchEventType.GENERAL_CAPTURED)).toHaveLength(1);
    expect(match.events.filter((event) => event.type === MatchEventType.PLAYER_ELIMINATED)).toHaveLength(1);
    expect(match.events.filter((event) => event.type === MatchEventType.MATCH_FINISHED)).toHaveLength(1);
  });

  it('creates immutable player snapshots and protects duplicate player/event records', async () => {
    const store = new InMemoryMatchStore();
    const recorder = new MatchRecorder(store, 1);
    const { first } = participants();
    const snapshot = snapshotPlayer(first);
    const matchId = recorder.startMatch({ roomId: 'snapshot-room', players: [snapshot] });
    recorder.recordPlayerJoined(matchId, snapshot);
    recorder.recordMatchEvent(matchId, {
      type: MatchEventType.GENERAL_CAPTURED,
      idempotencyKey: 'capture:p1',
      playerId: first.id,
    });
    recorder.recordMatchEvent(matchId, {
      type: MatchEventType.GENERAL_CAPTURED,
      idempotencyKey: 'capture:p1',
      playerId: first.id,
    });
    first.username = 'Changed';
    first.codeforcesHandle = 'changed_handle';
    await recorder.flush(matchId);

    const match = store.matches.get(matchId)!;
    expect(match.players.size).toBe(1);
    expect(match.players.get('p1')).toMatchObject({ playerName: 'Vipul', codeforcesHandle: 'old_handle' });
    expect(match.events.filter((event) => event.idempotencyKey === 'capture:p1')).toHaveLength(1);
  });

  it('retries a temporary critical database failure and persists completion', async () => {
    class FlakyStore extends InMemoryMatchStore {
      finishAttempts = 0;
      async finishMatch(matchId: string, input: FinishMatchInput): Promise<void> {
        this.finishAttempts += 1;
        if (this.finishAttempts < 3) throw new Error('temporary database outage');
        return super.finishMatch(matchId, input);
      }
    }
    const store = new FlakyStore();
    const recorder = new MatchRecorder(store, 1);
    const { first } = participants();
    const matchId = recorder.startMatch({ roomId: 'retry-room', players: [snapshotPlayer(first)] });
    recorder.finishMatch(matchId, { winnerPlayerId: first.id, winnerPlayerIds: [first.id], winnerTeam: 1, finalTurn: 9 });
    await recorder.flush(matchId);

    expect(store.finishAttempts).toBe(3);
    expect(store.matches.get(matchId)?.status).toBe('COMPLETED');
  });

  it('persists the replay storage reference on the durable match', async () => {
    const store = new InMemoryMatchStore();
    const recorder = new MatchRecorder(store, 1);
    const { first } = participants();
    const matchId = recorder.startMatch({ roomId: 'replay-room', players: [snapshotPlayer(first)] });
    recorder.attachReplay(matchId, {
      replayId: matchId,
      storageType: 'AZURE_BLOB',
      objectKey: `replays/${matchId}.json`,
    });
    await recorder.flush(matchId);

    expect(store.matches.get(matchId)).toMatchObject({
      replayId: matchId,
      replayStorageType: 'AZURE_BLOB',
      replayObjectKey: `replays/${matchId}.json`,
    });
  });

  it('maps replay metadata to the Prisma Match reference fields', async () => {
    const updateMany = jest.fn(async () => ({ count: 1 }));
    const store = new PrismaMatchStore({ match: { updateMany } } as any);
    const reference: ReplayStorageReference = {
      replayId: '76fca46d-350e-4d5b-9912-bf0023a7855f',
      storageType: 'AZURE_BLOB',
      objectKey: 'replays/76fca46d-350e-4d5b-9912-bf0023a7855f.json',
    };

    await store.attachReplay('76fca46d-350e-4d5b-9912-bf0023a7855f', reference);

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: reference.replayId },
      data: {
        replayId: reference.replayId,
        replayStorageType: 'AZURE_BLOB',
        replayObjectKey: reference.objectKey,
      },
    });
  });
});
