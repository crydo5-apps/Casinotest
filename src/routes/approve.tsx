import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { approveByToken } from "@/lib/player";

export const Route = createFileRoute("/approve")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  component: Approve,
});

function Approve() {
  const { token } = Route.useSearch();
  const [state, setState] = useState<"work" | "ok" | "bad">("work");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setState("bad");
      return;
    }
    void approveByToken({ data: { token } })
      .then((res) => {
        setEmail(res.email);
        setState(res.ok ? "ok" : "bad");
      })
      .catch(() => setState("bad"));
  }, [token]);

  return (
    <div className="relative flex min-h-dvh w-full flex-col items-center justify-center overflow-hidden bg-bg px-6">
      <img src="/bg/tomb.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-ink/70" />
      <div className="relative z-10 tomb-panel max-w-md rounded-2xl p-6 text-center">
        {state === "work" && <p className="font-display text-gold-2">Freigabe …</p>}
        {state === "ok" && (
          <>
            <h1 className="font-display text-2xl tracking-[0.12em] text-gold-2">Spieler freigeschaltet</h1>
            {email && <p className="mt-2 text-sm text-muted">{email}</p>}
            <p className="mt-3 text-sm text-fg">Das Konto kann das Grab jetzt betreten.</p>
          </>
        )}
        {state === "bad" && (
          <>
            <h1 className="font-display text-2xl tracking-[0.12em] text-gold-2">Link ungültig</h1>
            <p className="mt-3 text-sm text-muted">Dieser Freigabe-Link ist abgelaufen oder wurde schon verwendet.</p>
          </>
        )}
        <Link to="/" className="mt-5 inline-block font-display text-xs uppercase tracking-[0.22em] text-gold">
          Zurück zum Spiel
        </Link>
      </div>
    </div>
  );
}
