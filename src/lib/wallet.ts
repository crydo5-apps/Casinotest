import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { ADMIN_INBOX, isAdminEmail, sessionEmail } from "@/lib/player";
import { randomHex } from "@/lib/random-id";

export const DEPOSIT_AMOUNTS = [10, 20, 50, 100, 200] as const;

export type DepositMethod = "twint" | "cash";
export type DepositStatus = "pending" | "paid" | "rejected";

export type DepositRow = {
  id: string;
  user_id: string;
  email: string;
  chf: number;
  credits: number;
  method: DepositMethod;
  status: DepositStatus;
  created_at: string;
};

function asInt(n: unknown) {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? Math.trunc(v) : 0;
}

export const getWallet = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{ credits: number }>`
      select credits from player where user_id = ${context.userId}
    `;
    const settings = await sql<{ twint_phone: string; twint_name: string }>`
      select twint_phone, twint_name from shop_settings where id = 1
    `;
    const pending = await sql<DepositRow>`
      select id, user_id, email, chf, credits, method, status, created_at::text as created_at
      from deposit
      where user_id = ${context.userId} and status = 'pending'
      order by created_at desc
    `;
    return {
      credits: asInt(rows[0]?.credits),
      twintPhone: settings[0]?.twint_phone ?? "",
      twintName: settings[0]?.twint_name ?? "",
      pending,
    };
  });

export const saveWallet = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ credits: z.number().int().min(0).max(50_000_000) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      update player set credits = ${data.credits} where user_id = ${context.userId}
    `;
    return { ok: true };
  });

export const requestDeposit = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      chf: z.number().int().refine((n) => (DEPOSIT_AMOUNTS as readonly number[]).includes(n)),
      method: z.enum(["twint", "cash"]),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const email = await sessionEmail(context.userId);
    const id = randomHex(12);
    const credits = data.chf * 100;
    const instant = email === ADMIN_INBOX || isAdminEmail(email);
    if (instant) {
      await sql`
        insert into deposit (id, user_id, email, chf, credits, method, status, paid_at)
        values (${id}, ${context.userId}, ${email}, ${data.chf}, ${credits}, ${data.method}, 'paid', now())
      `;
      await sql`
        update player set credits = credits + ${credits} where user_id = ${context.userId}
      `;
      const bal = await sql<{ credits: number }>`
        select credits from player where user_id = ${context.userId}
      `;
      return { ok: true, id, instant: true as const, credits: asInt(bal[0]?.credits) };
    }
    await sql`
      insert into deposit (id, user_id, email, chf, credits, method, status)
      values (${id}, ${context.userId}, ${email}, ${data.chf}, ${credits}, ${data.method}, 'pending')
    `;
    try {
      const { callTool } = await import("@/lib/app-data/client.server");
      const { ConnectorType } = await import("@/lib/app-data");
      const prev = process.env.GROK_CONNECTORS_URL;
      if (!prev) process.env.GROK_CONNECTORS_URL = "https://connectors.grok.me";
      const how = data.method === "twint" ? "TWINT" : "Bar";
      await callTool(
        "gmail_send_message",
        {
          to: ["thhaessig84@gmail.com", ADMIN_INBOX],
          subject: `Book of Ra — ${data.chf} CHF ${how} von ${email}`,
          body: `${email} will ${data.chf} CHF per ${how} aufladen.\nIm Spiel unter Freigaben bestätigen, sobald das Geld da ist.`,
        },
        { connectorType: ConnectorType.Gmail },
      );
      if (!prev) delete process.env.GROK_CONNECTORS_URL;
    } catch {
      /* mail is best-effort */
    }
    return { ok: true, id, instant: false as const, credits: null };
  });

export const listDeposits = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const email = await sessionEmail(context.userId);
    if (!isAdminEmail(email)) return { ok: false as const, deposits: [] as DepositRow[], players: [] as { email: string; credits: number }[], twintPhone: "", twintName: "" };
    const sql = await getSql();
    const deposits = await sql<DepositRow>`
      select id, user_id, email, chf, credits, method, status, created_at::text as created_at
      from deposit
      where status = 'pending'
      order by created_at desc
    `;
    const players = await sql<{ email: string; credits: number }>`
      select email, credits from player order by email
    `;
    const settings = await sql<{ twint_phone: string; twint_name: string }>`
      select twint_phone, twint_name from shop_settings where id = 1
    `;
    return {
      ok: true as const,
      deposits,
      players: players.map((p) => ({ email: p.email, credits: asInt(p.credits) })),
      twintPhone: settings[0]?.twint_phone ?? "",
      twintName: settings[0]?.twint_name ?? "",
    };
  });

export const settleDeposit = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string().min(8), action: z.enum(["paid", "rejected"]) }))
  .handler(async ({ context, data }) => {
    const email = await sessionEmail(context.userId);
    if (!isAdminEmail(email)) return { ok: false };
    const sql = await getSql();
    const rows = await sql<{ user_id: string; credits: number; status: string }>`
      select user_id, credits, status from deposit where id = ${data.id}
    `;
    const row = rows[0];
    if (!row || row.status !== "pending") return { ok: false };
    if (data.action === "paid") {
      await sql`update player set credits = credits + ${asInt(row.credits)} where user_id = ${row.user_id}`;
      await sql`update deposit set status = 'paid', paid_at = now() where id = ${data.id}`;
    } else {
      await sql`update deposit set status = 'rejected' where id = ${data.id}`;
    }
    return { ok: true };
  });

export const adminAddCredits = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ email: z.string().email(), credits: z.number().int().min(1).max(1_000_000) }))
  .handler(async ({ context, data }) => {
    const email = await sessionEmail(context.userId);
    if (!isAdminEmail(email)) return { ok: false };
    const sql = await getSql();
    const rows = await sql<{ email: string }>`
      update player
      set credits = credits + ${data.credits}
      where email = ${data.email.toLowerCase()}
      returning email
    `;
    return { ok: rows.length > 0 };
  });

export const saveShopSettings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ twintPhone: z.string().max(40), twintName: z.string().max(80) }))
  .handler(async ({ context, data }) => {
    const email = await sessionEmail(context.userId);
    if (!isAdminEmail(email)) return { ok: false };
    const sql = await getSql();
    await sql`
      insert into shop_settings (id, twint_phone, twint_name)
      values (1, ${data.twintPhone.trim()}, ${data.twintName.trim()})
      on conflict (id) do update set twint_phone = excluded.twint_phone, twint_name = excluded.twint_name
    `;
    return { ok: true };
  });
