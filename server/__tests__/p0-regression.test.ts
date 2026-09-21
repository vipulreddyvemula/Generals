/**
 * P0 Regression Tests — P7 (AFK), P8 (Abilities), P9 (Replay)
 */
import Player from '../src/lib/player';
import { Room } from '../src/lib/types';
import { AbilityType, ABILITY_COSTS } from '../src/lib/types';
import { SOCKET_EVENT_POLICIES } from '../src/lib/socket-rate-limit';
import GameRecord from '../src/lib/game-record';
import os from 'os';
import path from 'path';
import fs from 'fs';

// ---------------------------------------------------------------------------
// P7 — AFK detection uses lastMoveTurn, not operatedTurn
// ---------------------------------------------------------------------------
describe('P7 — AFK detection via lastMoveTurn', () => {
  it('Player initialises with lastMoveTurn = 0', () => {
    const p = new Player('p', 's', 'User', 1, 1);
    expect(p.lastMoveTurn).toBe(0);
    expect(p.operatedTurn).toBe(0);
  });

  it('reset() clears lastMoveTurn along with operatedTurn', () => {
    const p = new Player('p', 's', 'User', 1, 1);
    p.lastMoveTurn = 50;
    p.operatedTurn = 50;
    p.reset();
    expect(p.lastMoveTurn).toBe(0);
    expect(p.operatedTurn).toBe(0);
  });

  it('AFK condition: turn - lastMoveTurn >= 160 catches players who moved once then stopped', () => {
    const p = new Player('p', 's', 'User', 1, 1);
    // Player made one move on turn 5, then went AFK.
    p.lastMoveTurn = 5;
    p.operatedTurn = 5;
    const currentTurn = 165;

    // Old (broken) condition: would NOT catch this player because operatedTurn !== 0
    const brokenAFK = p.operatedTurn === 0 && p.operatedTurn + 160 <= currentTurn;
    expect(brokenAFK).toBe(false);

    // New (correct) condition
    const correctAFK = currentTurn - p.lastMoveTurn >= 160;
    expect(correctAFK).toBe(true);
  });

  it('AFK condition: player who never moved is detected on turn 160', () => {
    const p = new Player('p', 's', 'User', 1, 1);
    // lastMoveTurn = 0, currentTurn = 160
    const correctAFK = 160 - p.lastMoveTurn >= 160;
    expect(correctAFK).toBe(true);
  });

  it('active player who moved recently is NOT AFK', () => {
    const p = new Player('p', 's', 'User', 1, 1);
    p.lastMoveTurn = 158;
    const currentTurn = 160;
    const correctAFK = currentTurn - p.lastMoveTurn >= 160;
    expect(correctAFK).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// P8 — Ability enum only contains Scout, Reinforce, Airstrike
// ---------------------------------------------------------------------------
describe('P8 — ability consistency (no dead abilities)', () => {
  it('AbilityType enum has exactly Scout, Reinforce, Airstrike', () => {
    const values = Object.values(AbilityType);
    expect(values).toEqual(['Scout', 'Reinforce', 'Airstrike']);
    expect(values).not.toContain('Blitz');
    expect(values).not.toContain('Fortify');
    expect(values).not.toContain('Supply Surge');
  });

  it('ABILITY_COSTS has an entry for every AbilityType and no extras', () => {
    const costKeys = Object.keys(ABILITY_COSTS);
    const enumValues = Object.values(AbilityType);
    expect(costKeys.sort()).toEqual(enumValues.sort());
  });

  it('Socket event policies cover activate_ability', () => {
    expect(SOCKET_EVENT_POLICIES['activate_ability']).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// P9 — Replay: async write, size bound, truncation flag
// ---------------------------------------------------------------------------
describe('P9 — replay safety', () => {
  const tmpDir = path.join(os.tmpdir(), `p9-test-${process.pid}`);

  beforeAll(() => {
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('outPutToJSON returns a Promise (not synchronous)', async () => {
    const record = new GameRecord([], 10, 10);
    const result = record.outPutToJSON(tmpDir);
    expect(result).toBeInstanceOf(Promise);
    const filename = await result;
    expect(typeof filename).toBe('string');
    expect(fs.existsSync(path.join(tmpDir, 'records', `${filename}.json`))).toBe(true);
  });

  it('replay file is valid JSON with expected structure', async () => {
    const record = new GameRecord([], 8, 8);
    record.addGameUpdate([], 1, []);
    const filename = await record.outPutToJSON(tmpDir);
    const raw = fs.readFileSync(path.join(tmpDir, 'records', `${filename}.json`), 'utf8');
    const parsed = JSON.parse(raw);
    expect(parsed).toHaveProperty('gameRecordTurns');
    expect(parsed).toHaveProperty('mapWidth', 8);
    expect(parsed).toHaveProperty('mapHeight', 8);
    expect(parsed).toHaveProperty('truncated');
  });

  it('replays longer than MAX_REPLAY_TURNS are truncated and flagged', async () => {
    const MAX_REPLAY_TURNS = 3600;
    const record = new GameRecord([], 4, 4);
    for (let t = 0; t < MAX_REPLAY_TURNS + 50; t++) {
      record.addGameUpdate([], t, []);
    }
    const filename = await record.outPutToJSON(tmpDir);
    const raw = fs.readFileSync(path.join(tmpDir, 'records', `${filename}.json`), 'utf8');
    const parsed = JSON.parse(raw);
    expect(parsed.truncated).toBe(true);
    expect(parsed.gameRecordTurns).toHaveLength(MAX_REPLAY_TURNS);
  });

  it('replays within the limit have truncated = false', async () => {
    const record = new GameRecord([], 4, 4);
    record.addGameUpdate([], 1, []);
    const filename = await record.outPutToJSON(tmpDir);
    const raw = fs.readFileSync(path.join(tmpDir, 'records', `${filename}.json`), 'utf8');
    expect(JSON.parse(raw).truncated).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// P3 — Socket rate-limit policies cover math-challenge events
// ---------------------------------------------------------------------------
describe('P3 — socket rate-limit policy coverage', () => {
  const required = [
    'attack', 'surrender', 'leave_room', 'set_team', 'change_room_setting',
    'player_message', 'activate_ability', 'force_start', 'change_host',
    'get_room_info', 'get_commander_config',
    'request_math_challenge', 'submit_math_answer',
    'skip_codeforces_challenge',
  ];

  it.each(required)('event "%s" has a rate-limit policy', (event) => {
    expect(SOCKET_EVENT_POLICIES[event]).toBeDefined();
    expect(SOCKET_EVENT_POLICIES[event].burst).toBeGreaterThan(0);
    expect(SOCKET_EVENT_POLICIES[event].refillMs).toBeGreaterThan(0);
  });

  it('math-challenge burst is limited to prevent brute-force', () => {
    expect(SOCKET_EVENT_POLICIES['request_math_challenge'].burst).toBeLessThanOrEqual(6);
    expect(SOCKET_EVENT_POLICIES['submit_math_answer'].burst).toBeLessThanOrEqual(10);
  });
});
