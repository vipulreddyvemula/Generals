import crypto from 'crypto';
import { ChallengeState, MathDomain } from '../types';
import { COMMANDER_CONFIG, MathDifficulty } from './config';

export const ENERGY_REWARD_EASY = COMMANDER_CONFIG.math.rewards.EASY.energy;
export const ENERGY_REWARD_MEDIUM = COMMANDER_CONFIG.math.rewards.MEDIUM.energy;
export const ENERGY_REWARD_HARD = COMMANDER_CONFIG.math.rewards.HARD.energy;
export const ENERGY_REWARD_EXPERT = COMMANDER_CONFIG.math.rewards.EXPERT.energy;

interface Problem {
  domain: MathDomain;
  question: string;
  answer: string;
  difficulty: MathDifficulty;
}

const PROBLEM_POOL: Problem[] = [
  { domain: MathDomain.Arithmetic, question: 'What is 37 × 4?', answer: '148', difficulty: 'EASY' },
  { domain: MathDomain.Arithmetic, question: 'What is 144 ÷ 12?', answer: '12', difficulty: 'EASY' },
  { domain: MathDomain.Arithmetic, question: 'What is 256 − 89?', answer: '167', difficulty: 'EASY' },
  { domain: MathDomain.Logic, question: 'If all A are B, and X is A, is X a B? (yes/no)', answer: 'yes', difficulty: 'EASY' },
  { domain: MathDomain.Arithmetic, question: 'What is 37 × 84?', answer: '3108', difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: 'What is 25% of 480?', answer: '120', difficulty: 'MEDIUM' },
  { domain: MathDomain.Algebra, question: 'Solve for x: 3x + 7 = 31', answer: '8', difficulty: 'MEDIUM' },
  {
    domain: MathDomain.Geometry,
    question: 'Area of a circle with radius 7? (use π = 22/7)',
    answer: '154',
    difficulty: 'MEDIUM',
  },
  { domain: MathDomain.Algebra, question: 'If f(x) = 3x² − 2, find f(4)', answer: '46', difficulty: 'HARD' },
  { domain: MathDomain.Sequence, question: 'Next in sequence: 3, 7, 13, 21, 31, ?', answer: '43', difficulty: 'HARD' },
  {
    domain: MathDomain.Geometry,
    question: 'A right triangle has legs 9 and 12. Its hypotenuse?',
    answer: '15',
    difficulty: 'HARD',
  },
  { domain: MathDomain.Sequence, question: 'Next in sequence: 2, 6, 12, 20, 30, ?', answer: '42', difficulty: 'EXPERT' },
  {
    domain: MathDomain.Logic,
    question: 'A clock shows 3:15. What is the smaller angle between its hands?',
    answer: '7.5',
    difficulty: 'EXPERT',
  },
];

function normalize(value: string): string {
  return value.toLowerCase().replace(/,/g, '').trim();
}

export class MathGenerator {
  public static generateChallenge(currentTurn: number): ChallengeState {
    const problem = PROBLEM_POOL[Math.floor(Math.random() * PROBLEM_POOL.length)];
    const reward = COMMANDER_CONFIG.math.rewards[problem.difficulty];
    return {
      id: crypto.randomUUID(),
      domain: problem.domain,
      difficulty: problem.difficulty,
      question: problem.question,
      correctAnswer: problem.answer,
      rewardEnergy: reward.energy,
      rewardTroops: reward.troops,
      expiresAtTurn: currentTurn + COMMANDER_CONFIG.math.expiresAfterTurns,
      attempted: false,
    };
  }

  public static verifyAnswer(challenge: ChallengeState, submitted: string): boolean {
    return normalize(challenge.correctAnswer) === normalize(submitted);
  }
}
