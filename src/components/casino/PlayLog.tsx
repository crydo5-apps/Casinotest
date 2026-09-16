import { useEffect, useState } from "react";
import { ScrollText, X } from "lucide-react";
import { listPlayLog, type PlayGame, type PlayKind, type PlayLogRow } from "@/lib/play";
import { formatCredits } from "@/lib/slot/engine";
import { cn } from "@/lib/utils";

const GAME_DE: Record<PlayGame, string> = {
  book: "Book of Ra",
  cowboy: "El Cowboy",
  roulette: "Roulette",
  shop: "Kasse",
};

const KIND_DE: Record<PlayKind, string> = {
  spin: "Spin",
  free_spin: "Freispiel",
  buy_fs: "Freispiele gekauft",
  expand: "Expand-Spin",
  gamble: "Risiko",
  roulette: "Roulette",
  deposit: "Einzahlung",
  credit: "Gutschrift",
};

function when(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16).replace("T", " ");
  return d.toLocaleString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function LogButton({ onClick, label = "Log" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tomb-panel grid size-10 place-items-center rounded-full text-gold-2 sm:size-11"
      aria-label={label}
    >
      <ScrollText className="size-4 sm:size-5" />
    </button>
  );
}

export function PlayLogSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<PlayLogRow[] | null>(null);

  useEffect(() => {
    if (!open) return;
    let live = true;
    setRows(null);
    void listPlayLog()
      .then((r) => {
        if (live) setRows(r.rows);
      })
      .catch(() => {
        if (live) setRows([]);
      });
    return () => {
      live = false;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center bg-ink/75 sm:items-center">
      <div className="tomb-panel flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-2xl p-5 sm:rounded-2xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-display text-[10px] uppercase tracking-[0.28em] text-gold">Konto</p>
            <h2 className="font-display text-xl tracking-[0.12em] text-gold-2">Spiel-Log</h2>
          </div>
          <button type="button" aria-label="Schließen" onClick={onClose} className="grid size-10 place-items-center text-muted">
            <X className="size-5" />
          </button>
        </div>
        <p className="mt-1 text-xs text-muted">Jeder Einsatz, Gewinn und Verlust — über die ganze Spielzeit.</p>
        <div className="mt-4 min-h-0 flex-1 overflow-auto">
          {rows === null ? (
            <p className="py-8 text-center font-display tracking-[0.2em] text-gold">…</p>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">Noch keine Spiele.</p>
          ) : (
            <ul className="space-y-2">
              {rows.map((r) => {
                const loss = r.delta < 0;
                const win = r.delta > 0;
                return (
                  <li key={r.id} className="rounded-lg border border-gold/20 bg-ink/40 px-3 py-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-display text-sm text-gold-2">
                        {GAME_DE[r.game]} · {KIND_DE[r.kind]}
                      </p>
                      <p
                        className={cn(
                          "font-display text-sm tabular-nums",
                          win && "text-emerald-300",
                          loss && "text-red-300",
                          !win && !loss && "text-muted",
                        )}
                      >
                        {win ? "+" : ""}
                        {formatCredits(r.delta, "de")}
                      </p>
                    </div>
                    <p className="mt-0.5 font-display text-[10px] uppercase tracking-[0.14em] text-muted">
                      {when(r.created_at)}
                    </p>
                    <div className="mt-1 grid grid-cols-3 gap-2 font-display text-[11px] tabular-nums text-gold">
                      <span>Einsatz {formatCredits(r.stake, "de")}</span>
                      <span>Gewinn {formatCredits(r.payout, "de")}</span>
                      <span className="text-right">Stand {formatCredits(r.balance, "de")}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
