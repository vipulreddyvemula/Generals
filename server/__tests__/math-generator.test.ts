import { MathGenerator, ENERGY_REWARD_EASY } from '../src/lib/commander/math-generator';
import { MathDomain } from '../src/lib/types';

describe('MathGenerator — hardcoded pool', () => {
  it('generates a challenge with all required fields', () => {
    const challenge = MathGenerator.generateChallenge(100);
    expect(challenge.id).toBeDefined();
    expect(challenge.domain).toBeDefined();
    expect(challenge.question.length).toBeGreaterThan(0);
    expect(challenge.correctAnswer.length).toBeGreaterThan(0);
    expect(challenge.rewardEnergy).toBeGreaterThan(0);
    expect(challenge.expiresAtTurn).toBeGreaterThan(100);
  });

  it('generates different challenges across multiple calls (randomness test)', () => {
    const domains = new Set<MathDomain>();
    for (let i = 0; i < 50; i++) {
      const c = MathGenerator.generateChallenge(0);
      domains.add(c.domain);
    }
    // After 50 calls we should see at least 2 different domains
    expect(domains.size).toBeGreaterThan(1);
  });

  it('verifyAnswer: accepts correct answer (case-insensitive, whitespace-tolerant)', () => {
    const challenge = MathGenerator.generateChallenge(0);
    const answer = challenge.correctAnswer;
    expect(MathGenerator.verifyAnswer(challenge, answer)).toBe(true);
    expect(MathGenerator.verifyAnswer(challenge, answer.toUpperCase())).toBe(true);
    expect(MathGenerator.verifyAnswer(challenge, '  ' + answer + '  ')).toBe(true);
  });

  it('verifyAnswer: rejects wrong answer', () => {
    const challenge = MathGenerator.generateChallenge(0);
    expect(MathGenerator.verifyAnswer(challenge, 'definitely-wrong-9999')).toBe(false);
  });

  it('ENERGY_REWARD_EASY is a positive number', () => {
    expect(ENERGY_REWARD_EASY).toBeGreaterThan(0);
  });
});
