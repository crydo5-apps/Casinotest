export const GATES_SYMBOLS = [
  "blueGem",
  "greenGem",
  "yellowGem",
  "purpleGem",
  "redGem",
  "chalice",
  "ring",
  "hourglass",
  "crown",
  "scatter",
  "orb",
] as const;

export type GatesSymbolId = (typeof GATES_SYMBOLS)[number];

export type RegularSymbol = Exclude<GatesSymbolId, "scatter" | "orb">;

export type ScatterPay = {
  symbol: GatesSymbolId;
  count: number;
  amount: number;
};

export type OrbInfo = {
  row: number;
  col: number;
  value: number;
};

export type TumbleStep = {
  grid: GatesSymbolId[][];
  wins: ScatterPay[];
  orbs: OrbInfo[];
  removedPositions: { row: number; col: number }[];
};

export type GatesSpinResult = {
  grid: GatesSymbolId[][];
  scatterCount: number;
  scatterWin: number;
  tumbleSteps: TumbleStep[];
  totalWin: number;
  orbMultiplierSum: number;
  bonusTrigger: boolean;
  retrigger: boolean;
};

export type GatesGamePhase =
  | "idle"
  | "spinning"
  | "tumbling"
  | "payout"
  | "freeSpinsIntro"
  | "freeSpins"
  | "freeSpinsEnd"
  | "bigWin";

export type GatesGameState = {
  credits: number;
  bet: number;
  phase: GatesGamePhase;
  grid: GatesSymbolId[][];
  inFreeSpins: boolean;
  freeSpinsRemaining: number;
  globalMultiplier: number;
  pendingWin: number;
  totalBonusWin: number;
  tumbleStepIndex: number;
  currentTumbleSteps: TumbleStep[];
  orbMultiplierSum: number;
  winTier: "big" | "mega" | "huge" | "epic" | null;
};
