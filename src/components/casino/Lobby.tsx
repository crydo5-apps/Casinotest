import { Link } from "@tanstack/react-router";
import { ShieldCheck, X } from "lucide-react";
import { signOut } from "@/lib/auth/client";

const GAMES = [
  {
    to: "/book" as const,
    title: "Book of Ra",
    tag: "Slot · 6 Walzen · 25 Linien",
    img: "/bg/tomb.jpg",
  },
  {
    to: "/roulette" as const,
    title: "Roulette",
    tag: "Europäisch · Einzel-Zero",
    img: "/bg/roulette-table.jpg",
  },
  {
    to: "/ramon" as const,
    title: "Book of Ra(mon)",
    tag: "Slot · Gramm · Crydo5",
    img: "/bg/tomb.jpg",
  },
];

export function Lobby({ admin }: { admin: boolean }) {
  return (
    <div className="relative flex h-dvh max-h-dvh flex-col overflow-hidden bg-bg text-fg">
      <img src="/bg/casino.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(8_6_4/0.45)_0%,rgb(8_6_4/0.28)_40%,rgb(8_6_4/0.88)_100%)]" />
      <header className="relative z-10 flex items-center justify-between px-4 pt-[max(0.6rem,env(safe-area-inset-top))]">
        <div>
          <p className="font-display text-[10px] uppercase tracking-[0.42em] text-gold">Brugg AG</p>
          <h1 className="title-glow font-display text-2xl tracking-[0.16em] text-gold-2 sm:text-4xl">CRYDO5</h1>
          <p className="font-display text-[10px] uppercase tracking-[0.28em] text-gold sm:text-xs">Online Casino</p>
        </div>
        <div className="flex gap-2">
          {admin && (
            <Link to="/admin" className="tomb-panel grid size-10 place-items-center rounded-full text-gold-2">
              <ShieldCheck className="size-4" />
            </Link>
          )}
          <button
            type="button"
            onClick={() => void signOut("/login")}
            className="tomb-panel grid size-10 place-items-center rounded-full text-gold-2"
            aria-label="Abmelden"
          >
            <X className="size-4" />
          </button>
        </div>
      </header>
      <div className="relative z-10 mt-auto w-full max-w-3xl self-center px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <p className="mb-3 text-center font-display text-xs uppercase tracking-[0.32em] text-gold">Tische</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {GAMES.map((g) => (
            <Link
              key={g.to}
              to={g.to}
              className="group relative overflow-hidden rounded-2xl border border-gold/35 shadow-[0_12px_40px_rgb(0_0_0/0.45)]"
            >
              <img src={g.img} alt="" className="h-36 w-full object-cover sm:h-44" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-3">
                <p className="font-display text-lg tracking-[0.12em] text-gold-2">{g.title}</p>
                <p className="font-display text-[10px] uppercase tracking-[0.2em] text-gold">{g.tag}</p>
              </div>
            </Link>
          ))}
        </div>
        <p className="mt-4 text-center font-display text-[10px] uppercase tracking-[0.28em] text-muted">
          Crydo5 Online Casino Brugg AG
        </p>
      </div>
    </div>
  );
}
