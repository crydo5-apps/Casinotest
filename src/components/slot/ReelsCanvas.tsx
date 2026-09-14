import { useEffect, useRef } from "react";
import { PAYLINES, REELS, ROWS, STRIPS, type ExpandLayer, type SymbolId } from "@/lib/slot/engine";
import type { PaylineWin } from "@/lib/slot/types";

export type SlotAssets = {
  tiles: Record<SymbolId, HTMLImageElement>;
  bookOpen: HTMLImageElement;
  bookPage: HTMLImageElement;
};

type Props = {
  assets: SlotAssets;
  grid: SymbolId[][];
  spinning: boolean;
  stops: number[] | null;
  fromStops: number[];
  reducedMotion: boolean;
  turbo: boolean;
  skipRef: { current: boolean };
  wins: PaylineWin[];
  scatterRows: { reel: number; row: number }[];
  expandLayers: ExpandLayer[];
  expandSlow: boolean;
  bookReveal: boolean;
  highlightLine: number | null;
  onLanded: () => void;
  onReelStop: (index: number) => void;
  onExpandDone: () => void;
};

type ReelState = {
  from: number;
  to: number;
  offset: number;
  start: number;
  duration: number;
  done: boolean;
  announced: boolean;
};

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function wrapIndex(n: number, len: number) {
  return ((n % len) + len) % len;
}

export function ReelsCanvas({
  assets,
  grid,
  spinning,
  stops,
  fromStops,
  reducedMotion,
  turbo,
  skipRef,
  wins,
  scatterRows,
  expandLayers,
  expandSlow,
  bookReveal,
  highlightLine,
  onLanded,
  onReelStop,
  onExpandDone,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const reelsRef = useRef<ReelState[]>([]);
  const idleOffset = useRef<number[]>(
    Array.from({ length: REELS }, (_, i) => fromStops[i] ?? 0),
  );
  const spinGen = useRef(0);
  const landedRef = useRef(onLanded);
  const stopRef = useRef(onReelStop);
  const expandT = useRef(1);
  const bookT = useRef(0);
  const expandDone = useRef(true);
  const expandDoneRef = useRef(onExpandDone);
  expandDoneRef.current = onExpandDone;
  const inited = useRef(false);
  const turboNow = useRef(turbo);
  turboNow.current = turbo;

  landedRef.current = onLanded;
  stopRef.current = onReelStop;

  if (!inited.current && fromStops.length === REELS) {
    idleOffset.current = fromStops.slice();
    inited.current = true;
  }

  useEffect(() => {
    if (bookReveal) bookT.current = 0;
  }, [bookReveal]);

  useEffect(() => {
    if (expandLayers.length) {
      expandT.current = 0;
      expandDone.current = false;
    }
  }, [expandLayers]);

  useEffect(() => {
    if (!spinning || !stops || stops.length !== REELS) return;
    const gen = ++spinGen.current;
    const isTurbo = turboNow.current;
    const base = isTurbo ? 340 : reducedMotion ? 320 : 1500;
    const stagger = isTurbo ? 38 : reducedMotion ? 70 : 220;
    const now = performance.now();

    reelsRef.current = stops.map((stop, i) => {
      const stripLen = STRIPS[i].length;
      const from = idleOffset.current[i] ?? 0;
      const loops = isTurbo ? 1 : reducedMotion ? 1 : 4 + i;
      const currentMod = wrapIndex(Math.round(from), stripLen);
      const delta = wrapIndex(stop - currentMod, stripLen);
      const to = from + loops * stripLen + delta;
      return {
        from,
        to,
        offset: from,
        start: now,
        duration: base + i * stagger,
        done: false,
        announced: false,
      };
    });

    let raf = 0;
    let landed = false;
    const settle = (r: ReelState, i: number) => {
      const stripLen = STRIPS[i].length;
      r.offset = r.to;
      r.done = true;
      idleOffset.current[i] = wrapIndex(Math.round(r.to), stripLen);
    };

    const finish = () => {
      if (landed || gen !== spinGen.current) return;
      landed = true;
      for (let i = 0; i < REELS; i++) {
        const r = reelsRef.current[i];
        if (!r) continue;
        settle(r, i);
        if (!r.announced) {
          r.announced = true;
          stopRef.current(i);
        }
      }
      landedRef.current();
    };

    const tick = (tNow: number) => {
      if (gen !== spinGen.current) return;
      if (skipRef.current) {
        finish();
        return;
      }
      let allDone = true;
      for (let i = 0; i < REELS; i++) {
        const r = reelsRef.current[i];
        if (!r) continue;
        if (r.done) continue;
        const u = Math.min(1, Math.max(0, (tNow - r.start) / r.duration));
        r.offset = r.from + (r.to - r.from) * easeOutCubic(u);
        if (u >= 1) {
          settle(r, i);
          if (!r.announced) {
            r.announced = true;
            stopRef.current(i);
          }
        } else {
          allDone = false;
        }
      }
      if (allDone) {
        finish();
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    const failsafe = window.setTimeout(finish, base + stagger * (REELS - 1) + 400);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(failsafe);
    };
  }, [spinning, stops, reducedMotion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const frame = frameRef.current;
    if (!canvas || !frame) return;

    let raf = 0;
    const draw = (now: number) => {
      if (expandLayers.length && expandT.current < expandLayers.length) {
        const pace = expandSlow ? (turbo ? 0.018 : 0.0075) : turbo ? 0.05 : 0.018;
        expandT.current = Math.min(expandLayers.length, expandT.current + pace);
        if (expandT.current >= expandLayers.length && !expandDone.current) {
          expandDone.current = true;
          expandDoneRef.current();
        }
      }
      if (bookReveal) {
        bookT.current += turbo ? 0.022 : 0.012;
      }

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cssW = frame.clientWidth;
      const cssH = frame.clientHeight;
      const pw = Math.max(1, Math.floor(cssW * dpr));
      const ph = Math.max(1, Math.floor(cssH * dpr));
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const gap = Math.max(2, Math.min(cssW, cssH) * 0.006);
      const padX = Math.max(6, cssW * 0.016);
      const padY = Math.max(6, cssH * 0.016);
      const innerW = Math.max(1, cssW - padX * 2);
      const innerH = Math.max(1, cssH - padY * 2);
      const cellW = (innerW - gap * (REELS - 1)) / REELS;
      const cellH = innerH / ROWS;
      const gridW = cellW * REELS + gap * (REELS - 1);
      const gridH = cellH * ROWS;
      const ox = (cssW - gridW) / 2;
      const oy = (cssH - gridH) / 2;

      ctx.clearRect(0, 0, cssW, cssH);

      const stone = ctx.createLinearGradient(0, oy - 8, 0, oy + gridH + 8);
      stone.addColorStop(0, "#9a6c34");
      stone.addColorStop(0.14, "#6a4420");
      stone.addColorStop(0.5, "#3d2610");
      stone.addColorStop(1, "#1a1008");
      roundRect(ctx, ox - 7, oy - 7, gridW + 14, gridH + 14, 12);
      ctx.fillStyle = stone;
      ctx.fill();

      ctx.strokeStyle = "rgba(246, 220, 156, 0.55)";
      ctx.lineWidth = 2.4;
      roundRect(ctx, ox - 7, oy - 7, gridW + 14, gridH + 14, 12);
      ctx.stroke();
      ctx.strokeStyle = "rgba(226, 183, 90, 0.28)";
      ctx.lineWidth = 6;
      roundRect(ctx, ox - 11, oy - 11, gridW + 22, gridH + 22, 14);
      ctx.stroke();

      const pulse = 0.5 + 0.5 * Math.sin(now / 220);
      const winCells = new Set<string>();
      for (const win of wins) {
        for (const p of win.positions) winCells.add(`${p.reel}:${p.row}`);
      }
      for (const s of scatterRows) winCells.add(`${s.reel}:${s.row}`);

      for (let reel = 0; reel < REELS; reel++) {
        const x = ox + reel * (cellW + gap);
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, oy, cellW, gridH);
        ctx.clip();

        const strip = STRIPS[reel];
        const len = strip.length;
        const rs = reelsRef.current[reel];
        const offset = rs ? rs.offset : (idleOffset.current[reel] ?? 0);
        const tExp = expandT.current;
        const reelLayers = !spinning
          ? expandLayers
              .map((layer, idx) => ({ layer, idx }))
              .filter(({ layer }) => layer.reels.includes(reel))
          : [];

        const first = Math.floor(offset) - 1;
        const last = first + ROWS + 2;
        for (let i = first; i <= last; i++) {
          const row = i - Math.round(offset);
          const symbol = strip[wrapIndex(i, len)];
          const y = oy + (i - offset) * cellH;
          const inWindow = row >= 0 && row < ROWS;
          const hot = inWindow && winCells.has(`${reel}:${row}`);

          if (reelLayers.length && inWindow) {
            const cellY = oy + row * cellH;
            drawSymbol(ctx, assets, symbol, x, cellY, cellW, cellH, 1, now, false, false, 0);
            for (const { layer, idx } of reelLayers) {
              const localT = Math.min(1, Math.max(0, tExp - idx));
              if (localT <= 0) continue;
              drawExpandCards(
                ctx,
                assets,
                grid,
                layer.symbol,
                reel,
                row,
                x,
                cellY,
                cellW,
                cellH,
                localT,
                now,
                pulse,
              );
            }
          } else {
            const openBook = bookReveal && inWindow && symbol === "book";
            drawSymbol(
              ctx,
              assets,
              symbol,
              x,
              y,
              cellW,
              cellH,
              hot ? 1 + 0.04 * pulse : 1,
              now,
              hot,
              openBook,
              bookT.current,
            );
          }
        }

        ctx.restore();
      }

      ctx.strokeStyle = "rgba(232, 197, 92, 0.22)";
      ctx.lineWidth = 1;
      for (let reel = 0; reel < REELS - 1; reel++) {
        const x = ox + (reel + 1) * cellW + reel * gap + gap / 2;
        ctx.beginPath();
        ctx.moveTo(x, oy + 4);
        ctx.lineTo(x, oy + gridH - 4);
        ctx.stroke();
      }
      for (let row = 1; row < ROWS; row++) {
        const y = oy + row * cellH;
        ctx.beginPath();
        ctx.moveTo(ox + 4, y);
        ctx.lineTo(ox + gridW - 4, y);
        ctx.stroke();
      }

      if (!spinning) {
        const traces = new Set<number>();
        for (const w of wins) traces.add(w.line);
        if (highlightLine !== null) traces.add(highlightLine);
        const winOn = new Map<string, boolean>();
        for (const w of wins) {
          const hi = w.line === highlightLine;
          for (const p of w.positions) {
            const key = `${p.reel}:${p.row}`;
            winOn.set(key, Boolean(winOn.get(key) || hi));
          }
        }
        if (highlightLine !== null && PAYLINES[highlightLine]) {
          PAYLINES[highlightLine].forEach((row, reel) => {
            winOn.set(`${reel}:${row}`, true);
          });
        }
        for (const [key, hi] of winOn) {
          const [rs, rw] = key.split(":").map(Number);
          const cx = ox + rs * (cellW + gap);
          const cy = oy + rw * cellH;
          ctx.save();
          roundRect(ctx, cx + 2, cy + 2, cellW - 4, cellH - 4, 6);
          ctx.fillStyle = hi ? "rgba(255, 214, 90, 0.16)" : "rgba(232, 197, 92, 0.08)";
          ctx.fill();
          ctx.strokeStyle = hi ? "rgba(255, 230, 140, 0.95)" : "rgba(232, 197, 92, 0.55)";
          ctx.lineWidth = hi ? 3.4 : 2.1;
          ctx.shadowColor = hi ? "rgba(255, 200, 60, 0.9)" : "rgba(232, 197, 92, 0.35)";
          ctx.shadowBlur = hi ? 14 : 6;
          ctx.stroke();
          ctx.restore();
        }
        for (const li of traces) {
          const rows = PAYLINES[li];
          if (!rows) continue;
          const isHi = li === highlightLine;
          ctx.save();
          ctx.lineJoin = "round";
          ctx.lineCap = "round";
          ctx.strokeStyle = isHi
            ? `rgba(255, 220, 120, ${0.85 + 0.15 * pulse})`
            : "rgba(246, 220, 156, 0.55)";
          ctx.lineWidth = isHi ? 5.5 : 3.2;
          ctx.shadowColor = isHi ? "rgba(255, 200, 50, 1)" : "rgba(232, 197, 92, 0.55)";
          ctx.shadowBlur = isHi ? 16 : 7;
          ctx.beginPath();
          for (let reel = 0; reel < REELS; reel++) {
            const px = ox + reel * (cellW + gap) + cellW / 2;
            const py = oy + rows[reel] * cellH + cellH / 2;
            if (reel === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.stroke();
          for (let reel = 0; reel < REELS; reel++) {
            const px = ox + reel * (cellW + gap) + cellW / 2;
            const py = oy + rows[reel] * cellH + cellH / 2;
            ctx.beginPath();
            ctx.arc(px, py, isHi ? 6 : 4, 0, Math.PI * 2);
            ctx.fillStyle = isHi ? "rgba(255, 236, 180, 1)" : "rgba(246, 220, 156, 0.85)";
            ctx.fill();
          }
          if (isHi) {
            const px = ox + cellW / 2;
            const py = oy + rows[0] * cellH + cellH / 2;
            ctx.font = `700 ${Math.max(11, Math.round(cellH * 0.2))}px Cinzel, serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.lineWidth = 4;
            ctx.strokeStyle = "rgba(20, 12, 6, 0.75)";
            ctx.strokeText(String(li + 1), px, py);
            ctx.fillStyle = "#fff4c8";
            ctx.fillText(String(li + 1), px, py);
          }
          ctx.restore();
        }
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [assets, grid, spinning, wins, scatterRows, expandLayers, expandSlow, bookReveal, highlightLine, turbo]);

  return (
    <div ref={frameRef} className="relative h-full w-full min-h-0">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        role="img"
        aria-label="Walzen"
      />
    </div>
  );
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawCardPlate(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  alpha: number,
) {
  const insetX = w * 0.04;
  const insetY = h * 0.04;
  roundRect(ctx, x + insetX, y + insetY, w - insetX * 2, h - insetY * 2, Math.min(10, w * 0.1));
  ctx.fillStyle = `rgba(28, 18, 8, ${0.55 * alpha})`;
  ctx.fill();
  ctx.strokeStyle = `rgba(240, 213, 138, ${0.7 * alpha})`;
  ctx.lineWidth = Math.max(1.2, w * 0.018);
  ctx.stroke();
}

function drawExpandCards(
  ctx: CanvasRenderingContext2D,
  assets: SlotAssets,
  grid: SymbolId[][],
  special: SymbolId,
  reel: number,
  row: number,
  x: number,
  cellY: number,
  cellW: number,
  cellH: number,
  tExp: number,
  now: number,
  pulse: number,
) {
  const origins: number[] = [];
  const col = grid[reel];
  if (col) {
    for (let r = 0; r < ROWS; r++) {
      if (col[r] === special) origins.push(r);
    }
  }
  const origin = origins.length
    ? origins.reduce(
        (best, r) => (Math.abs(r - row) < Math.abs(best - row) ? r : best),
        origins[0],
      )
    : row;
  const dist = Math.abs(row - origin);
  const delay = dist === 0 ? 0 : 0.06 + (dist - 1) * 0.16;
  const local = dist === 0 ? Math.min(1, tExp / 0.35) : Math.min(1, Math.max(0, (tExp - delay) / 0.32));
  const flip = easeOutCubic(local);
  if (dist > 0 && local <= 0) return;

  ctx.save();
  if (dist > 0) {
    const pivotY = row < origin ? cellY + cellH : cellY;
    ctx.translate(x + cellW / 2, pivotY);
    ctx.scale(0.86 + 0.14 * flip, Math.max(0.04, flip));
    ctx.translate(-(x + cellW / 2), -pivotY);
  }
  drawCardPlate(ctx, x, cellY, cellW, cellH, dist === 0 ? 0.55 : 0.35 + 0.5 * flip);
  drawSymbol(ctx, assets, special, x, cellY, cellW, cellH, 1 + 0.04 * pulse, now, true, false, 0);
  ctx.restore();
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
  mode: "cover" | "contain" = "cover",
  padRatio = 0.13,
) {
  if (!img?.complete || !img.naturalWidth) return;
  const pad = mode === "contain" ? Math.min(w, h) * padRatio : 0;
  const tw = Math.max(1, w - pad * 2);
  const th = Math.max(1, h - pad * 2);
  const ox = x + (w - tw) / 2;
  const oy = y + (h - th) / 2;
  const ir = img.naturalWidth / img.naturalHeight;
  const cr = tw / th;
  let dw: number;
  let dh: number;
  if (mode === "contain" ? ir > cr : ir <= cr) {
    dw = tw;
    dh = tw / ir;
  } else {
    dh = th;
    dw = th * ir;
  }
  ctx.drawImage(img, ox + (tw - dw) / 2, oy + (th - dh) / 2, dw, dh);
}

function drawBookFlip(
  ctx: CanvasRenderingContext2D,
  assets: SlotAssets,
  x: number,
  y: number,
  w: number,
  h: number,
  t: number,
) {
  const closed = assets.tiles.book;
  const opened = assets.bookOpen ?? closed;
  const page = assets.bookPage ?? opened;
  const open = Math.min(1, t / 0.4);
  if (open < 1) {
    drawCover(ctx, closed, x, y, w, h);
    ctx.save();
    const spine = x + w * 0.16;
    ctx.translate(spine, y + h / 2);
    const sx = Math.cos(open * Math.PI);
    ctx.scale(Math.max(0.03, Math.abs(sx)), 1);
    ctx.translate(-spine, -(y + h / 2));
    ctx.beginPath();
    ctx.rect(spine, y, w, h);
    ctx.clip();
    drawCover(ctx, sx >= 0 ? closed : opened, x, y, w, h);
    ctx.restore();
    return;
  }
  drawCover(ctx, opened, x, y, w, h);
  const u = ((t - 0.4) % 0.72) / 0.72;
  const spine = x + w * 0.5;
  ctx.save();
  ctx.translate(spine, y + h / 2);
  const sx = Math.cos(u * Math.PI);
  ctx.scale(Math.max(0.04, Math.abs(sx)), 1);
  ctx.translate(-spine, -(y + h / 2));
  ctx.beginPath();
  if (sx >= 0) ctx.rect(spine, y, w / 2 + 2, h);
  else ctx.rect(x, y, w / 2 + 2, h);
  ctx.clip();
  drawCover(ctx, page, x, y, w, h);
  ctx.restore();
  ctx.fillStyle = "rgba(240, 213, 138, 0.7)";
  ctx.fillRect(spine - 1.2, y + h * 0.08, 2.4, h * 0.84);
  const glow = Math.max(0, Math.min(1, (t - 1.15) / 0.4));
  if (glow > 0) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, Math.max(w, h) * 1.35);
    g.addColorStop(0, `rgba(255, 248, 220, ${0.92 * glow})`);
    g.addColorStop(0.35, `rgba(246, 220, 156, ${0.55 * glow})`);
    g.addColorStop(1, "rgba(255, 230, 160, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - w * 0.2, y - h * 0.2, w * 1.4, h * 1.4);
  }
}

function drawSymbol(
  ctx: CanvasRenderingContext2D,
  assets: SlotAssets,
  id: SymbolId,
  x: number,
  y: number,
  cellW: number,
  cellH: number,
  scale: number,
  now: number,
  hot: boolean,
  openBook: boolean,
  bookT: number,
) {
  const img = assets.tiles[id];
  if (!img?.complete || !img.naturalWidth) return;

  const inset = Math.min(cellW, cellH) * 0.015;
  const rx = x + inset;
  const ry = y + inset;
  const rw = Math.max(1, (cellW - inset * 2) * scale);
  const rh = Math.max(1, (cellH - inset * 2) * scale);
  const dx = x + (cellW - rw) / 2;
  const dy = y + (cellH - rh) / 2;
  const rad = Math.min(7, Math.min(rw, rh) * 0.08);

  ctx.save();
  if (hot || id === "book") {
    ctx.shadowColor = id === "book" ? "rgba(255, 196, 64, 0.85)" : "rgba(255, 214, 110, 0.45)";
    ctx.shadowBlur = 14 + 6 * Math.sin(now / 180);
  }
  roundRect(ctx, dx, dy, rw, rh, rad);
  ctx.fillStyle = "#24150a";
  ctx.fill();
  ctx.clip();
  if (openBook) drawBookFlip(ctx, assets, dx, dy, rw, rh, bookT);
  else {
    const royal = id === "ace" || id === "king" || id === "queen" || id === "jack" || id === "ten";
    if (royal) {
      const edge = Math.max(rad * 0.65, Math.min(rw, rh) * 0.045);
      ctx.drawImage(img, dx + edge, dy + edge, rw - edge * 2, rh - edge * 2);
    } else {
      drawCover(ctx, img, dx, dy, rw, rh, "cover");
    }
  }
  ctx.restore();

  ctx.save();
  roundRect(ctx, dx, dy, rw, rh, rad);
  ctx.strokeStyle = hot || id === "book" ? "rgba(246, 220, 156, 0.9)" : "rgba(232, 197, 92, 0.55)";
  ctx.lineWidth = Math.max(1.4, Math.min(rw, rh) * 0.028);
  ctx.stroke();
  ctx.restore();
}

export default ReelsCanvas;

