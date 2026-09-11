import fs from 'fs';
import path from 'path';

export interface CodeforcesProblem {
  contestId: number;
  problemIndex: string;
  problemName: string;
  rating: number;
  difficulty: 'SUPER_EASY';
  tags?: string[];
}

function loadCatalogue(): CodeforcesProblem[] {
  const candidates = [
    path.resolve(process.cwd(), 'data/problems.json'),
    path.resolve(process.cwd(), 'server/data/problems.json'),
  ];
  const cataloguePath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!cataloguePath) throw new Error('Codeforces problem catalogue not found');

  const parsed = JSON.parse(fs.readFileSync(cataloguePath, 'utf8')) as CodeforcesProblem[];
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Codeforces problem catalogue is empty');
  }
  return parsed;
}

export const CODEFORCES_PROBLEMS = loadCatalogue();

export function problemKey(problem: Pick<CodeforcesProblem, 'contestId' | 'problemIndex'>): string {
  return `${problem.contestId}-${problem.problemIndex}`;
}

export function isValidCodeforcesHandle(handle: string): boolean {
  return /^[A-Za-z0-9_.-]{3,24}$/.test(handle);
}

export function selectCodeforcesProblem(
  solvedSet: ReadonlySet<string>,
  recentlyAssigned: ReadonlySet<string> = new Set()
): CodeforcesProblem {
  const preferred = CODEFORCES_PROBLEMS.filter(
    (problem) =>
      problem.difficulty === 'SUPER_EASY' && !solvedSet.has(problemKey(problem)) && !recentlyAssigned.has(problemKey(problem))
  );
  const unsolved = CODEFORCES_PROBLEMS.filter((problem) => !solvedSet.has(problemKey(problem)));
  const pool = preferred.length > 0 ? preferred : unsolved.length > 0 ? unsolved : CODEFORCES_PROBLEMS;
  return pool[Math.floor(Math.random() * pool.length)];
}
