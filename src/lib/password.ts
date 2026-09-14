import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { ADMIN_INBOX, isAdminEmail } from "@/lib/player";
import { randomHex } from "@/lib/random-id";

const ADMIN_PASSWORD = "3wSsadgW!";

function publicOrigin(): string {
  try {
    const req = getRequest();
    const host =
      req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
      req.headers.get("host") ||
      "localhost:8080";
    const proto =
      req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
      (host.includes("localhost") || host.startsWith("127.") ? "http" : "https");
    return `${proto}://${host}`;
  } catch {
    return "http://localhost:8080";
  }
}

async function setCredentialPassword(userId: string, password: string) {
  const sql = await getSql();
  const { hashPassword } = await import("@better-auth/utils/password");
  const hash = await hashPassword(password);
  const acc = await sql<{ id: string }>`
    select id from "account"
    where "userId" = ${userId} and "providerId" = 'credential'
  `;
  if (acc[0]) {
    await sql`
      update "account"
      set password = ${hash}, "updatedAt" = now()
      where id = ${acc[0].id}
    `;
    return;
  }
  const id = randomHex(16);
  await sql`
    insert into "account" (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
    values (${id}, ${userId}, 'credential', ${userId}, ${hash}, now(), now())
  `;
}

async function ensureAdminAccount() {
  const sql = await getSql();
  const existing = await sql<{ id: string }>`
    select id from "user" where email = ${ADMIN_INBOX}
  `;
  let userId = existing[0]?.id;
  if (!userId) {
    userId = randomHex(16);
    await sql`
      insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
      values (${userId}, 'Crydo5', ${ADMIN_INBOX}, true, now(), now())
    `;
  }
  await setCredentialPassword(userId, ADMIN_PASSWORD);
  const player = await sql<{ user_id: string }>`
    select user_id from player where user_id = ${userId}
  `;
  if (!player[0]) {
    const token = randomHex(24);
    await sql`
      insert into player (user_id, email, approve_token, approved, approved_at, mail_sent)
      values (${userId}, ${ADMIN_INBOX}, ${token}, true, now(), true)
    `;
  } else {
    await sql`
      update player
      set approved = true, approved_at = now(), mail_sent = true, email = ${ADMIN_INBOX}
      where user_id = ${userId}
    `;
  }
  await sql`
    insert into shop_settings (id, twint_phone, twint_name, admin_seeded)
    values (1, '', '', true)
    on conflict (id) do update set admin_seeded = true
  `;
}

export const seedAdmin = createServerFn({ method: "POST" }).handler(async () => {
  await ensureAdminAccount();
  return { ok: true };
});

export const requestPasswordReset = createServerFn({ method: "POST" })
  .validator(z.object({ email: z.string().email() }))
  .handler(async ({ data }) => {
    await ensureAdminAccount();
    const sql = await getSql();
    const email = data.email.trim().toLowerCase();
    const users = await sql<{ id: string }>`
      select id from "user" where email = ${email}
    `;
    const user = users[0];
    if (user) {
      const token = randomHex(24);
      const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      await sql`
        insert into password_reset (token, user_id, email, expires_at)
        values (${token}, ${user.id}, ${email}, ${expires})
      `;
      const link = `${publicOrigin()}/reset?token=${encodeURIComponent(token)}`;
      try {
        const { callTool } = await import("@/lib/app-data/client.server");
        const { ConnectorType } = await import("@/lib/app-data");
        const prev = process.env.GROK_CONNECTORS_URL;
        if (!prev) process.env.GROK_CONNECTORS_URL = "https://connectors.grok.me";
        await callTool(
          "gmail_send_message",
          {
            to: isAdminEmail(email) ? ["thhaessig84@gmail.com", ADMIN_INBOX] : [email],
            subject: "Crydo5 — Passwort zurücksetzen",
            body: `Passwort zurücksetzen:\n${link}\n\nDer Link gilt 1 Stunde.`,
          },
          { connectorType: ConnectorType.Gmail },
        );
        if (!prev) delete process.env.GROK_CONNECTORS_URL;
      } catch {
        /* mail is best-effort */
      }
    }
    return { ok: true };
  });

export const confirmPasswordReset = createServerFn({ method: "POST" })
  .validator(
    z.object({
      token: z.string().min(16).max(128),
      password: z.string().min(8).max(128),
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql<{ user_id: string; used: boolean; expires_at: string }>`
      select user_id, used, expires_at::text as expires_at
      from password_reset
      where token = ${data.token}
    `;
    const row = rows[0];
    if (!row || row.used) return { ok: false as const, error: "Link ungültig oder schon benutzt." };
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return { ok: false as const, error: "Link abgelaufen." };
    }
    await setCredentialPassword(row.user_id, data.password);
    await sql`update password_reset set used = true where token = ${data.token}`;
    await sql`delete from "session" where "userId" = ${row.user_id}`;
    return { ok: true as const };
  });
