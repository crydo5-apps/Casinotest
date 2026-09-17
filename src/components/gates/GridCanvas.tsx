import { useEffect, useRef, useCallback } from "react";
import type { GatesSymbolId, OrbInfo } from "@/lib/gates/types";
import { COLS, ROWS } from "@/lib/gates/engine";

type SymbolDrawInfo = {
  gradient: string[];
  glow: string;
  label?: string;
  shape: "gem" | "crown" | "chalice" | "ring" | "hourglass" | "orb" | "scatter";
};

const SYMBOL_STYLES: Record<GatesSymbolId, SymbolDrawInfo> = {
  blueGem:   { gradient: ["#1a6fc4", "#3ba0e8", "#1a6fc4"], glow: "#3ba0e8", shape: "gem" },
  greenGem:  { gradient: ["#1a8a3a", "#4cdf6a", "#1a8a3a"], glow: "#4cdf6a", shape: "gem" },
  yellowGem: { gradient: ["#c4a020", "#ffd34d", "#c4a020"], glow: "#ffd34d", shape: "gem" },
  purpleGem: { gradient: ["#6a2ab0", "#b060f0", "#6a2ab0"], glow: "#b060f0", shape: "gem" },
  redGem:    { gradient: ["#c42020", "#f06060", "#c42020"], glow: "#f06060", shape: "gem" },
  chalice:   { gradient: ["#8a6a20", "#d4b056", "#8a6a20"], glow: "#d4b056", shape: "chalice", label: "chal" },
  ring:      { gradient: ["#7a5a18", "#c49a40", "#7a5a18"], glow: "#c49a40", shape: "ring", label: "ring" },
  hourglass: { gradient: ["#6a5a28", "#b8a060", "#6a5a28"], glow: "#b8a060", shape: "hourglass", label: "hour" },
  crown:     { gradient: ["#9a7a20", "#ffd700", "#9a7a20"], glow: "#ffd700", shape: "crown", label: "crown" },
  scatter:   { gradient: ["#2a5ac4", "#60a0ff", "#2a5ac4"], glow: "#60a0ff", shape: "scatter", label: "ZEUS" },
  orb:       { gradient: ["#c4a020", "#fff3c4", "#c4a020"], glow: "#fff3c4", shape: "orb" },
};

type Props = {
  grid: GatesSymbolId[][];
  orbMultipliers: OrbInfo[];
  winCells: Set<string>;
  orbSum: number;
  turbo: boolean;
};

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function easeOutBounce(t: number): number {
  if (t < 1 / 2.75) return 7.5625 * t * t;
  if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
  if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
  return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
}

function drawGem(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  info: SymbolDrawInfo,
  now: number,
  isWin: boolean,
) {
  const s = size * 0.42;
  ctx.save();

  if (isWin) {
    const pulse = 0.7 + 0.3 * Math.sin(now / 120);
    ctx.shadowColor = info.glow;
    ctx.shadowBlur = 18 * pulse;
  }

  const grad = ctx.createLinearGradient(cx - s, cy - s, cx + s, cy + s);
  grad.addColorStop(0, info.gradient[0]);
  grad.addColorStop(0.5, info.gradient[1]);
  grad.addColorStop(1, info.gradient[2]);

  ctx.beginPath();
  ctx.moveTo(cx, cy - s);
  ctx.lineTo(cx + s * 0.6, cy - s * 0.3);
  ctx.lineTo(cx + s, cy + s * 0.1);
  ctx.lineTo(cx + s * 0.6, cy + s);
  ctx.lineTo(cx - s * 0.6, cy + s);
  ctx.lineTo(cx - s, cy + s * 0.1);
  ctx.lineTo(cx - s * 0.6, cy - s * 0.3);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const highlight = ctx.createRadialGradient(cx - s * 0.2, cy - s * 0.3, 0, cx, cy, s * 0.8);
  highlight.addColorStop(0, "rgba(255,255,255,0.5)");
  highlight.addColorStop(0.5, "rgba(255,255,255,0.1)");
  highlight.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = highlight;
  ctx.fill();

  ctx.restore();
}

function drawCrown(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  now: number,
  isWin: boolean,
) {
  const s = size * 0.38;
  ctx.save();

  if (isWin) {
    ctx.shadowColor = "#ffd700";
    ctx.shadowBlur = 18 + 6 * Math.sin(now / 120);
  }

  const grad = ctx.createLinearGradient(cx, cy - s, cx, cy + s * 0.8);
  grad.addColorStop(0, "#ffd700");
  grad.addColorStop(0.5, "#c49a40");
  grad.addColorStop(1, "#8a6a20");

  ctx.beginPath();
  ctx.moveTo(cx - s, cy + s * 0.4);
  ctx.lineTo(cx - s * 0.7, cy - s * 0.3);
  ctx.lineTo(cx - s * 0.3, cy + s * 0.1);
  ctx.lineTo(cx, cy - s * 0.7);
  ctx.lineTo(cx + s * 0.3, cy + s * 0.1);
  ctx.lineTo(cx + s * 0.7, cy - s * 0.3);
  ctx.lineTo(cx + s, cy + s * 0.4);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.strokeStyle = "rgba(255,215,0,0.6)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const highlight = ctx.createRadialGradient(cx - s * 0.15, cy - s * 0.25, 0, cx, cy, s * 0.7);
  highlight.addColorStop(0, "rgba(255,255,255,0.45)");
  highlight.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = highlight;
  ctx.fill();

  ctx.restore();
}

function drawOrb(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  orbValue: number,
  now: number,
) {
  const s = size * 0.36;
  ctx.save();

  const pulse = 0.6 + 0.4 * Math.sin(now / 200);
  ctx.shadowColor = "#fff3c4";
  ctx.shadowBlur = 22 * pulse;

  const grad = ctx.createRadialGradient(cx - s * 0.2, cy - s * 0.2, 0, cx, cy, s);
  grad.addColorStop(0, "#fff3c4");
  grad.addColorStop(0.3, "#ffd34d");
  grad.addColorStop(0.7, "#c49a40");
  grad.addColorStop(1, "#8a6a20");

  ctx.beginPath();
  ctx.arc(cx, cy, s, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + now / 500;
    const lx = cx + Math.cos(angle) * s * 0.5;
    const ly = cy + Math.sin(angle) * s * 0.5;
    const rayGrad = ctx.createRadialGradient(lx, ly, 0, lx, ly, s * 0.3);
    rayGrad.addColorStop(0, "rgba(255,243,196,0.6)");
    rayGrad.addColorStop(1, "rgba(255,243,196,0)");
    ctx.fillStyle = rayGrad;
    ctx.fillRect(lx - s * 0.3, ly - s * 0.3, s * 0.6, s * 0.6);
  }

  const highlight = ctx.createRadialGradient(cx - s * 0.25, cy - s * 0.25, 0, cx, cy, s * 0.6);
  highlight.addColorStop(0, "rgba(255,255,255,0.65)");
  highlight.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = highlight;
  ctx.fill();

  ctx.font = `bold ${Math.round(s * 0.7)}px Cinzel, serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#1a1008";
  ctx.fillText(`${orbValue}×`, cx, cy + 1);

  ctx.restore();
}

function drawScatter(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  now: number,
  isWin: boolean,
) {
  const s = size * 0.38;
  ctx.save();

  if (isWin) {
    const pulse = 0.7 + 0.3 * Math.sin(now / 150);
    ctx.shadowColor = "#60a0ff";
    ctx.shadowBlur = 20 * pulse;
  }

  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 1.2);
  grad.addColorStop(0, "#60a0ff");
  grad.addColorStop(0.4, "#2a5ac4");
  grad.addColorStop(1, "#0a2a6a");
  ctx.beginPath();
  ctx.arc(cx, cy, s, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.strokeStyle = "rgba(96,160,255,0.6)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = `bold ${Math.round(s * 0.55)}px Cinzel, serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";
  ctx.fillText("Z", cx, cy - s * 0.05);

  const lightningGrad = ctx.createLinearGradient(cx - s * 0.15, cy + s * 0.1, cx + s * 0.15, cy + s * 0.5);
  lightningGrad.addColorStop(0, "#ffd700");
  lightningGrad.addColorStop(1, "#ff6600");
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.1, cy + s * 0.15);
  ctx.lineTo(cx - s * 0.05, cy + s * 0.3);
  ctx.lineTo(cx + s * 0.05, cy + s * 0.3);
  ctx.lineTo(cx - s * 0.1, cy + s * 0.55);
  ctx.strokeStyle = lightningGrad;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}

function drawChalice(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  now: number,
  isWin: boolean,
) {
  const s = size * 0.35;
  ctx.save();

  if (isWin) {
    ctx.shadowColor = "#d4b056";
    ctx.shadowBlur = 14 + 4 * Math.sin(now / 140);
  }

  const grad = ctx.createLinearGradient(cx - s, cy - s, cx + s, cy + s);
  grad.addColorStop(0, "#c49a40");
  grad.addColorStop(0.5, "#d4b056");
  grad.addColorStop(1, "#8a6a20");

  ctx.beginPath();
  ctx.ellipse(cx, cy - s * 0.2, s * 0.6, s * 0.35, 0, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx - s * 0.35, cy - s * 0.2);
  ctx.lineTo(cx - s * 0.15, cy + s * 0.35);
  ctx.lineTo(cx + s * 0.15, cy + s * 0.35);
  ctx.lineTo(cx + s * 0.35, cy - s * 0.2);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(cx, cy + s * 0.4, s * 0.4, s * 0.12, 0, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();
}

function drawRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  now: number,
  isWin: boolean,
) {
  const s = size * 0.32;
  ctx.save();

  if (isWin) {
    ctx.shadowColor = "#c49a40";
    ctx.shadowBlur = 14 + 4 * Math.sin(now / 140);
  }

  const grad = ctx.createLinearGradient(cx - s, cy - s, cx + s, cy + s);
  grad.addColorStop(0, "#c49a40");
  grad.addColorStop(0.5, "#ffd700");
  grad.addColorStop(1, "#8a6a20");

  ctx.beginPath();
  ctx.arc(cx, cy, s, 0, Math.PI * 2);
  ctx.lineWidth = s * 0.35;
  ctx.strokeStyle = grad;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.1, s * 0.22, 0, Math.PI * 2);
  const gemGrad = ctx.createRadialGradient(cx - 2, cy - s * 0.15, 0, cx, cy - s * 0.1, s * 0.22);
  gemGrad.addColorStop(0, "#f06060");
  gemGrad.addColorStop(1, "#c42020");
  ctx.fillStyle = gemGrad;
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();
}

function drawHourglass(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  now: number,
  isWin: boolean,
) {
  const s = size * 0.35;
  ctx.save();

  if (isWin) {
    ctx.shadowColor = "#b8a060";
    ctx.shadowBlur = 14 + 4 * Math.sin(now / 140);
  }

  const grad = ctx.createLinearGradient(cx - s, cy - s, cx + s, cy + s);
  grad.addColorStop(0, "#c49a40");
  grad.addColorStop(0.5, "#d4b056");
  grad.addColorStop(1, "#8a6a20");

  ctx.beginPath();
  ctx.moveTo(cx - s * 0.5, cy - s * 0.55);
  ctx.lineTo(cx + s * 0.5, cy - s * 0.55);
  ctx.lineTo(cx + s * 0.05, cy);
  ctx.lineTo(cx + s * 0.5, cy + s * 0.55);
  ctx.lineTo(cx - s * 0.5, cy + s * 0.55);
  ctx.lineTo(cx - s * 0.05, cy);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 1;
  ctx.stroke();

  const sand = ctx.createLinearGradient(cx, cy - s * 0.1, cx, cy + s * 0.3);
  sand.addColorStop(0, "rgba(255,243,196,0)");
  sand.addColorStop(1, "rgba(255,243,196,0.4)");
  ctx.fillStyle = sand;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.35, cy + s * 0.55);
  ctx.lineTo(cx + s * 0.35, cy + s * 0.55);
  ctx.lineTo(cx + s * 0.05, cy + s * 0.1);
  ctx.lineTo(cx - s * 0.05, cy + s * 0.1);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  sym: GatesSymbolId,
  now: number,
  isWin: boolean,
  orbValue?: number,
) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const info = SYMBOL_STYLES[sym];

  ctx.save();

  const pad = Math.min(w, h) * 0.06;
  roundRect(ctx, x + pad, y + pad, w - pad * 2, h - pad * 2, 8);
  ctx.fillStyle = "rgb(12 8 4 / 0.45)";
  ctx.fill();
  ctx.strokeStyle = isWin ? "rgba(255,214,90,0.7)" : "rgba(200,160,60,0.2)";
  ctx.lineWidth = isWin ? 2 : 1;
  ctx.stroke();

  if (sym === "orb" && orbValue !== undefined) {
    drawOrb(ctx, cx, cy, Math.min(w, h), orbValue, now);
  } else if (info.shape === "gem") {
    drawGem(ctx, cx, cy, Math.min(w, h), info, now, isWin);
  } else if (info.shape === "crown") {
    drawCrown(ctx, cx, cy, Math.min(w, h), now, isWin);
  } else if (info.shape === "chalice") {
    drawChalice(ctx, cx, cy, Math.min(w, h), now, isWin);
  } else if (info.shape === "ring") {
    drawRing(ctx, cx, cy, Math.min(w, h), now, isWin);
  } else if (info.shape === "hourglass") {
    drawHourglass(ctx, cx, cy, Math.min(w, h), now, isWin);
  } else if (info.shape === "scatter") {
    drawScatter(ctx, cx, cy, Math.min(w, h), now, isWin);
  }

  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function GridCanvas({ grid, orbMultipliers, winCells, orbSum, turbo }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  const orbMapRef = useRef<Map<string, number>>(new Map());
  orbMapRef.current = new Map(orbMultipliers.map((o) => [`${o.row}:${o.col}`, o.value]));

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const frame = frameRef.current;
    if (!canvas || !frame) return;

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

    const gap = Math.max(3, Math.min(cssW, cssH) * 0.008);
    const padX = Math.max(8, cssW * 0.02);
    const padY = Math.max(8, cssH * 0.02);
    const innerW = Math.max(1, cssW - padX * 2);
    const innerH = Math.max(1, cssH - padY * 2);
    const cellW = (innerW - gap * (COLS - 1)) / COLS;
    const cellH = (innerH - gap * (ROWS - 1)) / ROWS;
    const gridW = cellW * COLS + gap * (COLS - 1);
    const gridH = cellH * ROWS + gap * (ROWS - 1);
    const ox = (cssW - gridW) / 2;
    const oy = (cssH - gridH) / 2;

    ctx.clearRect(0, 0, cssW, cssH);

    const bgGrad = ctx.createLinearGradient(0, 0, 0, cssH);
    bgGrad.addColorStop(0, "rgba(20,12,6,0.3)");
    bgGrad.addColorStop(0.5, "rgba(14,8,4,0.15)");
    bgGrad.addColorStop(1, "rgba(20,12,6,0.3)");
    ctx.fillStyle = bgGrad;
    roundRect(ctx, ox - 10, oy - 10, gridW + 20, gridH + 20, 16);
    ctx.fill();

    ctx.strokeStyle = "rgba(201,162,39,0.5)";
    ctx.lineWidth = 2;
    roundRect(ctx, ox - 10, oy - 10, gridW + 20, gridH + 20, 16);
    ctx.stroke();

    ctx.strokeStyle = "rgba(201,162,39,0.2)";
    ctx.lineWidth = 5;
    roundRect(ctx, ox - 14, oy - 14, gridW + 28, gridH + 28, 18);
    ctx.stroke();

    const now = performance.now();

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = ox + c * (cellW + gap);
        const y = oy + r * (cellH + gap);
        const sym = grid[r]?.[c];
        if (!sym) continue;
        const isWin = winCells.has(`${r}:${c}`);
        const orbVal = orbMapRef.current.get(`${r}:${c}`);
        drawCell(ctx, x, y, cellW, cellH, sym, now, isWin, orbVal);
      }
    }

    requestAnimationFrame(draw);
  }, [grid, winCells, orbMultipliers, turbo]);

  useEffect(() => {
    const raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [draw]);

  return (
    <div ref={frameRef} className="relative h-full w-full min-h-0">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        role="img"
        aria-label="Gates of Olympus Grid"
      />
    </div>
  );
}
