import https from 'https';
import { COMMANDER_CONFIG } from './config';

export interface CodeforcesSubmission {
  id: number;
  creationTimeSeconds: number;
  verdict?: string;
  problem: { contestId?: number; index: string };
}

interface CodeforcesResponse {
  status: string;
  comment?: string;
  result?: CodeforcesSubmission[];
}

export type VerificationResult =
  | { status: 'accepted'; submissionId: number }
  | { status: 'not_accepted'; reason: 'no_submission' | 'rejected' | 'old_submission' };

export function classifyVerification(
  submissions: CodeforcesSubmission[],
  contestId: number,
  problemIndex: string,
  issuedAtMs: number
): VerificationResult {
  const matching = submissions.filter(
    (submission) => submission.problem.contestId === contestId && submission.problem.index === problemIndex
  );
  if (matching.length === 0) return { status: 'not_accepted', reason: 'no_submission' };

  const earliestAllowed = Math.floor(issuedAtMs / 1000) - COMMANDER_CONFIG.codeforces.clockSkewToleranceSeconds;
  const recent = matching.filter((submission) => submission.creationTimeSeconds >= earliestAllowed);
  const accepted = recent.find((submission) => submission.verdict === 'OK');
  if (accepted) return { status: 'accepted', submissionId: accepted.id };
  if (recent.length > 0) return { status: 'not_accepted', reason: 'rejected' };
  return { status: 'not_accepted', reason: 'old_submission' };
}

type QueueTask<T> = {
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
};

export class CodeforcesApiError extends Error {
  constructor(public readonly code: 'INVALID_HANDLE' | 'TIMEOUT' | 'RATE_LIMIT' | 'UNAVAILABLE') {
    super(code);
  }
}

export type UserStatusFetcher = (handle: string, count: number, from?: number) => Promise<CodeforcesSubmission[]>;

function fetchUserStatus(handle: string, count: number, from = 1): Promise<CodeforcesSubmission[]> {
  return new Promise((resolve, reject) => {
    const url = `https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}&from=${from}&count=${count}`;
    const request = https.get(url, { headers: { 'User-Agent': 'Generals-Commander/1.0' } }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        if (response.statusCode === 429) return reject(new CodeforcesApiError('RATE_LIMIT'));
        if (!response.statusCode || response.statusCode >= 500) return reject(new CodeforcesApiError('UNAVAILABLE'));
        try {
          const data = JSON.parse(body) as CodeforcesResponse;
          if (data.status !== 'OK') {
            const invalid = /not found|handle/i.test(data.comment || '');
            const rateLimited = /call limit exceeded|too many requests/i.test(data.comment || '');
            return reject(new CodeforcesApiError(rateLimited ? 'RATE_LIMIT' : invalid ? 'INVALID_HANDLE' : 'UNAVAILABLE'));
          }
          resolve(data.result || []);
        } catch {
          reject(new CodeforcesApiError('UNAVAILABLE'));
        }
      });
    });
    request.setTimeout(COMMANDER_CONFIG.codeforces.apiTimeoutMs, () => {
      request.destroy(new CodeforcesApiError('TIMEOUT'));
    });
    request.on('error', (error) => {
      reject(error instanceof CodeforcesApiError ? error : new CodeforcesApiError('UNAVAILABLE'));
    });
  });
}

export class CodeforcesApiQueue {
  private readonly highPriority: QueueTask<any>[] = [];
  private readonly lowPriority: QueueTask<any>[] = [];
  private readonly solvedCache = new Map<string, { expiresAt: number; solved: ReadonlySet<string> }>();
  private readonly solvedInFlight = new Map<string, Promise<ReadonlySet<string>>>();
  private running = false;
  private lastRequestAt = 0;
  private blockedUntil = 0;

  constructor(
    private readonly fetcher: UserStatusFetcher = fetchUserStatus,
    private readonly intervalMs: number = COMMANDER_CONFIG.codeforces.apiIntervalMs,
    private readonly maxQueueSize: number = COMMANDER_CONFIG.codeforces.maxQueueSize,
    private readonly rateLimitBackoffMs: number = COMMANDER_CONFIG.codeforces.apiRateLimitBackoffMs
  ) {}

  fetchSolvedSet(handle: string): Promise<Set<string>> {
    const cacheKey = handle.trim().toLowerCase();
    const cached = this.solvedCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return Promise.resolve(new Set(cached.solved));
    }
    if (cached) this.solvedCache.delete(cacheKey);

    const existing = this.solvedInFlight.get(cacheKey);
    if (existing) return existing.then((solved) => new Set(solved));

    const request = this.loadSolvedSet(handle)
      .then((solved) => {
        const snapshot = new Set(solved);
        this.solvedCache.set(cacheKey, {
          expiresAt: Date.now() + COMMANDER_CONFIG.codeforces.solvedHistoryCacheMs,
          solved: snapshot,
        });
        return snapshot;
      })
      .finally(() => {
        this.solvedInFlight.delete(cacheKey);
      });

    this.solvedInFlight.set(cacheKey, request);
    return request.then((solved) => new Set(solved));
  }

  markProblemSolved(handle: string, key: string): void {
    const cacheKey = handle.trim().toLowerCase();
    const cached = this.solvedCache.get(cacheKey);
    if (!cached || cached.expiresAt <= Date.now()) return;
    const solved = new Set(cached.solved);
    solved.add(key);
    this.solvedCache.set(cacheKey, { ...cached, solved });
  }

  verifySubmission(handle: string, contestId: number, problemIndex: string, issuedAtMs: number): Promise<VerificationResult> {
    return this.enqueue('high', async () => {
      const submissions = await this.fetcher(handle, COMMANDER_CONFIG.codeforces.verificationSubmissionCount, 1);
      return classifyVerification(submissions, contestId, problemIndex, issuedAtMs);
    });
  }

  private async loadSolvedSet(handle: string): Promise<Set<string>> {
    const solved = new Set<string>();
    const pageSize = COMMANDER_CONFIG.codeforces.solvedHistoryCount;
    let from = 1;

    while (true) {
      const submissions = await this.enqueue('low', () => this.fetcher(handle, pageSize, from));
      submissions.forEach((submission) => {
        if (submission.verdict === 'OK' && submission.problem.contestId !== undefined) {
          solved.add(`${submission.problem.contestId}-${submission.problem.index}`);
        }
      });
      if (submissions.length < pageSize) return solved;
      from += submissions.length;
    }
  }

  private enqueue<T>(priority: 'high' | 'low', run: () => Promise<T>): Promise<T> {
    const total = this.highPriority.length + this.lowPriority.length;
    if (total >= this.maxQueueSize) {
      return Promise.reject(new CodeforcesApiError('RATE_LIMIT'));
    }
    return new Promise<T>((resolve, reject) => {
      const task: QueueTask<T> = { run, resolve, reject };
      (priority === 'high' ? this.highPriority : this.lowPriority).push(task);
      void this.drain();
    });
  }

  private async drain(): Promise<void> {
    if (this.running) return;
    this.running = true;
    while (this.highPriority.length > 0 || this.lowPriority.length > 0) {
      const task = this.highPriority.shift() || this.lowPriority.shift();
      if (!task) break;
      const now = Date.now();
      const waitMs = Math.max(0, this.intervalMs - (now - this.lastRequestAt), this.blockedUntil - now);
      if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
      this.lastRequestAt = Date.now();
      try {
        task.resolve(await task.run());
      } catch (error) {
        if (error instanceof CodeforcesApiError && error.code === 'RATE_LIMIT') {
          this.blockedUntil = Date.now() + this.rateLimitBackoffMs;
        }
        task.reject(error instanceof Error ? error : new CodeforcesApiError('UNAVAILABLE'));
      }
    }
    this.running = false;
  }
}

export const codeforcesApiQueue = new CodeforcesApiQueue();
