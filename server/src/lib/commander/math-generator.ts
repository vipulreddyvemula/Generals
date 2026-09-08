import { MathDomain, ChallengeState } from '../types';
import crypto from 'crypto';

// ============================================================
// ENERGY REWARDS (authoritative — must match client constants)
// ============================================================
export const ENERGY_REWARD_EASY   = 10;
export const ENERGY_REWARD_MEDIUM = 20;
export const ENERGY_REWARD_HARD   = 35;

// Challenge expires after this many game turns (≈30 s at 1 turn/s)
const CHALLENGE_EXPIRE_TURNS = 60;

// ============================================================
// HARD-CODED PROBLEM POOL
// Each entry: domain, question, answer (lowercase, trimmed),
// difficulty, rewardEnergy
// ============================================================
interface Problem {
  domain: MathDomain;
  question: string;
  answer: string;        // canonical correct answer (lowercase, trimmed)
  rewardEnergy: number;
}

const PROBLEM_POOL: Problem[] = [
  // ------ Arithmetic — Easy ------
  { domain: MathDomain.Arithmetic,   question: 'What is 37 × 4?',                                    answer: '148',   rewardEnergy: ENERGY_REWARD_EASY },
  { domain: MathDomain.Arithmetic,   question: 'What is 144 ÷ 12?',                                  answer: '12',    rewardEnergy: ENERGY_REWARD_EASY },
  { domain: MathDomain.Arithmetic,   question: 'What is 256 − 89?',                                  answer: '167',   rewardEnergy: ENERGY_REWARD_EASY },
  { domain: MathDomain.Arithmetic,   question: 'What is 48 × 5?',                                    answer: '240',   rewardEnergy: ENERGY_REWARD_EASY },
  { domain: MathDomain.Arithmetic,   question: '15% of 240 = ?',                                     answer: '36',    rewardEnergy: ENERGY_REWARD_EASY },
  { domain: MathDomain.Arithmetic,   question: 'What is 17 + 58 + 25?',                              answer: '100',   rewardEnergy: ENERGY_REWARD_EASY },
  { domain: MathDomain.Arithmetic,   question: 'What is 360 ÷ 8?',                                   answer: '45',    rewardEnergy: ENERGY_REWARD_EASY },

  // ------ Arithmetic — Medium ------
  { domain: MathDomain.Arithmetic,   question: 'What is 37 × 84?',                                   answer: '3108',  rewardEnergy: ENERGY_REWARD_MEDIUM },
  { domain: MathDomain.Arithmetic,   question: 'What is 25% of 480?',                                answer: '120',   rewardEnergy: ENERGY_REWARD_MEDIUM },
  { domain: MathDomain.Arithmetic,   question: 'What is 512 ÷ 16?',                                  answer: '32',    rewardEnergy: ENERGY_REWARD_MEDIUM },
  { domain: MathDomain.Arithmetic,   question: 'What is 13³ (13 cubed)?',                            answer: '2197',  rewardEnergy: ENERGY_REWARD_MEDIUM },

  // ------ Algebra ------
  { domain: MathDomain.Algebra,      question: 'Solve for x: 3x + 7 = 31',                          answer: '8',     rewardEnergy: ENERGY_REWARD_MEDIUM },
  { domain: MathDomain.Algebra,      question: 'Solve for x: 5x − 15 = 35',                         answer: '10',    rewardEnergy: ENERGY_REWARD_MEDIUM },
  { domain: MathDomain.Algebra,      question: 'Solve for x: 2x + 9 = 41',                          answer: '16',    rewardEnergy: ENERGY_REWARD_MEDIUM },
  { domain: MathDomain.Algebra,      question: 'Solve for x: 7x = 56',                              answer: '8',     rewardEnergy: ENERGY_REWARD_EASY   },
  { domain: MathDomain.Algebra,      question: 'Solve for x: 4x − 3 = 17',                          answer: '5',     rewardEnergy: ENERGY_REWARD_EASY   },
  { domain: MathDomain.Algebra,      question: 'If f(x) = 3x² − 2, find f(4)',                      answer: '46',    rewardEnergy: ENERGY_REWARD_HARD   },

  // ------ Sequences ------
  { domain: MathDomain.Sequence,     question: 'Next in sequence: 4, 9, 14, 19, ?',                  answer: '24',    rewardEnergy: ENERGY_REWARD_EASY   },
  { domain: MathDomain.Sequence,     question: 'Next in sequence: 2, 4, 8, 16, ?',                   answer: '32',    rewardEnergy: ENERGY_REWARD_EASY   },
  { domain: MathDomain.Sequence,     question: 'Next in sequence: 1, 4, 9, 16, 25, ?',               answer: '36',    rewardEnergy: ENERGY_REWARD_EASY   },
  { domain: MathDomain.Sequence,     question: 'Next in sequence: 3, 7, 13, 21, 31, ?',              answer: '43',    rewardEnergy: ENERGY_REWARD_MEDIUM },
  { domain: MathDomain.Sequence,     question: 'Next in sequence: 1, 1, 2, 3, 5, 8, ?',              answer: '13',    rewardEnergy: ENERGY_REWARD_MEDIUM },

  // ------ Geometry ------
  { domain: MathDomain.Geometry,     question: 'Area of a rectangle: width 8, height 13?',           answer: '104',   rewardEnergy: ENERGY_REWARD_EASY   },
  { domain: MathDomain.Geometry,     question: 'Perimeter of a rectangle: width 9, height 6?',       answer: '30',    rewardEnergy: ENERGY_REWARD_EASY   },
  { domain: MathDomain.Geometry,     question: 'Area of a triangle: base 10, height 7?',             answer: '35',    rewardEnergy: ENERGY_REWARD_EASY   },
  { domain: MathDomain.Geometry,     question: 'How many degrees are in a triangle?',                answer: '180',   rewardEnergy: ENERGY_REWARD_EASY   },
  { domain: MathDomain.Geometry,     question: 'Area of a circle with radius 7? (use π = 22/7)',     answer: '154',   rewardEnergy: ENERGY_REWARD_MEDIUM },

  // ------ Probability & Logic ------
  { domain: MathDomain.Probability,  question: 'A bag has 3 red and 7 blue balls. P(red) as %?',     answer: '30',    rewardEnergy: ENERGY_REWARD_MEDIUM },
  { domain: MathDomain.Logic,        question: 'If all A are B, and X is A, is X a B? (yes/no)',     answer: 'yes',   rewardEnergy: ENERGY_REWARD_EASY   },
  { domain: MathDomain.Logic,        question: 'NOT (TRUE AND FALSE) = ?  (true/false)',             answer: 'true',  rewardEnergy: ENERGY_REWARD_EASY   },
];

// ============================================================
// Normalize answer: trim whitespace, lowercase, remove commas
// ============================================================
function normalize(s: string): string {
  return s.toLowerCase().replace(/,/g, '').trim();
}

// ============================================================
// MathGenerator — server-authoritative
// ============================================================
export class MathGenerator {
  /**
   * Generate a challenge. Server picks randomly.
   * @param currentTurn Current game turn (used to compute expiry).
   */
  public static generateChallenge(currentTurn: number): ChallengeState {
    const problem = PROBLEM_POOL[Math.floor(Math.random() * PROBLEM_POOL.length)];
    return {
      id: crypto.randomUUID(),
      domain: problem.domain,
      question: problem.question,
      correctAnswer: problem.answer,
      rewardEnergy: problem.rewardEnergy,
      expiresAtTurn: currentTurn + CHALLENGE_EXPIRE_TURNS,
    };
  }

  /**
   * Verify player's submitted answer against the challenge.
   * Returns true if correct.
   */
  public static verifyAnswer(challenge: ChallengeState, submitted: string): boolean {
    return normalize(challenge.correctAnswer) === normalize(submitted);
  }
}
