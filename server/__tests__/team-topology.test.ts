/**
 * P6 — Team Topology Regression Tests
 */
import Player from '../src/lib/player';
import { Room } from '../src/lib/types';
import { forceStartOK } from '../src/lib/constants';

/** Pure replica of the checkForcedStart guard — no Socket.IO. */
function wouldStart(room: Room): { allowed: boolean; reason?: string } {
  const activePlayers = room.players.filter((p) => !p.spectating());
  const threshold = forceStartOK[activePlayers.length];
  if (room.forceStartNum < threshold) {
    return { allowed: false, reason: 'NOT_ENOUGH_READY' };
  }
  const activeTeams = new Set(activePlayers.map((p) => p.team));
  if (activeTeams.size < 2) {
    return { allowed: false, reason: 'SINGLE_TEAM' };
  }
  return { allowed: true };
}

function readyPlayer(id: string, team: number): Player {
  const p = new Player(id, `s-${id}`, id, team === 1 ? 1 : 2, team);
  p.forceStart = true;
  return p;
}

function lobby(players: Player[]): Room {
  const room = new Room('topology-test');
  room.players = players;
  room.forceStartNum = players.filter((p) => p.forceStart && !p.spectating()).length;
  return room;
}

describe('P6 — team topology guard', () => {
  it('blocks start when all active players share one team', () => {
    // Two ready players, both on team 1 — meets threshold but fails team diversity
    const p1 = readyPlayer('p1', 1);
    const p2 = readyPlayer('p2', 1);
    const room = lobby([p1, p2]);
    // forceStartOK[2] = 2, forceStartNum = 2 => threshold met
    expect(room.forceStartNum).toBeGreaterThanOrEqual(forceStartOK[2]);
    const result = wouldStart(room);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('SINGLE_TEAM');
  });

  it('allows start when active players span two teams', () => {
    const p1 = readyPlayer('p1', 1);
    const p2 = readyPlayer('p2', 2);
    const room = lobby([p1, p2]);
    const result = wouldStart(room);
    expect(result.allowed).toBe(true);
  });

  it('spectators are excluded from team diversity count', () => {
    // Two active players, both team 1. One spectator on team 2 (does not count).
    const p1 = readyPlayer('p1', 1);
    const p2 = readyPlayer('p2', 1);
    const spec = readyPlayer('sp', 2);
    spec.setSpectate(); // team = MaxTeamNum+1
    const room = lobby([p1, p2, spec]);
    const result = wouldStart(room);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('SINGLE_TEAM');
  });

  it('blocks start when all active players become spectators (zero active)', () => {
    const spec1 = readyPlayer('s1', 1);
    const spec2 = readyPlayer('s2', 2);
    spec1.setSpectate();
    spec2.setSpectate();
    const room = lobby([spec1, spec2]);
    // 0 active players — threshold never reached
    const result = wouldStart(room);
    expect(result.allowed).toBe(false);
    // forceStartOK[0] = 1, forceStartNum = 0 < 1
    expect(result.reason).toBe('NOT_ENOUGH_READY');
  });

  it('does not reach topology check when ready count is below threshold', () => {
    const p1 = new Player('p1', 's1', 'A', 1, 1, false, false); // NOT ready
    const p2 = new Player('p2', 's2', 'B', 2, 2, false, false);
    const room = lobby([p1, p2]);
    const result = wouldStart(room);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('NOT_ENOUGH_READY');
  });

  it('three active players — two teams — allows start at threshold', () => {
    const p1 = readyPlayer('p1', 1);
    const p2 = readyPlayer('p2', 1);
    const p3 = readyPlayer('p3', 2);
    const room = lobby([p1, p2, p3]);
    // forceStartOK[3] = 2, forceStartNum = 3 >= 2
    const result = wouldStart(room);
    expect(result.allowed).toBe(true);
  });

  it('three active players all on team 1 — blocks with SINGLE_TEAM', () => {
    const p1 = readyPlayer('p1', 1);
    const p2 = readyPlayer('p2', 1);
    const p3 = readyPlayer('p3', 1);
    const room = lobby([p1, p2, p3]);
    const result = wouldStart(room);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('SINGLE_TEAM');
  });
});
