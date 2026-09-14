import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { DashboardApp } from "@/components/casino/DashboardApp";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getMyAccess } from "@/lib/player";

export const Route = createFileRoute("/dashboard")({ component: DashboardPage });

function DashboardPage() {
  const { user, isPending } = useCurrentUserState();
  const [allowed, setAllowed] = useState<"load" | "no" | "ok">("load");

  useEffect(() => {
    if (isPending || !user) return;
    void getMyAccess()
      .then((a) => setAllowed(a.isAdmin ? "ok" : "no"))
      .catch(() => setAllowed("no"));
  }, [isPending, user]);

  if (isPending || allowed === "load") {
    return (
      <div className="grid min-h-dvh place-items-center bg-[#0f0f0f] font-display tracking-[0.2em] text-[#d4af37]">
        …
      </div>
    );
  }
  if (!user) return <RedirectToSignIn />;
  if (allowed === "no") {
    return (
      <div className="grid min-h-dvh place-items-center bg-[#0f0f0f] px-6 text-center">
        <p className="font-display text-[#d4af37]">Kein Zugang.</p>
        <Link to="/" className="mt-4 font-display text-xs uppercase tracking-[0.2em] text-[#e6c547]">
          Zurück
        </Link>
      </div>
    );
  }
  return <DashboardApp />;
}
