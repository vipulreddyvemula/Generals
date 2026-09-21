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
  { domain: MathDomain.Arithmetic, question: "Simplify: $\\frac{789\\times789\\times789+211\\times211\\times211}{789\\times789-789\\times211+211\\times211}$.", answer: "1000", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "Find the smallest number to be added to $1500$ so that $37$ divides the sum exactly.", answer: "17", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "What least number must be subtracted from $2500$ to get a number exactly divisible by $19$?", answer: "11", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "The number $62684ab$ is divisible by both $8$ and $5$. How many possible pairs of digits can replace $a$ and $b$?", answer: "3", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "The number $52563744$ is divisible by $24$. How many of the two divisibility conditions, divisibility by $3$ and divisibility by $8$, does it satisfy?", answer: "2", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "$x$ is a positive integer such that $x^2+12$ is exactly divisible by $x$. How many possible values of $x$ are there?", answer: "6", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "Find the smallest number that must be added to $1000$ so that the resulting number is exactly divisible by $45$.", answer: "35", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "Find the least number that must be subtracted from $2000$ so that the resulting number is exactly divisible by $17$.", answer: "11", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "If $5p9+3r7+2q8=1114$, where $p,q,r$ are digits, what is the maximum possible value of $q$?", answer: "9", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "Evaluate $986\\times137+986\\times863$.", answer: "986000", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "Find the total number of prime factors, counting multiplicity, in $4^{11}\\times7^5\\times11^2$.", answer: "29", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "On dividing $15968$ by a certain number, the quotient is $89$ and the remainder is $37$. Find the divisor.", answer: "179", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "A number when divided by $114$ leaves remainder $21$. If the same number is divided by $19$, what is the remainder?", answer: "2", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "What is the number of zeros at the end of the product of the numbers from $1$ to $100$?", answer: "24", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "A number when divided by $6$ leaves remainder $3$. What remainder is obtained when the square of the same number is divided by $6$?", answer: "3", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "Find the sum of the greatest and smallest five-digit numbers.", answer: "109999", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "If the largest three-digit number is subtracted from the smallest five-digit number, what is the remainder?", answer: "9001", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "If $n$ is a positive integer, how many values of $n$ make $\\frac{16n^2+7n+6}{n}$ an integer?", answer: "4", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "If $13=\\frac{13w}{1-w}$, find $2(2w)^2$.", answer: "2", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "How many integers between $110$ and $120$ are prime numbers?", answer: "1", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "Four prime numbers are arranged in ascending order. The product of the first three is $385$ and the product of the last three is $1001$. How many prime numbers are there in total?", answer: "4", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "Evaluate $80^2-65^2+81$.", answer: "2256", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "Evaluate $\\frac{(489+375)^2-(489-375)^2}{489\\times375}$.", answer: "4", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "Evaluate $\\frac{(963+476)^2+(963-476)^2}{963^2+476^2}$.", answer: "2", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "Evaluate $\\frac{768\\times768\\times768+232\\times232\\times232}{768\\times768-768\\times232+232\\times232}$.", answer: "1000", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "Evaluate $\\frac{854\\times854\\times854-276\\times276\\times276}{854\\times854+854\\times276+276\\times276}$.", answer: "578", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "If $m$ and $n$ are positive integers, what is the units digit of $5^n+6^m$?", answer: "1", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "If $78a3945$ is divisible by $11$, where $a$ is a digit, find $a$.", answer: "5", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "The difference between the squares of two consecutive odd integers is always divisible by $8$. What is the greatest positive integer that always divides this difference?", answer: "8", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "If $352$ is divided by $19$, what is the remainder?", answer: "10", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "A number when divided by $136$ leaves remainder $36$. If the same number is divided by $17$, what is the remainder?", answer: "2", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "Find the least number greater than $5000$ that is exactly divisible by $73$.", answer: "5037", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "Find the smallest number that must be subtracted from $8112$ to make it exactly divisible by $99$.", answer: "93", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "Two numbers are in the ratio $4:5$. Their L.C.M. is $180$. Find the sum of the two numbers.", answer: "81", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "The H.C.F. of two numbers is $13$ and their L.C.M. is $780$. If one of the numbers is $52$, find the other number.", answer: "195", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "The sum of two numbers is $210$ and their highest common factor is $14$. What is the total number of pairs of positive integers that satisfy these conditions?", answer: "4", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "The H.C.F. of $8\\times25\\times49$, $4\\times27\\times35$ and $16\\times81\\times5$ is?", answer: "20", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "Find the highest common factor of $54$ and $90$.", answer: "18", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "The H.C.F. of fractions is obtained by taking the H.C.F. of the numerators and the L.C.M. of the denominators. Using this rule, find the H.C.F. of $\\frac{8}{15}, \\frac{12}{25}, \\frac{20}{35}, \\frac{28}{45}$. If the H.C.F. in lowest terms is $\\frac{p}{q}$, find $p+q$.", answer: "1579", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "The L.C.M. of fractions is obtained by taking the L.C.M. of the numerators and the H.C.F. of the denominators. Using this rule, find the L.C.M. of $\\frac{3}{4}, \\frac{5}{8}, \\frac{7}{12}, \\frac{15}{16}$. If the L.C.M. in lowest terms is $\\frac{p}{q}$, find $p+q$.", answer: "109", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "The product of two numbers is $2160$ and their H.C.F. is $12$. What is the number of such pairs?", answer: "2", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "Three numbers are in the ratio $2:3:5$ and their L.C.M. is $1800$. What is their H.C.F.?", answer: "60", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "The L.C.M. and ratio of four numbers are $840$ and $2:3:5:7$ respectively. What is the difference between the greatest and least numbers?", answer: "20", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "The H.C.F. and L.C.M. of two numbers are $24$ and $504$ respectively. If the ratio of the two numbers is $3:7$, then what is the larger of the two numbers?", answer: "168", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "The L.C.M. of two prime numbers $x$ and $y$, where $x>y$, is $119$. What is the value of $3y-x$?", answer: "4", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "The ratio of two numbers is $13:15$ and their L.C.M. is $390$. What is the sum of the two numbers?", answer: "56", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "If $x+y=15$ and $xy=54$, then what is the value of $x^2+y^2$?", answer: "117", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "The sum of four consecutive even numbers $A$, $B$, $C$ and $D$ is $140$. What is the sum of the next four consecutive even numbers?", answer: "172", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "For an integer $n$, $n!=n(n-1)(n-2)\\cdots3\\cdot2\\cdot1$. What remainder does $1!+2!+3!+\\cdots+80!$ leave when divided by $4$?", answer: "1", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "Convert $2.375$ into a fraction in its simplest form. If the fraction is $\\frac{p}{q}$, find $p+q$.", answer: "27", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "Convert $0.084$ into a fraction in its simplest form. If the fraction is $\\frac{p}{q}$, find $p+q$.", answer: "271", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "Given that $156\\times42=6552$, find the value of $1.56\\times0.42$.", answer: "0.6552", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "If $\\frac{b}{a}=\\frac{2}{3}$, then what is the value of $\\frac{2a-b}{2a+b}+\\frac{2}{9}$? If the answer is expressed as $\\frac{p}{q}$ in its lowest form, find $p+q$.", answer: "31", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "Solve $3\\frac{1}{4}+2\\frac{2}{3}-1\\frac{1}{4}$. Express the answer in the form $\\frac{p}{q}$ in its simplest form. Find $p+q$.", answer: "17", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "Evaluate $18.35+7.645-2.135+0.095$.", answer: "23.955", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "Evaluate $505.05+50.5-5.05+0.5-0.05$.", answer: "550.95", difficulty: 'MEDIUM' },
  { domain: MathDomain.Arithmetic, question: "Evaluate $7+7.77-0.7+77.07-7$.", answer: "84.14", difficulty: 'MEDIUM' }
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
