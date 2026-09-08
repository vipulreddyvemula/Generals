import { MathDomain, ChallengeState } from '../types';
import crypto from 'crypto';

export class MathGenerator {
  public static generate(domain?: MathDomain): Omit<ChallengeState, 'id' | 'expiresAtTurn'> {
    const selectedDomain = domain || this.getRandomDomain();
    
    let question = '';
    let correctAnswer = '';
    let rewardEnergy = 10;

    switch (selectedDomain) {
      case MathDomain.Arithmetic:
        const { q: aq, a: aa } = this.generateArithmetic();
        question = aq; correctAnswer = aa; rewardEnergy = 10;
        break;
      case MathDomain.Algebra:
        const { q: alq, a: ala } = this.generateAlgebra();
        question = alq; correctAnswer = ala; rewardEnergy = 20;
        break;
      case MathDomain.Sequence:
        const { q: sq, a: sa } = this.generateSequence();
        question = sq; correctAnswer = sa; rewardEnergy = 15;
        break;
      case MathDomain.Geometry:
        const { q: gq, a: ga } = this.generateGeometry();
        question = gq; correctAnswer = ga; rewardEnergy = 15;
        break;
      case MathDomain.Probability:
        const { q: pq, a: pa } = this.generateProbability();
        question = pq; correctAnswer = pa; rewardEnergy = 20;
        break;
      case MathDomain.Logic:
        const { q: lq, a: la } = this.generateLogic();
        question = lq; correctAnswer = la; rewardEnergy = 10;
        break;
    }

    return {
      domain: selectedDomain,
      question,
      correctAnswer: correctAnswer.toLowerCase().trim(),
      rewardEnergy
    };
  }

  public static generateWithIdAndExpiry(turn: number, domain?: MathDomain): ChallengeState {
    const base = this.generate(domain);
    return {
      ...base,
      id: crypto.randomUUID(),
      expiresAtTurn: turn + 10 // e.g. expires in 10 seconds if tick is 1s
    };
  }

  private static getRandomDomain(): MathDomain {
    const domains = Object.values(MathDomain);
    return domains[Math.floor(Math.random() * domains.length)] as MathDomain;
  }

  private static generateArithmetic() {
    const a = Math.floor(Math.random() * 50) + 1;
    const b = Math.floor(Math.random() * 50) + 1;
    const ops = ['+', '-', '*'];
    const op = ops[Math.floor(Math.random() * ops.length)];
    let ans = 0;
    if (op === '+') ans = a + b;
    if (op === '-') ans = a - b;
    if (op === '*') ans = a * (Math.floor(Math.random() * 10) + 1); // Keep multiplication smaller
    
    if (op === '*') {
      const b_small = Math.floor(Math.random() * 10) + 1;
      return { q: `${a} * ${b_small} = ?`, a: (a * b_small).toString() };
    }
    return { q: `${a} ${op} ${b} = ?`, a: ans.toString() };
  }

  private static generateAlgebra() {
    // ax + b = c  => x = (c-b)/a
    const a = Math.floor(Math.random() * 9) + 2; // 2 to 10
    const x = Math.floor(Math.random() * 20) + 1; // 1 to 20
    const b = Math.floor(Math.random() * 20) + 1;
    const c = a * x + b;
    return { q: `Solve for x: ${a}x + ${b} = ${c}`, a: x.toString() };
  }

  private static generateSequence() {
    // Arithmetic or geometric progression
    const isArithmetic = Math.random() > 0.5;
    const start = Math.floor(Math.random() * 10) + 1;
    
    if (isArithmetic) {
      const diff = Math.floor(Math.random() * 10) + 1;
      return {
        q: `Next in sequence: ${start}, ${start+diff}, ${start+2*diff}, ${start+3*diff}, ?`,
        a: (start + 4*diff).toString()
      };
    } else {
      const ratio = Math.floor(Math.random() * 3) + 2; // 2 to 4
      return {
        q: `Next in sequence: ${start}, ${start*ratio}, ${start*ratio*ratio}, ?`,
        a: (start*ratio*ratio*ratio).toString()
      };
    }
  }

  private static generateGeometry() {
    const isArea = Math.random() > 0.5;
    const w = Math.floor(Math.random() * 10) + 2;
    const h = Math.floor(Math.random() * 10) + 2;
    if (isArea) {
      return { q: `Area of a rectangle with width ${w} and height ${h}?`, a: (w*h).toString() };
    } else {
      return { q: `Perimeter of a rectangle with width ${w} and height ${h}?`, a: (2*w + 2*h).toString() };
    }
  }

  private static generateProbability() {
    return {
      q: `Probability of flipping a coin and getting Heads? (Format as fraction, e.g. 1/2)`,
      a: '1/2'
    };
  }

  private static generateLogic() {
    const a = Math.random() > 0.5;
    const b = Math.random() > 0.5;
    const isAnd = Math.random() > 0.5;
    const ans = isAnd ? (a && b) : (a || b);
    return {
      q: `If A is ${a} and B is ${b}, what is A ${isAnd ? 'AND' : 'OR'} B?`,
      a: ans.toString()
    };
  }
}
