// Shared canvas helpers. Nothing here touches the DOM at import time (so it is testable in Node).
export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;

/** Deterministic pseudo-random number in [0,1) for a given seed. */
export function seeded(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function createCanvas(w = 1, h = 1) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function fitSize(w, h, max) {
  const s = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}

const scratch = new Map();
/** Reusable off-screen canvases, so the render loop never allocates. */
export function getScratch(key, w, h) {
  let c = scratch.get(key);
  if (!c) {
    c = createCanvas(w, h);
    scratch.set(key, c);
  }
  if (c.width !== w || c.height !== h) {
    c.width = w;
    c.height = h;
  }
  return c;
}

/**
 * Cheap blur that works in every browser (ctx.filter is missing in Safari):
 * downscale then upscale with smoothing, and blend the result back.
 */
export function drawBlurred(ctx, w, h, { scale = 0.1, alpha = 1, composite = 'source-over' } = {}) {
  if (alpha <= 0) return;
  const mid = getScratch('blur-mid', Math.max(1, w >> 1), Math.max(1, h >> 1));
  const mctx = mid.getContext('2d');
  mctx.imageSmoothingEnabled = true;
  mctx.drawImage(ctx.canvas, 0, 0, mid.width, mid.height);
  const small = getScratch('blur-small', Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale)));
  const sctx = small.getContext('2d');
  sctx.imageSmoothingEnabled = true;
  sctx.drawImage(mid, 0, 0, small.width, small.height);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = composite;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(small, 0, 0, w, h);
  ctx.restore();
}

export function heartPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.3, y + s * 0.1, x - s * 0.9, y - s * 0.9, x, y - s * 0.35);
  ctx.bezierCurveTo(x + s * 0.9, y - s * 0.9, x + s * 1.3, y + s * 0.1, x, y + s * 0.9);
  ctx.closePath();
}

export function drawHeart(ctx, x, y, s, fill = '#ff5c8a') {
  heartPath(ctx, x, y, s);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.beginPath();
  ctx.ellipse(x - s * 0.4, y - s * 0.3, s * 0.2, s * 0.1, -0.6, 0, Math.PI * 2);
  ctx.fill();
}

export function starPath(ctx, x, y, r, points = 5, inner = 0.45, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = rot + (i * Math.PI) / points;
    const rr = i % 2 ? r * inner : r;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }
  ctx.closePath();
}

export function drawStar(ctx, x, y, r, fill = '#ffd95e') {
  starPath(ctx, x, y, r, 5, 0.48);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.14);
  ctx.strokeStyle = 'rgba(255,255,255,.9)';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

export function drawSparkle(ctx, x, y, r, fill = '#fff', glow = 'rgba(255,120,190,.9)') {
  starPath(ctx, x, y, r, 4, 0.22);
  ctx.shadowColor = glow;
  ctx.shadowBlur = r * 0.9;
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.shadowBlur = 0;
}
