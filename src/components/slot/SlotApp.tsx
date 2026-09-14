import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  BookOpen,
  Banknote,
  House,
  LayoutDashboard,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import { LogButton, PlayLogSheet } from "@/components/casino/PlayLog";
import ReelsCanvas, { type SlotAssets } from "@/components/slot/ReelsCanvas";
import { audio } from "@/lib/slot/audio";
import { t } from "@/lib/slot/copy";
import { signOut } from "@/lib/auth/client";
import { Link } from "@tanstack/react-router";
import { getWallet, requestDeposit, type DepositRow } from "@/lib/wallet";
import { commitRound, type PlayKind } from "@/lib/play";
import {
  BET_STEPS,
  BUY_EXPAND_MIN_REELS,
  BUY_EXPAND_MULT,
  BUY_FS_MULT,
  EXPANDABLE,
  LINE_PAYS,
  PAYLINES,
  PICTURE_SYMBOLS,
  REELS,
  ROWS,
  ROYAL_SYMBOLS,
  SCATTER_PAYS,
  evaluateSpin,
  formatCredits,
  freeSpinsFromScatters,
  gridFromStops,
  nextLineStep,
  spinStops,
  spinStopsGuaranteedBooks,
  totalBet,
  type SymbolId,
} from "@/lib/slot/engine";
import { loadSave, writeSave } from "@/lib/slot/persist";
import type { GamePhase, Lang, SpinResult } from "@/lib/slot/types";
import { cn } from "@/lib/utils";

const TILE_FILES: Record<SymbolId, string> = {
  book: "/symbols/book.png?v=fill",
  explorer: "/symbols/explorer.png?v=fill",
  priestess: "/symbols/priestess.png?v=fill",
  ankh: "/symbols/ankh.png?v=fill",
  anubis: "/symbols/anubis.png?v=fill",
  statue: "/symbols/statue.png?v=fill",
  scarab: "/symbols/scarab.png?v=fill",
  ace: "/symbols/ace.png?v=fill",
  king: "/symbols/king.png?v=fill",
  queen: "/symbols/queen.png?v=fill",
  jack: "/symbols/jack.png?v=fill",
  ten: "/symbols/ten.png?v=fill",
};

const BOOK_OPEN_SRC = "/symbols/book-open.png?v=fill";
const BOOK_PAGE_SRC = "/symbols/book-page.png?v=fill";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

async function loadAssets(): Promise<SlotAssets> {
  if (typeof document !== "undefined" && document.fonts?.load) {
    await document.fonts.load("700 48px Cinzel").catch(() => undefined);
  }
  const ids = Object.keys(TILE_FILES) as SymbolId[];
  const imgs = await Promise.all(ids.map((id) => loadImage(TILE_FILES[id])));
  const extra = await Promise.all([loadImage(BOOK_OPEN_SRC), loadImage(BOOK_PAGE_SRC)]);
  const tiles = {} as SlotAssets["tiles"];
  ids.forEach((id, i) => {
    tiles[id] = imgs[i];
  });
  return { tiles, bookOpen: extra[0], bookPage: extra[1] };
}

function scatterPositions(grid: SymbolId[][]) {
  const out: { reel: number; row: number }[] = [];
  grid.forEach((col, reel) =>
    col.forEach((s, row) => {
      if (s === "book") out.push({ reel, row });
    }),
  );
  return out;
}

function winTier(win: number, bet: number): "small" | "great" | "mega" | "epic" | null {
  if (win <= 0) return null;
  const x = win / Math.max(1, bet);
  if (x >= 50) return "epic";
  if (x >= 20) return "mega";
  if (x >= 8) return "great";
  return "small";
}

type BurstTier = "chip" | "gold" | "great" | "mega" | "epic";

function stakeMult(win: number, bet: number): number {
  return win / Math.max(1, bet);
}

function burstTier(win: number, bet: number): BurstTier | null {
  if (win <= 0) return null;
  const x = stakeMult(win, bet);
  if (x >= 50) return "epic";
  if (x >= 20) return "mega";
  if (x >= 8) return "great";
  if (x > 1) return "gold";
  return "chip";
}

function burstMs(tier: BurstTier, turbo: boolean, reduced: boolean): number {
  if (reduced) return 480;
  const map = { chip: 820, gold: 1300, great: 2600, mega: 4200, epic: 5800 };
  const cut = turbo ? (tier === "epic" || tier === "mega" ? 0.7 : 0.5) : 1;
  return Math.round(map[tier] * cut);
}

function formatMult(x: number): string {
  if (x >= 10) return `×${Math.round(x)}`;
  return `×${x.toFixed(1).replace(/\.0$/, "")}`;
}

export function SlotApp({
  edition: initialEdition = "classic",
  admin = false,
}: {
  edition?: "classic" | "ramon";
  admin?: boolean;
}) {
  const [phase, setPhase] = useState<GamePhase>("start");
  const [assets, setAssets] = useState<SlotAssets | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [lang, setLang] = useState<Lang>("de");
  const [muted, setMuted] = useState(false);
  const [credits, setCredits] = useState(0);
  const [lines, setLines] = useState(25);
  const [betPerLine, setBetPerLine] = useState(1);
  const [biggestWin, setBiggestWin] = useState(0);
  const [stops, setStops] = useState<number[]>(() => [4, 10, 7, 14, 5, 18]);
  const [spinning, setSpinning] = useState(false);
  const [pendingStops, setPendingStops] = useState<number[] | null>(null);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [displayWin, setDisplayWin] = useState(0);
  const [winBurst, setWinBurst] = useState<{ amount: number; bet: number; id: number } | null>(null);
  const [highlightLine, setHighlightLine] = useState<number | null>(null);
  const [expanding, setExpanding] = useState(false);
  const [bookReveal, setBookReveal] = useState(false);
  const [bookBlind, setBookBlind] = useState(false);
  const [freeSpins, setFreeSpins] = useState(0);
  const [expandSymbols, setExpandSymbols] = useState<SymbolId[]>([]);
  const [bonusPick, setBonusPick] = useState<SymbolId | null>(null);
  const [showPaytable, setShowPaytable] = useState(false);
  const [showAuto, setShowAuto] = useState(false);
  const [autoLeft, setAutoLeft] = useState(0);
  const [stopOnBonus, setStopOnBonus] = useState(true);
  const [gambleStake, setGambleStake] = useState(0);
  const [gambleRound, setGambleRound] = useState(0);
  const [cardFlip, setCardFlip] = useState<"red" | "black" | null>(null);
  const [status, setStatus] = useState("");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [booted, setBooted] = useState(false);
  const [turbo, setTurbo] = useState(false);
  const [showBuy, setShowBuy] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);
  const [twintPhone, setTwintPhone] = useState("");
  const [twintName, setTwintName] = useState("");
  const [pendingDeposits, setPendingDeposits] = useState<DepositRow[]>([]);
  const [walletReady, setWalletReady] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [buyKind, setBuyKind] = useState<null | "freeSpins" | "expand">(null);
  const [paidExpand, setPaidExpand] = useState<SymbolId | null>(null);
  const [fsAward, setFsAward] = useState(10);
  const [fsSummary, setFsSummary] = useState(false);
  const [edition, setEdition] = useState<"classic" | "ramon">(initialEdition);

  const lineHintRef = useRef(0);
  const busy = useRef(false);
  const creditsRef = useRef(credits);
  const countRaf = useRef(0);
  const fsRef = useRef({ left: 0, symbols: [] as SymbolId[] });
  const autoRef = useRef({ left: 0, stopBonus: true });
  const phaseRef = useRef(phase);
  const turboRef = useRef(false);
  const skipSpinRef = useRef(false);
  const paidExpandRef = useRef<{ symbol: SymbolId; minReels: number } | null>(null);
  const boughtFsRef = useRef<SymbolId | null>(null);
  const fsAwardRef = useRef(10);
  const fsBankRef = useRef(0);
  const roundStakeRef = useRef(0);
  const pendingKindRef = useRef<PlayKind>("spin");
  const editionRef = useRef(edition);
  editionRef.current = edition;

  creditsRef.current = credits;
  phaseRef.current = phase;
  autoRef.current = { left: autoLeft, stopBonus: stopOnBonus };
  fsRef.current = { left: freeSpins, symbols: expandSymbols };
  turboRef.current = turbo;

  const copy = t(lang);
  const bet = totalBet(lines, betPerLine);
  const expandArmed = Boolean(paidExpand) && freeSpins === 0;
  const spinCost = expandArmed ? bet * BUY_EXPAND_MULT : bet;
  const grid = useMemo(() => gridFromStops(stops), [stops]);
  const brandTitle = edition === "ramon" ? "Book of Ra(mon)" : copy.title;
  const brandSub = edition === "ramon" ? "Made by Crydo5" : copy.subtitle;
  const gram = edition === "ramon";
  const money = (n: number) => formatCredits(n, lang, gram);
  const creditsLabel = gram ? (lang === "de" ? "Gramm" : "Grams") : copy.credits;

  const recordPlay = useCallback((kind: PlayKind, stake: number, payout: number, detail = "") => {
    const game = editionRef.current === "ramon" ? "ramon" : "book";
    void commitRound({ data: { game, kind, stake, payout, detail } })
      .then((r) => {
        if (typeof r.credits === "number") setCredits(r.credits);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const s = loadSave();
    setLang(s.lang);
    setMuted(s.muted);
    setLines(s.lines);
    setBetPerLine(s.betPerLine);
    setBiggestWin(s.biggestWin);
    setTurbo(s.turbo);
    setBooted(true);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const fn = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  useEffect(() => {
    void loadAssets()
      .then(setAssets)
      .catch(() => setLoadError(true));
  }, []);

  useEffect(() => {
    audio.setMuted(muted);
  }, [muted]);

  useEffect(() => {
    let live = true;
    void getWallet()
      .then((w) => {
        if (!live) return;
        setCredits(w.credits);
        setTwintPhone(w.twintPhone);
        setTwintName(w.twintName);
        setPendingDeposits(w.pending);
        setWalletReady(true);
      })
      .catch(() => {
        if (live) setWalletReady(true);
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (pendingDeposits.length === 0) return;
    const tick = () => {
      void getWallet()
        .then((w) => {
          setTwintPhone(w.twintPhone);
          setTwintName(w.twintName);
          setPendingDeposits(w.pending);
          if (w.credits > creditsRef.current) setCredits(w.credits);
        })
        .catch(() => undefined);
    };
    const id = window.setInterval(tick, 8000);
    return () => window.clearInterval(id);
  }, [pendingDeposits.length]);

  useEffect(() => {
    if (!booted) return;
    const persist = () =>
      writeSave({
        version: 1,
        credits: creditsRef.current,
        lines,
        betPerLine,
        lang,
        muted,
        biggestWin,
        turbo,
      });
    persist();
    const onHide = () => {
      if (document.visibilityState === "hidden") persist();
      else audio.resume();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", persist);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", persist);
    };
  }, [booted, credits, lines, betPerLine, lang, muted, biggestWin, turbo]);

  const countUp = useCallback((from: number, to: number, ms: number) => {
    cancelAnimationFrame(countRaf.current);
    if (to <= from || ms < 80) {
      setDisplayWin(to);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const u = Math.min(1, (now - start) / ms);
      setDisplayWin(Math.round(from + (to - from) * (1 - (1 - u) ** 3)));
      if (u < 1) countRaf.current = requestAnimationFrame(tick);
    };
    countRaf.current = requestAnimationFrame(tick);
  }, []);

  const finishPay = useCallback(
    (res: SpinResult, awarded: boolean) => {
      setExpanding(false);
      setHighlightLine(null);
      setWinBurst(null);
      const fs = fsRef.current;
      const goingGamble =
        awarded && res.totalWin > 0 && fs.left === 0 && !res.bonusTrigger && autoRef.current.left === 0 && !turboRef.current;
      if (pendingKindRef.current !== "free_spin" && !goingGamble) {
        recordPlay(pendingKindRef.current, roundStakeRef.current, res.totalWin);
        roundStakeRef.current = 0;
      }
      if (res.bonusTrigger) {
        const award = freeSpinsFromScatters(res.scatterCount) || 10;
        fsAwardRef.current = award;
        setFsAward(award);
        const bought = boughtFsRef.current;
        if (bought && fs.left === 0) {
          boughtFsRef.current = null;
          setExpandSymbols([bought]);
          setBonusPick(bought);
          setFreeSpins(award);
          fsBankRef.current = 0;
          setAutoLeft(0);
          audio.bonus();
          setStatus(`${copy.freeSpins}: ${award}`);
          window.setTimeout(() => {
            busy.current = false;
            setPhase("idle");
          }, turboRef.current ? 500 : 1200);
          return;
        }
        if (fs.left > 0) {
          setFreeSpins((n) => n - 1 + award);
          setAutoLeft(0);
          setStatus(copy.retrigger);
          audio.bonus();
          const remaining = EXPANDABLE.filter((s) => !fs.symbols.includes(s));
          if (!remaining.length) {
            window.setTimeout(() => {
              busy.current = false;
              setPhase("idle");
            }, turboRef.current ? 400 : 1100);
            return;
          }
          setBonusPick(null);
          setPhase("bonusSelect");
          busy.current = false;
          return;
        }
        setPhase("bonusSelect");
        setBonusPick(null);
        audio.bonus();
        busy.current = false;
        return;
      }

      if (fs.left > 1) {
        setFreeSpins((n) => n - 1);
        busy.current = false;
        setPhase("idle");
        return;
      }
      if (fs.left === 1) {
        setFreeSpins(0);
        setExpandSymbols([]);
        audio.stopTombTheme();
        const total = fsBankRef.current;
        fsBankRef.current = 0;
        if (total > 0) {
          const betNow = totalBet(lines, betPerLine);
          const pop = burstTier(total, betNow) ?? "gold";
          const ms = burstMs(pop, turboRef.current, reducedMotion);
          setFsSummary(true);
          setWinBurst({ amount: total, bet: betNow, id: Date.now() });
          countUp(0, total, Math.max(400, Math.round(ms * 0.75)));
          audio.whoosh();
          const tier = winTier(total, betNow);
          if (tier) audio.win(tier);
          setPhase("fsTotal");
          window.setTimeout(() => {
            setWinBurst(null);
            setFsSummary(false);
            busy.current = false;
            setPhase("idle");
          }, Math.max(ms, turboRef.current ? 1800 : 3200));
          return;
        }
      }

      if (awarded && res.totalWin > 0 && fs.left === 0 && autoRef.current.left === 0 && !turboRef.current) {
        setGambleStake(res.totalWin);
        setGambleRound(0);
        setCardFlip(null);
        setPhase("gamble");
        busy.current = false;
        return;
      }

      busy.current = false;
      setPhase("idle");
    },
    [copy.freeSpins, copy.retrigger, betPerLine, countUp, lines, recordPlay, reducedMotion],
  );

  const payOut = useCallback(
    (res: SpinResult) => {
      setPhase("paying");
      const betNow = totalBet(lines, betPerLine);
      const tier = winTier(res.totalWin, betNow);
      const pop = burstTier(res.totalWin, betNow);
      const popMs = pop ? burstMs(pop, turboRef.current, reducedMotion) : 0;
      if (tier) audio.win(tier);
      if (fsRef.current.left > 0) fsBankRef.current += res.totalWin;
      if (fsRef.current.left > 0) {
        recordPlay("free_spin", 0, res.totalWin);
      }
      if (res.totalWin > 0 && pop) {
        setCredits((c) => c + res.totalWin);
        setBiggestWin((b) => Math.max(b, res.totalWin));
        setWinBurst({ amount: res.totalWin, bet: betNow, id: Date.now() });
        const tallyMs = Math.max(220, Math.round(popMs * 0.7));
        countUp(0, res.totalWin, tallyMs);
        audio.tally(tallyMs);
      }
      const linesToShow = res.lineWins;
      let i = 0;
      if (linesToShow.length) {
        setHighlightLine(linesToShow[0].line);
        const cycle = turboRef.current ? 220 : 850;
        const iv = window.setInterval(() => {
          i = (i + 1) % linesToShow.length;
          setHighlightLine(linesToShow[i].line);
          audio.tick();
        }, cycle);
        const hold = Math.max(
          popMs,
          turboRef.current
            ? Math.max(280, Math.min(720, 160 + linesToShow.length * 90))
            : Math.max(1100, Math.min(2800, 700 + linesToShow.length * 400)),
        );
        window.setTimeout(
          () => {
            window.clearInterval(iv);
            finishPay(res, true);
          },
          hold,
        );
      } else {
        const wait = Math.max(
          popMs,
          res.totalWin > 0
            ? turboRef.current ? 220 : 900
            : turboRef.current ? 80 : 420,
        );
        window.setTimeout(() => finishPay(res, res.totalWin > 0), wait);
      }
    },
    [betPerLine, countUp, finishPay, lines, recordPlay, reducedMotion],
  );

  const onLanded = useCallback(() => {
    audio.stopDrone();
    const res = result;
    if (!res) {
      busy.current = false;
      setSpinning(false);
      setPhase("idle");
      return;
    }
    setSpinning(false);
    setStops(res.stops);
    setPendingStops(null);
    const afterLand = () => {
      if (res.expandLayers.length) {
        setExpanding(true);
        audio.expand();
        setPhase("expanding");
        return;
      }
      payOut(res);
    };
    if (res.scatterCount >= 3) {
      setBookReveal(true);
      audio.bookOpen();
      audio.startTombTheme();
      const wait = turboRef.current || reducedMotion ? 1100 : 2400;
      const flashAt = wait - (turboRef.current || reducedMotion ? 380 : 700);
      window.setTimeout(() => {
        setBookBlind(true);
        audio.whoosh();
      }, Math.max(200, flashAt));
      window.setTimeout(afterLand, wait);
      window.setTimeout(() => setBookBlind(false), wait + (turboRef.current ? 480 : 900));
    } else {
      afterLand();
    }
  }, [payOut, reducedMotion, result]);

  const onExpandDone = useCallback(() => {
    const res = result;
    if (!res || phaseRef.current !== "expanding") return;
    payOut(res);
  }, [payOut, result]);

  const onReelStop = useCallback((index: number) => {
    audio.reelStop(index);
  }, []);

  const doSpin = useCallback(() => {
    if (busy.current || spinning) return;
    if (phase !== "idle") return;
    skipSpinRef.current = false;
    const fs = fsRef.current;
    const paid = paidExpandRef.current;
    const boughtFs = boughtFsRef.current;
    const usingFree = fs.left > 0 && fs.symbols.length > 0;
    const cost = usingFree || boughtFs
      ? 0
      : paid
        ? totalBet(lines, betPerLine) * BUY_EXPAND_MULT
        : totalBet(lines, betPerLine);
    if (!usingFree && creditsRef.current < cost) {
      if (paid) {
        paidExpandRef.current = null;
        setPaidExpand(null);
        setStatus(copy.expandOff);
      } else {
        setStatus(copy.broke);
      }
      setAutoLeft(0);
      return;
    }
    busy.current = true;
    setDisplayWin(0);
    setWinBurst(null);
    setHighlightLine(null);
    setResult(null);
    setExpanding(false);
    setBookReveal(false);
    setBookBlind(false);
    setStatus("");
    if (!usingFree) setCredits((c) => c - cost);
    roundStakeRef.current = cost;
    pendingKindRef.current = usingFree ? "free_spin" : paid ? "expand" : "spin";
    const nextStops = boughtFs ? spinStopsGuaranteedBooks() : spinStops();
    const expandSyms = usingFree ? fs.symbols : paid && !boughtFs && paid.symbol ? [paid.symbol] : [];
    const minReels = 2;
    const res = evaluateSpin(nextStops, betPerLine, lines, expandSyms, minReels);
    if (paid) setPaidExpand(paid.symbol);
    setResult(res);
    setPendingStops(nextStops);
    setSpinning(true);
    setPhase("spinning");
    audio.start();
    audio.startDrone(turboRef.current);
    if (res.scatterCount >= 2) audio.scatter();
  }, [betPerLine, copy.broke, copy.expandOff, lines, phase, spinning]);

  useEffect(() => {
    if (phase !== "idle") return;
    if (fsRef.current.left > 0 && fsRef.current.symbols.length) {
      const tmr = window.setTimeout(() => doSpin(), turboRef.current || reducedMotion ? 280 : 1100);
      return () => window.clearTimeout(tmr);
    }
    if (autoRef.current.left > 0) {
      const tmr = window.setTimeout(() => {
        setAutoLeft((n) => Math.max(0, n - 1));
        doSpin();
      }, turboRef.current ? 70 : 380);
      return () => window.clearTimeout(tmr);
    }
  }, [phase, doSpin, reducedMotion, freeSpins, autoLeft]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      if (e.repeat) return;
      e.preventDefault();
      if (phase === "start") return;
      if (showPaytable || showAuto || showBuy || showDeposit || buyKind) return;
      if (phase === "gamble") return;
      if (phase === "bonusSelect") return;
      if (autoLeft > 0) {
        setAutoLeft(0);
        return;
      }
      if (phase === "spinning") {
        skipSpinRef.current = true;
        audio.stopSlam();
        return;
      }
      doSpin();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [autoLeft, buyKind, doSpin, phase, showAuto, showBuy, showDeposit, showPaytable]);

  const enter = (ed: "classic" | "ramon" = edition) => {
    setEdition(ed);
    document.title = ed === "ramon" ? "Book of Ra(mon)" : "Book of Ra";
    audio.unlock();
    audio.setMuted(muted);
    audio.enter();
    setPhase("idle");
  };

  const changeBet = (dir: 1 | -1) => {
    if (busy.current || freeSpins > 0) return;
    audio.chip();
    const idx = BET_STEPS.indexOf(betPerLine as (typeof BET_STEPS)[number]);
    const next = BET_STEPS[Math.max(0, Math.min(BET_STEPS.length - 1, idx + dir))];
    setBetPerLine(next);
  };

  const changeLines = (dir: 1 | -1) => {
    if (busy.current || freeSpins > 0) return;
    audio.click();
    setLines((n) => {
      const next = nextLineStep(n, dir);
      window.clearTimeout(lineHintRef.current);
      setHighlightLine(next - 1);
      lineHintRef.current = window.setTimeout(() => {
        if (phaseRef.current === "idle") setHighlightLine(null);
      }, 1100);
      return next;
    });
  };

  const startBonus = (symbol: SymbolId) => {
    audio.pick();
    setExpandSymbols((prev) => (prev.includes(symbol) ? prev : [...prev, symbol]));
    setBonusPick(symbol);
    if (fsRef.current.left <= 0) {
      fsBankRef.current = 0;
      setFreeSpins(fsAwardRef.current || 10);
    }
    if (autoRef.current.stopBonus) setAutoLeft(0);
    window.setTimeout(() => {
      setPhase("idle");
    }, turboRef.current ? 400 : 900);
  };

  const confirmBuy = (kind: "freeSpins" | "expand") => {
    const stake = totalBet(lines, betPerLine);
    const cost = kind === "freeSpins" ? stake * BUY_FS_MULT : stake * BUY_EXPAND_MULT;
    if (creditsRef.current < cost) {
      setStatus(copy.broke);
      return;
    }
    audio.click();
    setBuyKind(kind);
    setShowBuy(false);
  };

  const pickBoughtSymbol = (symbol: SymbolId) => {
    const kind = buyKind;
    if (!kind) return;
    const stake = totalBet(lines, betPerLine);
    if (kind === "freeSpins") {
      const cost = stake * BUY_FS_MULT;
      if (creditsRef.current < cost) {
        setStatus(copy.broke);
        setBuyKind(null);
        return;
      }
      audio.bonus();
      setCredits((c) => c - cost);
      recordPlay("buy_fs", cost, 0, symbol);
      setBuyKind(null);
      setAutoLeft(0);
      boughtFsRef.current = symbol;
      doSpin();
      return;
    }
    const cost = stake * BUY_EXPAND_MULT;
    if (creditsRef.current < cost) {
      setStatus(copy.broke);
      setBuyKind(null);
      return;
    }
    audio.click();
    paidExpandRef.current = { symbol, minReels: BUY_EXPAND_MIN_REELS };
    setPaidExpand(symbol);
    setBuyKind(null);
    doSpin();
  };

  const deactivateExpand = () => {
    if (freeSpins > 0) return;
    audio.click();
    paidExpandRef.current = null;
    setPaidExpand(null);
  };

  const collectGamble = () => {
    audio.cash();
    recordPlay("gamble", roundStakeRef.current, gambleStake);
    roundStakeRef.current = 0;
    setGambleStake(0);
    setPhase("idle");
  };

  const pickColor = (color: "red" | "black") => {
    if (cardFlip) return;
    const outcome: "red" | "black" = Math.random() < 0.5 ? "red" : "black";
    setCardFlip(outcome);
    const win = outcome === color;
    window.setTimeout(() => {
      if (win) {
        audio.gambleWin();
        const next = gambleStake * 2;
        setCredits((c) => c - gambleStake + next);
        setGambleStake(next);
        setBiggestWin((b) => Math.max(b, next));
        setGambleRound((r) => r + 1);
        setCardFlip(null);
        setDisplayWin(next);
        if (gambleRound + 1 >= 5) {
          recordPlay("gamble", roundStakeRef.current, next);
          roundStakeRef.current = 0;
          setGambleStake(0);
          setPhase("idle");
        }
      } else {
        audio.gambleLose();
        setCredits((c) => c - gambleStake);
        recordPlay("gamble", roundStakeRef.current, 0);
        roundStakeRef.current = 0;
        setGambleStake(0);
        setDisplayWin(0);
        setPhase("idle");
      }
    }, 700);
  };

  if (phase === "start") {
    return (
      <StartScreen
        copy={copy}
        ready={Boolean(assets)}
        error={loadError}
        lang={lang}
        muted={muted}
        featured={initialEdition}
        onLang={setLang}
        onMute={() => setMuted((m) => !m)}
        onEnter={() => enter(initialEdition)}
      />
    );
  }

  if (!assets) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg text-muted">
        {loadError ? copy.broke : "…"}
      </div>
    );
  }

  const canSpin =
    phase === "idle" &&
    !spinning &&
    freeSpins === 0 &&
    autoLeft === 0 &&
    credits >= spinCost;
  const controlsLocked =
    busy.current || spinning || freeSpins > 0 || phase === "bonusSelect" || phase === "gamble" || phase === "fsTotal";

  return (
    <div className="relative flex h-dvh max-h-dvh flex-col overflow-hidden bg-bg text-fg">
      <img
        src="/bg/tomb.jpg"
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      <div className="tomb-veil pointer-events-none absolute inset-0" />

      <header className="relative z-10 flex shrink-0 items-center justify-between gap-2 px-3 pb-0.5 pt-[max(0.4rem,env(safe-area-inset-top))] sm:px-4 sm:pt-[max(0.6rem,env(safe-area-inset-top))]">
        <div className="min-w-0">
          <h1 className="title-glow font-display text-lg font-semibold tracking-[0.18em] text-gold-2 text-balance sm:text-2xl">
            {brandTitle}
          </h1>
          <p className="hidden font-display text-[10px] uppercase tracking-[0.32em] text-gold min-[420px]:block sm:text-[11px]">
            {brandSub}
          </p>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Link to="/" aria-label="Lobby" className="tomb-panel grid size-10 place-items-center rounded-full text-gold-2 sm:size-11">
            <House className="size-4 sm:size-5" />
          </Link>
          <IconBtn
            label={lang.toUpperCase()}
            onClick={() => setLang((l) => (l === "de" ? "en" : "de"))}
          >
            <span className="font-display text-[10px] tracking-widest sm:text-xs">{lang.toUpperCase()}</span>
          </IconBtn>
          <IconBtn label={copy.paytable} onClick={() => setShowPaytable(true)}>
            <BookOpen className="size-4 sm:size-5" />
          </IconBtn>
          <IconBtn
            label={muted ? copy.off : copy.on}
            onClick={() => {
              audio.unlock();
              setMuted((m) => !m);
            }}
          >
            {muted ? <VolumeX className="size-4 sm:size-5" /> : <Volume2 className="size-4 sm:size-5" />}
          </IconBtn>
          {admin && (
            <Link to="/dashboard" aria-label="Dashboard" className="tomb-panel grid size-10 place-items-center rounded-full text-gold-2 sm:size-11">
              <LayoutDashboard className="size-4 sm:size-5" />
            </Link>
          )}
          {admin && (
            <Link to="/admin" aria-label="Freigaben" className="tomb-panel grid size-10 place-items-center rounded-full text-gold-2 sm:size-11">
              <ShieldCheck className="size-4 sm:size-5" />
            </Link>
          )}
          <LogButton onClick={() => setShowLog(true)} />
          <IconBtn label="Abmelden" onClick={() => void signOut("/login")}>
            <X className="size-4 sm:size-5" />
          </IconBtn>
        </div>
      </header>

      {freeSpins > 0 && (
        <div className="relative z-10 mx-auto mt-1 flex shrink-0 items-center gap-2 rounded-full tomb-panel px-3 py-0.5 font-display text-[11px] tracking-[0.18em] text-gold-2">
          {copy.freeSpins}: {freeSpins}
          {expandSymbols.length > 0 && (
            <span className="flex items-center">
              {expandSymbols.map((id, i) => (
                <img
                  key={`${id}-${i}`}
                  src={assets.tiles[id].src}
                  alt={copy.symbols[id]}
                  className="size-6 rounded-sm object-cover ring-1 ring-gold/50"
                />
              ))}
            </span>
          )}
        </div>
      )}

      {paidExpand && freeSpins === 0 && (
        <button
          type="button"
          onClick={deactivateExpand}
          className="relative z-10 mx-auto mt-1 flex shrink-0 items-center gap-2 rounded-full tomb-panel px-3 py-0.5 font-display text-[11px] tracking-[0.18em] text-gold-2"
        >
          {copy.buyArmed}: {copy.symbols[paidExpand]} · {BUY_EXPAND_MULT}×
          <X className="size-3.5 opacity-80" />
        </button>
      )}

      <div className="relative z-10 mx-auto flex min-h-0 w-full max-w-[1180px] flex-1 flex-col gap-2 px-2 pt-1 sm:px-3 landscape:flex-row landscape:items-stretch landscape:gap-3">
        <div className="relative mx-auto min-h-0 min-w-0 w-full flex-1">
          <div className="absolute inset-0 flex items-stretch justify-stretch">
            <div className="relative h-full w-full rounded-[22px] tomb-shrine p-1.5 sm:rounded-[28px] sm:p-2">
              <div className="pointer-events-none absolute inset-[7px] rounded-[16px] ring-1 ring-gold/40 sm:inset-[10px] sm:rounded-[18px]" />
              <ReelsCanvas
                assets={assets}
                grid={grid}
                spinning={spinning}
                stops={pendingStops}
                fromStops={stops}
                reducedMotion={reducedMotion}
                turbo={turbo}
                skipRef={skipSpinRef}
                wins={phase === "paying" || phase === "gamble" ? (result?.lineWins ?? []) : []}
                scatterRows={result && result.scatterCount >= 2 ? scatterPositions(grid) : []}
                expandLayers={expanding || phase === "paying" ? (result?.expandLayers ?? []) : []}
                expandSlow={freeSpins > 0}
                bookReveal={bookReveal}
                highlightLine={highlightLine}
                onLanded={onLanded}
                onReelStop={onReelStop}
                onExpandDone={onExpandDone}
              />
              {winBurst &&
                !fsSummary &&
                !["great", "mega", "epic"].includes(burstTier(winBurst.amount, winBurst.bet) ?? "") && (
                <WinBurst
                  key={winBurst.id}
                  amount={winBurst.amount}
                  bet={winBurst.bet}
                  live={displayWin}
                  lang={lang}
                  copy={copy}
                  reduced={reducedMotion}
                  fullscreen={false}
                  gram={gram}
                />
              )}
              {turbo && (
                <div className="pointer-events-none absolute right-4 top-3 rounded-full tomb-panel px-2.5 py-0.5 font-display text-[10px] tracking-[0.22em] text-gold-2">
                  {copy.turbo}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="relative z-10 flex w-full shrink-0 flex-col gap-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] landscape:w-[280px] landscape:justify-center">
          <div className="grid grid-cols-3 gap-2">
            <Meter label={creditsLabel} value={money(credits)} />
            <Meter label={copy.bet} value={money(spinCost)} gold />
            <Meter label={copy.win} value={money(displayWin)} gold />
          </div>
          {status && (
            <p className="text-center text-xs text-muted text-pretty sm:text-sm">{status}</p>
          )}

          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2 sm:gap-3">
            <div className="flex flex-col gap-1.5 sm:gap-2">
              <Stepper
                label={copy.lines}
                value={String(lines)}
                disabled={controlsLocked}
                onMinus={() => changeLines(-1)}
                onPlus={() => changeLines(1)}
              />
              <Stepper
                label={copy.betPerLine}
                value={gram ? (betPerLine * 0.1).toFixed(2) : String(betPerLine)}
                disabled={controlsLocked}
                onMinus={() => changeBet(-1)}
                onPlus={() => changeBet(1)}
              />
            </div>

            <button
              type="button"
              onClick={() => {
                audio.unlock();
                if (spinning) {
                  skipSpinRef.current = true;
                  audio.stopSlam();
                  return;
                }
                if (autoLeft > 0) {
                  setAutoLeft(0);
                  return;
                }
                doSpin();
              }}
              disabled={!canSpin && autoLeft === 0 && !spinning}
              className={cn(
                "size-[72px] shrink-0 rounded-full font-display text-base font-semibold tracking-[0.18em] uppercase transition-transform duration-150 ease-out sm:size-[92px] sm:text-lg landscape:size-[68px]",
                "border-2 border-gold-2 bg-[radial-gradient(circle_at_30%_22%,var(--color-gold-2),var(--color-gold)_40%,var(--color-bronze))] text-ink shadow-[0_0_22px_rgb(226_183_90_/_0.45),0_8px_24px_rgb(0_0_0_/_0.5)]",
                "hover:brightness-110 active:scale-[0.97] disabled:opacity-40",
              )}
            >
              {spinning ? copy.stop : autoLeft > 0 ? `${autoLeft}` : copy.start}
            </button>

            <div className="flex flex-col items-stretch gap-1.5 sm:gap-2">
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                <button
                  type="button"
                  aria-pressed={turbo}
                  onClick={() => {
                    audio.click();
                    setTurbo((v) => !v);
                  }}
                  className={cn(
                    "flex h-10 items-center justify-center gap-1 rounded-md border font-display text-[10px] uppercase tracking-[0.12em] sm:h-11 sm:text-xs sm:tracking-[0.16em]",
                    turbo
                      ? "border-gold bg-gold text-ink"
                      : "tomb-panel text-gold-2",
                  )}
                >
                  <Zap className="size-3.5" />
                  {copy.turbo}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    audio.click();
                    setShowAuto(true);
                  }}
                  disabled={controlsLocked}
                  className="tomb-panel h-10 rounded-md px-1 font-display text-[10px] uppercase tracking-[0.12em] text-gold-2 disabled:opacity-40 sm:h-11 sm:text-xs sm:tracking-[0.16em]"
                >
                  {copy.auto}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => {
                    audio.click();
                    setShowBuy(true);
                  }}
                  disabled={controlsLocked}
                  className={cn(
                    "flex h-10 items-center justify-center gap-1 rounded-md border font-display text-[10px] uppercase tracking-[0.12em] disabled:opacity-40 sm:h-11 sm:text-xs sm:tracking-[0.16em]",
                    paidExpand
                      ? "border-gold bg-gold text-ink"
                      : "tomb-panel text-gold-2",
                  )}
                >
                  <ShoppingBag className="size-3.5" />
                  {copy.buy}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    audio.click();
                    setShowDeposit(true);
                    void getWallet()
                      .then((w) => {
                        setTwintPhone(w.twintPhone);
                        setTwintName(w.twintName);
                        setPendingDeposits(w.pending);
                        if (w.credits > creditsRef.current) setCredits(w.credits);
                      })
                      .catch(() => undefined);
                  }}
                  className="tomb-panel h-10 rounded-md px-1 font-display text-[10px] uppercase tracking-[0.12em] text-gold-2 sm:h-11 sm:text-xs sm:tracking-[0.16em]"
                >
                  {copy.reload}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {bookBlind && (
        <div className="tomb-blind pointer-events-none absolute inset-0 z-[35]" aria-hidden />
      )}

      {winBurst &&
        (fsSummary ||
          ["great", "mega", "epic"].includes(burstTier(winBurst.amount, winBurst.bet) ?? "")) && (
          <WinBurst
            key={winBurst.id}
            amount={winBurst.amount}
            bet={winBurst.bet}
            live={displayWin}
            lang={lang}
            copy={copy}
            reduced={reducedMotion}
            fullscreen
            summary={fsSummary}
            gram={gram}
          />
        )}

      {phase === "bonusSelect" && (
        <BonusSelect
          copy={copy}
          assets={assets}
          pick={bonusPick}
          stacked={expandSymbols}
          retrigger={freeSpins > 0}
          turbo={turbo}
          award={fsAward}
          onPick={startBonus}
        />
      )}

      {phase === "gamble" && gambleStake > 0 && (
        <GamblePanel
          copy={copy}
          lang={lang}
          stake={gambleStake}
          flip={cardFlip}
          gram={gram}
          onCollect={collectGamble}
          onPick={pickColor}
        />
      )}

      {showPaytable && (
        <Paytable
          copy={copy}
          lang={lang}
          assets={assets}
          betPerLine={betPerLine}
          bet={bet}
          lines={lines}
          gram={gram}
          onClose={() => setShowPaytable(false)}
        />
      )}

      {showDeposit && (
        <DepositPanel
          copy={copy}
          lang={lang}
          gram={gram}
          twintPhone={twintPhone}
          twintName={twintName}
          pending={pendingDeposits}
          onClose={() => setShowDeposit(false)}
          onRequest={async (chf, method) => {
            const res = await requestDeposit({ data: { chf, method } });
            const w = await getWallet();
            setPendingDeposits(w.pending);
            setTwintPhone(w.twintPhone);
            setTwintName(w.twintName);
            if (typeof res.credits === "number") setCredits(res.credits);
            else if (w.credits > creditsRef.current) setCredits(w.credits);
            if (res.instant) setShowDeposit(false);
          }}
        />
      )}

      {showAuto && (
        <AutoPanel
          copy={copy}
          stopOnBonus={stopOnBonus}
          onStopOnBonus={setStopOnBonus}
          onClose={() => setShowAuto(false)}
          onPick={(n) => {
            setAutoLeft(n);
            setShowAuto(false);
            setPhase("idle");
          }}
        />
      )}

      {showBuy && !buyKind && (
        <BuyPanel
          copy={copy}
          lang={lang}
          bet={bet}
          credits={credits}
          armed={paidExpand}
          gram={gram}
          onClose={() => setShowBuy(false)}
          onChoose={confirmBuy}
          onDisable={() => {
            deactivateExpand();
            setShowBuy(false);
          }}
        />
      )}

      {buyKind && assets && (
        <BuySymbolPick
          copy={copy}
          assets={assets}
          kind={buyKind}
          onBack={() => {
            setBuyKind(null);
            setShowBuy(true);
          }}
          onPick={pickBoughtSymbol}
        />
      )}

      <PlayLogSheet open={showLog} onClose={() => setShowLog(false)} />
    </div>
  );
}

function StartScreen({
  copy,
  ready,
  error,
  lang,
  muted,
  featured,
  onLang,
  onMute,
  onEnter,
}: {
  copy: ReturnType<typeof t>;
  ready: boolean;
  error: boolean;
  lang: Lang;
  muted: boolean;
  featured: "classic" | "ramon";
  onLang: (l: Lang) => void;
  onMute: () => void;
  onEnter: () => void;
}) {
  const canEnter = ready && !error;
  return (
    <div className="relative flex min-h-dvh w-full flex-col items-center justify-end overflow-hidden bg-bg text-left">
      <img src="/bg/tomb.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(18_12_7/0.35)_0%,rgb(18_12_7/0.2)_40%,rgb(18_12_7/0.88)_100%)]" />
      <div className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-10 flex gap-2">
        <Link to="/" className="rounded-md border border-border bg-ink/60 px-3 py-2 font-display text-xs tracking-[0.16em] text-gold-2">
          Lobby
        </Link>
        <button
          type="button"
          onClick={() => onLang(lang === "de" ? "en" : "de")}
          className="rounded-md border border-border bg-ink/60 px-3 py-2 font-display text-xs tracking-[0.16em] text-gold-2"
        >
          {lang.toUpperCase()}
        </button>
        <button
          type="button"
          onClick={onMute}
          className="rounded-md border border-border bg-ink/60 p-2 text-gold-2"
          aria-label={copy.sound}
        >
          {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>
      </div>
      <div className="relative z-10 w-full max-w-lg px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] text-center">
        <p className="font-display text-sm uppercase tracking-[0.42em] text-gold">{copy.subtitle}</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-[0.12em] text-gold-2 text-balance sm:text-5xl">
          {featured === "ramon" ? "Book of Ra(mon)" : copy.title}
        </h1>
        {featured === "ramon" && (
          <p className="mt-3 font-display text-sm uppercase tracking-[0.28em] text-gold">Made by Crydo5</p>
        )}
        <p className="mt-6 font-display text-xs uppercase tracking-[0.28em] text-muted">
          {error ? copy.loading : copy.tapToEnter}
        </p>
        <button
          type="button"
          disabled={!canEnter}
          onClick={onEnter}
          className="tomb-panel mt-5 w-full rounded-2xl px-4 py-4 text-center disabled:opacity-50"
        >
          <p className="font-display text-xl tracking-[0.16em] text-gold-2">Start</p>
        </button>
      </div>
    </div>
  );
}

function WinBurst({
  amount,
  bet,
  live,
  lang,
  copy,
  reduced,
  fullscreen,
  summary = false,
  gram = false,
}: {
  amount: number;
  bet: number;
  live: number;
  lang: Lang;
  copy: ReturnType<typeof t>;
  reduced: boolean;
  fullscreen: boolean;
  summary?: boolean;
  gram?: boolean;
}) {
  const x = stakeMult(amount, bet);
  const tier = burstTier(amount, bet) ?? "chip";
  const vis: BurstTier = summary
    ? tier === "epic" || tier === "mega"
      ? tier
      : "great"
    : tier;
  const title = summary
    ? copy.fsTotal
    : vis === "epic"
      ? copy.epicWin
      : vis === "mega"
        ? copy.megaWin
        : vis === "great"
          ? copy.greatWin
          : null;
  const sparks = reduced ? 0 : vis === "epic" ? 34 : vis === "mega" ? 24 : vis === "great" ? 16 : vis === "gold" ? 8 : 4;
  const coins = reduced ? 0 : vis === "epic" ? 22 : vis === "mega" ? 16 : vis === "great" ? 10 : vis === "gold" ? 4 : 0;
  const dust = reduced ? 0 : vis === "epic" ? 18 : vis === "mega" ? 12 : vis === "great" ? 6 : 0;
  const size =
    vis === "epic"
      ? "text-6xl sm:text-8xl"
      : vis === "mega"
        ? "text-5xl sm:text-7xl"
        : vis === "great"
          ? "text-4xl sm:text-6xl"
          : vis === "gold"
            ? "text-3xl sm:text-4xl"
            : "text-2xl sm:text-3xl";

  return (
    <div
      className={cn(
        "pointer-events-none flex items-center justify-center overflow-hidden",
        fullscreen ? "absolute inset-0 z-[25]" : "absolute inset-0 z-20 rounded-[16px]",
      )}
    >
      {fullscreen && <div className="win-flash absolute inset-0" />}
      {(vis === "mega" || vis === "epic") && <div className="absolute inset-0 bg-ink/55" />}
      {vis === "great" && fullscreen && <div className="absolute inset-0 bg-ink/30" />}
      {!reduced && (vis === "great" || vis === "mega" || vis === "epic") && (
        <>
          <div
            className={cn(
              "absolute rounded-full opacity-80",
              vis === "epic" ? "win-rays-fast size-[min(180%,42rem)]" : "win-rays size-[min(150%,34rem)]",
            )}
            style={{
              background:
                "repeating-conic-gradient(from 0deg, rgb(240 213 138 / 0) 0deg 7deg, rgb(240 213 138 / 0.32) 7deg 10deg)",
              maskImage: "radial-gradient(circle, transparent 12%, black 38%, transparent 70%)",
            }}
          />
          {(vis === "mega" || vis === "epic") && (
            <div
              className="win-rays-rev absolute size-[min(160%,36rem)] rounded-full opacity-50"
              style={{
                background:
                  "repeating-conic-gradient(from 18deg, rgb(255 236 180 / 0) 0deg 12deg, rgb(255 220 120 / 0.2) 12deg 14deg)",
                maskImage: "radial-gradient(circle, transparent 16%, black 44%, transparent 72%)",
              }}
            />
          )}
        </>
      )}
      {(vis === "great" || vis === "mega" || vis === "epic") && (
        <>
          <div className="win-ring absolute size-44 rounded-full border-2 border-gold/60 sm:size-64" />
          <div className="win-ring absolute size-60 rounded-full border border-gold-2/40 sm:size-80" style={{ animationDelay: "140ms" }} />
          {vis === "epic" && (
            <div className="win-ring absolute size-80 rounded-full border border-gold/25 sm:size-[28rem]" style={{ animationDelay: "280ms" }} />
          )}
        </>
      )}
      {Array.from({ length: sparks }, (_, i) => {
        const a = ((i * 137.508) % 360) * (Math.PI / 180);
        const d = 22 + (i % 7) * 10;
        return (
          <span
            key={`s${i}`}
            className="win-spark absolute left-1/2 top-1/2 size-1.5 rounded-full bg-gold-2 shadow-[0_0_10px_var(--color-gold)] sm:size-2"
            style={{
              marginLeft: `${Math.cos(a) * d}%`,
              marginTop: `${Math.sin(a) * d * 0.7}%`,
              animationDelay: `${(i % 10) * 50}ms`,
            }}
          />
        );
      })}
      {Array.from({ length: coins }, (_, i) => {
        const a = ((i * 97.3 + 20) % 360) * (Math.PI / 180);
        const dist = 90 + (i % 6) * 28;
        return (
          <span
            key={`c${i}`}
            className="win-coin absolute left-1/2 top-1/2 size-4 rounded-full border border-gold-2 bg-[radial-gradient(circle_at_30%_30%,var(--color-gold-2),var(--color-gold)_55%,var(--color-bronze))] sm:size-6"
            style={{
              animationDelay: `${60 + i * 40}ms`,
              ["--dx" as string]: `${Math.cos(a) * dist}px`,
              ["--dy" as string]: `${Math.sin(a) * dist}px`,
              ["--rot" as string]: `${i % 2 === 0 ? 160 : -170}deg`,
            }}
          />
        );
      })}
      {Array.from({ length: dust }, (_, i) => (
        <span
          key={`d${i}`}
          className="win-dust absolute left-1/2 top-[8%] h-8 w-px bg-gradient-to-b from-gold-2 to-transparent"
          style={{ marginLeft: `${((i * 17) % 80) - 40}%`, animationDelay: `${i * 90}ms` }}
        />
      ))}
      <div
        className={cn(
          "win-pop relative mx-4 max-w-[92%] text-center",
          fullscreen && "rounded-2xl px-6 py-5 ring-1 ring-gold/50 sm:px-10 sm:py-7",
          fullscreen && "bg-[rgb(16_10_5/0.55)] shadow-[0_0_48px_rgb(226_183_90/0.35)]",
        )}
      >
        {fullscreen && (
          <>
            <span className="win-corner left-2 top-2 border-l border-t" />
            <span className="win-corner right-2 top-2 border-r border-t" />
            <span className="win-corner bottom-2 left-2 border-b border-l" />
            <span className="win-corner bottom-2 right-2 border-b border-r" />
          </>
        )}
        {title && (
          <p className={cn("win-title font-display uppercase text-gold", vis === "epic" ? "text-sm tracking-[0.38em] sm:text-xl" : "text-xs tracking-[0.32em] sm:text-base")}>
            {title}
          </p>
        )}
        {summary && (
          <p className="mt-1 font-display text-[11px] uppercase tracking-[0.32em] text-gold-2 sm:text-sm">
            {copy.fsTotalSub}
          </p>
        )}
        <p className={cn("title-glow mt-1 font-display font-semibold tabular-nums tracking-wide text-gold-2", size, vis !== "chip" && "win-shimmer")}>
          {formatCredits(Math.max(live, 0), lang, gram)}
        </p>
        {x > 1 && (
          <p className={cn("win-mult mt-1 font-display font-semibold text-gold", vis === "epic" ? "text-2xl tracking-[0.22em] sm:text-4xl" : vis === "mega" ? "text-xl tracking-[0.2em] sm:text-3xl" : "text-base tracking-[0.18em] sm:text-xl")}>
            {formatMult(x)}
          </p>
        )}
      </div>
    </div>
  );
}

function Meter({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="tomb-panel rounded-lg px-2 py-1.5 sm:px-3 sm:py-2">
      <div className="font-display text-[9px] uppercase tracking-[0.2em] text-gold sm:text-[10px]">{label}</div>
      <div className={cn("mt-0.5 font-display text-base tabular-nums tracking-wide sm:text-lg", gold ? "text-gold-2" : "text-fg")}>
        {value}
      </div>
    </div>
  );
}

function Stepper({
  label,
  value,
  disabled,
  onMinus,
  onPlus,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <div className="tomb-panel flex items-center justify-between rounded-lg px-1.5 py-1">
      <button type="button" aria-label="−" disabled={disabled} onClick={onMinus} className="grid size-8 place-items-center text-gold-2 disabled:opacity-40">
        <Minus className="size-4" />
      </button>
      <div className="min-w-0 text-center">
        <div className="font-display text-[8px] uppercase tracking-[0.16em] text-gold">{label}</div>
        <div className="font-display text-sm tabular-nums text-gold-2">{value}</div>
      </div>
      <button type="button" aria-label="+" disabled={disabled} onClick={onPlus} className="grid size-8 place-items-center text-gold-2 disabled:opacity-40">
        <Plus className="size-4" />
      </button>
    </div>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-9 place-items-center rounded-md tomb-panel text-gold-2 sm:size-10"
    >
      {children}
    </button>
  );
}

function BonusSelect({
  copy,
  assets,
  pick,
  stacked,
  retrigger,
  award,
  onPick,
}: {
  copy: ReturnType<typeof t>;
  assets: SlotAssets;
  pick: SymbolId | null;
  stacked: SymbolId[];
  retrigger: boolean;
  turbo: boolean;
  award: number;
  onPick: (s: SymbolId) => void;
}) {
  const left = EXPANDABLE.filter((s) => !stacked.includes(s));
  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center bg-ink/75 sm:items-center">
      <div className="tomb-panel w-full max-w-md rounded-t-2xl p-5 sm:rounded-2xl">
        <p className="font-display text-xs uppercase tracking-[0.22em] text-gold">
          {retrigger ? copy.stackTitle : copy.bonusTitle}
        </p>
        <h2 className="mt-1 font-display text-xl text-gold-2">
          {retrigger ? copy.stackBody : `${award} ${copy.bonusBody}`}
        </h2>
        <p className="mt-2 text-xs text-muted">{copy.pickHint}</p>
        <div className="mt-4 grid grid-cols-5 gap-2">
          {(left.length ? left : EXPANDABLE).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onPick(id)}
              className={cn(
                "overflow-hidden rounded-md ring-1 ring-gold/35",
                pick === id && "ring-2 ring-gold",
              )}
            >
              <img src={assets.tiles[id].src} alt={copy.symbols[id]} className="aspect-square w-full object-cover" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function GamblePanel({
  copy,
  lang,
  stake,
  flip,
  gram = false,
  onCollect,
  onPick,
}: {
  copy: ReturnType<typeof t>;
  lang: Lang;
  stake: number;
  flip: "red" | "black" | null;
  gram?: boolean;
  onCollect: () => void;
  onPick: (c: "red" | "black") => void;
}) {
  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center bg-ink/75 sm:items-center">
      <div className="tomb-panel w-full max-w-sm rounded-t-2xl p-5 sm:rounded-2xl">
        <h2 className="font-display text-lg text-gold-2">{copy.gamble}</h2>
        <p className="mt-1 text-sm text-muted">{copy.gambleHint}</p>
        <p className="mt-3 font-display text-3xl tabular-nums text-gold-2">{formatCredits(stake, lang, gram)}</p>
        <div className="mt-4 flex justify-center">
          <div className="size-28 overflow-hidden rounded-lg ring-1 ring-gold/40">
            {flip ? (
              <div className={cn("grid h-full place-items-center font-display text-xl", flip === "red" ? "bg-red-800 text-gold-2" : "bg-zinc-900 text-gold-2")}>
                {flip === "red" ? copy.red : copy.black}
              </div>
            ) : (
              <img src="/bg/card-back.jpg" alt="" className="h-full w-full object-cover" />
            )}
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" disabled={Boolean(flip)} onClick={() => onPick("red")} className="h-12 rounded-md bg-red-800 font-display tracking-[0.16em] text-gold-2 disabled:opacity-40">
            {copy.red}
          </button>
          <button type="button" disabled={Boolean(flip)} onClick={() => onPick("black")} className="h-12 rounded-md bg-zinc-900 font-display tracking-[0.16em] text-gold-2 disabled:opacity-40">
            {copy.black}
          </button>
        </div>
        <button type="button" onClick={onCollect} className="mt-3 h-12 w-full rounded-md tomb-panel font-display tracking-[0.18em] text-gold-2">
          {copy.collect}
        </button>
      </div>
    </div>
  );
}

function Paytable({
  copy,
  lang,
  assets,
  betPerLine,
  bet,
  lines,
  gram = false,
  onClose,
}: {
  copy: ReturnType<typeof t>;
  lang: Lang;
  assets: SlotAssets;
  betPerLine: number;
  bet: number;
  lines: number;
  gram?: boolean;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center bg-ink/75 sm:items-center">
      <div className="tomb-panel max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl p-5 sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg tracking-[0.12em] text-gold-2">{copy.paytable}</h2>
          <button type="button" aria-label={copy.close} onClick={onClose} className="grid size-10 place-items-center text-muted">
            <X className="size-5" />
          </button>
        </div>
        <p className="mt-3 font-display text-xs uppercase tracking-[0.18em] text-muted">{copy.picturePays}</p>
        <div className="mt-2 space-y-2">
          {PICTURE_SYMBOLS.map((id) => (
            <PayRow key={id} assets={assets} id={id} betPerLine={betPerLine} bet={bet} lang={lang} copy={copy} gram={gram} />
          ))}
        </div>
        <p className="mt-4 font-display text-xs uppercase tracking-[0.18em] text-muted">{copy.royalPays}</p>
        <div className="mt-2 space-y-2">
          {ROYAL_SYMBOLS.map((id) => (
            <PayRow key={id} assets={assets} id={id} betPerLine={betPerLine} bet={bet} lang={lang} copy={copy} gram={gram} />
          ))}
        </div>
        <p className="mt-5 font-display text-xs uppercase tracking-[0.18em] text-gold">{copy.linesTitle}</p>
        <p className="mt-1 text-xs text-muted">
          {REELS}×{ROWS} · {lines}/{PAYLINES.length} {copy.lines}
        </p>
        <LineMap active={lines} />
        <div className="mt-5 space-y-2 text-sm leading-snug text-muted">
          <p className="font-display text-xs uppercase tracking-[0.18em] text-gold">{copy.rulesTitle}</p>
          <p>{copy.rule1}</p>
          <p>{copy.rule2}</p>
          <p>{copy.rule3}</p>
          <p>{copy.rule4}</p>
          <p>{copy.rule5}</p>
          <p>{copy.rule6}</p>
        </div>
      </div>
    </div>
  );
}

function PayRow({
  assets,
  id,
  betPerLine,
  bet,
  lang,
  copy,
  gram = false,
}: {
  assets: SlotAssets;
  id: SymbolId;
  betPerLine: number;
  bet: number;
  lang: Lang;
  copy: ReturnType<typeof t>;
  gram?: boolean;
}) {
  const pays = id === "book" ? SCATTER_PAYS : LINE_PAYS[id as Exclude<SymbolId, "book">];
  return (
    <div className="tomb-panel flex items-center gap-3 overflow-hidden rounded-lg px-3 py-2">
      <div className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-md ring-1 ring-gold/35">
        <img src="/bg/tomb.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />
        <div className="absolute inset-0 bg-ink/45" />
        <div className="relative">
          <img src={assets.tiles[id].src} alt="" className="size-12 rounded-sm object-cover" />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-display text-xs uppercase tracking-[0.14em] text-gold-2">
          {id === "book" ? copy.wild : copy.symbols[id]}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-display text-xs tabular-nums text-fg">
          {([6, 5, 4, 3, 2] as const).map((n) => {
            const m = pays[n];
            if (!m) return null;
            const amount = id === "book" ? m * bet : m * betPerLine;
            return (
              <span key={n}>
                {n}× {formatCredits(amount, lang, gram)}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function LineMap({ active }: { active: number }) {
  const cw = 8;
  const ch = 7;
  const gx = 2.2;
  const gy = 2.2;
  const pad = 4;
  const w = pad * 2 + REELS * cw + (REELS - 1) * gx;
  const h = pad * 2 + ROWS * ch + (ROWS - 1) * gy;
  return (
    <div className="mt-2 grid grid-cols-5 gap-1.5">
      {PAYLINES.map((rows, i) => {
        const on = i < active;
        const pts = rows
          .map((row, reel) => {
            const x = pad + reel * (cw + gx) + cw / 2;
            const y = pad + row * (ch + gy) + ch / 2;
            return `${x},${y}`;
          })
          .join(" ");
        return (
          <div
            key={i}
            className={cn("relative overflow-hidden rounded-lg ring-1", on ? "ring-gold/55" : "ring-gold/20 opacity-55")}
          >
            <img src="/bg/tomb.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(18_10_5/0.35)_0%,rgb(12_8_4/0.62)_100%)]" />
            <div className="relative px-1 pb-1.5 pt-1">
              <div className="mb-1 text-center font-display text-[9px] tabular-nums tracking-[0.14em] text-gold-2">
                {i + 1}
              </div>
              <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full drop-shadow-[0_1px_2px_rgb(0_0_0_/_0.65)]" aria-hidden>
                <rect x={1} y={1} width={w - 2} height={h - 2} rx={2} fill="rgba(42, 28, 12, 0.55)" stroke="rgba(232, 197, 92, 0.28)" strokeWidth={0.6} />
                {Array.from({ length: ROWS }).map((_, row) =>
                  Array.from({ length: REELS }).map((__, reel) => {
                    const hit = rows[reel] === row;
                    return (
                      <rect
                        key={`${reel}-${row}`}
                        x={pad + reel * (cw + gx)}
                        y={pad + row * (ch + gy)}
                        width={cw}
                        height={ch}
                        rx={1}
                        fill={hit ? "var(--color-gold)" : "rgba(92, 62, 28, 0.85)"}
                        stroke={hit ? "var(--color-gold-2)" : "rgba(232, 197, 92, 0.28)"}
                        strokeWidth={0.45}
                      />
                    );
                  }),
                )}
                <polyline points={pts} fill="none" stroke="var(--color-gold-2)" strokeWidth={1.05} strokeLinejoin="round" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DepositPanel({
  copy,
  lang,
  gram,
  twintPhone,
  twintName,
  pending,
  onClose,
  onRequest,
}: {
  copy: ReturnType<typeof t>;
  lang: Lang;
  gram: boolean;
  twintPhone: string;
  twintName: string;
  pending: DepositRow[];
  onClose: () => void;
  onRequest: (chf: number, method: "twint" | "cash") => Promise<void>;
}) {
  const [chf, setChf] = useState(20);
  const [method, setMethod] = useState<"twint" | "cash">("twint");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center bg-ink/75 sm:items-center">
      <div className="tomb-panel w-full max-w-md rounded-t-2xl p-5 sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg text-gold-2">{copy.depositTitle}</h2>
          <button type="button" aria-label={copy.close} onClick={onClose} className="grid size-10 place-items-center text-muted">
            <X className="size-5" />
          </button>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted">{copy.depositBody}</p>
        <div className="mt-4 grid grid-cols-5 gap-1.5">
          {[10, 20, 50, 100, 200].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setChf(n)}
              className={cn(
                "h-11 rounded-md font-display text-sm tabular-nums",
                chf === n ? "border-2 border-gold-2 bg-gold text-ink" : "tomb-panel text-gold-2",
              )}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="mt-2 text-center font-display text-xs uppercase tracking-[0.18em] text-gold">
          {chf} CHF → {formatCredits(chf, lang, gram)}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMethod("twint")}
            className={cn(
              "flex h-12 items-center justify-center gap-1.5 rounded-md font-display text-xs uppercase tracking-[0.14em]",
              method === "twint" ? "border-2 border-gold-2 bg-gold text-ink" : "tomb-panel text-gold-2",
            )}
          >
            <Smartphone className="size-4" />
            {copy.depositTwint}
          </button>
          <button
            type="button"
            onClick={() => setMethod("cash")}
            className={cn(
              "flex h-12 items-center justify-center gap-1.5 rounded-md font-display text-xs uppercase tracking-[0.14em]",
              method === "cash" ? "border-2 border-gold-2 bg-gold text-ink" : "tomb-panel text-gold-2",
            )}
          >
            <Banknote className="size-4" />
            {copy.depositCash}
          </button>
        </div>
        {method === "twint" ? (
          <div className="mt-4 rounded-lg border border-gold/25 bg-ink/40 p-3 text-center">
            {twintPhone ? (
              <>
                {twintName && <p className="font-display text-xs uppercase tracking-[0.16em] text-gold">{twintName}</p>}
                <p className="mt-1 font-display text-2xl tabular-nums tracking-wide text-gold-2">{twintPhone}</p>
                <p className="mt-2 text-xs text-muted">{copy.depositTwintHint}</p>
              </>
            ) : (
              <p className="text-sm text-muted">{copy.depositNoTwint}</p>
            )}
          </div>
        ) : (
          <p className="mt-4 text-center text-sm text-muted">{copy.depositCashHint}</p>
        )}
        {pending.length > 0 && (
          <p className="mt-3 text-center font-display text-xs uppercase tracking-[0.16em] text-gold">
            {copy.depositPending} · {pending[0].chf} CHF
          </p>
        )}
        {err && <p className="mt-2 text-center text-sm text-red-300">{err}</p>}
        <button
          type="button"
          disabled={busy || (method === "twint" && !twintPhone)}
          onClick={() => {
            setBusy(true);
            setErr("");
            void onRequest(chf, method)
              .catch((e) => setErr(e instanceof Error ? e.message : "Fehler"))
              .finally(() => setBusy(false));
          }}
          className="mt-4 h-12 w-full rounded-md border-2 border-gold-2 bg-[radial-gradient(circle_at_30%_22%,var(--color-gold-2),var(--color-gold)_40%,var(--color-bronze))] font-display tracking-[0.16em] text-ink disabled:opacity-40"
        >
          {busy ? "…" : copy.depositSend}
        </button>
      </div>
    </div>
  );
}

function AutoPanel({
  copy,
  stopOnBonus,
  onStopOnBonus,
  onClose,
  onPick,
}: {
  copy: ReturnType<typeof t>;
  stopOnBonus: boolean;
  onStopOnBonus: (v: boolean) => void;
  onClose: () => void;
  onPick: (n: number) => void;
}) {
  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center bg-ink/70 sm:items-center">
      <div className="tomb-panel w-full max-w-sm rounded-t-2xl p-5 sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg text-gold-2">{copy.autoTitle}</h2>
          <button type="button" aria-label={copy.close} onClick={onClose} className="grid size-10 place-items-center text-muted">
            <X className="size-5" />
          </button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[10, 25, 50, 100, 250, 500].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onPick(n)}
              className="tomb-panel h-12 rounded-md font-display tabular-nums text-gold-2"
            >
              {n}
            </button>
          ))}
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={stopOnBonus} onChange={(e) => onStopOnBonus(e.target.checked)} />
          {copy.stopBonus}
        </label>
      </div>
    </div>
  );
}

function BuyPanel({
  copy,
  lang,
  bet,
  credits,
  armed,
  gram = false,
  onClose,
  onChoose,
  onDisable,
}: {
  copy: ReturnType<typeof t>;
  lang: Lang;
  bet: number;
  credits: number;
  armed: SymbolId | null;
  gram?: boolean;
  onClose: () => void;
  onChoose: (k: "freeSpins" | "expand") => void;
  onDisable: () => void;
}) {
  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center bg-ink/75 sm:items-center">
      <div className="tomb-panel w-full max-w-md rounded-t-2xl p-5 sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg text-gold-2">{copy.buyTitle}</h2>
          <button type="button" aria-label={copy.close} onClick={onClose} className="grid size-10 place-items-center text-muted">
            <X className="size-5" />
          </button>
        </div>
        <button type="button" onClick={() => onChoose("freeSpins")} className="tomb-panel mt-4 w-full rounded-xl p-4 text-left">
          <p className="font-display text-sm tracking-[0.16em] text-gold-2">{copy.buyFsTitle}</p>
          <p className="mt-1 text-xs text-muted">{copy.buyFsBody}</p>
          <p className="mt-2 font-display text-gold">{copy.buyFsCost} · {formatCredits(bet * BUY_FS_MULT, lang, gram)}</p>
        </button>
        <button type="button" onClick={() => onChoose("expand")} className="tomb-panel mt-3 w-full rounded-xl p-4 text-left">
          <p className="font-display text-sm tracking-[0.16em] text-gold-2">{copy.buyExpandTitle}</p>
          <p className="mt-1 text-xs text-muted">{copy.buyExpandBody}</p>
          <p className="mt-2 font-display text-gold">{copy.buyExpandCost} · {formatCredits(bet * BUY_EXPAND_MULT, lang, gram)}</p>
        </button>
        {armed && (
          <button type="button" onClick={onDisable} className="mt-3 h-11 w-full rounded-md border border-gold/40 font-display text-sm tracking-[0.16em] text-gold-2">
            {copy.buyOff}
          </button>
        )}
        <p className="mt-3 text-center font-display text-xs tabular-nums text-muted">
          {gram ? (lang === "de" ? "Gramm" : "Grams") : copy.credits}: {formatCredits(credits, lang, gram)}
        </p>
      </div>
    </div>
  );
}

function BuySymbolPick({
  copy,
  assets,
  kind,
  onBack,
  onPick,
}: {
  copy: ReturnType<typeof t>;
  assets: SlotAssets;
  kind: "freeSpins" | "expand";
  onBack: () => void;
  onPick: (s: SymbolId) => void;
}) {
  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center bg-ink/75 sm:items-center">
      <div className="tomb-panel w-full max-w-md rounded-t-2xl p-5 sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg text-gold-2">{copy.buyPick}</h2>
          <button type="button" aria-label={copy.close} onClick={onBack} className="grid size-10 place-items-center text-muted">
            <X className="size-5" />
          </button>
        </div>
        <p className="mt-1 text-xs text-muted">{kind === "freeSpins" ? copy.buyFsTitle : copy.buyExpandTitle}</p>
        <div className="mt-4 grid grid-cols-5 gap-2">
          {EXPANDABLE.map((id) => (
            <button key={id} type="button" onClick={() => onPick(id)} className="overflow-hidden rounded-md ring-1 ring-gold/35">
              <img src={assets.tiles[id].src} alt={copy.symbols[id]} className="aspect-square w-full object-cover" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
