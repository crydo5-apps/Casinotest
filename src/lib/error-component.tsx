import type { ErrorComponentProps } from "@tanstack/react-router";

export function AppErrorComponent({ error, reset }: ErrorComponentProps) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-bg px-6 text-center">
      <img src="/bg/casino.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-ink/75" />
      <div className="relative z-10 tomb-panel max-w-md rounded-2xl p-6">
        <p className="font-display text-[10px] uppercase tracking-[0.32em] text-gold">Crydo5</p>
        <h1 className="mt-2 font-display text-2xl tracking-[0.12em] text-gold-2">Kurz unterbrochen</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Bitte neu laden — das Spiel geht danach weiter.
        </p>
        {error?.message ? (
          <p className="mt-2 break-words font-display text-[10px] uppercase tracking-[0.14em] text-gold/70">
            {error.message}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => {
            try {
              reset?.();
            } catch {
              /* ignore */
            }
            window.location.reload();
          }}
          className="mt-5 h-12 w-full rounded-md border-2 border-gold-2 bg-[radial-gradient(circle_at_30%_22%,var(--color-gold-2),var(--color-gold)_40%,var(--color-bronze))] font-display tracking-[0.18em] text-ink"
        >
          Neu laden
        </button>
      </div>
    </main>
  );
}
