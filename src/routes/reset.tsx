import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { confirmPasswordReset } from "@/lib/password";

export const Route = createFileRoute("/reset")({
  validateSearch: (s: Record<string, unknown>) => ({
    token: typeof s.token === "string" ? s.token : "",
  }),
  component: Reset,
});

function Reset() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== repeat) {
      setError("Passwörter stimmen nicht überein.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await confirmPasswordReset({ data: { token, password } });
      if (!res.ok) throw new Error(res.error);
      await navigate({ to: "/login" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh w-full flex-col items-center justify-end overflow-hidden bg-bg">
      <img src="/bg/casino.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(18_12_7/0.4)_0%,rgb(18_12_7/0.25)_40%,rgb(18_12_7/0.92)_100%)]" />
      <div className="relative z-10 w-full max-w-md px-5 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        <p className="text-center font-display text-sm uppercase tracking-[0.4em] text-gold">Crydo5 · Brugg AG</p>
        <h1 className="mt-2 text-center font-display text-3xl tracking-[0.14em] text-gold-2">Neues Passwort</h1>
        {!token ? (
          <p className="mt-6 text-center text-sm text-muted">Link ungültig.</p>
        ) : (
          <form onSubmit={(e) => void submit(e)} className="tomb-panel mt-6 space-y-3 rounded-2xl p-5">
            <label className="block">
              <span className="font-display text-[10px] uppercase tracking-[0.2em] text-gold">Passwort</span>
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 h-11 w-full rounded-md border border-gold/35 bg-ink/60 px-3 text-fg outline-none focus:border-gold"
              />
            </label>
            <label className="block">
              <span className="font-display text-[10px] uppercase tracking-[0.2em] text-gold">Wiederholen</span>
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
                className="mt-1 h-11 w-full rounded-md border border-gold/35 bg-ink/60 px-3 text-fg outline-none focus:border-gold"
              />
            </label>
            {error && <p className="text-sm text-red-300">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="h-12 w-full rounded-md border-2 border-gold-2 bg-[radial-gradient(circle_at_30%_22%,var(--color-gold-2),var(--color-gold)_40%,var(--color-bronze))] font-display tracking-[0.18em] text-ink disabled:opacity-50"
            >
              {busy ? "…" : "Speichern"}
            </button>
          </form>
        )}
        <div className="mt-4 text-center">
          <Link to="/login" className="font-display text-xs uppercase tracking-[0.2em] text-gold">
            Zur Anmeldung
          </Link>
        </div>
      </div>
    </div>
  );
}
