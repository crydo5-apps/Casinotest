import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { House, LayoutDashboard, Minus, Plus, Smartphone, Volume2, VolumeX, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { audio } from "@/lib/slot/audio";
import { commitRound } from "@/lib/play";
import { getWallet, requestDeposit, type DepositRow } from "@/lib/wallet";
import { getCopy, fill, type Lang, type Copy } from "@/lib/cowboy/copy";
import {
  BETS,
  ROWS,
  COLS,
  resolveCascades,
  resolveRevolvers,
  fireCollector,
  rollGrid,
  nextBet,
  currency,
  type BonusType,
  type Cell,
  type Grid,
  type EngineEvent,
} from "@/lib/cowboy/engine";

const STORAGE_KEY = "crydo5-cowboy-v1";
const ASSET_ROOT = "/cowboy/";
const ASSET: Record<string, string> = {
  "10": "royal-10.png",
  J: "royal-j.png",
  Q: "royal-q.png",
  K: "royal-k.png",
  A: "royal-a.png",
  hat: "cowboy-hat.png",
  cactus: "cactus.png",
  pistols: "crossed-pistols.png",
  skull: "skull.png",
  badge: "sheriff-badge.png",
  wild: "wanted-wild.png",
  scatter: "fs-scatter.png",
  cylinder: "revolver-cylinder.png",
  bronze: "bronze-coin.png",
  silver: "silver-coin.png",
  gold: "gold-coin.png",
  diamond: "diamond.png",
  clover: "green-clover.png",
  goldclover: "gold-clover.png",
  bag: "loot-bag.png",
  reload: "reload.png",
};

function art(id: string) {
  return id in ASSET ? `url("${ASSET_ROOT}${ASSET[id]}")` : "";
}

type Modal = null | "paytable" | "autoplay" | "buy" | "gamble" | "deposit";

type Snapshot = {
  phase: "start" | "playing";
  lang: Lang;
  muted: boolean;
  turbo: boolean;
  credits: number;
  bet: number;
  grid: Grid;
  pendingWin: number;
  totalWon: number;
  spins: number;
  bonusType: BonusType | null;
  freeSpins: number;
  bullet: number;
  autoplay: number;
  status: string;
  statusVals: Record<string, string | number>;
  char: string;
  shotCount: number;
  shotAt: [number, number] | null;
  winners: Set<string>;
  dropTick: number;
  joy: number;
  toast: string | null;
  modal: Modal;
  twintPhone: string;
  twintName: string;
  pending: DepositRow[];
};

function freshGrid() {
  return rollGrid({ allowScatter: false }).grid;
}

function initSnapshot(): Snapshot {
  return {
    phase: "start",
    lang: "de",
    muted: false,
    turbo: false,
    credits: 0,
    bet: 5,
    grid: freshGrid(),
    pendingWin: 0,
    totalWon: 0,
    spins: 0,
    bonusType: null,
    freeSpins: 0,
    bullet: 0,
    autoplay: 0,
    status: "",
    statusVals: {},
    char: "character.idle",
    shotCount: 0,
    shotAt: null,
    winners: new Set<string>(),
    dropTick: 0,
    joy: 0,
    toast: null,
    modal: null,
    twintPhone: "",
    twintName: "",
    pending: [],
  };
}

function loadPrefs(): Partial<Snapshot> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const s = JSON.parse(raw) as Record<string, unknown>;
    const o: Partial<Snapshot> = {};
    if (typeof s.bet === "number" && (BETS as readonly number[]).includes(s.bet)) o.bet = s.bet;
    if (typeof s.turbo === "boolean") o.turbo = s.turbo;
    if (typeof s.muted === "boolean") o.muted = s.muted;
    if (s.lang === "de" || s.lang === "en") o.lang = s.lang;
    if (typeof s.totalWon === "number") o.totalWon = s.totalWon;
    if (typeof s.spins === "number") o.spins = s.spins;
    return o;
  } catch {
    return {};
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function winTierKey(mult: number): "" | "bigWin" | "megaWin" | "hugeWin" | "epicWin" {
  if (mult >= 1000) return "epicWin";
  if (mult >= 200) return "hugeWin";
  if (mult >= 50) return "megaWin";
  if (mult >= 15) return "bigWin";
  return "";
}

function cashFromGamble(type: BonusType | null, roll: number): number {
  if (type === "SALOON") {
    if (roll === 2) return [1, 2, 3, 4][Math.floor(Math.random() * 4)];
    if (roll === 3) return [5, 10, 15, 20][Math.floor(Math.random() * 4)];
    return [25, 50, 100][Math.floor(Math.random() * 3)];
  }
  if (roll <= 3) return [5, 10, 15, 20][Math.floor(Math.random() * 4)];
  if (roll <= 7) return [25, 50, 100][Math.floor(Math.random() * 3)];
  return [150, 250, 500][Math.floor(Math.random() * 3)];
}

function symbolClass(item: Cell): string {
  if (!item) return "royal";
  if (item.kind === "cylinder") return "cylinder";
  if (item.kind === "special") return item.subtype;
  if (item.id === "wild") return "wild";
  if (item.id === "scatter") return "scatter";
  return ["hat", "cactus", "pistols", "skull", "badge"].includes(item.id) ? item.id : "royal";
}

function symbolAssetId(item: Cell): string {
  if (item.kind === "cylinder") return "cylinder";
  if (item.kind === "special") return item.subtype;
  return item.id;
}

function symbolLabel(item: Cell, c: Copy): string {
  if (!item) return "";
  if (item.kind === "cylinder") return "⟳";
  if (item.kind === "special") {
    const map: Record<string, string> = {
      bronze: c.pay.bronze1,
      silver: c.pay.silver1,
      gold: c.pay.gold1,
      diamond: c.pay.diamond1,
      clover: c.pay.clover1,
      goldclover: c.pay.goldclover1,
      bag: c.pay.bag1,
      reload: c.pay.reload1,
    };
    return map[item.subtype] ?? "";
  }
  return item.id;
}

const BUY_OPTIONS = [
  { id: "HUNT" as const, nameKey: "hunt" as const, descKey: "huntDesc" as const, price: 3 },
  { id: "WILD" as const, nameKey: "wild" as const, descKey: "wildDesc" as const, price: 75 },
  { id: "SALOON" as const, nameKey: "saloon" as const, descKey: "saloonDesc" as const, price: 65 },
  { id: "TRAIL" as const, nameKey: "trail" as const, descKey: "trailDesc" as const, price: 250 },
];

function buildPaytableRows(c: Copy) {
  return [
    { id: "10", name: c.pay.royal, range: "1×–250×" },
    { id: "hat", name: c.pay.hat, range: "2×–375×" },
    { id: "cactus", name: c.pay.cactus, range: "2×–375×" },
    { id: "pistols", name: c.pay.pistols, range: "3×–500×" },
    { id: "skull", name: c.pay.skull, range: "3×–500×" },
    { id: "badge", name: c.pay.badge, range: "5×–1000×" },
    { id: "wild", name: c.pay.wild, range: "FEATURE" },
    { id: "scatter", name: c.pay.scatter, range: "FEATURE" },
  ];
}

export function CowboyApp({ admin }: { admin?: boolean }) {
  const [g, setG] = useState<Snapshot>(() => ({ ...initSnapshot(), ...loadPrefs() }));
  const gRef = useRef(g);
  useEffect(() => {
    gRef.current = g;
  }, [g]);
  const busyRef = useRef(false);
  const aliveRef = useRef(true);
  const runSpinRef = useRef<() => void>(() => undefined);
  const savedOverridesRef = useRef<{ bonusChance?: number; forceWilds?: boolean; wildBoost?: boolean } | null>(null);

  useEffect(() => {
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const patch = (p: Partial<Snapshot> | ((prev: Snapshot) => Partial<Snapshot>)) => {
    setG((prev) => ({ ...prev, ...(typeof p === "function" ? p(prev) : p) }));
  };

  const c = useMemo(() => getCopy(g.lang), [g.lang]);
  const money = (n: number) => currency(n, g.lang);

  const toastTimer = useRef(0);
  const toast = (msg: string) => {
    patch({ toast: msg });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => {
      if (aliveRef.current) patch({ toast: null });
    }, 2400);
  };

  const scheduleSpin = (ms: number) => {
    window.setTimeout(() => {
      if (aliveRef.current && !busyRef.current) runSpinRef.current();
    }, ms);
  };

  const onEngineEvent = (event: EngineEvent) => {
    switch (event.type) {
      case "cascade": {
        const ws = new Set<string>();
        for (const win of event.wins) for (const [r, cc] of win.cells) ws.add(`${r}:${cc}`);
        patch({ grid: event.grid, winners: ws, status: c.status.cascade, char: c.character.spin });
        audio.pick();
        break;
      }
      case "drop":
        patch({ grid: event.grid, winners: new Set<string>(), dropTick: gRef.current.dropTick + 1 });
        break;
      case "cylinders":
        patch({ grid: event.grid, status: c.status.revolver, char: c.character.shoot, shotCount: event.count * 4 });
        audio.bonus();
        break;
      case "shot":
      case "bullet":
      case "lootReveal":
        patch({ grid: event.grid, shotAt: event.at, shotCount: Math.max(0, gRef.current.shotCount - 1) });
        if (event.type === "bullet") audio.tick();
        else audio.coin();
        break;
      case "reload":
        patch({ grid: event.grid, status: fill(c.bonus.collectorReady, { count: gRef.current.bullet }), shotCount: 6 });
        audio.expand();
        break;
      case "specialPayout":
        patch({ grid: event.grid, shotCount: 0, shotAt: null });
        if (event.payout?.total) {
          patch({ status: fill(c.status.win, { amount: money(event.payout.total * gRef.current.bet) }) });
          audio.tally(200);
        }
        break;
    }
  };

  const startBonus = (type: BonusType, shouldAsk = true) => {
    const key = type === "SALOON" ? "saloon" : type === "TRAIL" ? "trail" : "pistols";
    patch({
      bonusType: type,
      freeSpins: 10,
      bullet: type === "PISTOLS" ? 5 : 0,
      status: fill(c.bonus.start, { name: c.bonus[key] }),
      char: c.character.big,
      dropTick: gRef.current.dropTick + 1,
    });
    audio.bonus();
    if (shouldAsk && type !== "PISTOLS") {
      window.setTimeout(() => {
        if (aliveRef.current) patch({ modal: "gamble" });
      }, 260);
    } else {
      window.setTimeout(() => {
        if (aliveRef.current) runSpinRef.current();
      }, 460);
    }
  };

  const handleGamble = async (choice: "play" | "upgradeTrail" | "upgradePistols" | { cash: true; roll: number }) => {
    patch({ modal: null });
    const s = gRef.current;
    if (choice === "play") {
      runSpinRef.current();
      return;
    }
    if (choice === "upgradeTrail") {
      startBonus("TRAIL", true);
      return;
    }
    if (choice === "upgradePistols") {
      startBonus("PISTOLS", false);
      return;
    }
    if (choice.cash) {
      const amount = cashFromGamble(s.bonusType, choice.roll) * s.bet;
      const res = await commitRound({ data: { game: "cowboy", kind: "gamble", stake: 0, payout: amount } });
      if (res.ok) {
        patch({
          credits: res.credits,
          pendingWin: amount,
          totalWon: s.totalWon + amount,
          bonusType: null,
          freeSpins: 0,
          bullet: 0,
          status: fill(c.status.win, { amount: money(amount) }),
          char: c.character.win,
        });
      } else {
        patch({ credits: res.credits, bonusType: null, freeSpins: 0, bullet: 0 });
      }
      toast(c.modal.cashAward);
      audio.cash();
    }
  };

  const buyFeature = async (option: (typeof BUY_OPTIONS)[number]) => {
    patch({ modal: null });
    const s = gRef.current;
    const cost = option.price * s.bet;
    if (s.credits < cost) {
      toast(c.status.noBalance);
      return;
    }
    patch({ credits: s.credits - cost });
    audio.chip();
    const res = await commitRound({ data: { game: "cowboy", kind: "buy_fs", stake: cost, payout: 0 } });
    if (res.ok) {
      patch({ credits: res.credits });
    } else {
      patch({ credits: res.credits });
      toast(c.status.noBalance);
      return;
    }
    if (option.id === "SALOON") startBonus("SALOON", true);
    else if (option.id === "TRAIL") startBonus("TRAIL", true);
    else if (option.id === "HUNT") {
      toast(fill(c.buy.huntDesc, {}));
      savedOverridesRef.current = { bonusChance: 0.85 };
      runSpinRef.current();
    } else {
      toast(fill(c.buy.wildDesc, {}));
      savedOverridesRef.current = { forceWilds: true, wildBoost: true };
      runSpinRef.current();
    }
  };

  const startAutoplay = (count: number) => {
    patch({ modal: null, autoplay: count, status: c.status.autoplay });
    runSpinRef.current();
  };

  async function runSpin() {
    if (busyRef.current) return;
    const s = gRef.current;
    if (s.phase !== "playing") return;
    const inBonus = Boolean(s.bonusType && s.freeSpins > 0);
    if (!inBonus && s.credits < s.bet) {
      toast(c.status.noBalance);
      return;
    }
    busyRef.current = true;
    const override = savedOverridesRef.current;
    savedOverridesRef.current = null;
    const stake = inBonus ? 0 : s.bet;
    const kind = inBonus ? "free_spin" : "spin";
    const freeSpinsNext = inBonus ? Math.max(0, s.freeSpins - 1) : s.freeSpins;
    patch({
      credits: inBonus ? s.credits : s.credits - s.bet,
      freeSpins: freeSpinsNext,
      spins: s.spins + 1,
      pendingWin: 0,
      status: inBonus ? c.status.bonus : c.status.spinning,
      char: c.character.spin,
      winners: new Set<string>(),
    });
    audio.unlock();
    audio.start();
    const opts = {
      bet: s.bet,
      allowScatter: s.bonusType !== "PISTOLS",
      wildBoost: inBonus,
      bonusChance: override?.bonusChance ?? (inBonus ? 0.62 : 0.38),
      wildClusterChance: inBonus ? 0.28 : 0.16,
      forceWilds: override?.forceWilds ?? false,
      noBronze: s.bonusType === "PISTOLS",
      delay: s.turbo ? 28 : 75,
    };
    const landed = rollGrid(opts);
    patch({ grid: landed.grid, dropTick: gRef.current.dropTick + 1, winners: new Set<string>(), shotAt: null, shotCount: 0 });
    await sleep(s.turbo ? 90 : 260);
    audio.startDrone(s.turbo);
    const cascades = await resolveCascades(landed.grid, opts, onEngineEvent);
    audio.stopDrone();
    audio.stopSlam();
    let grid = cascades.grid;
    patch({ grid });
    await sleep(s.turbo ? 60 : 160);
    let total = cascades.total;
    if (cascades.wilds && landed.scatters < 3) {
      const reveal = await resolveRevolvers(grid, cascades.wilds, { ...opts }, onEngineEvent);
      grid = reveal.grid;
      patch({ grid });
      total += reveal.total;
    }
    const sNow = gRef.current;
    if (inBonus && (sNow.bonusType === "TRAIL" || sNow.bonusType === "PISTOLS")) {
      const before = sNow.bullet;
      const bulletNext = before + cascades.winsCount;
      const shouldFire = sNow.bonusType === "PISTOLS" || gRef.current.freeSpins === 0;
      patch({ bullet: bulletNext, status: fill(c.bonus.collectorReady, { count: bulletNext }) });
      if (shouldFire && bulletNext > 0) {
        patch({ char: c.character.shoot, status: fill(c.bonus.collectorFire, { count: bulletNext }) });
        const fired = await fireCollector(grid, bulletNext, { ...opts }, onEngineEvent);
        grid = fired.grid;
        patch({ grid });
        total += fired.total;
        patch({ bullet: sNow.bonusType === "PISTOLS" ? Math.max(before, 5) : 0 });
      }
    }
    total = Math.floor(total);
    patch({ grid, pendingWin: total });
    await sleep(s.turbo ? 80 : 220);
    const res = await commitRound({ data: { game: "cowboy", kind, stake, payout: total } });
    if (res.ok) {
      patch({ credits: res.credits });
    } else {
      patch({ credits: res.credits });
      toast(c.status.noBalance);
      busyRef.current = false;
      audio.stopDrone();
      return;
    }
    const mult = total / s.bet;
    const tier = winTierKey(mult);
    if (total > 0) {
      const charKey = mult >= 15 ? c.character.big : c.character.win;
      patch({
        status: tier ? (c.status as Record<string, string>)[tier] : fill(c.status.win, { amount: money(total) }),
        char: charKey,
        totalWon: gRef.current.totalWon + total,
      });
      if (tier === "epicWin") audio.win("epic");
      else if (tier === "hugeWin" || tier === "megaWin") audio.win("mega");
      else audio.win("small");
      if (mult >= 50) {
        patch({ joy: gRef.current.joy + 1 });
      }
    } else {
      patch({ status: c.status.ready, char: c.character.idle });
    }
    const sFinal = gRef.current;
    const scatters = landed.scatters;
    if (inBonus) {
      if (sFinal.bonusType && sFinal.bonusType !== "PISTOLS" && scatters >= 3) {
        patch({ freeSpins: gRef.current.freeSpins + 4, status: fill(c.bonus.retriggers, { count: 4 }) });
      } else if (sFinal.bonusType && sFinal.bonusType !== "PISTOLS" && scatters === 2) {
        patch({ freeSpins: gRef.current.freeSpins + 2, status: fill(c.bonus.retriggers, { count: 2 }) });
      }
      if (gRef.current.freeSpins > 0) {
        busyRef.current = false;
        scheduleSpin(s.turbo ? 120 : 450);
        return;
      }
      patch({ bonusType: null, bullet: 0, status: c.modal.roundComplete, char: c.character.idle });
      toast(c.modal.roundComplete);
      busyRef.current = false;
      return;
    }
    if (scatters >= 3) {
      const type: BonusType = scatters >= 5 ? "PISTOLS" : scatters === 4 ? "TRAIL" : "SALOON";
      busyRef.current = false;
      startBonus(type, true);
      return;
    }
    busyRef.current = false;
    if (gRef.current.autoplay > 0 && !gRef.current.bonusType) {
      const next = gRef.current.autoplay - 1;
      patch({ autoplay: next });
      if (next > 0) scheduleSpin(s.turbo ? 130 : 480);
      else patch({ status: c.autoplay.done });
    }
  }

  useEffect(() => {
    runSpinRef.current = runSpin;
  });

  useEffect(() => {
    audio.unlock();
    void getWallet()
      .then((w) => {
        if (aliveRef.current) patch({ credits: w.credits });
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const { bet, turbo, muted, lang, totalWon, spins } = g;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ bet, turbo, muted, lang, totalWon, spins }));
    } catch {
      /* ignore */
    }
  }, [g.bet, g.turbo, g.muted, g.lang, g.totalWon, g.spins]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && gRef.current.phase === "playing" && !gRef.current.modal && !busyRef.current) {
        e.preventDefault();
        runSpinRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    document.title = g.phase === "playing" ? "El Cowboy" : "Casino";
  }, [g.phase]);

  const enter = () => {
    audio.unlock();
    audio.setMuted(g.muted);
    audio.enter();
    patch({ phase: "playing", modal: null, status: c.status.ready, char: c.character.idle });
  };

  const setBet = (b: number) => {
    patch({ bet: b });
    audio.chip();
  };

  if (g.phase === "start") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-bg p-6 text-center">
        <div className="brand-lockup flex flex-col items-center">
          <span className="font-display text-[10px] uppercase tracking-[0.22em] text-gold">{c.brand.kicker}</span>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-[0.12em] text-gold-2 sm:text-5xl">{c.brand.title}</h1>
        </div>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">{c.modal.paytableIntro}</p>
        <button
          type="button"
          onClick={enter}
          disabled={!g.credits}
          className="mt-2 h-14 w-56 rounded-xl border-2 border-gold bg-[radial-gradient(circle_at_30%_22%,var(--color-gold-2),var(--color-gold)_40%,var(--color-bronze))] font-display text-sm uppercase tracking-[0.18em] text-ink shadow-lg disabled:opacity-40"
        >
          {c.buttons.spin}
        </button>
        <div className="mt-3 flex gap-3">
          <button type="button" onClick={() => patch({ lang: g.lang === "de" ? "en" : "de" })} className="text-xs uppercase tracking-[0.16em] text-muted hover:text-gold-2">
            {g.lang === "de" ? "EN" : "DE"}
          </button>
          <button
            type="button"
            onClick={() => patch({ muted: !g.muted })}
            className="text-xs uppercase tracking-[0.16em] text-muted hover:text-gold-2"
          >
            {g.muted ? <VolumeX className="inline size-4" /> : <Volume2 className="inline size-4" />}
          </button>
        </div>
      </div>
    );
  }

  const paytableRows = buildPaytableRows(c);

  return (
    <div className="flex min-h-dvh flex-col bg-bg font-sans text-fg">
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <Link to="/" className="grid size-9 place-items-center rounded-lg text-muted hover:text-gold-2">
            <House className="size-5" />
          </Link>
          <div className="flex flex-col leading-none">
            <span className="font-display text-[9px] uppercase tracking-[0.2em] text-gold">{c.brand.kicker}</span>
            <span className="font-display text-sm font-semibold tracking-[0.1em] text-gold-2">{c.brand.title}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs tabular-nums">
            <span className="uppercase tracking-[0.12em] text-muted">{c.hud.balance}</span>
            <span className="font-semibold text-gold-2">{money(g.credits)}</span>
            <button
              type="button"
              onClick={() => patch({ modal: "deposit" })}
              className="ml-0.5 grid size-5 place-items-center rounded-full bg-gold/20 text-gold-2 hover:bg-gold/30"
              aria-label="Aufladen"
            >
              <Plus className="size-3" />
            </button>
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs tabular-nums">
            <span className="uppercase tracking-[0.12em] text-muted">{c.hud.bet}</span>
            <span className="font-semibold text-gold-2">{money(g.bet)}</span>
          </div>
          <button
            type="button"
            onClick={() => patch({ modal: "paytable" })}
            className="grid size-8 place-items-center rounded-lg text-muted hover:text-gold-2"
            aria-label={c.buttons.info}
          >
            <span className="font-display text-sm font-bold">i</span>
          </button>
          <button
            type="button"
            onClick={() => {
              g.muted ? audio.unlock() : undefined;
              patch({ muted: !g.muted });
              audio.setMuted(!g.muted);
            }}
            className="grid size-8 place-items-center rounded-lg text-muted hover:text-gold-2"
            aria-label={c.buttons.sound}
          >
            {g.muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </button>
          {admin && (
            <Link to="/dashboard" className="grid size-8 place-items-center rounded-lg text-muted hover:text-gold-2">
              <LayoutDashboard className="size-4" />
            </Link>
          )}
        </div>
      </header>

      <section className="relative flex items-center justify-between gap-2 border-b border-border px-3 py-1.5 text-xs">
        {g.bonusType && g.freeSpins > 0 ? (
          <div className="flex items-center gap-2 rounded-full border border-gold/30 bg-bronze/40 px-3 py-0.5 font-display text-[11px] tracking-[0.12em] text-gold-2">
            <span>{c.bonus[`${g.bonusType.toLowerCase()}` as "saloon" | "trail" | "pistols"]}</span>
            <span className="font-bold">{g.freeSpins} FS</span>
          </div>
        ) : (
          <div />
        )}
        <div className="text-center text-muted">{g.status}</div>
        <div className="min-w-[70px] text-right tabular-nums text-muted">
          WIN <span className="font-semibold text-gold-2">{money(g.pendingWin)}</span>
        </div>
      </section>

      <section className="relative flex-1 overflow-hidden px-2 pt-2">
        {(g.bonusType === "TRAIL" || g.bonusType === "PISTOLS") && (
          <div className="absolute right-3 top-0 z-10 flex items-center gap-2 rounded-b-lg border border-gold/40 bg-bronze px-2.5 py-1 text-[10px] tracking-[0.1em] text-gold-2">
            <span>{c.collector.label}</span>
            <span className="flex gap-0.5 opacity-80">
              {Array.from({ length: Math.min(g.bullet, 12) }, (_, i) => (
                <span key={i} className="inline-block h-2 w-1 rounded-sm bg-gold" />
              ))}
            </span>
            <span className="font-bold text-gold">{g.bullet}</span>
          </div>
        )}
        <div className="relative mx-auto grid grid-cols-6 gap-[3px] rounded-xl bg-ink/80 p-1.5 shadow-[inset_0_0_24px_#060402] sm:gap-1 sm:p-2 md:max-w-lg">
          {Array.from({ length: ROWS }, (_, r) =>
            Array.from({ length: COLS }, (_, cc) => {
              const item = g.grid[r]?.[cc];
              const pk = `${r}:${cc}`;
              const winner = g.winners.has(pk);
              const shot = g.shotAt && `${g.shotAt[0]}:${g.shotAt[1]}` === pk;
              const aId = item ? symbolAssetId(item) : "";
              const hasArt = aId in ASSET;
              return (
                <div
                  key={`${r}-${cc}-${g.dropTick}`}
                  className={cn(
                    "cow-cell relative aspect-square overflow-hidden rounded-md border border-gold/10 bg-surface-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
                    winner && "winner",
                    shot && "shot-target",
                  )}
                >
                  {item && (
                    <span
                      className={cn(
                        "cow-sym absolute inset-[6%] grid place-items-center rounded-md text-[14px] font-extrabold leading-none sm:text-[20px]",
                        symbolClass(item),
                      )}
                      style={
                        {
                          "--art": hasArt ? `url("${ASSET_ROOT}${ASSET[aId]}")` : undefined,
                        } as CSSProperties
                      }
                      aria-label={symbolLabel(item, c)}
                    >
                      {hasArt ? null : symbolLabel(item, c)}
                      {item.kind === "special" && !["clover", "goldclover"].includes(item.subtype) && (
                        <span className="cow-val absolute bottom-0.5 right-0.5 rounded bg-ink/70 px-0.5 text-[8px] text-fg">{item.value}</span>
                      )}
                    </span>
                  )}
                </div>
              );
            }),
          )}
        </div>

        <div className="relative mx-auto mt-2 flex min-h-[68px] items-center gap-3 rounded-xl border border-border/60 bg-surface/60 px-3 py-2">
          <div className="relative flex h-[56px] w-[52px] shrink-0 flex-col items-center justify-center">
            <div className="absolute top-0 h-4 w-8 rounded-t-full border-2 border-bronze bg-ink" />
            <div className="z-10 mt-3 h-8 w-8 rounded-full border-2 border-bronze bg-surface-2" />
            <span className="absolute bottom-1 text-[7px] font-bold tracking-wider text-bronze">O'</span>
          </div>
          <div className="flex flex-col gap-0.5 text-xs leading-tight">
            <span className="font-display text-[9px] uppercase tracking-[0.16em] text-gold">{c.character.eyebrow}</span>
            <span className="font-display text-sm font-bold tracking-[0.08em] text-fg">{c.character.name}</span>
            <span className="text-muted">{g.char && c.character[g.char.replace("character.", "") as keyof typeof c.character]}</span>
          </div>
          {g.shotCount > 0 && (
            <div className="ml-auto flex flex-col items-center gap-0.5 text-[10px] tracking-wider text-muted">
              <span>{c.revolver.shots}</span>
              <span className="grid size-8 place-items-center rounded-full border-2 border-gold bg-ink text-sm font-bold text-gold">{g.shotCount}</span>
            </div>
          )}
        </div>
      </section>

      <section className="border-t border-border px-3 pb-3 pt-2">
        <div className="mx-auto flex max-w-lg flex-wrap items-end justify-between gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-[0.12em] text-muted">{c.controls.bet}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setBet(nextBet(g.bet, -1))}
                disabled={busyRef.current}
                className="grid size-7 place-items-center rounded bg-surface-2 text-muted hover:text-gold-2 disabled:opacity-40"
                aria-label="-"
              >
                <Minus className="size-4" />
              </button>
              <span className="w-12 text-center font-display text-sm font-bold tabular-nums text-gold-2">{money(g.bet)}</span>
              <button
                type="button"
                onClick={() => setBet(nextBet(g.bet, 1))}
                disabled={busyRef.current}
                className="grid size-7 place-items-center rounded bg-surface-2 text-muted hover:text-gold-2 disabled:opacity-40"
                aria-label="+"
              >
                <Plus className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setBet(BETS[BETS.length - 1])}
                disabled={busyRef.current}
                className="ml-1 h-7 rounded bg-surface-2 px-2 text-[10px] font-bold uppercase tracking-wider text-muted hover:text-gold-2 disabled:opacity-40"
              >
                {c.buttons.maxBet}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                if (g.autoplay > 0) {
                  patch({ autoplay: 0, status: c.status.ready });
                } else {
                  patch({ modal: "autoplay" });
                }
              }}
              className="flex h-8 items-center gap-1 rounded bg-surface-2 px-2.5 text-[10px] font-bold uppercase tracking-wider text-muted hover:text-gold-2"
            >
              {c.buttons.autoplay}
              {g.autoplay > 0 && <span className="tabular-nums text-gold">({g.autoplay})</span>}
            </button>
            <button
              type="button"
              onClick={() => patch({ turbo: !g.turbo })}
              className={cn(
                "flex h-8 items-center gap-1 rounded px-2.5 text-[10px] font-bold uppercase tracking-wider",
                g.turbo ? "bg-gold text-ink" : "bg-surface-2 text-muted hover:text-gold-2",
              )}
            >
              {c.buttons.turbo}
            </button>
            <button
              type="button"
              onClick={() => patch({ modal: "buy" })}
              disabled={busyRef.current}
              className="flex h-8 items-center gap-1 rounded bg-surface-2 px-2.5 text-[10px] font-bold uppercase tracking-wider text-muted hover:text-gold-2 disabled:opacity-40"
            >
              {c.buttons.buy}
            </button>
          </div>
        </div>
        <div className="mx-auto mt-2 flex max-w-lg items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => runSpinRef.current()}
            disabled={busyRef.current || !g.credits}
            className="flex h-14 w-44 items-center justify-center gap-2 rounded-xl border-2 border-gold bg-[radial-gradient(circle_at_30%_22%,var(--color-gold-2),var(--color-gold)_40%,var(--color-bronze))] font-display text-sm font-bold uppercase tracking-[0.16em] text-ink shadow-lg disabled:opacity-40"
          >
            <Zap className="size-4" />
            {c.buttons.spin}
            <small className="ml-1 text-[10px] tabular-nums">{money(g.bet)}</small>
          </button>
        </div>
      </section>

      <footer className="flex items-center justify-between border-t border-border px-3 py-1.5 text-[10px] tracking-wider text-muted">
        <span>{c.footer.rtp}</span>
        <button type="button" onClick={() => patch({ modal: "paytable" })} className="uppercase hover:text-gold-2">
          {c.buttons.paytable}
        </button>
      </footer>

      {g.modal === "paytable" && (
        <Modal onClose={() => patch({ modal: null })} title={c.modal.paytableTitle} subtitle={c.modal.paytableIntro}>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {paytableRows.map((row) => (
              <div key={row.id} className="flex flex-col items-center gap-1 rounded-lg bg-surface-2 p-2">
                <span className={cn("cow-sym h-10 w-10 rounded border border-gold/10 bg-ink grid place-items-center text-xs font-bold text-gold-2", row.id)} style={{ "--art": art(row.id) } as CSSProperties}>
                  {"10"}
                </span>
                <span className="text-[10px] text-muted">{row.name}</span>
                <span className="text-[10px] font-bold text-gold-2">{row.range}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted">{c.modal.featureText}</p>
          <p className="mt-3 text-xs leading-relaxed text-muted">{c.modal.bonusText}</p>
          <p className="mt-3 text-xs leading-relaxed text-muted">{c.modal.gambleText}</p>
          <p className="mt-3 text-[10px] text-muted">{c.modal.disclosure}</p>
        </Modal>
      )}

      {g.modal === "autoplay" && (
        <Modal onClose={() => patch({ modal: null })} title={c.modal.autoplayTitle} subtitle={c.modal.autoplayIntro}>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[10, 25, 50, 100, 250, 500, 1000].map((n) => (
              <button key={n} type="button" onClick={() => startAutoplay(n)} className="h-10 rounded-lg bg-surface-2 font-display text-sm tabular-nums text-gold-2 hover:bg-bronze/40">
                {fill(c.autoplay.spins, { count: n })}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {g.modal === "buy" && (
        <Modal onClose={() => patch({ modal: null })} title={c.modal.buyTitle} subtitle={c.modal.buyIntro}>
          <div className="mt-4 flex flex-col gap-2">
            {BUY_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => buyFeature(opt)}
                className="flex items-center justify-between rounded-lg border border-border bg-surface-2 p-3 text-left hover:border-gold/60"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-display text-sm font-bold text-gold-2">{c.buy[opt.nameKey]}</span>
                  <span className="text-[11px] text-muted">{c.buy[opt.descKey]}</span>
                </div>
                <span className="shrink-0 pl-3 font-display text-sm tabular-nums text-gold">{fill(c.buy.price, { amount: opt.price })}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {g.modal === "gamble" && <GambleModal type={g.bonusType} c={c} onChoice={handleGamble} />}

      {g.modal === "deposit" && (
        <DepositModal
          lang={g.lang}
          c={c}
          twintPhone={g.twintPhone}
          twintName={g.twintName}
          pending={g.pending}
          onClose={() => patch({ modal: null })}
          onRefresh={() =>
            void getWallet()
              .then((w) => patch({ twintPhone: w.twintPhone, twintName: w.twintName, pending: w.pending, credits: w.credits }))
              .catch(() => undefined)
          }
        />
      )}

      {g.toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center">
          <div className="rounded-lg border border-gold/30 bg-surface-2 px-4 py-2 text-center text-sm font-medium text-gold-2 shadow-lg">{g.toast}</div>
        </div>
      )}

      {g.joy > 0 && (
        <div key={g.joy} className="pointer-events-none fixed inset-0 z-[60] animate-[cowConfetti_.9s_both]">
          {Array.from({ length: 28 }, (_, i) => (
            <span
              key={i}
              className="absolute h-2 w-2 rounded-sm"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${-10 + Math.random() * 40}%`,
                background: ["var(--color-gold)", "var(--color-bronze)", "var(--color-gold-2)", "var(--color-win)"][i % 4],
                animation: `cowConfettiFall ${0.6 + Math.random() * 0.5}s ${Math.random() * 0.3}s both`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Modal({ onClose, title, subtitle, children }: { onClose: () => void; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/70 sm:items-center" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="tomb-panel w-full max-w-md rounded-t-2xl p-5 sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg text-gold-2">{title}</h2>
          <button type="button" onClick={onClose} className="grid size-10 place-items-center text-muted hover:text-gold-2" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        {subtitle && <p className="mt-2 text-sm leading-relaxed text-muted">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}

function GambleModal({ type, c, onChoice }: { type: BonusType | null; c: Copy; onChoice: (choice: "play" | "upgradeTrail" | "upgradePistols" | { cash: true; roll: number }) => void }) {
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [doneChoice, setDoneChoice] = useState<"play" | "collect" | null>(null);
  const [roll, setRoll] = useState(0);
  const count = type === "SALOON" ? 4 : 8;
  const chamberRef = useRef<HTMLDivElement>(null);

  const spin = () => {
    if (spinning) return;
    setSpinning(true);
    setResult(null);
    setDoneChoice(null);
    const chambers = chamberRef.current?.children;
    if (!chambers) return;
    let idx = 0;
    const timer = window.setInterval(() => {
      for (const ch of Array.from(chambers)) ch.classList.remove("active");
      chambers[idx % count]?.classList.add("active");
      idx++;
      if (idx > count + 4) {
        window.clearInterval(timer);
        const r = Math.floor(Math.random() * count) + 1;
        setRoll(r);
        for (const ch of Array.from(chambers)) ch.classList.remove("active");
        chambers[r - 1]?.classList.add("active");
        if (r === 1) {
          const bonus = type === "SALOON" ? c.bonus.trail : c.bonus.pistols;
          setResult(fill(c.modal.upgrade, { bonus }));
          setDoneChoice("play");
        } else {
          setResult(c.modal.instant);
          setDoneChoice("collect");
        }
        setSpinning(false);
      }
    }, 95);
  };

  const handleDone = () => {
    if (doneChoice === "play") {
      onChoice(type === "SALOON" ? "upgradeTrail" : "upgradePistols");
    } else {
      onChoice({ cash: true, roll });
    }
  };

  return (
    <Modal onClose={() => onChoice("play")} title={c.modal.gambleTitle} subtitle={c.modal.playPrompt}>
      <div className="mt-4 flex justify-center gap-1.5" ref={chamberRef}>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="chamber flex h-10 w-10 items-center justify-center rounded-full border-2 border-border bg-surface-2 font-display text-sm text-muted">
            {i + 1}
          </div>
        ))}
      </div>
      {result && <p className="mt-4 text-center text-sm text-gold-2">{result}</p>}
      <div className="mt-4 flex gap-2">
        {doneChoice ? (
          <button type="button" onClick={handleDone} className="h-10 flex-1 rounded-lg border-2 border-gold bg-gold font-display text-sm font-bold tracking-wider text-ink">
            {doneChoice === "play" ? c.buttons.play : c.buttons.collect}
          </button>
        ) : (
          <>
            <button type="button" onClick={() => onChoice("play")} className="h-10 flex-1 rounded-lg border-2 border-gold bg-gold font-display text-sm font-bold tracking-wider text-ink">
              {c.buttons.play}
            </button>
            <button type="button" onClick={spin} disabled={spinning} className="h-10 flex-1 rounded-lg border border-border bg-surface-2 font-display text-sm font-bold tracking-wider text-muted hover:text-gold-2 disabled:opacity-50">
              {c.buttons.gamble}
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}

function DepositModal({ lang, c, twintPhone, twintName, pending, onClose, onRefresh }: { lang: Lang; c: Copy; twintPhone: string; twintName: string; pending: DepositRow[]; onClose: () => void; onRefresh: () => void }) {
  const [chf, setChf] = useState(20);
  const [method, setMethod] = useState<"twint" | "cash">("twint");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [instant, setInstant] = useState(false);

  const submit = async () => {
    setBusy(true);
    setErr("");
    try {
      const res = await requestDeposit({ data: { chf, method } });
      if (res.instant) {
        setInstant(true);
        onRefresh();
      } else {
        onRefresh();
        onClose();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  };

  const moneyFmt = (n: number) => currency(n * 100, lang);

  return (
    <Modal onClose={onClose} title="Aufladen" subtitle={`${chf} CHF → ${moneyFmt(chf)}`}>
      <div className="mt-4 grid grid-cols-5 gap-1.5">
        {[10, 20, 50, 100, 200].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setChf(n)}
            className={cn("h-11 rounded-md font-display text-sm tabular-nums", chf === n ? "border-2 border-gold-2 bg-gold text-ink" : "bg-surface-2 text-gold-2")}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setMethod("twint")}
          className={cn(
            "flex h-10 items-center justify-center gap-1.5 rounded-md font-display text-xs uppercase tracking-[0.14em]",
            method === "twint" ? "border-2 border-gold-2 bg-gold text-ink" : "bg-surface-2 text-gold-2",
          )}
        >
          <Smartphone className="size-4" />
          TWINT
        </button>
        <button
          type="button"
          onClick={() => setMethod("cash")}
          className={cn(
            "flex h-10 items-center justify-center gap-1.5 rounded-md font-display text-xs uppercase tracking-[0.14em]",
            method === "cash" ? "border-2 border-gold-2 bg-gold text-ink" : "bg-surface-2 text-gold-2",
          )}
        >
          Bar
        </button>
      </div>
      {method === "twint" ? (
        <div className="mt-3 rounded-lg border border-gold/25 bg-ink/40 p-3 text-center">
          {twintPhone ? (
            <>
              {twintName && <p className="font-display text-xs uppercase tracking-[0.16em] text-gold">{twintName}</p>}
              <p className="mt-1 font-display text-2xl tabular-nums tracking-wide text-gold-2">{twintPhone}</p>
              <p className="mt-2 text-xs text-muted">Geld senden, Betreff: Casino</p>
            </>
          ) : (
            <p className="text-sm text-muted">Keine TWINT-Nummer hinterlegt.</p>
          )}
        </div>
      ) : (
        <p className="mt-3 text-center text-sm text-muted">Barzahlung direkt beim Betreiber.</p>
      )}
      {instant && <p className="mt-2 text-center text-sm font-bold text-gold-2">Gutschrift erfolgt!</p>}
      {err && <p className="mt-2 text-center text-sm text-red-400">{err}</p>}
      {pending.length > 0 && (
        <p className="mt-2 text-center text-xs text-muted">
          Offen: {pending[0].chf} CHF
        </p>
      )}
      <button
        type="button"
        disabled={busy || (method === "twint" && !twintPhone)}
        onClick={() => void submit()}
        className="mt-4 h-12 w-full rounded-md border-2 border-gold-2 bg-[radial-gradient(circle_at_30%_22%,var(--color-gold-2),var(--color-gold)_40%,var(--color-bronze))] font-display tracking-[0.16em] text-ink disabled:opacity-40"
      >
        {busy ? "…" : "Anfordern"}
      </button>
    </Modal>
  );
}