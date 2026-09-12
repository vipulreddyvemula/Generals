import { CodeforcesProblem, problemKey, selectCodeforcesProblem } from './codeforces-catalogue';

export type CodeforcesProblemSelector = (excludedProblems: ReadonlySet<string>) => CodeforcesProblem;

/**
 * One problem sequence shared by every eligible player in a room.
 * Players keep independent cursors, so reaching a position later returns
 * the exact problem first selected for that position.
 */
export default class SharedCodeforcesQueue {
  private readonly initialSolvedProblems = new Set<string>();
  private readonly problems: CodeforcesProblem[] = [];
  private readonly queuedProblemKeys = new Set<string>();
  private readonly playerPositions = new Map<string, number>();

  constructor(
    eligiblePlayerIds: Iterable<string>,
    solvedSets: Iterable<ReadonlySet<string>>,
    private readonly selectProblem: CodeforcesProblemSelector = selectCodeforcesProblem
  ) {
    for (const solvedSet of solvedSets) {
      for (const solvedProblem of solvedSet) this.initialSolvedProblems.add(solvedProblem);
    }
    for (const playerId of eligiblePlayerIds) this.playerPositions.set(playerId, 0);
  }

  hasPlayer(playerId: string): boolean {
    return this.playerPositions.has(playerId);
  }

  getPlayerPosition(playerId: string): number | null {
    return this.playerPositions.get(playerId) ?? null;
  }

  advancePlayer(playerId: string): number {
    const currentPosition = this.playerPositions.get(playerId);
    if (currentPosition === undefined) throw new Error('Player is not eligible for this Codeforces queue');
    const nextPosition = currentPosition + 1;
    this.playerPositions.set(playerId, nextPosition);
    return nextPosition;
  }

  getOrCreateProblem(position: number): CodeforcesProblem {
    if (!Number.isInteger(position) || position < 0) throw new Error('Invalid Codeforces queue position');

    while (this.problems.length <= position) {
      const excludedProblems = new Set([...this.initialSolvedProblems, ...this.queuedProblemKeys]);
      const problem = this.selectProblem(excludedProblems);
      const key = problemKey(problem);
      if (excludedProblems.has(key)) throw new Error('Codeforces selector returned an excluded problem');
      this.problems.push(problem);
      this.queuedProblemKeys.add(key);
    }

    return this.problems[position];
  }

  get length(): number {
    return this.problems.length;
  }
}
