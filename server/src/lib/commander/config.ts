export type MathDifficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';

export const COMMANDER_CONFIG = {
  maxEnergy: 100,
  math: {
    expiresAfterTurns: 360,
    cooldownTurns: 12,
    rewards: {
      EASY: { energy: 3, troops: 1 },
      MEDIUM: { energy: 3, troops: 1 },
      HARD: { energy: 3, troops: 1 },
      EXPERT: { energy: 3, troops: 1 },
    } satisfies Record<MathDifficulty, { energy: number; troops: number }>,
  },
  codeforces: {
    difficulty: 'SUPER_EASY' as const,
    clistBand: 0,
    energyReward: 50,
    troopReward: 10,
    verificationCooldownMs: 10 * 1000,
    clockSkewToleranceSeconds: 30,
    apiIntervalMs: 2100,
    apiRateLimitBackoffMs: 10_000,
    apiTimeoutMs: 12_000,
    solvedHistoryCount: 5000,
    solvedHistoryCacheMs: 60 * 60 * 1000,
    verificationSubmissionCount: 25,
    maxQueueSize: 256,
    skipEnergyCosts: [10, 20, 30] as const,
  },
  abilities: {
    Scout: { energy: 20 },
    Airstrike: { energy: 40 },
    Reinforce: { energy: 50, troops: 40 },
  },
} as const;

export function getCodeforcesSkipCost(completedSkips: number): number {
  const costs = COMMANDER_CONFIG.codeforces.skipEnergyCosts;
  const safeCount = Number.isInteger(completedSkips) && completedSkips > 0 ? completedSkips : 0;
  return costs[Math.min(safeCount, costs.length - 1)];
}

export function addCommanderEnergy(current: number, reward: number, maxEnergyOverride?: number): number {
  return Math.min(maxEnergyOverride ?? COMMANDER_CONFIG.maxEnergy, Math.max(0, current) + Math.max(0, reward));
}
