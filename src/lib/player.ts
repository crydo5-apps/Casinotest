import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { randomHex } from "@/lib/random-id";

export const ADMIN_INBOX = "info@harmonai.ch";
const ADMIN_DELIVER = ["thhaessig84@gmail.com", "info@harmonai.ch"] as const;
const ADMIN_LOGINS = new Set(["info@harmonai.ch", "thhaessig84@gmail.com"]);

type PlayerRow = {
  user_id: string;
  email: string;
  approved: boolean;
  approve_token: string;
  mail_sent: boolean;
};

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

function mailBodies(email: string, token: string) {
  const origin = publicOrigin();
  const link = `${origin}/approve?token=${encodeURIComponent(token)}`;
  const subject = `Book of Ra — neue Anmeldung: ${email}`;
  const body = [
    "Neue Registrierung für Book of Ra.",
    "",
    `E-Mail: ${email}`,
    "",
    "Zum Freischalten diesen Link öffnen:",
    link,
    "",
    "Erst danach kann der Spieler das Grab betreten.",
  ].join("\n");
  const safe = email.replace(/</g, "");
  const bodyHtml = `
    <p>Neue Registrierung für <strong>Book of Ra</strong>.</p>
    <p>E-Mail: <strong>${safe}</strong></p>
    <p><a href="${link}" style="display:inline-block;padding:12px 20px;background:#c9a227;color:#1a1008;font-weight:700;text-decoration:none;border-radius:8px">Spieler freischalten</a></p>
    <p style="color:#666;font-size:12px">${link}</p>
  `;
  return { subject, body, bodyHtml, link };
}

async function sendViaGmail(email: string, token: string): Promise<boolean> {
  const { subject, body, bodyHtml } = mailBodies(email, token);
  const prev = process.env.GROK_CONNECTORS_URL;
  if (!prev) process.env.GROK_CONNECTORS_URL = "https://connectors.grok.me";
  try {
    const { callTool } = await import("@/lib/app-data/client.server");
    const { ConnectorType } = await import("@/lib/app-data");
    const result = await callTool(
      "gmail_send_message",
      {
        to: [...ADMIN_DELIVER],
        subject,
        body,
        body_html: bodyHtml,
      },
      { connectorType: ConnectorType.Gmail },
    );
    if (result.ok) return true;
    process.env.GROK_CONNECTORS_URL = "https://connectors.app-builder-testing.com";
    const retry = await callTool(
      "gmail_send_message",
      {
        to: [...ADMIN_DELIVER],
        subject,
        body,
        body_html: bodyHtml,
      },
      { connectorType: ConnectorType.Gmail },
    );
    return Boolean(retry.ok);
  } catch {
    return false;
  } finally {
    if (!prev) delete process.env.GROK_CONNECTORS_URL;
    else process.env.GROK_CONNECTORS_URL = prev;
  }
}

async function sendViaFormSubmit(email: string, token: string): Promise<boolean> {
  const { subject, body, link } = mailBodies(email, token);
  try {
    const res = await fetch(`https://formsubmit.co/ajax/${ADMIN_DELIVER[0]}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        _subject: subject,
        _template: "table",
        _captcha: "false",
        name: "Book of Ra",
        email,
        message: body,
        freigabe: link,
      }),
    });
    if (!res.ok) return false;
    const json = (await res.json().catch(() => null)) as { success?: boolean | string } | null;
    return json?.success === true || json?.success === "true";
  } catch {
    return false;
  }
}

async function sendAdminMail(email: string, token: string): Promise<boolean> {
  if (await sendViaGmail(email, token)) return true;
  if (await sendViaFormSubmit(email, token)) return true;
  return false;
}

export async function sessionEmail(userId: string): Promise<string> {
  const sql = await getSql();
  const users = await sql<{ email: string }>`
    select email from "user" where id = ${userId}
  `;
  return users[0]?.email?.trim().toLowerCase() || "";
}

export function isAdminEmail(email: string) {
  return ADMIN_LOGINS.has(email.trim().toLowerCase());
}

export const registerPlayer = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const email = (await sessionEmail(context.userId)) || "unknown";
    const admin = isAdminEmail(email);
    const existing = await sql<PlayerRow>`
      select user_id, email, approved, approve_token, mail_sent
      from player
      where user_id = ${context.userId}
    `;
    let row = existing[0];
    if (!row) {
      const token = randomHex(24);
      const inserted = await sql<PlayerRow>`
        insert into player (user_id, email, approve_token, approved, approved_at, mail_sent)
        values (
          ${context.userId},
          ${email},
          ${token},
          ${admin},
          ${admin ? new Date().toISOString() : null},
          ${admin}
        )
        returning user_id, email, approved, approve_token, mail_sent
      `;
      row = inserted[0];
    } else if (admin && !row.approved) {
      await sql`update player set approved = true, approved_at = now(), mail_sent = true where user_id = ${context.userId}`;
      return { approved: true, mailed: true, isAdmin: true };
    }
    if (!row) return { approved: false, mailed: false, isAdmin: admin };
    if (row.approved) return { approved: true, mailed: true, isAdmin: admin };
    const mailed = await sendAdminMail(row.email, row.approve_token);
    if (mailed && !row.mail_sent) {
      await sql`update player set mail_sent = true where user_id = ${context.userId}`;
    }
    return { approved: false, mailed, isAdmin: admin };
  });

export const getMyAccess = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const email = await sessionEmail(context.userId);
    const rows = await sql<{ approved: boolean; mail_sent: boolean }>`
      select approved, mail_sent from player where user_id = ${context.userId}
    `;
    return {
      approved: Boolean(rows[0]?.approved) || isAdminEmail(email),
      mailed: Boolean(rows[0]?.mail_sent),
      isAdmin: isAdminEmail(email),
    };
  });

export const listPendingPlayers = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const email = await sessionEmail(context.userId);
    if (!isAdminEmail(email)) return { ok: false as const, players: [] as { email: string; created_at: string }[] };
    const sql = await getSql();
    const players = await sql<{ email: string; created_at: string }>`
      select email, created_at::text as created_at
      from player
      where approved = false
      order by created_at desc
    `;
    return { ok: true as const, players };
  });

export const approvePlayerEmail = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ email: z.string().email() }))
  .handler(async ({ context, data }) => {
    const email = await sessionEmail(context.userId);
    if (!isAdminEmail(email)) return { ok: false };
    const sql = await getSql();
    const rows = await sql<{ email: string }>`
      update player
      set approved = true, approved_at = now()
      where email = ${data.email.toLowerCase()}
      returning email
    `;
    return { ok: rows.length > 0 };
  });

export const approveByToken = createServerFn({ method: "POST" })
  .validator(z.object({ token: z.string().min(8).max(128) }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql<{ email: string }>`
      update player
      set approved = true, approved_at = now()
      where approve_token = ${data.token}
      returning email
    `;
    return { ok: Boolean(rows[0]?.email), email: rows[0]?.email ?? null };
  });
