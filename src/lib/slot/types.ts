export const SYMBOL_IDS = [
  "book",
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
] as const;

export type SymbolId = (typeof SYMBOL_IDS)[number];

export type PictureId = "book" | "explorer" | "priestess" | "ankh" | "anubis" | "statue" | "scarab";

export type PayCount = 2 | 3 | 4 | 5 | 6;

export type Grid = SymbolId[][];

export type PaylineWin = {
  line: number;
  symbol: SymbolId;
  count: number;
  amount: number;
  positions: { reel: number; row: number }[];
};

export type ExpandLayer = {
  symbol: SymbolId;
  reels: number[];
};

export type SpinResult = {
  grid: Grid;
  stops: number[];
  lineWins: PaylineWin[];
  scatterCount: number;
  scatterWin: number;
  expandReels: number[];
  expandSymbol: SymbolId | null;
  expandLayers: ExpandLayer[];
  expandWin: number;
  totalWin: number;
  bonusTrigger: boolean;
};

export type Lang = "de" | "en";
export type GamePhase =
  | "start"
  | "idle"
  | "spinning"
  | "expanding"
  | "paying"
  | "bonusSelect"
  | "gamble"
  | "fsTotal";
