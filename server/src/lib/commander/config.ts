export type MathDifficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';

export const COMMANDER_CONFIG = {
  maxEnergy: 100,
  math: {
    expiresAfterTurns: 60,
    cooldownTurns: 12,
    rewards: {
      EASY: { energy: 1, troops: 1 },
      MEDIUM: { energy: 2, troops: 2 },
      HARD: { energy: 4, troops: 3 },
      EXPERT: { energy: 5, troops: 5 },
    } satisfies Record<MathDifficulty, { energy: number; troops: number }>,
  },
  codeforces: {
    difficulty: 'SUPER_EASY' as const,
    energyReward: 50,
    troopReward: 10,
    assignmentTtlMs: 30 * 60 * 1000,
    assignmentCooldownMs: 60 * 1000,
    verificationCooldownMs: 10 * 1000,
    clockSkewToleranceSeconds: 30,
    apiIntervalMs: 2100,
    apiTimeoutMs: 12_000,
    solvedHistoryCount: 5000,
    verificationSubmissionCount: 25,
    maxQueueSize: 256,
  },
  abilities: {
    Scout: { energy: 20 },
    Reinforce: { energy: 40, troops: 40 },
    Airstrike: { energy: 60 },
  },
} as const;

export function addCommanderEnergy(current: number, reward: number): number {
  return Math.min(COMMANDER_CONFIG.maxEnergy, Math.max(0, current) + Math.max(0, reward));
}
