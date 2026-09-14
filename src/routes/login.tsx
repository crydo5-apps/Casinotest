import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { authClient, authEnabled } from "@/lib/auth/client";
import { requestPasswordReset, seedAdmin } from "@/lib/password";
import { registerPlayer } from "@/lib/player";

function storePreviewToken(token: string | null | undefined) {
  if (!token || typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem("grok-auth.bearer-token", token);
  } catch {
    /* ignore */
  }
}

export const Route = createFileRoute("/login")({
  loader: async () => {
    await seedAdmin().catch(() => undefined);
    return null;
  },
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up" | "reset">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    void seedAdmin().catch(() => undefined);
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!authEnabled) return;
    setBusy(true);
    setError("");
    setInfo("");
    try {
      if (mode === "reset") {
        await requestPasswordReset({ data: { email: email.trim() } });
        setInfo("Wenn das Konto existiert, ist ein Reset-Link unterwegs. Bitte auch Spam prüfen.");
        return;
      }
      if (mode === "up") {
        const { data, error: err } = await authClient.signUp.email({
          email: email.trim(),
          password,
          name: email.trim().split("@")[0] || "Spieler",
        });
        if (err) throw new Error(err.message || "Registrierung fehlgeschlagen");
        storePreviewToken((data as { token?: string } | null)?.token);
        await authClient.getSession();
        await registerPlayer();
      } else {
        const { data, error: err } = await authClient.signIn.email({
          email: email.trim(),
          password,
        });
        if (err) throw new Error(err.message || "Anmeldung fehlgeschlagen");
        storePreviewToken((data as { token?: string } | null)?.token);
        await authClient.getSession();
      }
      await navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
    } finally {
      setBusy(false);
    }
  };

  const title = mode === "up" ? "Registrieren" : mode === "reset" ? "Passwort reset" : "Anmelden";

  return (
    <div className="relative flex min-h-dvh w-full flex-col items-center justify-center overflow-hidden bg-bg">
      <img src="/bg/casino.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(18_12_7/0.4)_0%,rgb(18_12_7/0.25)_40%,rgb(18_12_7/0.92)_100%)]" />
      <div className="relative z-10 w-full max-w-md px-5 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        <p className="text-center font-display text-sm uppercase tracking-[0.4em] text-gold">Crydo5 · Brugg AG</p>
        <h1 className="mt-2 text-center font-display text-3xl tracking-[0.14em] text-gold-2">{title}</h1>
        <p className="mt-2 text-center text-sm text-muted">
          {mode === "up"
            ? "Nur E-Mail und Passwort. Nach der Bestätigung durch info@harmonai.ch kannst du spielen."
            : mode === "reset"
              ? "Wir schicken einen Link zum neuen Passwort."
              : "Mit deinem Konto ins Casino."}
        </p>
        {!authEnabled ? (
          <p className="mt-6 text-center text-sm text-muted">Anmeldung ist deaktiviert.</p>
        ) : (
          <form onSubmit={(e) => void submit(e)} className="tomb-panel mt-6 space-y-3 rounded-2xl p-5">
            <label className="block">
              <span className="font-display text-[10px] uppercase tracking-[0.2em] text-gold">E-Mail</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 h-11 w-full rounded-md border border-gold/35 bg-ink/60 px-3 text-fg outline-none focus:border-gold"
              />
            </label>
            {mode !== "reset" && (
              <label className="block">
                <span className="font-display text-[10px] uppercase tracking-[0.2em] text-gold">Passwort</span>
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete={mode === "up" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 h-11 w-full rounded-md border border-gold/35 bg-ink/60 px-3 text-fg outline-none focus:border-gold"
                />
              </label>
            )}
            {error && <p className="text-sm text-red-300">{error}</p>}
            {info && <p className="text-sm text-gold-2">{info}</p>}
            <button
              type="submit"
              disabled={busy}
              className="h-12 w-full rounded-md border-2 border-gold-2 bg-[radial-gradient(circle_at_30%_22%,var(--color-gold-2),var(--color-gold)_40%,var(--color-bronze))] font-display tracking-[0.18em] text-ink disabled:opacity-50"
            >
              {busy ? "…" : mode === "up" ? "Konto erstellen" : mode === "reset" ? "Link senden" : "Anmelden"}
            </button>
            {mode === "in" && (
              <button
                type="button"
                onClick={() => {
                  setMode("reset");
                  setError("");
                  setInfo("");
                }}
                className="w-full font-display text-xs uppercase tracking-[0.2em] text-gold"
              >
                Passwort vergessen?
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setMode((m) => (m === "up" ? "in" : "up"));
                setError("");
                setInfo("");
              }}
              className="w-full font-display text-xs uppercase tracking-[0.2em] text-gold-2"
            >
              {mode === "up" ? "Schon ein Konto? Anmelden" : "Neu hier? Registrieren"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
