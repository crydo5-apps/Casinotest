import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { House, LayoutDashboard, ShieldCheck, Volume2, VolumeX, X } from "lucide-react";
import { signOut } from "@/lib/auth/client";
import { audio } from "@/lib/slot/audio";
import { t } from "@/lib/slot/copy";
import { formatCredits } from "@/lib/slot/engine";
import { LogButton, PlayLogSheet } from "@/components/casino/PlayLog";
import { getWallet, requestDeposit, type DepositRow } from "@/lib/wallet";
import { commitRound } from "@/lib/play";
import {
  CHIP_VALUES,
  RED,
  WHEEL,
  type Bet,
  type Placed,
  betKey,
  colorOf,
  settle,
  spinNumber,
  wheelAngle,
} from "@/lib/roulette/engine";
import { cn } from "@/lib/utils";

const CHIP_TONE: Record<number, string> = {
  1: "linear-gradient(180deg,#f7f7f7,#cfcfcf)",
  5: "linear-gradient(180deg,#e35a4f,#8d1c16)",
  10: "linear-gradient(180deg,#4ea3e0,#1a4f86)",
  25: "linear-gradient(180deg,#3dba7a,#14663c)",
  100: "linear-gradient(180deg,#2a2a2a,#0a0a0a)",
};

export function RouletteApp({ admin = false }: { admin?: boolean }) {
  const copy = t("de");
  const [credits, setCredits] = useState(0);
  const [chip, setChip] = useState(5);
  const [bets, setBets] = useState<Placed[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [angle, setAngle] = useState(0);
  const [ball, setBall] = useState(0);
  const [ballDrop, setBallDrop] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [banner, setBanner] = useState("Faites vos jeux");
  const [showLog, setShowLog] = useState(false);
  const [muted, setMuted] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);
  const [twintPhone, setTwintPhone] = useState("");
  const [twintName, setTwintName] = useState("");
  const [pending, setPending] = useState<DepositRow[]>([]);
  const creditsRef = useRef(0);
  const walletReady = useRef(false);
  creditsRef.current = credits;

  const stake = useMemo(() => bets.reduce((s, b) => s + b.amount, 0), [bets]);

  useEffect(() => {
    void getWallet().then((w) => {
      setCredits(w.credits);
      setTwintPhone(w.twintPhone);
      setTwintName(w.twintName);
      setPending(w.pending);
      walletReady.current = true;
    });
  }, []);

  useEffect(() => {
    audio.setMuted(muted);
  }, [muted]);

  const place = (bet: Bet) => {
    if (spinning) return;
    if (credits < chip) {
      setBanner(copy.broke);
      return;
    }
    audio.click();
    setCredits((c) => c - chip);
    setBets((prev) => {
      const key = betKey(bet);
      const i = prev.findIndex((p) => p.key === key);
      if (i === -1) return [...prev, { key, bet, amount: chip }];
      const next = [...prev];
      next[i] = { ...next[i], amount: next[i].amount + chip };
      return next;
    });
    setBanner("Rien ne va plus?");
    setResult(null);
  };

  const clear = () => {
    if (spinning) return;
    setCredits((c) => c + stake);
    setBets([]);
    setBanner("Faites vos jeux");
  };

  const spin = () => {
    if (spinning || bets.length === 0) return;
    audio.unlock();
    audio.click();
    const n = spinNumber();
    const extra = 360 * (5 + Math.floor(Math.random() * 3));
    const target = extra + (360 - wheelAngle(n));
    setSpinning(true);
    setResult(null);
    setBallDrop(false);
    setBanner("Rien ne va plus");
    setAngle((a) => a + target);
    setBall((b) => b - (360 * 8 + 18));
    window.setTimeout(() => setBallDrop(true), 4300);
    window.setTimeout(() => {
      const { payout, won } = settle(bets, n);
      setResult(n);
      setSpinning(false);
      setBets([]);
      void commitRound({
        data: { game: "roulette", kind: "roulette", stake, payout, detail: String(n) },
      })
        .then((r) => {
          if (typeof r.credits === "number") setCredits(r.credits);
          else if (payout > 0) setCredits((c) => c + payout);
        })
        .catch(() => {
          if (payout > 0) setCredits((c) => c + payout);
        });
      const col = colorOf(n);
      const colDe = col === "red" ? "Rot" : col === "black" ? "Schwarz" : "Zero";
      setBanner(won > 0 ? `${n} ${colDe}  ·  +${won}` : won === 0 ? `${n} ${colDe}` : `${n} ${colDe}  ·  ${won}`);
    }, 5600);
  };

  const chipOn = (key: string) => bets.find((b) => b.key === key)?.amount;

  return (
    <div className="relative flex h-dvh max-h-dvh flex-col overflow-hidden bg-[#070504] text-fg">
      <img src="/bg/casino.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgb(40_22_8/0.35),rgb(6_4_3/0.92))]" />

      <header className="relative z-10 flex shrink-0 items-center justify-between gap-2 px-3 pt-[max(0.4rem,env(safe-area-inset-top))]">
        <div className="min-w-0">
          <p className="font-display text-[10px] uppercase tracking-[0.32em] text-gold">Crydo5 · Brugg AG</p>
          <h1 className="title-glow font-display text-xl tracking-[0.16em] text-gold-2">Roulette</h1>
        </div>
        <div className="flex items-center gap-1.5">
          <Link to="/" className="tomb-panel grid size-10 place-items-center rounded-full text-gold-2">
            <House className="size-4" />
          </Link>
          <button type="button" onClick={() => setMuted((m) => !m)} className="tomb-panel grid size-10 place-items-center rounded-full text-gold-2">
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </button>
          {admin && (
            <Link to="/admin" className="tomb-panel grid size-10 place-items-center rounded-full text-gold-2">
              <ShieldCheck className="size-4" />
            </Link>
          )}
          <button type="button" onClick={() => void signOut("/login")} className="tomb-panel grid size-10 place-items-center rounded-full text-gold-2">
            <X className="size-4" />
          </button>
        </div>
      </header>

      <div className="relative z-10 mx-3 mt-1 grid shrink-0 grid-cols-3 gap-2">
        <Meter label="Guthaben" value={formatCredits(credits, "de", false)} />
        <Meter label="Einsatz" value={String(stake)} />
        <Meter label="Kugel" value={result === null ? "—" : String(result)} tone={result === null ? undefined : colorOf(result)} />
      </div>

      <div className="relative z-10 mx-3 mt-2 flex min-h-0 flex-1 flex-col">
        <div className="roulette-table">
          <div className="roulette-flow">
            <div className="roulette-scene grid shrink-0 place-items-center px-2 py-3">
              <Wheel3D angle={angle} ball={ball} spinning={spinning} drop={ballDrop} result={result} />
            </div>
            <div className="min-h-0 min-w-0 flex-1 overflow-auto pb-1">
              <Table bets={chipOn} onPlace={place} disabled={spinning} hit={result} />
            </div>
          </div>

          <div className="relative z-10 shrink-0 border-t border-gold/20 bg-[rgb(8_20_12/0.45)] px-3 py-2 pb-[max(0.6rem,env(safe-area-inset-bottom))]">
            {banner && (
              <p className="roulette-banner mb-2 text-center font-display text-sm tracking-[0.22em] text-gold-2">
                {banner}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-center gap-2">
              {CHIP_VALUES.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setChip(v)}
                  className="chip-3d text-white"
                  data-on={chip === v ? "1" : "0"}
                  style={{ background: CHIP_TONE[v], color: v === 1 ? "#1a1008" : "#fff" }}
                >
                  {v}
                </button>
              ))}
              <button type="button" onClick={clear} disabled={spinning || bets.length === 0} className="h-11 rounded-full border border-gold/40 px-4 font-display text-xs uppercase tracking-[0.16em] text-gold-2 disabled:opacity-40">
                Clear
              </button>
              <button type="button" onClick={() => setShowDeposit(true)} className="h-11 rounded-full border border-gold/40 px-4 font-display text-xs uppercase tracking-[0.16em] text-gold-2">
                Aufladen
              </button>
              <button
                type="button"
                onClick={spin}
                disabled={spinning || bets.length === 0}
                className="h-12 min-w-32 rounded-full border-2 border-gold-2 bg-[radial-gradient(circle_at_30%_22%,var(--color-gold-2),var(--color-gold)_40%,var(--color-bronze))] px-8 font-display tracking-[0.22em] text-ink disabled:opacity-40"
              >
                {spinning ? "…" : "Spin"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showDeposit && (
        <DepositMini
          copy={copy}
          twintPhone={twintPhone}
          twintName={twintName}
          pending={pending}
          onClose={() => setShowDeposit(false)}
          onRequest={async (chf, method) => {
            const res = await requestDeposit({ data: { chf, method } });
            const w = await getWallet();
            setPending(w.pending);
            setTwintPhone(w.twintPhone);
            setTwintName(w.twintName);
            if (typeof res.credits === "number") setCredits(res.credits);
            else if (w.credits > creditsRef.current) setCredits(w.credits);
            if (res.instant) setShowDeposit(false);
          }}
        />
      )}
    </div>
  );
}

function Meter({ label, value, tone }: { label: string; value: string; tone?: "red" | "black" | "green" }) {
  return (
    <div className="tomb-panel rounded-md px-2 py-1.5 text-center">
      <p className="font-display text-[9px] uppercase tracking-[0.18em] text-gold">{label}</p>
      <p
        className={cn(
          "font-display text-sm tabular-nums text-gold-2",
          tone === "red" && "text-red-400",
          tone === "black" && "text-zinc-200",
          tone === "green" && "text-emerald-400",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Wheel3D({
  angle,
  ball,
  spinning,
  drop,
  result,
}: {
  angle: number;
  ball: number;
  spinning: boolean;
  drop: boolean;
  result: number | null;
}) {
  const seg = 360 / WHEEL.length;
  return (
    <div className="roulette-wheel">
      <div className="roulette-bowl" />
      <div
        className={cn("roulette-rotor", spinning && "is-spinning")}
        style={{ ["--rot" as string]: `${angle}deg` }}
      >
        <svg viewBox="0 0 100 100" className="h-full w-full">
          {WHEEL.map((n, i) => {
            const a0 = ((i * seg - 90) * Math.PI) / 180;
            const a1 = (((i + 1) * seg - 90) * Math.PI) / 180;
            const x0 = 50 + 50 * Math.cos(a0);
            const y0 = 50 + 50 * Math.sin(a0);
            const x1 = 50 + 50 * Math.cos(a1);
            const y1 = 50 + 50 * Math.sin(a1);
            const fill = n === 0 ? "#0d7a3c" : RED.has(n) ? "#b31f1f" : "#121212";
            const mid = ((i + 0.5) * seg - 90) * (Math.PI / 180);
            const tx = 50 + 39 * Math.cos(mid);
            const ty = 50 + 39 * Math.sin(mid);
            return (
              <g key={n}>
                <path d={`M50 50 L${x0} ${y0} A50 50 0 0 1 ${x1} ${y1} Z`} fill={fill} />
                <path d={`M50 50 L${x0} ${y0}`} stroke="rgba(246,220,156,0.28)" strokeWidth="0.35" />
                <text
                  x={tx}
                  y={ty}
                  fill="#f6e7c4"
                  fontSize="3.8"
                  fontFamily="Cinzel, serif"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${i * seg} ${tx} ${ty})`}
                >
                  {n}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="roulette-cone" />
      <div className={cn("roulette-ball-pivot", spinning && "is-spinning")} style={{ ["--ball" as string]: `${ball}deg` }}>
        <div className={cn("roulette-ball", drop && "is-drop")} />
      </div>
      <div className="roulette-pointer" />
      {result !== null && !spinning && (
        <div className="absolute inset-0 z-10 grid place-items-center" style={{ transform: "translateZ(36px)" }}>
          <span
            className={cn(
              "rounded-full px-3 py-1 font-display text-2xl shadow-lg",
              colorOf(result) === "red" && "bg-red-800 text-white",
              colorOf(result) === "black" && "bg-zinc-950 text-white",
              colorOf(result) === "green" && "bg-emerald-800 text-white",
            )}
          >
            {result}
          </span>
        </div>
      )}
    </div>
  );
}

function Table({
  bets,
  onPlace,
  disabled,
  hit,
}: {
  bets: (key: string) => number | undefined;
  onPlace: (b: Bet) => void;
  disabled: boolean;
  hit: number | null;
}) {
  return (
    <div className="roulette-felt-grid mx-auto select-none">
      <div
        className="grid gap-[2px]"
        style={{
          gridTemplateColumns: "1.15fr repeat(12, 1fr) 1.15fr",
          gridTemplateRows: "repeat(3, minmax(2.4rem, 1fr)) minmax(2.1rem, auto) minmax(2.1rem, auto)",
        }}
      >
        <BetCell
          className="row-span-3 bg-[#0f6a38]"
          label="0"
          amount={bets("n-0")}
          hot={hit === 0}
          onClick={() => onPlace({ type: "straight", n: 0 })}
          disabled={disabled}
        />
        {Array.from({ length: 36 }, (_, i) => i + 1).map((n) => {
          const col = Math.ceil(n / 3) + 1;
          const row = n % 3 === 0 ? 1 : n % 3 === 2 ? 2 : 3;
          const c = colorOf(n);
          return (
            <BetCell
              key={n}
              style={{ gridColumn: col, gridRow: row }}
              className={c === "red" ? "bg-[#9b1c1c]" : "bg-[#141414]"}
              label={String(n)}
              amount={bets(`n-${n}`)}
              hot={hit === n}
              onClick={() => onPlace({ type: "straight", n })}
              disabled={disabled}
            />
          );
        })}
        {([3, 2, 1] as const).map((c, i) => (
          <BetCell
            key={`col-${c}`}
            style={{ gridColumn: 14, gridRow: i + 1 }}
            className="bg-[#0b3d24] text-gold-2"
            label="2:1"
            amount={bets(`c-${c}`)}
            onClick={() => onPlace({ type: "column", c })}
            disabled={disabled}
          />
        ))}
        {([1, 2, 3] as const).map((d) => (
          <BetCell
            key={`d-${d}`}
            style={{ gridColumn: `${(d - 1) * 4 + 2} / span 4`, gridRow: 4 }}
            className="bg-[#0b3d24] text-gold-2"
            label={d === 1 ? "1–12" : d === 2 ? "13–24" : "25–36"}
            amount={bets(`d-${d}`)}
            onClick={() => onPlace({ type: "dozen", d })}
            disabled={disabled}
          />
        ))}
        {(
          [
            [{ type: "low" as const }, "1–18", 2, "bg-[#0b3d24] text-gold-2"],
            [{ type: "even" as const }, "Gerade", 4, "bg-[#0b3d24] text-gold-2"],
            [{ type: "red" as const }, "Rot", 6, "bg-[#9b1c1c]"],
            [{ type: "black" as const }, "Schwarz", 8, "bg-[#141414]"],
            [{ type: "odd" as const }, "Ungerade", 10, "bg-[#0b3d24] text-gold-2"],
            [{ type: "high" as const }, "19–36", 12, "bg-[#0b3d24] text-gold-2"],
          ] as const
        ).map(([bet, label, col, cls]) => (
          <BetCell
            key={label}
            style={{ gridColumn: `${col} / span 2`, gridRow: 5 }}
            className={cls}
            label={label}
            amount={bets(betKey(bet))}
            onClick={() => onPlace(bet)}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}

function BetCell({
  label,
  amount,
  onClick,
  disabled,
  className,
  style,
  hot,
}: {
  label: string;
  amount?: number;
  onClick: () => void;
  disabled: boolean;
  className?: string;
  style?: CSSProperties;
  hot?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={style}
      className={cn(
        "relative flex min-h-9 items-center justify-center rounded-[4px] border border-white/10 font-display text-[11px] tracking-wide text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.12)] sm:text-xs",
        hot && "ring-2 ring-gold-2",
        className,
      )}
    >
      {label}
      {amount ? <span className="chip-mark">{amount}</span> : null}
    </button>
  );
}

function DepositMini({
  copy,
  twintPhone,
  twintName,
  pending,
  onClose,
  onRequest,
}: {
  copy: ReturnType<typeof t>;
  twintPhone: string;
  twintName: string;
  pending: DepositRow[];
  onClose: () => void;
  onRequest: (chf: number, method: "twint" | "cash") => Promise<void>;
}) {
  const [chf, setChf] = useState(20);
  const [method, setMethod] = useState<"twint" | "cash">("twint");
  const [busy, setBusy] = useState(false);
  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center bg-ink/75 sm:items-center">
      <div className="tomb-panel w-full max-w-md rounded-t-2xl p-5 sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg text-gold-2">{copy.depositTitle}</h2>
          <button type="button" onClick={onClose} className="grid size-10 place-items-center text-muted">
            <X className="size-5" />
          </button>
        </div>
        <p className="mt-2 text-sm text-muted">{copy.depositBody}</p>
        <div className="mt-3 grid grid-cols-5 gap-1.5">
          {[10, 20, 50, 100, 200].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setChf(n)}
              className={cn("h-10 rounded-md font-display", chf === n ? "bg-gold text-ink" : "tomb-panel text-gold-2")}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setMethod("twint")} className={cn("h-10 rounded-md font-display text-xs", method === "twint" ? "bg-gold text-ink" : "tomb-panel text-gold-2")}>
            TWINT
          </button>
          <button type="button" onClick={() => setMethod("cash")} className={cn("h-10 rounded-md font-display text-xs", method === "cash" ? "bg-gold text-ink" : "tomb-panel text-gold-2")}>
            Bar
          </button>
        </div>
        {method === "twint" && (
          <p className="mt-3 text-center font-display text-xl text-gold-2">{twintPhone || copy.depositNoTwint}</p>
        )}
        {twintName && method === "twint" && <p className="text-center text-xs text-gold">{twintName}</p>}
        {pending[0] && <p className="mt-2 text-center text-xs text-gold">{copy.depositPending}</p>}
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void onRequest(chf, method).finally(() => setBusy(false));
          }}
          className="mt-4 h-12 w-full rounded-md bg-gold font-display tracking-[0.16em] text-ink"
        >
          {copy.depositSend}
        </button>
      </div>
    </div>
  );
}
