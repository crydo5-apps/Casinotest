export const WHEEL = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 20, 14, 31, 9, 22, 18, 29, 7, 28,
  12, 35, 3, 26,
] as const;

export const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export const CHIP_VALUES = [1, 5, 10, 25, 100] as const;

export type OutsideBet =
  | { type: "red" }
  | { type: "black" }
  | { type: "even" }
  | { type: "odd" }
  | { type: "low" }
  | { type: "high" }
  | { type: "dozen"; d: 1 | 2 | 3 }
  | { type: "column"; c: 1 | 2 | 3 };

export type Bet = { type: "straight"; n: number } | OutsideBet;

export type Placed = { key: string; bet: Bet; amount: number };

export function colorOf(n: number): "green" | "red" | "black" {
  if (n === 0) return "green";
  return RED.has(n) ? "red" : "black";
}

export function betKey(bet: Bet): string {
  if (bet.type === "straight") return `n-${bet.n}`;
  if (bet.type === "dozen") return `d-${bet.d}`;
  if (bet.type === "column") return `c-${bet.c}`;
  return bet.type;
}

export function payoutMult(bet: Bet): number {
  if (bet.type === "straight") return 35;
  if (bet.type === "dozen" || bet.type === "column") return 2;
  return 1;
}

export function hits(bet: Bet, n: number): boolean {
  if (n < 0 || n > 36) return false;
  switch (bet.type) {
    case "straight":
      return bet.n === n;
    case "red":
      return colorOf(n) === "red";
    case "black":
      return colorOf(n) === "black";
    case "even":
      return n !== 0 && n % 2 === 0;
    case "odd":
      return n % 2 === 1;
    case "low":
      return n >= 1 && n <= 18;
    case "high":
      return n >= 19 && n <= 36;
    case "dozen":
      return n >= (bet.d - 1) * 12 + 1 && n <= bet.d * 12;
    case "column":
      return n !== 0 && n % 3 === (bet.c === 3 ? 0 : bet.c);
    default:
      return false;
  }
}

export function settle(bets: Placed[], n: number): { payout: number; stake: number; won: number } {
  let stake = 0;
  let payout = 0;
  for (const b of bets) {
    stake += b.amount;
    if (hits(b.bet, n)) payout += b.amount + b.amount * payoutMult(b.bet);
  }
  return { payout, stake, won: payout - stake };
}

export function spinNumber(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % 37;
}

export function wheelIndex(n: number): number {
  return WHEEL.indexOf(n as (typeof WHEEL)[number]);
}

export function wheelAngle(n: number): number {
  const i = wheelIndex(n);
  const seg = 360 / WHEEL.length;
  return i * seg;
}
