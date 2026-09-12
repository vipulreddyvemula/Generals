import Player from '../src/lib/player';
import { addCommanderEnergy, COMMANDER_CONFIG } from '../src/lib/commander/config';
import { MathGenerator } from '../src/lib/commander/math-generator';
import {
  CODEFORCES_PROBLEMS,
  isValidCodeforcesHandle,
  problemKey,
  selectCodeforcesProblem,
} from '../src/lib/commander/codeforces-catalogue';
import {
  classifyVerification,
  CodeforcesApiError,
  CodeforcesApiQueue,
  CodeforcesSubmission,
} from '../src/lib/commander/cf-api-queue';

describe('Commander challenge authority', () => {
  it('keeps the requested reward balance in one server config', () => {
    expect(COMMANDER_CONFIG.math.rewards).toEqual({
      EASY: { energy: 1, troops: 1 },
      MEDIUM: { energy: 2, troops: 2 },
      HARD: { energy: 4, troops: 3 },
      EXPERT: { energy: 5, troops: 5 },
    });
    expect(COMMANDER_CONFIG.codeforces.energyReward).toBe(50);
    expect(COMMANDER_CONFIG.codeforces.troopReward).toBe(10);
  });

  it('caps all challenge energy rewards at 100', () => {
    expect(addCommanderEnergy(98, 50)).toBe(100);
    expect(addCommanderEnergy(0, 2)).toBe(2);
  });

  it('never serializes the Math answer or Codeforces solved history', () => {
    const player = new Player('p1', 's1', 'tourist', 1, 1);
    player.activeChallenge = MathGenerator.generateChallenge(10);
    player.codeforcesSolvedSet.add('4-A');
    const serialized = JSON.parse(JSON.stringify(player));
    expect(serialized.activeChallenge.correctAnswer).toBeUndefined();
    expect(serialized.codeforcesSolvedSet).toBeUndefined();
  });

  it('selects a local Super Easy problem the player has not solved', () => {
    const superEasy = CODEFORCES_PROBLEMS.filter((problem) => problem.clistBand === COMMANDER_CONFIG.codeforces.clistBand);
    const solved = new Set(superEasy.slice(0, -1).map(problemKey));
    const selected = selectCodeforcesProblem(solved);
    expect(selected.difficulty).toBe('SUPER_EASY');
    expect(problemKey(selected)).toBe(problemKey(superEasy[superEasy.length - 1]));
    expect(selected.problemName).toBeTruthy();
    expect(selected.rating).toBe(800);
  });

  it('does not fall through to a harder CLIST band when the configured pool is exhausted', () => {
    const solved = new Set(
      CODEFORCES_PROBLEMS.filter((problem) => problem.clistBand === COMMANDER_CONFIG.codeforces.clistBand).map(problemKey)
    );
    expect(() => selectCodeforcesProblem(solved)).toThrow('No unsolved Codeforces problem');
  });

  it('validates Codeforces handle syntax before any API work', () => {
    expect(isValidCodeforcesHandle('tourist')).toBe(true);
    expect(isValidCodeforcesHandle('user_name-17')).toBe(true);
    expect(isValidCodeforcesHandle('x')).toBe(false);
    expect(isValidCodeforcesHandle('bad handle')).toBe(false);
  });
});

describe('central Codeforces API queue', () => {
  it('serializes requests and gives queued verification priority', async () => {
    const order: string[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let calls = 0;
    const queue = new CodeforcesApiQueue(async (handle) => {
      calls += 1;
      if (calls === 1) await firstGate;
      order.push(handle);
      return [];
    }, 0);

    const firstLow = queue.fetchSolvedSet('low-1');
    const secondLow = queue.fetchSolvedSet('low-2');
    const high = queue.verifySubmission('high', 71, 'A', 0);
    releaseFirst();
    await Promise.all([firstLow, secondLow, high]);
    expect(order).toEqual(['low-1', 'high', 'low-2']);
  });

  it('propagates timeout failures as typed errors', async () => {
    const queue = new CodeforcesApiQueue(async () => {
      throw new CodeforcesApiError('TIMEOUT');
    }, 0);
    await expect(queue.fetchSolvedSet('tourist')).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  it('enforces the configured interval between API calls', async () => {
    const times: number[] = [];
    const queue = new CodeforcesApiQueue(async () => {
      times.push(Date.now());
      return [];
    }, 20);
    await Promise.all([queue.fetchSolvedSet('one'), queue.fetchSolvedSet('two')]);
    expect(times[1] - times[0]).toBeGreaterThanOrEqual(15);
  });

  it('backs off the entire queue after a Codeforces rate-limit response', async () => {
    const times: number[] = [];
    let calls = 0;
    const queue = new CodeforcesApiQueue(
      async () => {
        calls += 1;
        times.push(Date.now());
        if (calls === 1) throw new CodeforcesApiError('RATE_LIMIT');
        return [];
      },
      0,
      256,
      20
    );

    await expect(queue.fetchSolvedSet('limited')).rejects.toMatchObject({ code: 'RATE_LIMIT' });
    await queue.fetchSolvedSet('after-limit');
    expect(times[1] - times[0]).toBeGreaterThanOrEqual(15);
  });

  it('deduplicates and caches solved-history requests for the same handle', async () => {
    let calls = 0;
    const queue = new CodeforcesApiQueue(async () => {
      calls += 1;
      return [
        {
          id: 1,
          creationTimeSeconds: 1,
          verdict: 'OK',
          problem: { contestId: 71, index: 'A' },
        },
      ];
    }, 0);

    const [first, concurrent] = await Promise.all([queue.fetchSolvedSet('Tourist'), queue.fetchSolvedSet('tourist')]);
    first.add('4-A');
    const cached = await queue.fetchSolvedSet('TOURIST');

    expect(calls).toBe(1);
    expect(concurrent).toEqual(new Set(['71-A']));
    expect(cached).toEqual(new Set(['71-A']));
  });

  it('paginates complete solved history through the same queue', async () => {
    const pageSize = COMMANDER_CONFIG.codeforces.solvedHistoryCount;
    const firstPage = Array.from({ length: pageSize }, (_, index) => ({
      id: index + 1,
      creationTimeSeconds: 1,
      verdict: 'OK',
      problem: { contestId: index + 1, index: 'A' },
    }));
    const starts: number[] = [];
    const queue = new CodeforcesApiQueue(async (_handle, _count, from = 1) => {
      starts.push(from);
      return from === 1
        ? firstPage
        : [
            {
              id: pageSize + 1,
              creationTimeSeconds: 1,
              verdict: 'OK',
              problem: { contestId: pageSize + 1, index: 'B' },
            },
          ];
    }, 0);

    const solved = await queue.fetchSolvedSet('many-submissions');
    expect(starts).toEqual([1, pageSize + 1]);
    expect(solved.has(`${pageSize + 1}-B`)).toBe(true);
  });
});

describe('Codeforces submission verification', () => {
  const issuedAtMs = 2_000_000;
  const submission = (overrides: Partial<CodeforcesSubmission> = {}): CodeforcesSubmission => ({
    id: 100,
    creationTimeSeconds: 2010,
    verdict: 'OK',
    problem: { contestId: 71, index: 'A' },
    ...overrides,
  });

  it('accepts only a matching, new OK submission and returns its id', () => {
    expect(classifyVerification([submission()], 71, 'A', issuedAtMs)).toEqual({ status: 'accepted', submissionId: 100 });
    expect(classifyVerification([submission({ problem: { contestId: 4, index: 'A' } })], 71, 'A', issuedAtMs)).toEqual({
      status: 'not_accepted',
      reason: 'no_submission',
    });
  });

  it('rejects an accepted submission from before the issued-at tolerance', () => {
    const old = submission({ creationTimeSeconds: 1900 });
    expect(classifyVerification([old], 71, 'A', issuedAtMs)).toEqual({ status: 'not_accepted', reason: 'old_submission' });
  });

  it('reports a recent rejected or pending submission as not accepted', () => {
    const wrong = submission({ verdict: 'WRONG_ANSWER' });
    expect(classifyVerification([wrong], 71, 'A', issuedAtMs)).toEqual({ status: 'not_accepted', reason: 'rejected' });
  });
});
