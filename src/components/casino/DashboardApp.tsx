import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { House, RefreshCw } from "lucide-react";
import { getDashboardFeed, rotateDashboardToken, type DashGame } from "@/lib/dashboard";
import { formatCredits } from "@/lib/slot/engine";
import { cn } from "@/lib/utils";

const GAME_FILTERS = ["", "Slots", "Roulette", "Kasse"] as const;

function money(n: number) {
  return formatCredits(n, "de");
}

function when(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16).replace("T", " ");
  return d.toLocaleString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DashboardApp() {
  const [games, setGames] = useState<DashGame[]>([]);
  const [token, setToken] = useState("");
  const [player, setPlayer] = useState("");
  const [game, setGame] = useState("");
  const [sort, setSort] = useState<"date" | "amount" | "profit">("date");
  const [time, setTime] = useState<"all" | "today" | "week" | "month">("all");
  const [page, setPage] = useState(1);
  const [live, setLive] = useState(true);
  const [copied, setCopied] = useState(false);

  const load = () => {
    void getDashboardFeed()
      .then((r) => {
        if (!r.ok) return;
        setGames(r.games);
        setToken(r.token);
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(load, 4000);
    return () => window.clearInterval(id);
  }, [live]);

  const players = useMemo(() => [...new Set(games.map((g) => g.player).filter(Boolean))].sort(), [games]);

  const filtered = useMemo(() => {
    const now = new Date();
    let start = new Date(0);
    if (time === "today") start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (time === "week") start = new Date(now.getTime() - 7 * 86400000);
    if (time === "month") start = new Date(now.getFullYear(), now.getMonth(), 1);
    const rows = games.filter((d) => {
      if (player && d.player !== player) return false;
      if (game && d.game !== game) return false;
      return new Date(d.timestamp).getTime() >= start.getTime();
    });
    if (sort === "amount") rows.sort((a, b) => b.bet - a.bet);
    else if (sort === "profit") rows.sort((a, b) => b.profit - a.profit);
    return rows;
  }, [games, player, game, sort, time]);

  const perPage = 10;
  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const slice = filtered.slice((page - 1) * perPage, page * perPage);

  const totalBet = filtered.reduce((s, d) => s + d.bet, 0);
  const totalProfit = filtered.reduce((s, d) => s + d.profit, 0);
  const wins = filtered.filter((d) => d.result === "Gewonnen").length;
  const winRate = filtered.length ? Math.round((wins / filtered.length) * 100) : 0;
  const avgBet = filtered.length ? Math.round(totalBet / filtered.length) : 0;
  const maxBet = filtered.reduce((m, d) => Math.max(m, d.bet), 0);

  const byPlayer: Record<string, { bets: number; profit: number }> = {};
  filtered.forEach((d) => {
    byPlayer[d.player] ??= { bets: 0, profit: 0 };
    byPlayer[d.player].bets += d.bet;
    byPlayer[d.player].profit += d.profit;
  });
  const topPlayers = Object.entries(byPlayer)
    .sort((a, b) => b[1].bets - a[1].bets)
    .slice(0, 3);

  const byGame: Record<string, number> = { Slots: 0, Roulette: 0, Kasse: 0 };
  filtered.forEach((d) => {
    byGame[d.game] = (byGame[d.game] ?? 0) + d.bet;
  });
  const gameMax = Math.max(1, ...Object.values(byGame));

  const hours = Array.from({ length: 12 }, (_, i) => {
    const h = new Date();
    h.setMinutes(0, 0, 0);
    h.setHours(h.getHours() - (11 - i));
    const sum = filtered
      .filter((d) => {
        const t = new Date(d.timestamp);
        return t.getHours() === h.getHours() && t.getDate() === h.getDate();
      })
      .reduce((s, d) => s + d.profit, 0);
    return { label: `${h.getHours()}:00`, sum };
  });
  const hourAbs = Math.max(1, ...hours.map((h) => Math.abs(h.sum)));

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const connectUrl = token
    ? `https://crydo5-apps.github.io/casino-dashboard/?api=${encodeURIComponent(origin)}&token=${encodeURIComponent(token)}`
    : "";

  return (
    <div className="min-h-dvh bg-[#0f0f0f] px-4 py-6 text-[#e0e0e0] sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b-2 border-[#d4af37] pb-5">
          <div>
            <p className="font-display text-[10px] uppercase tracking-[0.32em] text-[#d4af37]">Crydo5 · Brugg AG</p>
            <h1 className="font-display text-3xl tracking-[0.12em] text-[#d4af37]">Casino Dashboard</h1>
            <p className="mt-1 text-sm text-[#999]">Echtzeit Spielerstatistiken und Spielhistorie</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs",
                live ? "border-[#4caf50] bg-[rgba(76,175,80,0.2)] text-[#4caf50]" : "border-[#444] text-[#999]",
              )}
            >
              {live && <span className="size-2 animate-pulse rounded-full bg-[#4caf50]" />}
              {live ? "LIVE" : "OFFLINE"}
            </div>
            <button
              type="button"
              onClick={() => setLive((v) => !v)}
              className="rounded-md border border-[#d4af37] px-3 py-2 font-display text-[10px] uppercase tracking-[0.16em] text-[#d4af37]"
            >
              {live ? "Updates stoppen" : "Updates starten"}
            </button>
            <button
              type="button"
              onClick={load}
              className="grid size-10 place-items-center rounded-md border border-[#444] text-[#d4af37]"
              aria-label="Aktualisieren"
            >
              <RefreshCw className="size-4" />
            </button>
            <Link to="/" className="grid size-10 place-items-center rounded-md border border-[#444] text-[#d4af37]">
              <House className="size-4" />
            </Link>
          </div>
        </header>

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Gesamte Einsätze" value={money(totalBet)} />
          <Stat label="Netto Gewinn/Verlust" value={`${totalProfit >= 0 ? "+" : ""}${money(totalProfit)}`} tone={totalProfit >= 0 ? "pos" : "neg"} />
          <Stat label="Ø Einsatz" value={money(avgBet)} sub={`${filtered.length} Spiele`} />
          <Stat label="Gewinnquote" value={`${winRate}%`} sub={`${wins} Siege`} />
          <Stat label="Höchster Einsatz" value={money(maxBet)} />
        </div>

        <div className="mb-6 grid gap-3 rounded-lg border border-[#333] bg-[#1a1a1a] p-4 sm:grid-cols-4">
          <Field label="Spieler">
            <select value={player} onChange={(e) => { setPlayer(e.target.value); setPage(1); }} className="dash-select">
              <option value="">Alle Spieler</option>
              {players.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </Field>
          <Field label="Spiel">
            <select value={game} onChange={(e) => { setGame(e.target.value); setPage(1); }} className="dash-select">
              {GAME_FILTERS.map((g) => (
                <option key={g || "all"} value={g}>{g || "Alle Spiele"}</option>
              ))}
            </select>
          </Field>
          <Field label="Sortierung">
            <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="dash-select">
              <option value="date">Nach Datum</option>
              <option value="amount">Nach Einsatz</option>
              <option value="profit">Nach Gewinn/Verlust</option>
            </select>
          </Field>
          <Field label="Zeitraum">
            <select value={time} onChange={(e) => { setTime(e.target.value as typeof time); setPage(1); }} className="dash-select">
              <option value="all">Alle Zeiten</option>
              <option value="today">Heute</option>
              <option value="week">Diese Woche</option>
              <option value="month">Dieser Monat</option>
            </select>
          </Field>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <Card title="Top Spieler">
            {topPlayers.length === 0 ? <p className="text-sm text-[#999]">Noch keine Spiele.</p> : topPlayers.map(([name, d]) => (
              <Row key={name} label={name} value={money(d.bets)} />
            ))}
          </Card>
          <Card title="Einsätze nach Spiel">
            {Object.entries(byGame).map(([name, amt]) => (
              <div key={name} className="mb-2">
                <Row label={name} value={money(amt)} />
                <div className="mt-1 h-1.5 overflow-hidden rounded bg-[#333]">
                  <div className="h-full bg-[#d4af37]" style={{ width: `${(amt / gameMax) * 100}%` }} />
                </div>
              </div>
            ))}
          </Card>
          <Card title="Gewinn/Verlust 12h">
            <div className="flex h-24 items-end gap-1">
              {hours.map((h) => (
                <div key={h.label} className="flex flex-1 flex-col items-center justify-end" title={`${h.label}: ${money(h.sum)}`}>
                  <div
                    className={cn("w-full rounded-t", h.sum >= 0 ? "bg-[#4caf50]" : "bg-[#ff6b6b]")}
                    style={{ height: `${Math.max(6, (Math.abs(h.sum) / hourAbs) * 100)}%` }}
                  />
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="overflow-hidden rounded-lg border border-[#333] bg-[#1a1a1a]">
          <div className="flex items-center justify-between border-b border-[#333] px-4 py-3">
            <h2 className="font-display text-sm tracking-[0.16em] text-[#d4af37]">Spielhistorie</h2>
            <span className="text-xs text-[#999]">{filtered.length} Einträge</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#0f0f0f] font-display text-[10px] uppercase tracking-[0.16em] text-[#d4af37]">
                <tr>
                  <th className="px-4 py-3">Zeit</th>
                  <th className="px-4 py-3">Spieler</th>
                  <th className="px-4 py-3">Spiel</th>
                  <th className="px-4 py-3">Einsatz</th>
                  <th className="px-4 py-3">Ergebnis</th>
                  <th className="px-4 py-3">Gewinn/Verlust</th>
                </tr>
              </thead>
              <tbody>
                {slice.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[#999]">Noch keine Spiele geloggt.</td>
                  </tr>
                ) : (
                  slice.map((d) => (
                    <tr key={d.id} className="border-t border-[#333]">
                      <td className="px-4 py-3 text-[#ccc]">{when(d.timestamp)}</td>
                      <td className="px-4 py-3">{d.player}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "rounded px-2 py-0.5 text-[10px] uppercase tracking-wide",
                          d.game === "Roulette" && "bg-[rgba(212,175,55,0.2)] text-[#d4af37]",
                          d.game === "Slots" && "bg-[rgba(76,175,80,0.2)] text-[#4caf50]",
                          d.game === "Kasse" && "bg-[rgba(156,39,176,0.2)] text-[#ce93d8]",
                        )}>{d.game}</span>
                      </td>
                      <td className="px-4 py-3 tabular-nums">{money(d.bet)}</td>
                      <td className="px-4 py-3">{d.result}</td>
                      <td className={cn("px-4 py-3 tabular-nums", d.profit > 0 && "text-[#4caf50]", d.profit < 0 && "text-[#ff6b6b]")}>
                        {d.profit > 0 ? "+" : ""}{money(d.profit)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="flex justify-center gap-1 bg-[#0f0f0f] py-3">
              {Array.from({ length: Math.min(pages, 8) }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  className={cn(
                    "min-w-8 rounded border px-2 py-1 text-xs",
                    n === page ? "border-[#d4af37] bg-[#d4af37] text-[#0f0f0f]" : "border-[#444] text-[#e0e0e0]",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 rounded-lg border border-[#333] bg-[#1a1a1a] p-4">
          <h2 className="font-display text-sm tracking-[0.16em] text-[#d4af37]">GitHub-Dashboard verbinden</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#999]">
            Das externe Dashboard unter crydo5-apps/casino-dashboard liest dieselben Daten über{" "}
            <code className="text-[#d4af37]">/api/games</code>, <code className="text-[#d4af37]">/api/stats</code> und{" "}
            <code className="text-[#d4af37]">/api/players</code>. Token in der URL nicht öffentlich teilen.
          </p>
          <p className="mt-3 break-all rounded-md bg-[#0f0f0f] p-3 font-mono text-xs text-[#d4af37]">{connectUrl || "Token wird erzeugt …"}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!connectUrl}
              onClick={() => {
                void navigator.clipboard.writeText(connectUrl);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              }}
              className="rounded-md bg-[#d4af37] px-4 py-2 font-display text-[10px] uppercase tracking-[0.16em] text-[#0f0f0f] disabled:opacity-40"
            >
              {copied ? "Kopiert" : "Link kopieren"}
            </button>
            <button
              type="button"
              onClick={() => {
                void rotateDashboardToken().then((r) => {
                  if (r.token) setToken(r.token);
                });
              }}
              className="rounded-md border border-[#d4af37] px-4 py-2 font-display text-[10px] uppercase tracking-[0.16em] text-[#d4af37]"
            >
              Token neu
            </button>
          </div>
        </div>
      </div>
      <style>{`
        .dash-select { background:#2a2a2a; border:1px solid #444; color:#e0e0e0; padding:0.65rem; border-radius:4px; width:100%; }
      `}</style>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "pos" | "neg" }) {
  return (
    <div className="rounded-lg border border-[#333] bg-gradient-to-br from-[#1a1a1a] to-[#252525] p-4 text-center">
      <p className="text-[10px] uppercase tracking-[0.16em] text-[#999]">{label}</p>
      <p className={cn("mt-1 font-display text-xl tabular-nums text-[#d4af37]", tone === "pos" && "text-[#4caf50]", tone === "neg" && "text-[#ff6b6b]")}>{value}</p>
      {sub && <p className="mt-1 text-xs text-[#4caf50]">{sub}</p>}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#333] bg-gradient-to-br from-[#1a1a1a] to-[#252525] p-4">
      <h2 className="mb-3 border-b border-[#333] pb-2 font-display text-[10px] uppercase tracking-[0.18em] text-[#d4af37]">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-display text-[10px] uppercase tracking-[0.16em] text-[#d4af37]">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 py-1 text-sm">
      <span className="truncate text-[#999]">{label}</span>
      <span className="tabular-nums text-[#e0e0e0]">{value}</span>
    </div>
  );
}
