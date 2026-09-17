import { useCallback, useEffect, useRef, useState } from "react";
import {
  Link,
} from "@tanstack/react-router";
import {
  Volume2,
  VolumeX,
  Zap,
  ChevronLeft,
  ChevronRight,
  Info,
  X,
  ShoppingCart,
  Play,
} from "lucide-react";
import { GridCanvas } from "@/components/gates/GridCanvas";
import { gatesAudio } from "@/lib/gates/audio";
import {
  BET_STEPS,
  BUY_FS_MULT,
  COLS,
  FREE_SPINS_INITIAL,
  FREE_SPINS_RETRIGGER,
  FREE_SPINS_RETRIGGER_MIN,
  MAX_WIN_MULT,
  ROWS,
  formatBet,
  formatWin,
  getWinTier,
  spinFreeSpins,
  spinReels,
  type BetStep,
} from "@/lib/gates/engine";
import type { GatesSymbolId, GatesGameState, OrbInfo, TumbleStep } from "@/lib/gates/types";

const PAY_TABLE_DATA: { sym: GatesSymbolId; name: string; pay8: string; pay10: string; pay12: string; color: string }[] = [
  { sym: "blueGem", name: "Blauer Edelstein", pay8: "0.25×", pay10: "0.75×", pay12: "2×", color: "#3ba0e8" },
  { sym: "greenGem", name: "Grüner Edelstein", pay8: "0.40×", pay10: "0.90×", pay12: "4×", color: "#4cdf6a" },
  { sym: "yellowGem", name: "Gelber Edelstein", pay8: "0.50×", pay10: "1×", pay12: "5×", color: "#ffd34d" },
  { sym: "purpleGem", name: "Lila Edelstein", pay8: "0.80×", pay10: "1.20×", pay12: "8×", color: "#b060f0" },
  { sym: "redGem", name: "Roter Edelstein", pay8: "1×", pay10: "1.50×", pay12: "10×", color: "#f06060" },
  { sym: "chalice", name: "Kelch", pay8: "1.50×", pay10: "2×", pay12: "12×", color: "#d4b056" },
  { sym: "ring", name: "Ring", pay8: "2×", pay10: "5×", pay12: "15×", color: "#c49a40" },
  { sym: "hourglass", name: "Stundenglas", pay8: "2.50×", pay10: "10×", pay12: "25×", color: "#b8a060" },
  { sym: "crown", name: "Goldene Krone", pay8: "10×", pay10: "25×", pay12: "50×", color: "#ffd700" },
  { sym: "scatter", name: "Zeus Scatter", pay8: "—", pay10: "—", pay12: "—", color: "#60a0ff" },
  { sym: "orb", name: "Orb Multiplikator", pay8: "—", pay10: "—", pay12: "—", color: "#fff3c4" },
];

export function GatesApp() {
  const [state, setState] = useState<GatesGameState>({
    credits: 1000,
    bet: 1,
    phase: "idle",
    grid: Array.from({ length: ROWS }, () => Array(COLS).fill("blueGem") as GatesSymbolId[]),
    inFreeSpins: false,
    freeSpinsRemaining: 0,
    globalMultiplier: 0,
    pendingWin: 0,
    totalBonusWin: 0,
    tumbleStepIndex: 0,
    currentTumbleSteps: [],
    orbMultiplierSum: 0,
    winTier: null,
  });

  const [muted, setMuted] = useState(false);
  const [turbo, setTurbo] = useState(false);
  const [anteBet, setAnteBet] = useState(false);
  const [betIndex, setBetIndex] = useState(5);
  const [showPaytable, setShowPaytable] = useState(false);
  const [showBuy, setShowBuy] = useState(false);
  const [autoSpins, setAutoSpins] = useState(0);
  const [displayWin, setDisplayWin] = useState(0);
  const [winCells, setWinCells] = useState<Set<string>>(new Set());
  const [currentOrbs, setCurrentOrbs] = useState<OrbInfo[]>([]);
  const [bigWinText, setBigWinText] = useState<string | null>(null);

  const busyRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const betRef = useRef(betIndex);
  betRef.current = betIndex;
  const autoRef = useRef(autoSpins);
  autoRef.current = autoSpins;
  const turboRef = useRef(turbo);
  turboRef.current = turbo;
  const countRaf = useRef(0);

  const bet = BET_STEPS[betIndex];
  const effectiveBet = anteBet ? bet * 1.25 : bet;

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

  useEffect(() => {
    audio.setMuted(muted);
  }, [muted]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        if (busyRef.current || stateRef.current.phase !== "idle") return;
        doSpin();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const doSpin = useCallback(() => {
    if (busyRef.current) return;
    const s = stateRef.current;
    if (s.phase !== "idle") return;

    const cost = effectiveBet;
    if (s.credits < cost && !s.inFreeSpins) {
      return;
    }

    busyRef.current = true;
    setDisplayWin(0);
    setWinCells(new Set());
    setCurrentOrbs([]);

    gatesAudio.spin();

    const newCredits = s.inFreeSpins ? s.credits : s.credits - cost;

    if (s.inFreeSpins) {
      const result = spinFreeSpins(s.globalMultiplier, s.freeSpinsRemaining);
      const steps = result.steps;
      const orbMap = new Map<string, number>();
      steps.forEach((step) => {
        step.orbs.forEach((o) => {
          orbMap.set(`${o.row}:${o.col}`, o.value);
        });
      });
      setCurrentOrbs([...orbMap.entries()].map(([k, v]) => {
        const [r, c] = k.split(":").map(Number);
        return { row: r, col: c, value: v };
      }));

      if (steps.length > 0) {
        setState((prev) => ({
          ...prev,
          grid: steps[0].grid,
          phase: "tumbling",
          currentTumbleSteps: steps,
          tumbleStepIndex: 0,
          orbMultiplierSum: result.orbSum,
        }));

        animateTumble(steps, 0, result.totalWin, newCredits, result.newGlobalMult, s.freeSpinsRemaining - 1, result.retrigger, result.scatterCount, true);
      } else {
        const newFs = s.freeSpinsRemaining - 1;
        const triggered = result.retrigger && result.scatterCount >= FREE_SPINS_RETRIGGER_MIN;
        const finalFs = triggered ? newFs + FREE_SPINS_RETRIGGER : newFs;

        setState((prev) => ({
          ...prev,
          grid: result.grid,
          credits: newCredits,
          totalBonusWin: prev.totalBonusWin + result.totalWin,
          freeSpinsRemaining: finalFs,
          globalMultiplier: result.newGlobalMult,
          phase: finalFs <= 0 ? "freeSpinsEnd" : "idle",
        }));

        if (finalFs <= 0) {
          const totalBonus = stateRef.current.totalBonusWin + result.totalWin;
          animateWin(totalBonus, cost);
        }

        busyRef.current = false;
      }
    } else {
      const result = spinReels(anteBet);

      const orbMap = new Map<string, number>();
      result.tumbleSteps.forEach((step) => {
        step.orbs.forEach((o) => {
          orbMap.set(`${o.row}:${o.col}`, o.value);
        });
      });
      setCurrentOrbs([...orbMap.entries()].map(([k, v]) => {
        const [r, c] = k.split(":").map(Number);
        return { row: r, col: c, value: v };
      }));

      if (result.tumbleSteps.length > 0 && result.totalWin > 0) {
        setState((prev) => ({
          ...prev,
          grid: result.tumbleSteps[0].grid,
          credits: newCredits,
          phase: "tumbling",
          currentTumbleSteps: result.tumbleSteps,
          tumbleStepIndex: 0,
          orbMultiplierSum: result.orbMultiplierSum,
        }));

        animateTumble(result.tumbleSteps, 0, result.totalWin, newCredits, 0, 0, false, result.scatterCount, false);
      } else if (result.bonusTrigger) {
        setState((prev) => ({
          ...prev,
          grid: result.grid,
          credits: newCredits,
          phase: "freeSpinsIntro",
          inFreeSpins: true,
          freeSpinsRemaining: FREE_SPINS_INITIAL,
          globalMultiplier: 0,
          totalBonusWin: 0,
        }));
        gatesAudio.freeSpinsStart();
        window.setTimeout(() => {
          setState((prev) => ({ ...prev, phase: "idle" }));
          busyRef.current = false;
        }, turboRef.current ? 800 : 2000);
      } else {
        setState((prev) => ({
          ...prev,
          grid: result.grid,
          credits: newCredits,
          phase: "idle",
        }));
        busyRef.current = false;
      }
    }
  }, [anteBet, effectiveBet]);

  const animateTumble = useCallback((
    steps: TumbleStep[],
    index: number,
    totalWin: number,
    credits: number,
    globalMult: number,
    fsRemaining: number,
    retrigger: boolean,
    scatterCount: number,
    inFs: boolean,
  ) => {
    if (index >= steps.length) {
      const tier = getWinTier(totalWin, effectiveBet);
      if (tier) {
        animateWin(totalWin, effectiveBet);
      }

      if (retrigger && scatterCount >= FREE_SPINS_RETRIGGER_MIN) {
        const newFs = fsRemaining + FREE_SPINS_RETRIGGER;
        setState((prev) => ({
          ...prev,
          freeSpinsRemaining: newFs,
          globalMultiplier: globalMult,
          totalBonusWin: prev.totalBonusWin + totalWin,
          credits,
          phase: newFs <= 0 ? "freeSpinsEnd" : "idle",
        }));
      } else if (inFs && fsRemaining <= 0) {
        setState((prev) => ({
          ...prev,
          totalBonusWin: prev.totalBonusWin + totalWin,
          credits,
          phase: "freeSpinsEnd",
        }));
        const finalTotal = stateRef.current.totalBonusWin + totalWin;
        animateWin(finalTotal, effectiveBet);
      } else {
        setState((prev) => ({
          ...prev,
          credits,
          phase: "idle",
        }));
      }

      busyRef.current = false;
      return;
    }

    const step = steps[index];

    const winCellsSet = new Set<string>();
    step.wins.forEach((w) => {
      step.grid.forEach((row, r) => {
        row.forEach((sym, c) => {
          if (sym === w.symbol) winCellsSet.add(`${r}:${c}`);
        });
      });
    });
    setWinCells(winCellsSet);

    if (step.orbs.length > 0) {
      step.orbs.forEach((o) => gatesAudio.orbLand(o.value));
    }

    if (step.wins.length > 0) {
      gatesAudio.tumble();
    }

    setState((prev) => ({
      ...prev,
      grid: step.grid,
      tumbleStepIndex: index,
    }));

    const delay = turboRef.current ? 250 : 600;
    window.setTimeout(() => {
      animateTumble(steps, index + 1, totalWin, credits, globalMult, fsRemaining, retrigger, scatterCount, inFs);
    }, delay);
  }, [effectiveBet]);

  const animateWin = useCallback((amount: number, betAmount: number) => {
    const tier = getWinTier(amount, betAmount);
    const ms = tier === "epic" ? 3000 : tier === "huge" ? 2500 : tier === "mega" ? 2000 : 1200;
    countUp(0, amount, Math.max(400, Math.round(ms * 0.7)));

    if (tier === "epic") gatesAudio.winMega();
    else if (tier === "huge" || tier === "mega") gatesAudio.winBig();
    else gatesAudio.winSmall();

    const text = tier === "epic" ? "EPIC WIN" : tier === "huge" ? "HUGE WIN" : tier === "mega" ? "MEGA WIN" : tier === "big" ? "BIG WIN" : null;
    if (text) setBigWinText(text);

    setState((prev) => ({ ...prev, winTier: tier }));

    window.setTimeout(() => {
      setBigWinText(null);
      setState((prev) => ({ ...prev, winTier: null }));
    }, ms);
  }, [countUp]);

  const changeBet = (dir: 1 | -1) => {
    if (busyRef.current || state.inFreeSpins) return;
    gatesAudio.buttonClick();
    setBetIndex((i) => Math.max(0, Math.min(BET_STEPS.length - 1, i + dir)));
  };

  const toggleAnte = () => {
    if (busyRef.current || state.inFreeSpins) return;
    gatesAudio.buttonClick();
    setAnteBet((a) => !a);
  };

  const buyFreeSpins = () => {
    const cost = effectiveBet * BUY_FS_MULT;
    if (state.credits < cost) return;

    gatesAudio.freeSpinsStart();
    setState((prev) => ({
      ...prev,
      credits: prev.credits - cost,
      phase: "freeSpinsIntro",
      inFreeSpins: true,
      freeSpinsRemaining: FREE_SPINS_INITIAL,
      globalMultiplier: 0,
      totalBonusWin: 0,
    }));

    window.setTimeout(() => {
      setState((prev) => ({ ...prev, phase: "idle" }));
      busyRef.current = false;
    }, turboRef.current ? 800 : 2000);
  };

  const toggleAuto = () => {
    if (autoSpins > 0) {
      setAutoSpins(0);
    } else {
      setAutoSpins(100);
    }
  };

  useEffect(() => {
    if (autoSpins > 0 && state.phase === "idle" && !busyRef.current) {
      const timer = window.setTimeout(() => {
        doSpin();
        setAutoSpins((n) => Math.max(0, n - 1));
      }, turbo ? 100 : 400);
      return () => window.clearTimeout(timer);
    }
  }, [autoSpins, state.phase, doSpin, turbo]);

  const audio = gatesAudio;

  const canSpin = state.phase === "idle" && !busyRef.current;
  const buyCost = effectiveBet * BUY_FS_MULT;

  return (
    <div className="relative flex h-dvh max-h-dvh flex-col overflow-hidden bg-[#0a0604] text-[#f6e7c4]">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,rgb(30_20_8_/_0.9),rgb(10_6_4_/_0.98)_70%)]" />
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 5 L35 25 L55 30 L35 35 L30 55 L25 35 L5 30 L25 25 Z' fill='none' stroke='%23c9a227' stroke-width='0.3' opacity='0.3'/%3E%3C/svg%3E\")",
        }} />
      </div>

      <header className="relative z-20 flex shrink-0 items-center justify-between px-3 pt-[max(0.4rem,env(safe-area-inset-top))] sm:px-4 sm:pt-[max(0.6rem,env(safe-area-inset-top))]">
        <div className="min-w-0">
          <Link to="/" className="font-display text-[9px] uppercase tracking-[0.3em] text-[#cbb07a] hover:text-[#f6dc9c]">
            ← Lobby
          </Link>
          <h1 className="font-display text-lg font-semibold tracking-[0.12em] text-[#f6dc9c] sm:text-2xl" style={{ textShadow: "0 0 18px rgb(226,183,90/0.45)" }}>
            GATES OF OLYMPUS
          </h1>
          <p className="font-display text-[9px] uppercase tracking-[0.28em] text-[#c9a227] sm:text-[10px]">
            1000
          </p>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => { audio.unlock(); setMuted((m) => !m); }}
            className="grid size-9 place-items-center rounded-full border border-[rgb(240,213,138/0.28)] bg-[rgb(16,10,5/0.62)] text-[#f6dc9c] sm:size-10"
          >
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </button>
          <button
            type="button"
            onClick={() => setShowPaytable(true)}
            className="grid size-9 place-items-center rounded-full border border-[rgb(240,213,138/0.28)] bg-[rgb(16,10,5/0.62)] text-[#f6dc9c] sm:size-10"
          >
            <Info className="size-4" />
          </button>
        </div>
      </header>

      {state.inFreeSpins && (
        <div className="relative z-20 mx-auto mt-1 flex shrink-0 items-center gap-3 rounded-full border border-[rgb(240,213,138/0.28)] bg-[rgb(16,10,5/0.62)] px-4 py-1 font-display text-[11px] tracking-[0.18em] text-[#f6dc9c] backdrop-blur-sm">
          <span className="text-[#ffd34d]">FREE SPINS: {state.freeSpinsRemaining}</span>
          {state.globalMultiplier > 0 && (
            <span className="text-[#c9a227]">GLOBAL: {state.globalMultiplier}×</span>
          )}
        </div>
      )}

      <div className="relative z-10 mx-auto flex min-h-0 w-full max-w-[1180px] flex-1 flex-col gap-1 px-2 pt-1 sm:px-3">
        <div className="relative mx-auto min-h-0 min-w-0 w-full flex-1">
          <div className="absolute inset-0 flex items-stretch justify-stretch">
            <div className="relative h-full w-full rounded-[16px] border border-[rgb(201,162,39/0.3)] bg-[rgb(12,8,4/0.28)] p-1.5 sm:rounded-[22px] sm:p-2" style={{
              boxShadow: "0 0 0 1px rgb(240,213,138/0.35), 0 0 28px rgb(226,183,90/0.18), inset 0 1px 0 rgb(246,220,156/0.22), inset 0 -18px 36px rgb(0,0,0/0.35)",
            }}>
              <div className="pointer-events-none absolute inset-[6px] rounded-[12px] ring-1 ring-[rgb(240,213,138/0.2)] sm:inset-[8px] sm:rounded-[16px]" />
              <GridCanvas
                grid={state.grid}
                orbMultipliers={currentOrbs}
                winCells={winCells}
                orbSum={state.orbMultiplierSum}
                turbo={turbo}
              />

              {bigWinText && (
                <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
                  <div className="absolute inset-0 bg-[rgb(10,6,4/0.6)]" />
                  <div className="relative z-10 text-center">
                    <p className="font-display text-4xl font-bold tracking-[0.2em] text-[#ffd700] sm:text-6xl" style={{
                      textShadow: "0 0 30px rgb(255,215,0/0.8), 0 0 60px rgb(255,215,0/0.4)",
                      animation: "win-pop 620ms cubic-bezier(0.16,1,0.3,1) both",
                    }}>
                      {bigWinText}
                    </p>
                    <p className="mt-2 font-display text-xl text-[#f6dc9c] sm:text-3xl" style={{
                      animation: "win-pop 560ms 220ms cubic-bezier(0.16,1,0.3,1) both",
                    }}>
                      {formatWin(displayWin)}×
                    </p>
                  </div>
                </div>
              )}

              {turbo && (
                <div className="pointer-events-none absolute right-3 top-2 rounded-full border border-[rgb(240,213,138/0.28)] bg-[rgb(16,10,5/0.62)] px-2 py-0.5 font-display text-[9px] tracking-[0.22em] text-[#f6dc9c]">
                  TURBO
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="relative z-20 flex w-full shrink-0 flex-col gap-2 pb-[max(0.6rem,env(safe-area-inset-bottom))]">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-[rgb(240,213,138/0.28)] bg-[rgb(16,10,5/0.62)] px-2 py-1.5 sm:px-3 sm:py-2">
              <div className="font-display text-[8px] uppercase tracking-[0.2em] text-[#c9a227] sm:text-[9px]">Guthaben</div>
              <div className="mt-0.5 font-display text-base tabular-nums text-[#f6e7c4] sm:text-lg">{formatWin(state.credits)}</div>
            </div>
            <div className="rounded-lg border border-[rgb(240,213,138/0.28)] bg-[rgb(16,10,5/0.62)] px-2 py-1.5 sm:px-3 sm:py-2">
              <div className="font-display text-[8px] uppercase tracking-[0.2em] text-[#c9a227] sm:text-[9px]">Einsatz</div>
              <div className="mt-0.5 font-display text-base tabular-nums text-[#f6dc9c] sm:text-lg">{formatBet(effectiveBet)}</div>
            </div>
            <div className="rounded-lg border border-[rgb(240,213,138/0.28)] bg-[rgb(16,10,5/0.62)] px-2 py-1.5 sm:px-3 sm:py-2">
              <div className="font-display text-[8px] uppercase tracking-[0.2em] text-[#c9a227] sm:text-[9px]">Gewinn</div>
              <div className="mt-0.5 font-display text-base tabular-nums text-[#f6dc9c] sm:text-lg">{formatWin(displayWin)}</div>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2 sm:gap-3">
            <div className="flex flex-col gap-1.5 sm:gap-2">
              <div className="flex items-center justify-between rounded-lg border border-[rgb(240,213,138/0.28)] bg-[rgb(16,10,5/0.62)] px-1.5 py-1">
                <button
                  type="button"
                  aria-label="Einsatz −"
                  disabled={busyRef.current || state.inFreeSpins}
                  onClick={() => changeBet(-1)}
                  className="grid size-8 place-items-center text-[#f6dc9c] disabled:opacity-40"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <div className="min-w-0 text-center">
                  <div className="font-display text-[7px] uppercase tracking-[0.16em] text-[#c9a227]">Einsatz</div>
                  <div className="font-display text-sm tabular-nums text-[#f6dc9c]">{formatBet(bet)}</div>
                </div>
                <button
                  type="button"
                  aria-label="Einsatz +"
                  disabled={busyRef.current || state.inFreeSpins}
                  onClick={() => changeBet(1)}
                  className="grid size-8 place-items-center text-[#f6dc9c] disabled:opacity-40"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={toggleAnte}
                disabled={busyRef.current || state.inFreeSpins}
                className={`flex h-9 items-center justify-center gap-1 rounded-md border font-display text-[9px] uppercase tracking-[0.12em] sm:h-10 sm:text-[10px] ${
                  anteBet
                    ? "border-[#c9a227] bg-[#c9a227] text-[#0b0704]"
                    : "border-[rgb(240,213,138/0.28)] bg-[rgb(16,10,5/0.62)] text-[#f6dc9c]"
                } disabled:opacity-40`}
              >
                <Zap className="size-3" />
                ANTE +25%
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                audio.unlock();
                if (autoSpins > 0) { setAutoSpins(0); return; }
                doSpin();
              }}
              disabled={!canSpin && autoSpins === 0}
              className="size-[68px] shrink-0 rounded-full border-2 border-[#f6dc9c] font-display text-sm font-semibold tracking-[0.18em] uppercase transition-transform duration-150 ease-out sm:size-[88px] sm:text-base disabled:opacity-40"
              style={{
                background: "radial-gradient(circle at 30% 22%, #f6dc9c, #c9a227 40%, #a36628)",
                color: "#0b0704",
                boxShadow: "0 0 22px rgb(226,183,90/0.45), 0 8px 24px rgb(0,0,0/0.5)",
              }}
            >
              {autoSpins > 0 ? autoSpins : "SPIN"}
            </button>

            <div className="flex flex-col items-stretch gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => { audio.buttonClick(); setTurbo((v) => !v); }}
                className={`flex h-9 items-center justify-center gap-1 rounded-md border font-display text-[9px] uppercase tracking-[0.12em] sm:h-10 sm:text-[10px] ${
                  turbo
                    ? "border-[#c9a227] bg-[#c9a227] text-[#0b0704]"
                    : "border-[rgb(240,213,138/0.28)] bg-[rgb(16,10,5/0.62)] text-[#f6dc9c]"
                }`}
              >
                <Zap className="size-3" />
                TURBO
              </button>

              <button
                type="button"
                onClick={toggleAuto}
                disabled={busyRef.current}
                className="flex h-9 items-center justify-center gap-1 rounded-md border border-[rgb(240,213,138/0.28)] bg-[rgb(16,10,5/0.62)] font-display text-[9px] uppercase tracking-[0.12em] text-[#f6dc9c] disabled:opacity-40 sm:h-10 sm:text-[10px]"
              >
                <Play className="size-3" />
                AUTO {autoSpins > 0 ? autoSpins : ""}
              </button>

              <button
                type="button"
                onClick={() => setShowBuy(true)}
                disabled={busyRef.current || state.inFreeSpins}
                className="flex h-9 items-center justify-center gap-1 rounded-md border border-[rgb(240,213,138/0.28)] bg-[rgb(16,10,5/0.62)] font-display text-[9px] uppercase tracking-[0.12em] text-[#f6dc9c] disabled:opacity-40 sm:h-10 sm:text-[10px]"
              >
                <ShoppingCart className="size-3" />
                BUY {formatBet(buyCost)}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showPaytable && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[rgb(10,6,4/0.85)] backdrop-blur-sm" onClick={() => setShowPaytable(false)}>
          <div className="mx-4 max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[rgb(240,213,138/0.35)] bg-[rgb(20,12,6/0.95)] p-4 shadow-[0_0_48px_rgb(226,183,90/0.2)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl tracking-[0.12em] text-[#f6dc9c]">Paytable</h2>
              <button type="button" onClick={() => setShowPaytable(false)} className="text-[#cbb07a] hover:text-[#f6dc9c]">
                <X className="size-5" />
              </button>
            </div>

            <p className="mb-3 text-xs text-[#cbb07a] leading-relaxed">
              Mindestens 8 identische Symbole irgendwo auf dem Raster = Gewinn.
              Tumble-Mechanik: Gewinn-Symbole verschwinden, neue fallen von oben.
              Orb-Multiplikatoren (2×–1000×) werden am Ende jeder Tumble-Sequenz aufsummiert und auf den Gewinn angewendet.
            </p>

            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[rgb(240,213,138/0.2)]">
                  <th className="py-2 text-left font-display text-[10px] uppercase tracking-wider text-[#c9a227]">Symbol</th>
                  <th className="py-2 text-center font-display text-[10px] uppercase tracking-wider text-[#c9a227]">8–9</th>
                  <th className="py-2 text-center font-display text-[10px] uppercase tracking-wider text-[#c9a227]">10–11</th>
                  <th className="py-2 text-center font-display text-[10px] uppercase tracking-wider text-[#c9a227]">12+</th>
                </tr>
              </thead>
              <tbody>
                {PAY_TABLE_DATA.map((row) => (
                  <tr key={row.sym} className="border-b border-[rgb(240,213,138/0.1)]">
                    <td className="py-1.5 font-display" style={{ color: row.color }}>{row.name}</td>
                    <td className="py-1.5 text-center text-[#f6e7c4]">{row.pay8}</td>
                    <td className="py-1.5 text-center text-[#f6e7c4]">{row.pay10}</td>
                    <td className="py-1.5 text-center text-[#f6e7c4]">{row.pay12}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-4 space-y-2 text-xs text-[#cbb07a]">
              <p><strong className="text-[#f6dc9c]">Scatter (Zeus):</strong> 4+ = Free Spins (15 Spins). 4 = 3×, 5 = 5×, 6 = 100× Einsatz.</p>
              <p><strong className="text-[#f6dc9c]">Orb Multiplikator:</strong> 2×–1000×. Am Ende jeder Tumble-Sequenz werden alle Orb-Werte summiert und auf den Gewinn angewendet.</p>
              <p><strong className="text-[#f6dc9c]">Free Spins:</strong> 15 Freispiele. Globaler Multiplikator steigt mit jedem Orb auf Gewinn-Spin. 3+ Scatter = +5 Retriggers.</p>
              <p><strong className="text-[#f6dc9c]">Ante Bet:</strong> +25% Einsatz, verdoppelt die chance auf Free Spins.</p>
              <p><strong className="text-[#f6dc9c]">Max Win:</strong> 15,000× Einsatz.</p>
              <p><strong className="text-[#f6dc9c]">RTP:</strong> 96.50%</p>
            </div>
          </div>
        </div>
      )}

      {showBuy && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[rgb(10,6,4/0.85)] backdrop-blur-sm" onClick={() => setShowBuy(false)}>
          <div className="mx-4 w-full max-w-sm rounded-2xl border border-[rgb(240,213,138/0.35)] bg-[rgb(20,12,6/0.95)] p-5 shadow-[0_0_48px_rgb(226,183,90/0.2)] text-center" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-lg tracking-[0.12em] text-[#f6dc9c] mb-3">Free Spins kaufen</h2>
            <p className="text-sm text-[#cbb07a] mb-4">
              15 Free Spins für <span className="text-[#f6dc9c] font-semibold">{formatBet(buyCost)}</span> ({BUY_FS_MULT}× Einsatz)
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowBuy(false)}
                className="flex-1 rounded-lg border border-[rgb(240,213,138/0.28)] bg-[rgb(16,10,5/0.62)] py-2.5 font-display text-xs uppercase tracking-[0.16em] text-[#cbb07a]"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => { buyFreeSpins(); setShowBuy(false); }}
                disabled={state.credits < buyCost}
                className="flex-1 rounded-lg border border-[#c9a227] bg-[#c9a227] py-2.5 font-display text-xs font-semibold uppercase tracking-[0.16em] text-[#0b0704] disabled:opacity-40"
              >
                Kaufen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
