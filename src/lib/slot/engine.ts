import type { ExpandLayer, Grid, PayCount, PaylineWin, PictureId, SpinResult, SymbolId } from "./types";

export type { SymbolId, Grid, PaylineWin, SpinResult, PayCount, PictureId, ExpandLayer } from "./types";

export const REELS = 6;
export const ROWS = 4;
export const LINE_COUNT = 25;

export const LINE_STEPS = [1, 5, 10, 15, 20, 25] as const;
export type LineStep = (typeof LINE_STEPS)[number];

/**
 * 25 paylines on a 6×4 grid. Each entry is the row (0 = top) per reel.
 */
export const PAYLINES: number[][] = [
  [1, 1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2, 2],
  [3, 3, 3, 3, 3, 3],
  [0, 1, 2, 3, 2, 1],
  [3, 2, 1, 0, 1, 2],
  [1, 0, 0, 0, 0, 1],
  [2, 3, 3, 3, 3, 2],
  [0, 0, 1, 2, 3, 3],
  [3, 3, 2, 1, 0, 0],
  [1, 2, 3, 3, 2, 1],
  [2, 1, 0, 0, 1, 2],
  [0, 1, 0, 1, 0, 1],
  [3, 2, 3, 2, 3, 2],
  [1, 1, 2, 2, 1, 1],
  [2, 2, 1, 1, 2, 2],
  [0, 1, 1, 1, 1, 0],
  [3, 2, 2, 2, 2, 3],
  [1, 0, 1, 2, 3, 2],
  [2, 3, 2, 1, 0, 1],
  [0, 0, 0, 1, 2, 3],
  [3, 3, 3, 2, 1, 0],
  [1, 2, 1, 2, 1, 2],
  [2, 1, 2, 1, 2, 1],
  [0, 1, 2, 2, 1, 0],
];

/** Multipliers of bet-per-line. */
export const LINE_PAYS: Record<SymbolId, Partial<Record<PayCount, number>>> = {
  explorer: { 2: 10, 3: 100, 4: 500, 5: 2500, 6: 10000 },
  priestess: { 2: 8, 3: 80, 4: 400, 5: 2000, 6: 8000 },
  ankh: { 2: 5, 3: 40, 4: 200, 5: 1000, 6: 4000 },
  anubis: { 3: 30, 4: 150, 5: 750, 6: 2500 },
  statue: { 3: 25, 4: 100, 5: 500, 6: 1500 },
  scarab: { 3: 25, 4: 100, 5: 500, 6: 1500 },
  ace: { 3: 8, 4: 40, 5: 150, 6: 500 },
  king: { 3: 8, 4: 40, 5: 150, 6: 500 },
  queen: { 3: 5, 4: 25, 5: 100, 6: 300 },
  jack: { 3: 5, 4: 25, 5: 100, 6: 300 },
  ten: { 3: 5, 4: 25, 5: 100, 6: 300 },
  book: {},
};

/** Scatter pays × total bet. */
export const SCATTER_PAYS: Partial<Record<PayCount, number>> = {
  2: 2,
  3: 20,
  4: 100,
  5: 500,
  6: 2500,
};

export const EXPANDABLE: SymbolId[] = [
  "explorer",
  "priestess",
  "ankh",
  "anubis",
  "statue",
  "scarab",
  "ace",
  "king",
  "queen",
  "jack",
  "ten",
];

export const BET_STEPS = [1, 2, 5, 10, 20, 50] as const;

/** Direct buy: 10 free spins for 100× total bet. */
export const BUY_FS_MULT = 100;
/** Direct buy: one spin with a chosen expanding symbol for 10× total bet. */
export const BUY_EXPAND_MULT = 10;
/** Bought expand only triggers when the symbol lands on this many reels. */
export const BUY_EXPAND_MIN_REELS = 2;

export const PICTURE_SYMBOLS: PictureId[] = [
  "book",
  "explorer",
  "priestess",
  "ankh",
  "anubis",
  "statue",
  "scarab",
];
export const ROYAL_SYMBOLS: SymbolId[] = ["ace", "king", "queen", "jack", "ten"];

export const ROYAL_GLYPH: Record<
  "ace" | "king" | "queen" | "jack" | "ten",
  { letter: string; fill: string }
> = {
  ace: { letter: "A", fill: "#c45a3a" },
  king: { letter: "K", fill: "#3a6ec4" },
  queen: { letter: "Q", fill: "#2e8a55" },
  jack: { letter: "J", fill: "#7a4ab8" },
  ten: { letter: "10", fill: "#2a8a8a" },
};

/**
 * 40-stop strips, 1 book each. 4 visible rows → ~10% of reels show a book.
 */
export const STRIPS: SymbolId[][] = [
  [
    "ten", "jack", "queen", "king", "explorer", "ace", "scarab", "ten",
    "jack", "priestess", "book", "statue", "king", "ace", "ankh", "anubis",
    "ten", "jack", "scarab", "queen", "king", "ace", "statue", "explorer",
    "jack", "queen", "scarab", "priestess", "ace", "ankh", "ten", "statue",
    "anubis", "queen", "king", "ten", "jack", "scarab", "ace", "statue",
  ],
  [
    "jack", "ten", "ace", "king", "statue", "queen", "ten", "ankh",
    "jack", "ace", "book", "scarab", "king", "ten", "explorer", "queen",
    "anubis", "ace", "statue", "ten", "king", "scarab", "queen", "ankh",
    "ten", "jack", "ace", "explorer", "king", "statue", "queen", "priestess",
    "jack", "anubis", "queen", "scarab", "ten", "priestess", "king", "scarab",
  ],
  [
    "queen", "king", "ten", "jack", "scarab", "ace", "statue", "queen",
    "explorer", "ten", "book", "king", "jack", "ankh", "ace", "ten",
    "statue", "queen", "anubis", "scarab", "jack", "ten", "ace", "explorer",
    "queen", "king", "statue", "ten", "jack", "ankh", "ace", "scarab",
    "priestess", "queen", "anubis", "king", "priestess", "ten", "jack", "statue",
  ],
  [
    "ace", "ten", "jack", "statue", "king", "queen", "scarab", "ten",
    "ankh", "ace", "jack", "book", "queen", "king", "explorer", "ten",
    "statue", "ace", "jack", "scarab", "queen", "ten", "king", "ankh",
    "anubis", "statue", "jack", "ten", "explorer", "queen", "king", "scarab",
    "priestess", "ace", "anubis", "queen", "priestess", "jack", "statue", "scarab",
  ],
  [
    "king", "queen", "ace", "ten", "jack", "explorer", "statue", "king",
    "scarab", "queen", "ten", "book", "ace", "jack", "ankh", "king",
    "statue", "ten", "queen", "scarab", "ace", "jack", "explorer", "king",
    "ten", "statue", "queen", "ankh", "ace", "jack", "anubis", "ten",
    "priestess", "scarab", "anubis", "queen", "priestess", "statue", "jack", "scarab",
  ],
  [
    "scarab", "ace", "queen", "ten", "king", "anubis", "jack", "statue",
    "queen", "ankh", "ten", "book", "jack", "ace", "explorer", "king",
    "scarab", "queen", "statue", "ten", "priestess", "jack", "ace", "ankh",
    "king", "ten", "anubis", "queen", "statue", "jack", "explorer", "ace",
    "scarab", "priestess", "king", "ten", "statue", "queen", "jack", "scarab",
  ],
];

function randInt(n: number): number {
  return Math.floor(Math.random() * n);
}

export function isPayCount(n: number): n is PayCount {
  return n === 2 || n === 3 || n === 4 || n === 5 || n === 6;
}

export function minCountFor(symbol: SymbolId): number {
  return LINE_PAYS[symbol][2] ? 2 : 3;
}

export function visibleFromStop(reel: number, stop: number): SymbolId[] {
  const strip = STRIPS[reel];
  const len = strip.length;
  return Array.from({ length: ROWS }, (_, row) => strip[(stop + row) % len]);
}

export function gridFromStops(stops: number[]): Grid {
  const padded = Array.from({ length: REELS }, (_, reel) => stops[reel] ?? 0);
  return padded.map((stop, reel) => visibleFromStop(reel, stop));
}

export function spinStops(): number[] {
  return STRIPS.map((strip) => randInt(strip.length));
}

/** 3 books → 10 FS, 4 → 15, 5 → 25, 6 → 30. */
export function freeSpinsFromScatters(count: number): number {
  if (count >= 6) return 30;
  if (count >= 5) return 25;
  if (count >= 4) return 15;
  if (count >= 3) return 10;
  return 0;
}

function stopsShowingBook(reel: number): number[] {
  const strip = STRIPS[reel];
  const b = strip.indexOf("book");
  const len = strip.length;
  if (b < 0) return [];
  return [0, 1, 2, 3].map((k) => (b - k + len) % len);
}

function stopWithoutBook(reel: number): number {
  const blocked = new Set(stopsShowingBook(reel));
  const len = STRIPS[reel].length;
  for (let i = 0; i < 24; i++) {
    const s = randInt(len);
    if (!blocked.has(s)) return s;
  }
  return 0;
}

/** Weighted 3 / 4 / 5 / 6 books, never fewer than 3. */
export function spinStopsGuaranteedBooks(): number[] {
  const roll = Math.random();
  const n = roll < 0.7 ? 3 : roll < 0.92 ? 4 : roll < 0.99 ? 5 : 6;
  const order = Array.from({ length: REELS }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    const tmp = order[i];
    order[i] = order[j];
    order[j] = tmp;
  }
  const withBook = new Set(order.slice(0, n));
  return Array.from({ length: REELS }, (_, reel) => {
    if (!withBook.has(reel)) return stopWithoutBook(reel);
    const opts = stopsShowingBook(reel);
    return opts[randInt(opts.length)] ?? 0;
  });
}

export function pickExpandingSymbol(): SymbolId {
  return EXPANDABLE[randInt(EXPANDABLE.length)];
}

function countScatter(grid: Grid): number {
  let n = 0;
  for (const reel of grid) for (const s of reel) if (s === "book") n += 1;
  return n;
}

function evaluateLine(
  grid: Grid,
  lineIndex: number,
  betPerLine: number,
  wildOk: (symbol: SymbolId) => boolean,
): PaylineWin | null {
  const rows = PAYLINES[lineIndex];
  const first = grid[0][rows[0]];
  let symbol: SymbolId = first === "book" ? "book" : first;
  let count = 1;

  for (let reel = 1; reel < REELS; reel++) {
    const s = grid[reel][rows[reel]];
    if (symbol === "book") {
      if (s === "book") {
        count += 1;
        continue;
      }
      symbol = s;
      count += 1;
      continue;
    }
    if (s === symbol || (s === "book" && wildOk(symbol))) {
      count += 1;
      continue;
    }
    break;
  }

  if (symbol === "book") return null;
  const pay = isPayCount(count) ? LINE_PAYS[symbol][count] : undefined;
  if (!pay) return null;

  const positions = [];
  for (let reel = 0; reel < count; reel++) {
    positions.push({ reel, row: rows[reel] });
  }
  return {
    line: lineIndex,
    symbol,
    count,
    amount: pay * betPerLine,
    positions,
  };
}

export function expandGrid(
  grid: Grid,
  special: SymbolId,
  minReels = 2,
): { grid: Grid; reels: number[] } {
  const hits: number[] = [];
  for (let r = 0; r < REELS; r++) {
    if (grid[r].includes(special)) hits.push(r);
  }
  if (hits.length < minReels) return { grid, reels: [] };
  const next = grid.map((col) => col.slice()) as Grid;
  for (const r of hits) {
    next[r] = Array.from({ length: ROWS }, () => special);
  }
  return { grid: next, reels: hits };
}

export function evaluateSpin(
  stops: number[],
  betPerLine: number,
  lines: number,
  expandSymbols: SymbolId[] | SymbolId | null,
  minExpandReels = 2,
): SpinResult {
  const specials = normalizeSpecials(expandSymbols);
  const original = gridFromStops(stops);
  const expandLayers: ExpandLayer[] = [];
  let expandWin = 0;
  const specialSet = new Set(specials);

  for (const special of specials) {
    const expanded = expandGrid(original, special, minExpandReels);
    if (!expanded.reels.length) continue;
    expandLayers.push({ symbol: special, reels: expanded.reels });
    const n = expanded.reels.length;
    const pay = isPayCount(n) ? LINE_PAYS[special][n] : undefined;
    if (pay) expandWin += pay * betPerLine * lines;
  }

  const lineWins: PaylineWin[] = [];
  const active = Math.max(1, Math.min(LINE_COUNT, lines));
  for (let i = 0; i < active; i++) {
    const win = evaluateLine(original, i, betPerLine, (sym) => !specialSet.has(sym));
    if (!win) continue;
    if (specialSet.has(win.symbol)) continue;
    lineWins.push(win);
  }

  const scatterCount = countScatter(original);
  const scatterPay = isPayCount(scatterCount) ? (SCATTER_PAYS[scatterCount] ?? 0) : 0;
  const stake = betPerLine * active;
  const scatterWin = scatterPay * stake;
  const bonusTrigger = scatterCount >= 3;
  const expandReels = [...new Set(expandLayers.flatMap((l) => l.reels))];
  const expandSymbol = expandLayers[expandLayers.length - 1]?.symbol ?? specials[0] ?? null;

  const totalWin =
    lineWins.reduce((s, w) => s + w.amount, 0) + scatterWin + expandWin;

  return {
    grid: original,
    stops,
    lineWins,
    scatterCount,
    scatterWin,
    expandReels,
    expandSymbol,
    expandLayers,
    expandWin,
    totalWin,
    bonusTrigger,
  };
}

function normalizeSpecials(expandSymbols: SymbolId[] | SymbolId | null): SymbolId[] {
  const list = Array.isArray(expandSymbols)
    ? expandSymbols
    : expandSymbols
      ? [expandSymbols]
      : [];
  const seen = new Set<SymbolId>();
  const out: SymbolId[] = [];
  for (const s of list) {
    if (s === "book" || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

export function totalBet(lines: number, betPerLine: number): number {
  return lines * betPerLine;
}

export function formatCredits(n: number, lang: "de" | "en", gram = false): string {
  if (gram) {
    return `${(n * 0.1).toLocaleString(lang === "de" ? "de-DE" : "en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} G`;
  }
  return Math.round(n).toLocaleString(lang === "de" ? "de-DE" : "en-US");
}

export function nextLineStep(current: number, dir: 1 | -1): number {
  const idx = LINE_STEPS.indexOf(current as LineStep);
  const from = idx === -1 ? LINE_STEPS.indexOf(25) : idx;
  return LINE_STEPS[Math.max(0, Math.min(LINE_STEPS.length - 1, from + dir))];
}
