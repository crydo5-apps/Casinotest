import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getMyAccess, registerPlayer } from "@/lib/player";

export function GameGate({ children }: { children: (ctx: { admin: boolean }) => ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  const [access, setAccess] = useState<"load" | "ok" | "wait">("load");
  const [admin, setAdmin] = useState(false);
  const [mailed, setMailed] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const refresh = async () => {
    let res = await getMyAccess();
    if (!res.approved) {
      const reg = await registerPlayer();
      res = { ...res, ...reg, approved: reg.approved || res.approved };
    }
    setAdmin(res.isAdmin);
    setMailed(res.mailed);
    setAccess(res.approved ? "ok" : "wait");
  };

  useEffect(() => {
    if (isPending || !user) return;
    let live = true;
    void refresh().catch(() => {
      if (live) setAccess("wait");
    });
    return () => {
      live = false;
    };
  }, [isPending, user]);

  if (isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg font-display tracking-[0.2em] text-gold">
        …
      </div>
    );
  }
  if (!user) return <RedirectToSignIn />;
  if (access === "load") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg font-display tracking-[0.2em] text-gold">
        …
      </div>
    );
  }
  if (access === "wait") {
    return (
      <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-bg px-6">
        <img src="/bg/casino.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-ink/70" />
        <div className="relative z-10 tomb-panel max-w-md rounded-2xl p-6 text-center">
          <h1 className="font-display text-2xl tracking-[0.12em] text-gold-2">Warten auf Freigabe</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            {mailed
              ? "Eine Freigabe-Mail ist an info@harmonai.ch unterwegs. Sobald der Link bestätigt wird, kannst du spielen."
              : "Dein Konto wartet. Die Freigabe-Mail wird an info@harmonai.ch geschickt — bitte Spam prüfen. Der Betreiber kann dich auch in den Freigaben direkt aktivieren."}
          </p>
          <p className="mt-4 font-display text-xs tracking-[0.16em] text-gold">{user.primaryEmail}</p>
          <button
            type="button"
            disabled={retrying}
            onClick={() => {
              setRetrying(true);
              void refresh().finally(() => setRetrying(false));
            }}
            className="mt-5 font-display text-xs uppercase tracking-[0.22em] text-gold-2 disabled:opacity-50"
          >
            {retrying ? "…" : "Mail erneut senden"}
          </button>
          <div className="mt-3">
            <Link to="/login" className="font-display text-xs uppercase tracking-[0.22em] text-gold">
              Anderes Konto
            </Link>
          </div>
        </div>
      </div>
    );
  }
  return <>{children({ admin })}</>;
}
