import type {
  GatesSymbolId,
  GatesSpinResult,
  ScatterPay,
  OrbInfo,
  TumbleStep,
  RegularSymbol,
} from "./types";

export const COLS = 6;
export const ROWS = 5;

export const BET_STEPS = [0.2, 0.4, 0.6, 0.8, 1, 1.5, 2, 3, 5, 8, 10, 15, 20, 25, 50, 100] as const;
export type BetStep = (typeof BET_STEPS)[number];

export const BUY_FS_MULT = 100;
export const ANTE_BET_MULT = 0.25;
export const MAX_WIN_MULT = 15000;
export const FREE_SPINS_INITIAL = 15;
export const FREE_SPINS_RETRIGGER = 5;
export const FREE_SPINS_RETRIGGER_MIN = 3;

export const ORB_VALUES = [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 50, 100, 250, 500, 1000] as const;

export const SCATTER_PAY_TABLE: Record<number, number> = {
  4: 3,
  5: 5,
  6: 100,
};

export const PAY_TABLE: Record<RegularSymbol, Record<string, number>> = {
  blueGem:   { "8": 0.25, "10": 0.75, "12": 2 },
  greenGem:  { "8": 0.40, "10": 0.90, "12": 4 },
  yellowGem: { "8": 0.50, "10": 1,    "12": 5 },
  purpleGem: { "8": 0.80, "10": 1.20, "12": 8 },
  redGem:    { "8": 1,    "10": 1.50, "12": 10 },
  chalice:   { "8": 1.50, "10": 2,    "12": 12 },
  ring:      { "8": 2,    "10": 5,    "12": 15 },
  hourglass: { "8": 2.50, "10": 10,   "12": 25 },
  crown:     { "8": 10,   "10": 25,   "12": 50 },
};

const REGULAR_SYMBOLS: RegularSymbol[] = [
  "blueGem", "greenGem", "yellowGem", "purpleGem", "redGem",
  "chalice", "ring", "hourglass", "crown",
];

const SYMBOL_WEIGHTS: Record<GatesSymbolId, number> = {
  blueGem: 9.0,
  greenGem: 8.0,
  yellowGem: 7.5,
  purpleGem: 7.0,
  redGem: 6.5,
  chalice: 4.5,
  ring: 4.0,
  hourglass: 3.5,
  crown: 2.5,
  orb: 2.2,
  scatter: 0.9,
};

const TOTAL_WEIGHT = Object.values(SYMBOL_WEIGHTS).reduce((a, b) => a + b, 0);

function weightedRandom(anteBet: boolean): GatesSymbolId {
  let r = Math.random() * TOTAL_WEIGHT;
  if (anteBet) {
    r = Math.random() * (TOTAL_WEIGHT + SYMBOL_WEIGHTS.scatter * 0.8);
  }
  let acc = 0;
  for (const [sym, w] of Object.entries(SYMBOL_WEIGHTS)) {
    let adjusted = w;
    if (sym === "scatter" && anteBet) adjusted = w * 1.8;
    acc += adjusted;
    if (r < acc) return sym as GatesSymbolId;
  }
  return "blueGem";
}

function pickOrbValue(): number {
  const weights = [8, 7, 6, 5, 5, 4, 4, 3, 3, 2, 2, 1.5, 1, 0.5, 0.3, 0.15];
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < ORB_VALUES.length; i++) {
    r -= weights[i];
    if (r < 0) return ORB_VALUES[i];
  }
  return ORB_VALUES[0];
}

function makeGrid(anteBet: boolean): GatesSymbolId[][] {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => weightedRandom(anteBet)),
  );
}

function countSymbols(grid: GatesSymbolId[][]): Map<GatesSymbolId, { count: number; positions: { row: number; col: number }[] }> {
  const map = new Map<GatesSymbolId, { count: number; positions: { row: number; col: number }[] }>();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const sym = grid[r][c];
      if (sym === "orb" || sym === "scatter") continue;
      const entry = map.get(sym) ?? { count: 0, positions: [] };
      entry.count += 1;
      entry.positions.push({ row: r, col: c });
      map.set(sym, entry);
    }
  }
  return map;
}

function getOrbs(grid: GatesSymbolId[][]): OrbInfo[] {
  const orbs: OrbInfo[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] === "orb") {
        orbs.push({ row: r, col: c, value: pickOrbValue() });
      }
    }
  }
  return orbs;
}

function removeWinningSymbols(grid: GatesSymbolId[][], winSymbols: GatesSymbolId[]): { newGrid: GatesSymbolId[][]; removed: { row: number; col: number }[] } {
  const removed: { row: number; col: number }[] = [];
  const newGrid = grid.map((row) => [...row]);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (winSymbols.includes(newGrid[r][c])) {
        newGrid[r][c] = null as unknown as GatesSymbolId;
        removed.push({ row: r, col: c });
      }
    }
  }

  return { newGrid, removed };
}

function gravityAndRefill(grid: GatesSymbolId[][], anteBet: boolean): GatesSymbolId[][] {
  const newGrid: GatesSymbolId[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(null));

  for (let c = 0; c < COLS; c++) {
    const surviving: GatesSymbolId[] = [];
    for (let r = ROWS - 1; r >= 0; r--) {
      if (grid[r][c] !== null) {
        surviving.push(grid[r][c]);
      }
    }
    surviving.reverse();

    const emptySlots = ROWS - surviving.length;
    const newSymbols: GatesSymbolId[] = [];
    for (let i = 0; i < emptySlots; i++) {
      newSymbols.push(weightedRandom(anteBet));
    }

    const column = [...newSymbols, ...surviving];
    for (let r = 0; r < ROWS; r++) {
      newGrid[r][c] = column[r] ?? weightedRandom(anteBet);
    }
  }

  return newGrid;
}

function evaluateScatterPay(grid: GatesSymbolId[][]): ScatterPay[] {
  const counts = countSymbols(grid);
  const wins: ScatterPay[] = [];

  for (const [sym, { count }] of counts) {
    let bucket: string | null = null;
    if (count >= 12) bucket = "12";
    else if (count >= 10) bucket = "10";
    else if (count >= 8) bucket = "8";

    if (bucket) {
      const payTable = PAY_TABLE[sym as RegularSymbol];
      if (payTable) {
        const mult = payTable[bucket];
        if (mult) {
          wins.push({ symbol: sym, count, amount: mult });
        }
      }
    }
  }

  return wins;
}

function evaluateScatterCount(grid: GatesSymbolId[][]): number {
  let count = 0;
  for (const row of grid) {
    for (const sym of row) {
      if (sym === "scatter") count += 1;
    }
  }
  return count;
}

function resolveTumbleSequence(
  initialGrid: GatesSymbolId[][],
  bet: number,
  anteBet: boolean,
  inFreeSpins: boolean,
  globalMult: number,
): { steps: TumbleStep[]; totalWin: number; orbSum: number; newGlobalMult: number } {
  let grid = initialGrid.map((r) => [...r]);
  const steps: TumbleStep[] = [];
  let totalWin = 0;
  let orbSum = 0;
  let newGlobalMult = globalMult;

  for (let step = 0; step < 100; step++) {
    const wins = evaluateScatterPay(grid);
    const orbs = getOrbs(grid);

    if (wins.length === 0) {
      if (step > 0) {
        break;
      }
      const orbTotal = orbs.reduce((s, o) => s + o.value, 0);
      steps.push({ grid: grid.map((r) => [...r]), wins: [], orbs, removedPositions: [] });
      return { steps, totalWin: 0, orbSum: orbTotal, newGlobalMult };
    }

    const stepWin = wins.reduce((s, w) => s + w.amount * bet, 0);
    const winSymbols = [...new Set(wins.map((w) => w.symbol))];
    const { newGrid, removed } = removeWinningSymbols(grid, winSymbols);
    const filledGrid = gravityAndRefill(newGrid, anteBet);

    const orbTotal = orbs.reduce((s, o) => s + o.value, 0);
    orbSum += orbTotal;

    if (inFreeSpins && orbTotal > 0) {
      newGlobalMult += orbTotal;
    }

    const sequenceWin = stepWin * (orbTotal > 0 ? orbTotal : 1) * (inFreeSpins && newGlobalMult > 0 ? newGlobalMult : 1);
    totalWin += sequenceWin;

    steps.push({ grid: filledGrid.map((r) => [...r]), wins, orbs, removedPositions: removed });
    grid = filledGrid;
  }

  return { steps, totalWin, orbSum, newGlobalMult };
}

export function spinReels(anteBet: boolean): GatesSpinResult {
  const grid = makeGrid(anteBet);
  const scatterCount = evaluateScatterCount(grid);

  let scatterWin = 0;
  if (scatterCount >= 4) {
    const mult = SCATTER_PAY_TABLE[Math.min(scatterCount, 6)] ?? 0;
    scatterWin = mult;
  }

  const { steps, totalWin, orbSum, newGlobalMult } = resolveTumbleSequence(grid, 1, anteBet, false, 0);

  const bonusTrigger = scatterCount >= 4;

  return {
    grid,
    scatterCount,
    scatterWin,
    tumbleSteps: steps,
    totalWin: totalWin + scatterWin,
    orbMultiplierSum: orbSum,
    bonusTrigger,
    retrigger: false,
  };
}

export function spinFreeSpins(
  _globalMult: number,
  _remaining: number,
): {
  grid: GatesSymbolId[][];
  steps: TumbleStep[];
  totalWin: number;
  orbSum: number;
  newGlobalMult: number;
  scatterCount: number;
  retrigger: boolean;
} {
  const grid = makeGrid(false);
  const scatterCount = evaluateScatterCount(grid);
  const retrigger = scatterCount >= FREE_SPINS_RETRIGGER_MIN;

  const { steps, totalWin, orbSum, newGlobalMult } = resolveTumbleSequence(grid, 1, false, true, _globalMult);

  return { grid, steps, totalWin, orbSum, newGlobalMult, scatterCount, retrigger };
}

export function getWinTier(totalWin: number, bet: number): "big" | "mega" | "huge" | "epic" | null {
  if (totalWin <= 0) return null;
  const x = totalWin / Math.max(0.01, bet);
  if (x >= 100) return "epic";
  if (x >= 50) return "huge";
  if (x >= 15) return "mega";
  if (x >= 5) return "big";
  return null;
}

export function formatBet(n: number): string {
  return n.toFixed(2);
}

export function formatWin(n: number): string {
  if (n >= 1000) return n.toFixed(0);
  if (n >= 100) return n.toFixed(1);
  return n.toFixed(2);
}
