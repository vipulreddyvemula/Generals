import fs from 'fs';
import path from 'path';
import { COMMANDER_CONFIG } from './config';

export type CodeforcesDifficulty = 'SUPER_EASY' | 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT' | 'UNRATED';

export class CodeforcesCatalogueError extends Error {
  readonly code = 'NO_ELIGIBLE_PROBLEM';
}

export interface CodeforcesProblem {
  contestId: number;
  problemIndex: string;
  problemName: string;
  rating: number;
  difficulty: CodeforcesDifficulty;
  solvedCount?: number;
  division?: string;
  clistBand: number;
  clistRating?: number;
  tags?: string[];
}

interface CompactCatalogueProblem {
  c: number;
  i: string;
  n: string;
  r: number;
  s: number;
  d: string;
  b: number;
  l: number;
}

interface LegacyCatalogueProblem {
  contestId: number;
  problemIndex?: string;
  index?: string;
  problemName?: string;
  name?: string;
  rating: number;
  difficulty?: CodeforcesDifficulty;
  solvedCount?: number;
  division?: string;
  clistBand?: number;
  clistRating?: number;
  tags?: string[];
}

const DIFFICULTY_BY_CLIST_BAND: Record<number, CodeforcesDifficulty> = {
  [-1]: 'UNRATED',
  0: 'SUPER_EASY',
  1: 'EASY',
  2: 'MEDIUM',
  3: 'HARD',
  4: 'EXPERT',
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalizeProblem(value: unknown, position: number): CodeforcesProblem {
  if (!value || typeof value !== 'object') {
    throw new Error(`Invalid Codeforces problem at catalogue position ${position}`);
  }

  const raw = value as Partial<CompactCatalogueProblem & LegacyCatalogueProblem>;
  const compact = 'c' in raw;
  const contestId = compact ? raw.c : raw.contestId;
  const problemIndex = compact ? raw.i : raw.problemIndex ?? raw.index;
  const problemName = compact ? raw.n : raw.problemName ?? raw.name;
  const rating = compact ? raw.r : raw.rating;
  const clistBand = compact ? raw.b : raw.clistBand ?? (raw.difficulty === 'SUPER_EASY' ? 0 : -1);

  if (
    !isFiniteNumber(contestId) ||
    !Number.isInteger(contestId) ||
    contestId <= 0 ||
    typeof problemIndex !== 'string' ||
    problemIndex.length === 0 ||
    typeof problemName !== 'string' ||
    problemName.length === 0 ||
    !isFiniteNumber(rating) ||
    !isFiniteNumber(clistBand)
  ) {
    throw new Error(`Invalid Codeforces problem at catalogue position ${position}`);
  }

  return {
    contestId,
    problemIndex,
    problemName,
    rating,
    difficulty: DIFFICULTY_BY_CLIST_BAND[clistBand] ?? raw.difficulty ?? 'UNRATED',
    solvedCount: compact ? raw.s : raw.solvedCount,
    division: compact ? raw.d : raw.division,
    clistBand,
    clistRating: compact ? raw.l : raw.clistRating,
    tags: raw.tags,
  };
}

function loadCatalogue(): CodeforcesProblem[] {
  const candidates = [
    path.resolve(process.cwd(), 'data/problems.json'),
    path.resolve(process.cwd(), 'server/data/problems.json'),
  ];
  const cataloguePath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!cataloguePath) throw new Error('Codeforces problem catalogue not found');

  const parsed = JSON.parse(fs.readFileSync(cataloguePath, 'utf8')) as unknown;
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Codeforces problem catalogue is empty');
  }

  const seen = new Set<string>();
  return parsed.map(normalizeProblem).filter((problem) => {
    const key = problemKey(problem);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
  const eligible = CODEFORCES_PROBLEMS.filter(
    (problem) => problem.clistBand === COMMANDER_CONFIG.codeforces.clistBand && !solvedSet.has(problemKey(problem))
  );
  const fresh = eligible.filter((problem) => !recentlyAssigned.has(problemKey(problem)));
  const pool = fresh.length > 0 ? fresh : eligible;
  if (pool.length === 0) {
    throw new CodeforcesCatalogueError('No unsolved Codeforces problem is available in the configured CLIST band');
  }
  return pool[Math.floor(Math.random() * pool.length)];
}
