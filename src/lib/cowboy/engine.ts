export type RegularId =
  | "10"
  | "J"
  | "Q"
  | "K"
  | "A"
  | "hat"
  | "cactus"
  | "pistols"
  | "skull"
  | "badge";

export type SymbolId = RegularId | "wild" | "scatter";

export type SpecialSubtype =
  | "bronze"
  | "silver"
  | "gold"
  | "diamond"
  | "clover"
  | "goldclover"
  | "bag"
  | "reload";

export type Cell =
  | { kind: "regular"; id: SymbolId }
  | { kind: "special"; subtype: SpecialSubtype; value: number }
  | { kind: "cylinder"; shots: number };

export type Grid = Cell[][];

export type ClusterWin = {
  type: RegularId;
  cells: [number, number][];
  size: number;
  payout: number;
};

export type PayoutInfo = {
  total: number;
  coins: number;
  bagValue: number;
  multiplier: number;
  bagCount: number;
  values: { r: number; c: number; value: number }[];
};

export type EngineEvent =
  | { type: "cascade"; grid: Grid; wins: ClusterWin[]; cascadeCount: number; total: number }
  | { type: "drop"; grid: Grid; cascadeCount: number }
  | { type: "cylinders"; grid: Grid; count: number }
  | { type: "shot"; grid: Grid; at: [number, number]; shotTotal: number }
  | { type: "bullet"; grid: Grid; at: [number, number]; shotTotal: number }
  | { type: "lootReveal"; grid: Grid; at: [number, number] }
  | { type: "reload"; grid: Grid }
  | {
      type: "specialPayout";
      grid: Grid;
      payout: PayoutInfo;
      shotTotal: number;
      reloads?: number;
    };

export type EngineOptions = {
  bet?: number;
  delay?: number;
  turbo?: boolean;
  allowScatter?: boolean;
  wildBoost?: boolean;
  bonusChance?: number;
  wildClusterChance?: number;
  forceWilds?: boolean;
  noBronze?: boolean;
};

export const ROWS = 5;
export const COLS = 6;
export const MIN_CLUSTER = 5;

export const REGULARS: RegularId[] = [
  "10",
  "J",
  "Q",
  "K",
  "A",
  "hat",
  "cactus",
  "pistols",
  "skull",
  "badge",
];

/** Coin multipliers relative to the bet, scaled so payouts are whole credits. */
export const PAYTABLE: Record<RegularId, number[]> = {
  "10": [1, 2, 3, 10, 50, 250],
  J: [1, 2, 3, 10, 50, 250],
  Q: [1, 2, 3, 10, 50, 250],
  K: [1, 2, 3, 10, 50, 250],
  A: [1, 2, 3, 10, 50, 250],
  hat: [2, 3, 5, 15, 75, 375],
  cactus: [2, 3, 5, 15, 75, 375],
  pistols: [3, 5, 10, 25, 100, 500],
  skull: [3, 5, 10, 25, 100, 500],
  badge: [5, 7, 15, 50, 250, 1000],
};

const SPECIALS: SpecialSubtype[] = [
  "bronze",
  "silver",
  "gold",
  "diamond",
  "clover",
  "goldclover",
  "bag",
  "reload",
];

const SPECIAL_VALUES: Partial<Record<SpecialSubtype, number[]>> = {
  bronze: [1, 2, 3, 4],
  silver: [5, 10, 15, 20],
  gold: [25, 50, 100],
  diamond: [150, 250, 500],
  clover: [2, 3, 4, 5, 10, 20],
  goldclover: [2, 3, 4, 5, 10, 20],
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const random = (max: number) => Math.floor(Math.random() * max);
const pick = <T,>(values: readonly T[]): T => values[random(values.length)];
const key = (r: number, c: number) => `${r}:${c}`;

export function isRegular(value: Cell | null | undefined): value is { kind: "regular"; id: SymbolId } {
  return Boolean(value && value.kind === "regular");
}
export function isWild(value: Cell | null | undefined): boolean {
  return isRegular(value) && value.id === "wild";
}
export function isScatter(value: Cell | null | undefined): boolean {
  return isRegular(value) && value.id === "scatter";
}
export function createSpecial(subtype: SpecialSubtype): Cell {
  return {
    kind: "special",
    subtype,
    value: SPECIAL_VALUES[subtype] ? pick(SPECIAL_VALUES[subtype]!) : 0,
  };
}
export function cloneGrid(grid: Grid): Grid {
  return grid.map((row) => row.map((item) => ({ ...item })));
}

export function weightedSymbol(options: EngineOptions = {}, allowScatter = true): SymbolId {
  const pool: [SymbolId, number][] = [
    ["10", 6.5],
    ["J", 6.5],
    ["Q", 6.5],
    ["K", 6.5],
    ["A", 6.5],
    ["hat", 3],
    ["cactus", 3],
    ["pistols", 2.5],
    ["skull", 2.5],
    ["badge", 1.5],
    ["wild", options.wildBoost ? 2.4 : 1.2],
    ["scatter", options.allowScatter === false || !allowScatter ? 0 : 0.9],
  ];
  const total = pool.reduce((sum, item) => sum + item[1], 0);
  let roll = Math.random() * total;
  for (const [id, weight] of pool) {
    roll -= weight;
    if (roll <= 0) return id;
  }
  return "10";
}

export type RollResult = { grid: Grid; scatters: number };

export function rollGrid(options: EngineOptions = {}): RollResult {
  const grid: Grid = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ kind: "regular", id: weightedSymbol(options) })),
  );
  if (options.forceWilds) {
    let changed = 0;
    for (let r = 0; r < ROWS && changed < 2; r++)
      for (let c = 0; c < COLS && changed < 2; c++)
        if (!isScatter(grid[r][c])) {
          grid[r][c] = { kind: "regular", id: "wild" };
          changed++;
        }
  }
  if (Math.random() < (options.bonusChance || 0.38) && countScatters(grid) < 3) {
    const type = pick(REGULARS.slice(0, 9) as RegularId[]);
    const row = random(ROWS);
    const start = random(2);
    const useWild = Math.random() < (options.wildClusterChance || 0.16);
    for (let i = 0; i < 5; i++) {
      grid[row][start + i] = { kind: "regular", id: useWild && i === 4 ? "wild" : type };
    }
  }
  return { grid, scatters: countScatters(grid) };
}

export function countScatters(grid: Grid): number {
  return grid.flat().filter((item) => isScatter(item)).length;
}

export function findClusters(grid: Grid): ClusterWin[] {
  const wins: ClusterWin[] = [];
  for (const type of REGULARS) {
    const visited = new Set<string>();
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const start = grid[r]?.[c];
        const startKey = key(r, c);
        if (!start || visited.has(startKey) || !isRegular(start) || (start.id !== type && start.id !== "wild")) {
          continue;
        }
        const queue: [number, number][] = [[r, c]];
        const cells: [number, number][] = [];
        visited.add(startKey);
        while (queue.length) {
          const [cr, cc] = queue.shift() as [number, number];
          cells.push([cr, cc]);
          for (const [dr, dc] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ] as const) {
            const nr = cr + dr;
            const nc = cc + dc;
            const nextKey = key(nr, nc);
            const next = grid[nr]?.[nc];
            if (
              nr >= 0 &&
              nr < ROWS &&
              nc >= 0 &&
              nc < COLS &&
              !visited.has(nextKey) &&
              isRegular(next) &&
              (next.id === type || next.id === "wild")
            ) {
              visited.add(nextKey);
              queue.push([nr, nc]);
            }
          }
        }
        if (cells.length >= MIN_CLUSTER) {
          wins.push({ type, cells, size: cells.length, payout: PAYTABLE[type][clusterTier(cells.length)] });
        }
      }
  }
  return wins;
}

function refill(grid: Grid, wins: ClusterWin[], options: EngineOptions): Grid {
  const winTypes = new Set<SymbolId>(wins.map((win) => win.type));
  const removed = new Set<string>();
  for (const win of wins) {
    for (const [r, c] of win.cells) removed.add(key(r, c));
  }
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const cell = grid[r][c];
      if (isRegular(cell) && (isWild(cell) || winTypes.has(cell.id))) {
        removed.add(key(r, c));
      }
    }
  const next: Grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null) as unknown as Cell[]);
  for (let c = 0; c < COLS; c++) {
    const survivors: Cell[] = [];
    for (let r = ROWS - 1; r >= 0; r--) {
      if (!removed.has(key(r, c))) survivors.push(grid[r][c]);
    }
    for (let r = ROWS - 1, i = 0; r >= 0; r--, i++) {
      next[r][c] = survivors[i] || ({ kind: "regular", id: weightedSymbol({ ...options, allowScatter: false }) });
    }
  }
  return next;
}

export async function resolveCascades(
  initialGrid: Grid,
  options: EngineOptions,
  onEvent: (event: EngineEvent) => void = () => undefined,
): Promise<{ grid: Grid; total: number; cascadeCount: number; winsCount: number; wilds: number }> {
  let grid = cloneGrid(initialGrid);
  let total = 0;
  let cascadeCount = 0;
  let winsCount = 0;
  let wilds = 0;
  const pace = options.delay || 95;
  for (let guard = 0; guard < 14; guard++) {
    const wins = findClusters(grid);
    if (!wins.length) break;
    cascadeCount++;
    winsCount += wins.length;
    const wildCells = new Set<string>();
    for (const win of wins) {
      for (const [r, c] of win.cells) {
        if (isWild(grid[r][c])) wildCells.add(key(r, c));
      }
    }
    wilds += wildCells.size;
    total += wins.reduce((sum, win) => sum + win.payout * (options.bet ?? 1), 0);
    onEvent({ type: "cascade", grid: cloneGrid(grid), wins, cascadeCount, total });
    await sleep(pace);
    grid = refill(grid, wins, options);
    onEvent({ type: "drop", grid: cloneGrid(grid), cascadeCount });
    await sleep(pace);
  }
  return { grid, total, cascadeCount, winsCount, wilds };
}

function placeCylinders(grid: Grid, count: number): Grid {
  const result = cloneGrid(grid);
  const candidates: [number, number][] = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (isRegular(result[r][c]) && !isScatter(result[r][c])) candidates.push([r, c]);
  for (let i = 0; i < count && candidates.length; i++) {
    const at = candidates.splice(random(candidates.length), 1)[0];
    result[at[0]][at[1]] = { kind: "cylinder", shots: 2 + random(5) };
  }
  return result;
}

function randomTarget(): [number, number] {
  return [random(ROWS), random(COLS)];
}

function revealOne(
  grid: Grid,
  options: EngineOptions = {},
): { changed: boolean; at: [number, number]; upgraded?: boolean } {
  const [r, c] = randomTarget();
  const target = grid[r][c];
  if (target?.kind === "cylinder") return { changed: false, at: [r, c] };
  if (target?.kind === "special") {
    if (target.subtype === "bronze") grid[r][c] = createSpecial("silver");
    else if (target.subtype === "silver") grid[r][c] = createSpecial("gold");
    else if (target.subtype === "clover") grid[r][c] = createSpecial("goldclover");
    else return { changed: false, at: [r, c] };
    return { changed: true, at: [r, c], upgraded: true };
  }
  const types: SpecialSubtype[] = options.noBronze
    ? ["silver", "silver", "gold", "diamond", "clover", "goldclover", "bag", "reload"]
    : SPECIALS;
  grid[r][c] = createSpecial(pick(types));
  return { changed: true, at: [r, c] };
}

export function payoutSpecials(grid: Grid): PayoutInfo {
  let coins = 0;
  let bagCount = 0;
  let multiplier = 1;
  const values: { r: number; c: number; value: number }[] = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const item = grid[r][c];
      if (item?.kind !== "special") continue;
      if (["bronze", "silver", "gold", "diamond"].includes(item.subtype)) {
        coins += item.value;
        values.push({ r, c, value: item.value });
      }
      if (item.subtype === "bag") bagCount++;
    }
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const item = grid[r][c];
      if (item?.kind !== "special") continue;
      if (item.subtype === "goldclover") multiplier *= item.value;
      if (item.subtype === "clover") {
        let near = 0;
        for (const [dr, dc] of [
          [-1, -1],
          [-1, 0],
          [-1, 1],
          [0, -1],
          [0, 1],
          [1, -1],
          [1, 0],
          [1, 1],
        ] as const) {
          const n = grid[r + dr]?.[c + dc];
          if (n?.kind === "special" && ["bronze", "silver", "gold", "diamond", "bag"].includes(n.subtype)) near++;
        }
        if (near) multiplier *= item.value;
      }
    }
  const bagValue = bagCount ? coins * multiplier : 0;
  return {
    total: coins * multiplier + bagValue,
    coins,
    bagValue,
    multiplier,
    bagCount,
    values,
  };
}

export async function resolveRevolvers(
  initialGrid: Grid,
  cylinderCount: number,
  options: EngineOptions = {},
  onEvent: (event: EngineEvent) => void = () => undefined,
): Promise<{ grid: Grid; total: number; shotTotal: number; reloads: number; payout: PayoutInfo }> {
  let grid = placeCylinders(initialGrid, cylinderCount);
  const cylinders: { r: number; c: number; shots: number }[] = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const cell = grid[r][c];
      if (cell?.kind === "cylinder") cylinders.push({ r, c, shots: cell.shots });
    }
  let shotTotal = 0;
  let reloads = 0;
  onEvent({ type: "cylinders", grid: cloneGrid(grid), count: cylinders.length });
  for (let loop = 0; loop < 4; loop++) {
    let fired = false;
    for (const cylinder of cylinders) {
      while (cylinder.shots > 0) {
        cylinder.shots--;
        shotTotal++;
        fired = true;
        const shot = revealOne(grid, options);
        onEvent({ type: "shot", grid: cloneGrid(grid), at: shot.at, shotTotal });
        await sleep(options.delay || 95);
      }
    }
    const reloadAt: [number, number][] = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const cell = grid[r][c];
        if (cell?.kind === "special" && cell.subtype === "reload") reloadAt.push([r, c]);
      }
    if (reloadAt.length) {
      const [rr, cc] = reloadAt[0];
      grid[rr][cc] = createSpecial("silver");
      reloads++;
      for (const cylinder of cylinders) cylinder.shots += 2 + random(5);
      onEvent({ type: "reload", grid: cloneGrid(grid) });
      await sleep(options.delay || 95);
      continue;
    }
    if (fired) break;
    break;
  }
  let payout = payoutSpecials(grid);
  let loops = 0;
  while (payout.bagCount && loops < 2) {
    loops++;
    for (let i = 0; i < Math.max(1, cylinders.length); i++) {
      const shot = revealOne(grid, options);
      onEvent({ type: "lootReveal", grid: cloneGrid(grid), at: shot.at });
      await sleep(options.delay || 95);
    }
    payout = payoutSpecials(grid);
  }
  onEvent({ type: "specialPayout", grid: cloneGrid(grid), payout, shotTotal, reloads });
  return { grid, total: payout.total * (options.bet ?? 1), shotTotal, reloads, payout };
}

export async function fireCollector(
  initialGrid: Grid,
  bullets: number,
  options: EngineOptions = {},
  onEvent: (event: EngineEvent) => void = () => undefined,
): Promise<{ grid: Grid; total: number; payout: PayoutInfo; shotTotal: number }> {
  const grid = cloneGrid(initialGrid);
  let shotTotal = 0;
  for (let i = 0; i < bullets; i++) {
    const shot = revealOne(grid, options);
    shotTotal++;
    onEvent({ type: "bullet", grid: cloneGrid(grid), at: shot.at, shotTotal });
    await sleep(options.delay || 85);
  }
  const payout = payoutSpecials(grid);
  onEvent({ type: "specialPayout", grid: cloneGrid(grid), payout, shotTotal });
  return { grid, total: payout.total * (options.bet ?? 1), payout, shotTotal };
}

export type BonusType = "SALOON" | "TRAIL" | "PISTOLS";

export function tierName(type: BonusType): string {
  if (type === "SALOON") return "High Noon Saloon";
  if (type === "TRAIL") return "Trail of Trickery";
  return "Pistols at Dawn";
}

/** Bet steps in whole credits. Shown on screen as currency Ã· 10 â†’ min. bet 0.10. */
export const BETS = [1, 2, 5, 10, 20, 50, 100, 200, 500] as const;

export function nextBet(current: number, dir: 1 | -1): number {
  const idx = BETS.indexOf(current as (typeof BETS)[number]);
  const from = idx === -1 ? 4 : idx;
  return BETS[Math.max(0, Math.min(BETS.length - 1, from + dir))];
}

export function clusterTier(size: number): number {
  return size >= 14 ? 5 : Math.min(5, Math.floor((size - 5) / 2));
}

export function positionKey(position: readonly [number, number] | readonly number[]): string {
  return `${position[0]}:${position[1]}`;
}

export function currency(n: number, lang: "de" | "en" = "de"): string {
  return (n / 100).toLocaleString(lang === "de" ? "de-CH" : "en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}