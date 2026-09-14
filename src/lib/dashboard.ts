import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { isAdminEmail, sessionEmail } from "@/lib/player";
import { randomHex } from "@/lib/random-id";

export type DashGame = {
  id: string;
  timestamp: string;
  player: string;
  game: string;
  bet: number;
  result: "Gewonnen" | "Verloren" | "Draw";
  profit: number;
  duration: number;
  tableId: string;
};

export type DashPlayer = {
  id: string;
  name: string;
  totalBets: number;
  totalProfit: number;
  gamesPlayed: number;
  joinDate: string;
};

function asInt(n: unknown) {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? Math.trunc(v) : 0;
}

function dashLabel(game: string): string {
  if (game === "roulette") return "Roulette";
  if (game === "shop") return "Kasse";
  return "Slots";
}

function resultOf(delta: number): DashGame["result"] {
  if (delta > 0) return "Gewonnen";
  if (delta < 0) return "Verloren";
  return "Draw";
}

type LogJoin = {
  id: string;
  game: string;
  kind: string;
  stake: number;
  payout: number;
  delta: number;
  detail: string;
  created_at: string;
  email: string;
};

function toDash(row: LogJoin): DashGame {
  const delta = asInt(row.delta);
  return {
    id: row.id,
    timestamp: row.created_at,
    player: row.email,
    game: dashLabel(row.game),
    bet: asInt(row.stake),
    result: resultOf(delta),
    profit: delta,
    duration: 0,
    tableId: row.kind,
  };
}

function gameFilterSql(game: string | null): string[] | null {
  if (!game) return null;
  const g = game.toLowerCase();
  if (g === "slots" || g === "book" || g === "ramon") return ["book", "ramon"];
  if (g === "roulette") return ["roulette"];
  if (g === "kasse" || g === "shop") return ["shop"];
  return [game];
}

export async function queryDashGames(opts: {
  player?: string;
  game?: string;
  limit: number;
  offset: number;
  startDate?: string;
  endDate?: string;
}): Promise<{ rows: DashGame[]; total: number }> {
  const sql = await getSql();
  const games = gameFilterSql(opts.game ?? null);
  const player = opts.player?.trim() || "";
  const start = opts.startDate || "";
  const end = opts.endDate || "";
  const all = await sql<LogJoin>`
    select
      l.id,
      l.game,
      l.kind,
      l.stake,
      l.payout,
      l.delta,
      l.detail,
      l.created_at::text as created_at,
      coalesce(p.email, '') as email
    from play_log l
    left join player p on p.user_id = l.user_id
    where (${player} = '' or p.email = ${player})
      and (${start} = '' or l.created_at >= ${start}::timestamptz)
      and (${end} = '' or l.created_at < (${end}::date + interval '1 day'))
    order by l.created_at desc
  `;
  const filtered = games ? all.filter((r) => games.includes(r.game)) : all;
  const total = filtered.length;
  const slice = filtered.slice(opts.offset, opts.offset + opts.limit).map((r) =>
    toDash({
      ...r,
      stake: asInt(r.stake),
      payout: asInt(r.payout),
      delta: asInt(r.delta),
    }),
  );
  return { rows: slice, total };
}

export async function queryLatestGame(): Promise<DashGame | null> {
  const { rows } = await queryDashGames({ limit: 1, offset: 0 });
  return rows[0] ?? null;
}

export async function queryDashStats() {
  const sql = await getSql();
  const rows = await sql<{ stake: number; delta: number }>`
    select stake, delta from play_log
  `;
  const list = rows.map((r) => ({ stake: asInt(r.stake), delta: asInt(r.delta) }));
  const totalGames = list.length;
  const totalBets = list.reduce((s, r) => s + r.stake, 0);
  const totalProfit = list.reduce((s, r) => s + r.delta, 0);
  const wins = list.filter((r) => r.delta > 0).length;
  const mean = totalGames ? totalProfit / totalGames : 0;
  const variance = totalGames
    ? list.reduce((s, r) => s + (r.delta - mean) ** 2, 0) / totalGames
    : 0;
  return {
    totalBets,
    totalProfit,
    totalGames,
    winRate: totalGames ? Number(((wins / totalGames) * 100).toFixed(2)) : 0,
    averageBet: totalGames ? Number((totalBets / totalGames).toFixed(2)) : 0,
    maxBet: list.reduce((m, r) => Math.max(m, r.stake), 0),
    volatility: Number(Math.sqrt(variance).toFixed(2)),
  };
}

export async function queryDashPlayers(): Promise<DashPlayer[]> {
  const sql = await getSql();
  const rows = await sql<{
    user_id: string;
    email: string;
    created_at: string;
    games: number;
    bets: number;
    profit: number;
  }>`
    select
      p.user_id,
      p.email,
      p.created_at::text as created_at,
      count(l.id)::int as games,
      coalesce(sum(l.stake), 0)::int as bets,
      coalesce(sum(l.delta), 0)::int as profit
    from player p
    left join play_log l on l.user_id = p.user_id
    group by p.user_id, p.email, p.created_at
    order by bets desc, p.email
  `;
  return rows.map((r) => ({
    id: r.user_id,
    name: r.email,
    totalBets: asInt(r.bets),
    totalProfit: asInt(r.profit),
    gamesPlayed: asInt(r.games),
    joinDate: r.created_at.slice(0, 10),
  }));
}

export async function ensureDashboardToken(): Promise<string> {
  const sql = await getSql();
  const rows = await sql<{ dashboard_token: string }>`
    select dashboard_token from shop_settings where id = 1
  `;
  if (rows[0]?.dashboard_token) return rows[0].dashboard_token;
  const token = randomHex(24);
  await sql`
    insert into shop_settings (id, twint_phone, twint_name, dashboard_token)
    values (1, '', '', ${token})
    on conflict (id) do update set dashboard_token = excluded.dashboard_token
    where shop_settings.dashboard_token = ''
  `;
  const again = await sql<{ dashboard_token: string }>`
    select dashboard_token from shop_settings where id = 1
  `;
  return again[0]?.dashboard_token || token;
}

export const getDashboardFeed = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const email = await sessionEmail(context.userId);
    if (!isAdminEmail(email)) {
      return { ok: false as const, games: [] as DashGame[], players: [] as DashPlayer[], token: "" };
    }
    const { rows } = await queryDashGames({ limit: 500, offset: 0 });
    const players = await queryDashPlayers();
    const token = await ensureDashboardToken();
    return { ok: true as const, games: rows, players, token };
  });

export const rotateDashboardToken = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const email = await sessionEmail(context.userId);
    if (!isAdminEmail(email)) return { ok: false as const, token: "" };
    const token = randomHex(24);
    const sql = await getSql();
    await sql`
      insert into shop_settings (id, twint_phone, twint_name, dashboard_token)
      values (1, '', '', ${token})
      on conflict (id) do update set dashboard_token = excluded.dashboard_token
    `;
    return { ok: true as const, token };
  });
