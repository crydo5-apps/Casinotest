import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { randomHex } from "@/lib/random-id";

export const PLAY_GAMES = ["book", "cowboy", "roulette", "shop"] as const;
export const PLAY_KINDS = [
  "spin",
  "free_spin",
  "buy_fs",
  "expand",
  "gamble",
  "roulette",
  "deposit",
  "credit",
] as const;

export type PlayGame = (typeof PLAY_GAMES)[number];
export type PlayKind = (typeof PLAY_KINDS)[number];

export type PlayLogRow = {
  id: string;
  game: PlayGame;
  kind: PlayKind;
  stake: number;
  payout: number;
  delta: number;
  balance: number;
  detail: string;
  created_at: string;
};

function asInt(n: unknown) {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? Math.trunc(v) : 0;
}

export async function insertPlayLog(opts: {
  userId: string;
  game: PlayGame;
  kind: PlayKind;
  stake: number;
  payout: number;
  balance: number;
  detail?: string;
}) {
  const sql = await getSql();
  const id = randomHex(12);
  const delta = opts.payout - opts.stake;
  await sql`
    insert into play_log (id, user_id, game, kind, stake, payout, delta, balance, detail)
    values (
      ${id},
      ${opts.userId},
      ${opts.game},
      ${opts.kind},
      ${opts.stake},
      ${opts.payout},
      ${delta},
      ${opts.balance},
      ${opts.detail ?? ""}
    )
  `;
}

export const commitRound = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      game: z.enum(PLAY_GAMES),
      kind: z.enum(PLAY_KINDS),
      stake: z.number().int().min(0).max(50_000_000),
      payout: z.number().int().min(0).max(50_000_000),
      detail: z.string().max(200).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const updated = await sql<{ credits: number }>`
      update player
      set credits = credits - ${data.stake} + ${data.payout}
      where user_id = ${context.userId} and credits >= ${data.stake}
      returning credits
    `;
    if (!updated[0]) {
      const cur = await sql<{ credits: number }>`
        select credits from player where user_id = ${context.userId}
      `;
      return { ok: false as const, credits: asInt(cur[0]?.credits) };
    }
    const balance = asInt(updated[0].credits);
    await insertPlayLog({
      userId: context.userId,
      game: data.game,
      kind: data.kind,
      stake: data.stake,
      payout: data.payout,
      balance,
      detail: data.detail,
    });
    return { ok: true as const, credits: balance };
  });

export const listPlayLog = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<PlayLogRow>`
      select
        id,
        game,
        kind,
        stake,
        payout,
        delta,
        balance,
        detail,
        created_at::text as created_at
      from play_log
      where user_id = ${context.userId}
      order by created_at desc
      limit 250
    `;
    return {
      rows: rows.map((r) => ({
        ...r,
        stake: asInt(r.stake),
        payout: asInt(r.payout),
        delta: asInt(r.delta),
        balance: asInt(r.balance),
      })),
    };
  });
