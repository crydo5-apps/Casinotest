import { timingSafeEqual } from "node:crypto";
import { getSessionUser } from "@/lib/auth/verify.server";
import { getSql } from "@/lib/db";
import { isAdminEmail } from "@/lib/player";

const DASH_ORIGINS = [
  "https://crydo5-apps.github.io",
  "https://casino-db.crydo5.ch",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
];

function tokenEq(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}

export function corsHeaders(request: Request): Headers {
  const origin = request.headers.get("origin") || "";
  const allow =
    DASH_ORIGINS.includes(origin) ||
    origin.endsWith(".github.io") ||
    origin.endsWith(".grok-sandbox.com") ||
    origin.endsWith(".grok.me");
  const headers = new Headers();
  if (allow) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }
  headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Dashboard-Token");
  headers.set("Access-Control-Max-Age", "86400");
  return headers;
}

export function jsonDash(request: Request, body: unknown, status = 200) {
  const headers = corsHeaders(request);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(body), { status, headers });
}

export async function authorizeDashboard(request: Request): Promise<boolean> {
  const url = new URL(request.url);
  const header = request.headers.get("authorization") || "";
  const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  const fromHeader = request.headers.get("x-dashboard-token")?.trim() || "";
  const fromQuery = url.searchParams.get("token")?.trim() || "";
  const given = bearer || fromHeader || fromQuery;
  const sql = await getSql();
  const rows = await sql<{ dashboard_token: string }>`
    select dashboard_token from shop_settings where id = 1
  `;
  const expected = rows[0]?.dashboard_token || "";
  if (given && expected && tokenEq(given, expected)) return true;
  const user = await getSessionUser();
  return Boolean(user?.email && isAdminEmail(user.email));
}
