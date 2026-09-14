import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { approvePlayerEmail, getMyAccess, listPendingPlayers } from "@/lib/player";
import { adminAddCredits, listDeposits, saveShopSettings, settleDeposit, type DepositRow } from "@/lib/wallet";

export const Route = createFileRoute("/admin")({ component: Admin });

function Admin() {
  const { user, isPending } = useCurrentUserState();
  const [allowed, setAllowed] = useState<"load" | "no" | "ok">("load");
  const [players, setPlayers] = useState<{ email: string; created_at: string }[]>([]);
  const [deposits, setDeposits] = useState<DepositRow[]>([]);
  const [balances, setBalances] = useState<{ email: string; credits: number }[]>([]);
  const [twintPhone, setTwintPhone] = useState("");
  const [twintName, setTwintName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [manualEmail, setManualEmail] = useState("");
  const [manualAmt, setManualAmt] = useState("20");

  const load = async () => {
    const access = await getMyAccess();
    if (!access.isAdmin) {
      setAllowed("no");
      return;
    }
    setAllowed("ok");
    const list = await listPendingPlayers();
    setPlayers(list.players);
    const shop = await listDeposits();
    setDeposits(shop.deposits);
    setBalances(shop.players);
    setTwintPhone(shop.twintPhone);
    setTwintName(shop.twintName);
  };

  useEffect(() => {
    if (isPending || !user) return;
    void load().catch(() => setAllowed("no"));
  }, [isPending, user]);

  if (isPending || allowed === "load") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg font-display tracking-[0.2em] text-gold">
        …
      </div>
    );
  }
  if (!user) return <RedirectToSignIn />;
  if (allowed === "no") {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg px-6 text-center">
        <p className="font-display text-gold">Kein Zugang.</p>
        <Link to="/" className="mt-4 font-display text-xs uppercase tracking-[0.2em] text-gold-2">
          Zurück
        </Link>
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-bg px-5 py-10">
      <img src="/bg/tomb.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-ink/75" />
      <div className="relative z-10 mx-auto w-full max-w-lg">
        <p className="text-center font-display text-xs uppercase tracking-[0.32em] text-gold">info@harmonai.ch</p>
        <h1 className="mt-2 text-center font-display text-3xl tracking-[0.12em] text-gold-2">Freigaben</h1>
        <div className="tomb-panel mt-6 space-y-3 rounded-2xl p-5">
          {players.length === 0 ? (
            <p className="text-center text-sm text-muted">Keine offenen Anmeldungen.</p>
          ) : (
            players.map((p) => (
              <div key={p.email} className="flex items-center justify-between gap-3 border-b border-gold/15 py-3 last:border-0">
                <div>
                  <p className="text-sm text-fg">{p.email}</p>
                  <p className="font-display text-[10px] uppercase tracking-[0.16em] text-muted">{p.created_at.slice(0, 16)}</p>
                </div>
                <button
                  type="button"
                  disabled={busy === p.email}
                  onClick={() => {
                    setBusy(p.email);
                    void approvePlayerEmail({ data: { email: p.email } })
                      .then(() => load())
                      .finally(() => setBusy(null));
                  }}
                  className="rounded-md border border-gold-2 px-3 py-1.5 font-display text-[10px] uppercase tracking-[0.16em] text-gold-2 disabled:opacity-50"
                >
                  {busy === p.email ? "…" : "Freischalten"}
                </button>
              </div>
            ))
          )}
        </div>

        <div className="tomb-panel mt-5 space-y-3 rounded-2xl p-5">
          <h2 className="text-center font-display text-sm uppercase tracking-[0.22em] text-gold-2">Zahlungen</h2>
          {deposits.length === 0 ? (
            <p className="text-center text-sm text-muted">Keine offenen Zahlungen.</p>
          ) : (
            deposits.map((d) => (
              <div key={d.id} className="border-b border-gold/15 py-3 last:border-0">
                <p className="text-sm text-fg">{d.email}</p>
                <p className="font-display text-xs uppercase tracking-[0.16em] text-gold">
                  {d.chf} CHF · {d.method === "twint" ? "TWINT" : "Bar"}
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={busy === d.id}
                    onClick={() => {
                      setBusy(d.id);
                      void settleDeposit({ data: { id: d.id, action: "paid" } })
                        .then(() => load())
                        .finally(() => setBusy(null));
                    }}
                    className="rounded-md border border-gold-2 px-3 py-1.5 font-display text-[10px] uppercase tracking-[0.14em] text-gold-2"
                  >
                    Gutschreiben
                  </button>
                  <button
                    type="button"
                    disabled={busy === d.id}
                    onClick={() => {
                      setBusy(d.id);
                      void settleDeposit({ data: { id: d.id, action: "rejected" } })
                        .then(() => load())
                        .finally(() => setBusy(null));
                    }}
                    className="rounded-md border border-gold/30 px-3 py-1.5 font-display text-[10px] uppercase tracking-[0.14em] text-muted"
                  >
                    Ablehnen
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="tomb-panel mt-5 space-y-3 rounded-2xl p-5">
          <h2 className="text-center font-display text-sm uppercase tracking-[0.22em] text-gold-2">TWINT</h2>
          <label className="block">
            <span className="font-display text-[10px] uppercase tracking-[0.16em] text-gold">Name</span>
            <input
              value={twintName}
              onChange={(e) => setTwintName(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-gold/35 bg-ink/60 px-3 text-sm text-fg outline-none"
              placeholder="Thomas"
            />
          </label>
          <label className="block">
            <span className="font-display text-[10px] uppercase tracking-[0.16em] text-gold">TWINT-Nummer</span>
            <input
              value={twintPhone}
              onChange={(e) => setTwintPhone(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-gold/35 bg-ink/60 px-3 text-sm text-fg outline-none"
              placeholder="+41 79 …"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              setBusy("twint");
              void saveShopSettings({ data: { twintPhone, twintName } })
                .then(() => load())
                .finally(() => setBusy(null));
            }}
            className="h-11 w-full rounded-md border border-gold-2 font-display text-xs uppercase tracking-[0.16em] text-gold-2"
          >
            Speichern
          </button>
        </div>

        <div className="tomb-panel mt-5 space-y-3 rounded-2xl p-5">
          <h2 className="text-center font-display text-sm uppercase tracking-[0.22em] text-gold-2">Manuell gutschreiben</h2>
          <input
            value={manualEmail}
            onChange={(e) => setManualEmail(e.target.value)}
            placeholder="spieler@…"
            className="h-10 w-full rounded-md border border-gold/35 bg-ink/60 px-3 text-sm text-fg outline-none"
          />
          <input
            value={manualAmt}
            onChange={(e) => setManualAmt(e.target.value)}
            inputMode="numeric"
            className="h-10 w-full rounded-md border border-gold/35 bg-ink/60 px-3 text-sm text-fg outline-none"
          />
          <button
            type="button"
            onClick={() => {
              const n = Math.trunc(Number(manualAmt));
              if (!manualEmail || n < 1) return;
              setBusy("manual");
              void adminAddCredits({ data: { email: manualEmail, credits: n } })
                .then(() => load())
                .finally(() => setBusy(null));
            }}
            className="h-11 w-full rounded-md border border-gold-2 font-display text-xs uppercase tracking-[0.16em] text-gold-2"
          >
            {manualAmt || "0"} CHF gutschreiben
          </button>
          <ul className="space-y-1 text-xs text-muted">
            {balances.map((b) => (
              <li key={b.email} className="flex justify-between gap-2">
                <span className="truncate">{b.email}</span>
                <span className="tabular-nums text-gold-2">{b.credits}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="tomb-panel mt-5 space-y-3 rounded-2xl p-5 text-left">
          <h2 className="text-center font-display text-sm uppercase tracking-[0.22em] text-gold-2">Hostpoint MX</h2>
          <p className="text-sm leading-relaxed text-muted">
            Die Domain ist bei Hostpoint, die <strong className="text-fg">aktiven Nameserver sind aber Netlify</strong>.
            MX nur im Hostpoint-Panel zu setzen greift deshalb nicht.
          </p>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted">
            <li>
              Hostpoint Control Panel → E-Mail → Adresse <strong className="text-fg">info@harmonai.ch</strong> anlegen.
            </li>
            <li>
              Netlify → Domain management → DNS — diese Einträge (Website bleibt):
            </li>
          </ol>
          <div className="overflow-x-auto text-xs">
            <table className="w-full border-collapse font-display tracking-wide">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-[0.16em] text-muted">
                  <th className="py-1 pr-2">Typ</th>
                  <th className="py-1 pr-2">Name</th>
                  <th className="py-1 pr-2">Prio</th>
                  <th className="py-1">Wert</th>
                </tr>
              </thead>
              <tbody className="text-fg">
                <tr>
                  <td className="py-1 pr-2 text-gold">MX</td>
                  <td className="py-1 pr-2">@</td>
                  <td className="py-1 pr-2">10</td>
                  <td className="py-1 break-all">mx1.mail.hostpoint.ch</td>
                </tr>
                <tr>
                  <td className="py-1 pr-2 text-gold">MX</td>
                  <td className="py-1 pr-2">@</td>
                  <td className="py-1 pr-2">10</td>
                  <td className="py-1 break-all">mx2.mail.hostpoint.ch</td>
                </tr>
                <tr>
                  <td className="py-1 pr-2 text-gold">TXT</td>
                  <td className="py-1 pr-2">@</td>
                  <td className="py-1 pr-2">—</td>
                  <td className="py-1 break-all">v=spf1 redirect=spf.mail.hostpoint.ch</td>
                </tr>
                <tr>
                  <td className="py-1 pr-2 text-gold">CNAME</td>
                  <td className="py-1 pr-2">autoconfig</td>
                  <td className="py-1 pr-2">—</td>
                  <td className="py-1 break-all">autoconfig.mail.hostpoint.ch</td>
                </tr>
                <tr>
                  <td className="py-1 pr-2 text-gold">CNAME</td>
                  <td className="py-1 pr-2">autodiscover</td>
                  <td className="py-1 pr-2">—</td>
                  <td className="py-1 break-all">autoconfig-nonssl.mail.hostpoint.ch</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs leading-relaxed text-muted">
            Alternativ: Hostpoint → Domain → Nameserver auf ns.hostpoint.ch / ns2 / ns3 zurücksetzen. Dann Website-A-Records zu Netlify mitnehmen, sonst ist die Seite weg.
          </p>
        </div>

        <div className="mt-6 text-center">
          <Link to="/" className="font-display text-xs uppercase tracking-[0.22em] text-gold">
            Zum Spiel
          </Link>
        </div>
      </div>
    </div>
  );
}
