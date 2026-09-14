import { LINE_STEPS } from "./engine";
import type { Lang } from "./types";

const KEY = "book-of-ra-save";
const VERSION = 2;

export type SaveData = {
  version: number;
  credits: number;
  lines: number;
  betPerLine: number;
  lang: Lang;
  muted: boolean;
  biggestWin: number;
  turbo: boolean;
};

const DEFAULTS: SaveData = {
  version: VERSION,
  credits: 4000,
  lines: 25,
  betPerLine: 1,
  lang: "de",
  muted: false,
  biggestWin: 0,
  turbo: false,
};

function migrate(raw: Partial<SaveData> & { version?: number }): SaveData {
  const save: SaveData = { ...DEFAULTS, ...raw, version: VERSION };
  if ((raw.version ?? 0) < 2) save.lines = 25;
  return save;
}

export function loadSave(): SaveData {
  if (typeof window === "undefined") return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const save = migrate(parsed);
    if (!Number.isFinite(save.credits) || save.credits < 0) save.credits = DEFAULTS.credits;
    if (!(LINE_STEPS as readonly number[]).includes(save.lines)) save.lines = 25;
    if (![1, 2, 5, 10, 20, 50].includes(save.betPerLine)) save.betPerLine = 1;
    if (save.lang !== "de" && save.lang !== "en") save.lang = "de";
    save.turbo = Boolean(save.turbo);
    return save;
  } catch {
    return { ...DEFAULTS };
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...data, version: VERSION }));
  } catch {
    /* private mode / quota */
  }
}
