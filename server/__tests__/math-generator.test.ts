import { MathGenerator } from '../src/lib/commander/math-generator';
import { MathDomain } from '../src/lib/types';

describe('MathGenerator', () => {
  it('should generate a deterministic arithmetic challenge', () => {
    const challenge = MathGenerator.generate(MathDomain.Arithmetic);
    expect(challenge.domain).toBe(MathDomain.Arithmetic);
    expect(challenge.question).toContain('?');
    expect(typeof challenge.correctAnswer).toBe('string');
  });

  it('should generate an algebra challenge', () => {
    const challenge = MathGenerator.generate(MathDomain.Algebra);
    expect(challenge.domain).toBe(MathDomain.Algebra);
    expect(challenge.question).toContain('Solve for x:');
  });

  it('should generate valid challenges for all domains without crashing', () => {
    const domains = Object.values(MathDomain);
    for (const domain of domains) {
      const challenge = MathGenerator.generate(domain);
      expect(challenge.question.length).toBeGreaterThan(0);
      expect(challenge.correctAnswer.length).toBeGreaterThan(0);
      expect(challenge.rewardEnergy).toBeGreaterThan(0);
    }
  });

  it('should generate with ID and Expiry', () => {
    const challenge = MathGenerator.generateWithIdAndExpiry(100, MathDomain.Arithmetic);
    expect(challenge.id).toBeDefined();
    expect(challenge.expiresAtTurn).toBeGreaterThan(100);
  });
});
