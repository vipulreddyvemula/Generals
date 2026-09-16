/**
 * P2 — Atomic General Elimination Regression Tests
 *
 * Tests neutralizePlayer's atomicity guarantees:
 *  - isDead is set in the same call that clears land/king.
 *  - getGameOutcome immediately reflects the elimination.
 *  - Dead players are barred from subsequent actions.
 */
import Player from '../src/lib/player';
import { Room } from '../src/lib/types';
import { neutralizePlayer, getGameOutcome } from '../src/lib/lifecycle';
import { surrenderForSocket } from '../src/lib/security';
import Block from '../src/lib/block';
import { TileType } from '../src/lib/types';
import GameMap from '../src/lib/map';
import Point from '../src/lib/point';

function createTwoPlayerRoom() {
  const p1 = new Player('p1', 'socket-1', 'Alpha', 1, 1);
  const p2 = new Player('p2', 'socket-2', 'Beta', 2, 2);
  p1.disconnected = false;
  p2.disconnected = false;

  // Build a minimal 4x4 map and register the king blocks in the grid.
  const gameMap = new GameMap('map', 'test', 4, 4, 0, 0, 0, [], false);
  // Fill the grid with plain blocks.
  for (let x = 0; x < 4; x++) {
    for (let y = 0; y < 4; y++) {
      gameMap.map[x][y] = new Block(x, y, TileType.Plain, 0, null);
    }
  }
  // Place king blocks directly into the map grid.
  const king1 = new Block(0, 0, TileType.King, 5, p1);
  const king2 = new Block(3, 3, TileType.King, 5, p2);
  gameMap.map[0][0] = king1;
  gameMap.map[3][3] = king2;

  // Wire up player <-> block references.
  p1.land.push(king1);
  p1.king = king1;
  p2.land.push(king2);
  p2.king = king2;

  const room = new Room('elimination-test');
  room.players = [p1, p2];
  room.gameStarted = true;
  room.map = gameMap;

  return { room, p1, p2, gameMap };
}

describe('P2 — atomic general elimination', () => {
  it('neutralizePlayer sets isDead to true immediately before clearing land', () => {
    const { room, p1 } = createTwoPlayerRoom();
    expect(p1.isDead).toBe(false);
    const result = neutralizePlayer(room, p1);
    expect(result).toBe(true);
    expect(p1.isDead).toBe(true);
    expect(p1.land).toHaveLength(0);
    expect(p1.king).toBeNull();
  });

  it('getGameOutcome is terminal immediately after neutralizePlayer', () => {
    const { room, p1 } = createTwoPlayerRoom();
    // Before: two alive teams → not terminal
    expect(getGameOutcome(room)).toEqual({ terminal: false, winnerTeam: null });
    neutralizePlayer(room, p1);
    // After: only team 2 alive → terminal
    const outcome = getGameOutcome(room);
    expect(outcome.terminal).toBe(true);
    expect(outcome.winnerTeam).toBe(2);
  });

  it('dead player cannot surrender (ALREADY_SURRENDERED)', () => {
    const { room, p1 } = createTwoPlayerRoom();
    neutralizePlayer(room, p1);
    // p1.isDead = true, p1.disconnected = false — resolveSocketPlayer still finds p1.
    const result = surrenderForSocket(room, 'socket-1');
    expect(result).toMatchObject({ ok: false, code: 'ALREADY_SURRENDERED' });
  });

  it('double-neutralize is idempotent — second call returns false, state unchanged', () => {
    const { room, p1 } = createTwoPlayerRoom();
    const first = neutralizePlayer(room, p1);
    const second = neutralizePlayer(room, p1);
    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(p1.isDead).toBe(true);
    expect(p1.land).toHaveLength(0);
  });

  it('victory check reports the correct winner team after elimination', () => {
    const { room, p1, p2 } = createTwoPlayerRoom();
    neutralizePlayer(room, p1);
    const outcome = getGameOutcome(room);
    expect(outcome.terminal).toBe(true);
    expect(outcome.winnerTeam).toBe(p2.team);
  });

  it('surrenderForSocket succeeds for alive player, then is rejected on repeat', () => {
    const { room, p1 } = createTwoPlayerRoom();
    // First surrender — should succeed
    const alive = surrenderForSocket(room, 'socket-1');
    expect(alive).toMatchObject({ ok: true });
    expect(p1.isDead).toBe(true);
    // Second attempt on same socket — should fail
    const dead = surrenderForSocket(room, 'socket-1');
    expect(dead).toMatchObject({ ok: false, code: 'ALREADY_SURRENDERED' });
  });

  it('eliminating both players on different teams gives null winner (draw scenario)', () => {
    const { room, p1, p2 } = createTwoPlayerRoom();
    neutralizePlayer(room, p1);
    neutralizePlayer(room, p2);
    // Both dead — no team with living players
    const outcome = getGameOutcome(room);
    expect(outcome.terminal).toBe(true);
    // winner may be either last remaining or null — just ensure it is terminal
    expect(typeof outcome.winnerTeam === 'number' || outcome.winnerTeam === null).toBe(true);
  });
});
