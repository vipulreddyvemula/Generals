import GameMap from '../src/lib/map';
import Player from '../src/lib/player';
import Point from '../src/lib/point';
import { ReconnectGraceMs } from '../src/lib/constants';
import { Room, TileType } from '../src/lib/types';
import {
  applyRoomSetting,
  authorizeRoomSettingForSocket,
  changeTeamForSocket,
  isOrthogonalMove,
  MAX_SUPPORTED_PLAYERS,
  resolveSocketPlayer,
  ROOM_SETTING_KEYS,
  surrenderForSocket,
  validateRoomSetting,
} from '../src/lib/security';
import {
  claimGameTermination,
  cleanupFinishedRoom,
  getGameOutcome,
  neutralizePlayer,
  restoreConnectedPlayer,
  scheduleReconnectGrace,
} from '../src/lib/lifecycle';
import { authorizeReconnect, createReconnectCredential, hashReconnectToken } from '../src/lib/session';
import { createRoom, MAX_ROOM_COUNT, roomPool } from '../src/lib/room-pool';

function createActiveRoom(): { room: Room; first: Player; second: Player; map: GameMap } {
  const first = new Player('p1', 'socket-1', 'First', 1, 1);
  const second = new Player('p2', 'socket-2', 'Second', 2, 2, true);
  const room = new Room('security-test');
  room.players = [first, second];
  room.gameStarted = true;
  const map = new GameMap('map', 'test', 4, 4, 0, 0, 0, [], false);
  map.generate();
  room.map = map;

  const firstKing = map.getBlock(new Point(0, 0));
  firstKing.initKing(first);
  first.initKing(firstKing);
  const secondKing = map.getBlock(new Point(3, 3));
  secondKing.initKing(second);
  second.initKing(secondKing);
  return { room, first, second, map };
}

describe('authenticated reconnect ownership', () => {
  it('requires the secret reconnect credential, not only a public player ID', () => {
    const player = new Player('public-id', '', 'Player', 1, 1);
    const credential = createReconnectCredential();
    player.sessionTokenHash = credential.tokenHash;
    player.disconnected = true;
    player.disconnectGraceExpiresAt = Date.now() + ReconnectGraceMs;

    expect(authorizeReconnect(player, 'attacker-token', false)).toEqual({
      ok: false,
      reason: 'INVALID_CREDENTIALS',
    });
    expect(authorizeReconnect(player, credential.token, false)).toEqual({ ok: true });
    expect(JSON.parse(JSON.stringify(player)).sessionTokenHash).toBeUndefined();
  });

  it('rejects a duplicate active session and expires disconnected credentials', () => {
    const player = new Player('p1', 'socket-1', 'Player', 1, 1);
    const credential = createReconnectCredential();
    player.sessionTokenHash = credential.tokenHash;

    expect(authorizeReconnect(player, credential.token, true)).toEqual({
      ok: false,
      reason: 'DUPLICATE_SESSION',
    });

    player.disconnected = true;
    player.disconnectGraceExpiresAt = 100;
    expect(authorizeReconnect(player, credential.token, false, 100)).toEqual({
      ok: false,
      reason: 'GRACE_EXPIRED',
    });
    expect(hashReconnectToken(credential.token)).toBe(credential.tokenHash);
  });

  it('does not restore a disconnected flag without an active grace window', () => {
    const player = new Player('p1', '', 'Player', 1, 1);
    const credential = createReconnectCredential();
    player.sessionTokenHash = credential.tokenHash;
    player.disconnected = true;

    expect(authorizeReconnect(player, credential.token, false)).toEqual({
      ok: false,
      reason: 'GRACE_EXPIRED',
    });
  });
});

describe('socket-bound surrender and team authorization', () => {
  it('surrenders only the player authenticated to the acting socket', () => {
    const { room, first, second } = createActiveRoom();
    const result = surrenderForSocket(room, 'socket-1');

    expect(result.ok).toBe(true);
    expect(first.isDead).toBe(true);
    expect(second.isDead).toBe(false);
    expect(second.isRoomHost).toBe(true);
    expect(resolveSocketPlayer(room, 'socket-1')).toBe(first);
  });

  it('ignores an arbitrary target ID, cannot affect another player, and does not change socket identity', () => {
    const { room, first, second } = createActiveRoom();
    (surrenderForSocket as unknown as (room: Room, socketId: string, targetId: string) => unknown)(room, 'socket-1', second.id);
    const landAfterFirstSurrender = first.land.length;
    const repeated = surrenderForSocket(room, 'socket-1');

    expect(repeated).toMatchObject({ ok: false, code: 'ALREADY_SURRENDERED' });
    expect(first.land.length).toBe(landAfterFirstSurrender);
    expect(second.isDead).toBe(false);
    expect(first.socket_id).toBe('socket-1');
  });

  it('rejects surrender safely after game end', () => {
    const { room, first } = createActiveRoom();
    room.gameStarted = false;
    expect(surrenderForSocket(room, first.socket_id)).toMatchObject({ ok: false, code: 'MATCH_NOT_ACTIVE' });
  });

  it('locks spectators and active players to their teams during a match', () => {
    const { room, first } = createActiveRoom();
    const spectator = new Player('spectator', 'socket-s', 'Spectator', 3, 13);
    room.players.push(spectator);

    expect(changeTeamForSocket(room, spectator.socket_id, 3)).toMatchObject({ ok: false, code: 'MATCH_STARTED' });
    expect(spectator.team).toBe(13);
    expect(changeTeamForSocket(room, first.socket_id, 2)).toMatchObject({ ok: false, code: 'MATCH_STARTED' });
    expect(first.team).toBe(1);
  });

  it('allows legitimate team selection in the lobby, including after a game ends', () => {
    const { room, first } = createActiveRoom();
    room.gameStarted = false;
    expect(changeTeamForSocket(room, first.socket_id, 2)).toMatchObject({ ok: true });
    expect(first.team).toBe(2);
  });
});

describe('disconnect grace and restoration', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('keeps the player authoritative during grace and expires only after 30 seconds', () => {
    const { room, first } = createActiveRoom();
    let expired = false;
    scheduleReconnectGrace(
      first,
      () => {
        expired = true;
        neutralizePlayer(room, first);
      },
      ReconnectGraceMs
    );

    expect(ReconnectGraceMs).toBe(30_000);
    expect(first.disconnected).toBe(true);
    expect(first.isDead).toBe(false);
    jest.advanceTimersByTime(ReconnectGraceMs - 1);
    expect(expired).toBe(false);
    expect(first.isDead).toBe(false);
    jest.advanceTimersByTime(1);
    expect(expired).toBe(true);
    expect(first.isDead).toBe(true);
  });

  it('restores the correct player, cancels expiry, and invalidates the old socket association', () => {
    const { first } = createActiveRoom();
    const expire = jest.fn();
    scheduleReconnectGrace(first, expire, ReconnectGraceMs);
    restoreConnectedPlayer(first, 'replacement-socket');

    expect(first.disconnected).toBe(false);
    expect(first.socket_id).toBe('replacement-socket');
    jest.advanceTimersByTime(ReconnectGraceMs);
    expect(expire).not.toHaveBeenCalled();
  });
});

describe('terminal game cleanup', () => {
  it('treats zero surviving teams as terminal and cleans every transient resource', () => {
    const { room, first, second, map } = createActiveRoom();
    first.isDead = true;
    second.isDead = true;
    map.activeEffects.push({ type: 'Scout' });
    room.globalMapDiff = {} as Room['globalMapDiff'];
    room.gameRecord = {} as Room['gameRecord'];
    room.gameLoop = setInterval(() => undefined, 1000);

    expect(getGameOutcome(room)).toEqual({ terminal: true, winnerTeam: null });
    cleanupFinishedRoom(room);
    expect(room.gameStarted).toBe(false);
    expect(room.gameLoop).toBeNull();
    expect(room.map).toBeNull();
    expect(room.gameRecord).toBeNull();
    expect(room.globalMapDiff).toBeNull();
    expect(map.activeEffects).toHaveLength(0);
  });

  it('makes repeated cleanup harmless', () => {
    const { room } = createActiveRoom();
    expect(claimGameTermination(room)).toBe(true);
    expect(claimGameTermination(room)).toBe(false);
    cleanupFinishedRoom(room);
    expect(() => cleanupFinishedRoom(room)).not.toThrow();
    expect(room.gameStarted).toBe(false);
    expect(room.gameLoop).toBeNull();
  });
});

describe('authoritative movement and troop invariants', () => {
  it.each([
    [new Point(2, 2), new Point(3, 2)],
    [new Point(2, 2), new Point(1, 2)],
    [new Point(2, 2), new Point(2, 3)],
    [new Point(2, 2), new Point(2, 1)],
  ])('allows each orthogonal direction', (from, to) => {
    expect(isOrthogonalMove(from, to)).toBe(true);
  });

  it.each([
    [new Point(2, 2), new Point(3, 3)],
    [new Point(2, 2), new Point(1, 3)],
    [new Point(2, 2), new Point(3, 1)],
    [new Point(2, 2), new Point(1, 1)],
    [new Point(2, 2), new Point(2, 2)],
  ])('rejects diagonal and zero-distance movement', (from, to) => {
    expect(isOrthogonalMove(from, to)).toBe(false);
  });

  it('rejects fractional coordinates even when their delta is one', () => {
    expect(isOrthogonalMove(new Point(1.5, 2), new Point(2.5, 2))).toBe(false);
  });

  it('enforces orthogonal movement inside the map authority too', () => {
    const player = new Player('p1', 's1', 'Player', 1, 1);
    const map = new GameMap('map', 'test', 4, 4, 0, 0, 0, [], false);
    map.generate();
    map.getBlock(new Point(1, 1)).player = player;

    expect(map.commendable(player, new Point(1, 1), new Point(2, 1))).toBe(true);
    expect(map.commendable(player, new Point(1, 1), new Point(2, 2))).toBe(false);
  });

  it('never makes an airstruck swamp tile negative', () => {
    const attacker = new Player('p1', 's1', 'Attacker', 1, 1);
    const defender = new Player('p2', 's2', 'Defender', 2, 2);
    const map = new GameMap('map', 'test', 3, 3, 0, 0, 0, [], false);
    map.generate();
    const swamp = map.getBlock(new Point(1, 1));
    swamp.type = TileType.Swamp;
    swamp.player = defender;
    swamp.unit = 1;
    defender.land.push(swamp);
    map.turn = 1;
    map.activeEffects.push({
      type: 'Airstrike',
      player: attacker,
      center: new Point(1, 1),
      radius: 0,
      expiresAtTurn: 2,
    });

    map.updateTurn();
    map.updateUnit();
    expect(swamp.unit).toBe(0);
    expect(swamp.player).toBeNull();
    swamp.setUnit(-5);
    swamp.leaveUnit(10);
    expect(swamp.unit).toBe(0);
  });
});

describe('room creation, settings, and supported capacity', () => {
  it('returns a clean failure when room creation reaches its limit', async () => {
    const insertedKeys: string[] = [];
    while (Object.keys(roomPool).length < MAX_ROOM_COUNT) {
      const key = `capacity-test-${insertedKeys.length}`;
      roomPool[key] = new Room(key);
      insertedKeys.push(key);
    }
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const result = await createRoom('must-fail');
    consoleSpy.mockRestore();
    for (const key of insertedKeys) delete roomPool[key];

    expect(result).toMatchObject({ success: false, message: 'Room count exceeded' });
    expect(roomPool['must-fail']).toBeUndefined();
  });

  it('uses an explicit settings allowlist and rejects internal Room state', () => {
    const room = new Room('settings');
    const host = new Player('host', 'host-socket', 'Host', 1, 1, true);
    const guest = new Player('guest', 'guest-socket', 'Guest', 2, 2);
    room.players = [host, guest];
    expect(ROOM_SETTING_KEYS).toEqual([
      'roomName',
      'mapId',
      'maxPlayers',
      'gameSpeed',
      'mapWidth',
      'mapHeight',
      'mountain',
      'city',
      'swamp',
      'fogOfWar',
      'revealKing',
      'warringStatesMode',
      'deathSpectator',
    ]);
    for (const forbidden of ['players', 'map', 'gameLoop', 'gameStarted', 'globalMapDiff', 'gameRecord']) {
      expect(validateRoomSetting(room, forbidden, true)).toMatchObject({ ok: false, code: 'SETTING_NOT_ALLOWED' });
    }
    const valid = authorizeRoomSettingForSocket(room, host.socket_id, 'roomName', 'Secure Room');
    expect(valid).toMatchObject({ ok: true, value: { property: 'roomName', value: 'Secure Room' } });
    if (valid.ok) applyRoomSetting(room, valid.value.property, valid.value.value);
    expect(room.roomName).toBe('Secure Room');
    expect(authorizeRoomSettingForSocket(room, guest.socket_id, 'roomName', 'Attack')).toMatchObject({
      ok: false,
      code: 'NOT_HOST',
    });
    expect(authorizeRoomSettingForSocket(room, host.socket_id, 'players', true)).toMatchObject({
      ok: false,
      code: 'SETTING_NOT_ALLOWED',
    });
    room.gameStarted = true;
    expect(authorizeRoomSettingForSocket(room, host.socket_id, 'roomName', 'Too late')).toMatchObject({
      ok: false,
      code: 'MATCH_STARTED',
    });
  });

  it('caps maxPlayers to colors, teams, and ready/start table support', () => {
    const room = new Room('capacity');
    expect(MAX_SUPPORTED_PLAYERS).toBe(12);
    expect(validateRoomSetting(room, 'maxPlayers', 12)).toMatchObject({ ok: true });
    expect(validateRoomSetting(room, 'maxPlayers', 13)).toMatchObject({ ok: false });
    room.players = [
      new Player('p1', 's1', 'One', 1, 1),
      new Player('p2', 's2', 'Two', 2, 2),
      new Player('p3', 's3', 'Three', 3, 3),
    ];
    expect(validateRoomSetting(room, 'maxPlayers', 2)).toMatchObject({ ok: false });
  });
});
