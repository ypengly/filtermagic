// Face-anchored decorations. Each overlay is (ctx, geo, intensity, timeSeconds) and is only
// drawn when real face landmarks exist - there are no static, fake "AR" stickers.
import { clamp, drawHeart, drawSparkle, drawStar, seeded } from '../utils/canvasUtils.js';

const TAU = Math.PI * 2;

/** Draw inside a frame whose origin is the top of the forehead, x along the eye line, y down. */
function headFrame(ctx, g, fn) {
  ctx.save();
  ctx.translate(g.top.x, g.top.y);
  ctx.rotate(g.roll);
  fn(g.faceW, g.faceH);
  ctx.restore();
}

/** Point offset from the nose (default) in face-widths, rotated with the head. */
function rel(g, dx, dy, o = g.nose) {
  const c = Math.cos(g.roll);
  const s = Math.sin(g.roll);
  return { x: o.x + g.faceW * (dx * c - dy * s), y: o.y + g.faceW * (dx * s + dy * c) };
}

function ear(ctx, x, y, w, h, tilt, outer, inner, round) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  const path = (s) => {
    const ww = w * s;
    const hh = h * s;
    ctx.beginPath();
    ctx.moveTo(-ww / 2, 0);
    if (round) {
      ctx.bezierCurveTo(-ww * 0.75, -hh * 0.55, -ww * 0.5, -hh, 0, -hh);
      ctx.bezierCurveTo(ww * 0.5, -hh, ww * 0.75, -hh * 0.55, ww / 2, 0);
    } else {
      ctx.quadraticCurveTo(-ww * 0.5, -hh * 0.55, 0, -hh);
      ctx.quadraticCurveTo(ww * 0.5, -hh * 0.55, ww / 2, 0);
    }
    ctx.closePath();
  };
  path(1);
  ctx.fillStyle = outer;
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, w * 0.06);
  ctx.strokeStyle = 'rgba(120,70,90,.35)';
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.translate(0, -h * 0.04);
  path(0.6);
  ctx.fillStyle = inner;
  ctx.fill();
  ctx.restore();
}

function ellipse(ctx, x, y, rx, ry, rot, fill, stroke) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = Math.max(1.5, rx * 0.12);
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

/** Twinkling sparkles on a deterministic orbit around the face. */
function sparkleField(ctx, g, t, k, colors, count, seed = 0, glow) {
  const cx = (g.top.x + g.chin.x) / 2;
  const cy = (g.top.y + g.chin.y) / 2;
  for (let i = 0; i < count; i++) {
    const ang = seeded(i + seed) * TAU + t * 0.12 * (i % 2 ? 1 : -1);
    const spread = 0.75 + 0.55 * seeded(i + seed + 3);
    const x = cx + Math.cos(ang) * g.faceW * 0.62 * spread;
    const y = cy + Math.sin(ang) * g.faceH * 0.72 * spread;
    const tw = 0.5 + 0.5 * Math.sin(t * 3 + i * 1.7);
    const size = g.faceW * (0.03 + 0.05 * seeded(i + seed + 9)) * (0.45 + tw);
    ctx.globalAlpha = clamp(k * (0.35 + 0.65 * tw));
    drawSparkle(ctx, x, y, size, colors[i % colors.length], glow);
  }
  ctx.globalAlpha = 1;
}

function floatingHearts(ctx, g, t, k, count = 7, colors = ['#ff7aa8', '#ff5c8a', '#ffa3c4']) {
  for (let i = 0; i < count; i++) {
    const phase = (t * 0.32 + seeded(i + 4)) % 1;
    const x = g.top.x + (seeded(i + 10) - 0.5) * g.faceW * 1.3 + Math.sin(t * 2 + i) * g.faceW * 0.03;
    const y = g.top.y + g.faceH * 0.15 - phase * g.faceH * 0.95;
    const s = g.faceW * (0.035 + 0.05 * seeded(i + 20));
    ctx.globalAlpha = clamp(k * Math.sin(phase * Math.PI));
    drawHeart(ctx, x, y, s, colors[i % colors.length]);
  }
  ctx.globalAlpha = 1;
}

export function blush(ctx, g, k) {
  const r = g.faceW * 0.19;
  for (const c of [g.cheekL, g.cheekR]) {
    const gr = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
    gr.addColorStop(0, `rgba(255,96,140,${0.62 * k})`);
    gr.addColorStop(0.55, `rgba(255,120,160,${0.3 * k})`);
    gr.addColorStop(1, 'rgba(255,140,170,0)');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, TAU);
    ctx.fill();
  }
}

const LIPS_OUT = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185];
const LIPS_IN = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191];

function poly(ctx, g, idx) {
  idx.forEach((i, n) => {
    const p = g.p(i);
    if (n) ctx.lineTo(p.x, p.y);
    else ctx.moveTo(p.x, p.y);
  });
  ctx.closePath();
}

export function lips(ctx, g, k) {
  ctx.beginPath();
  poly(ctx, g, LIPS_OUT);
  poly(ctx, g, LIPS_IN);
  ctx.fillStyle = `rgba(214,36,84,${0.58 * k})`;
  ctx.fill('evenodd');
  const a = g.p(14);
  const b = g.p(17);
  ctx.fillStyle = `rgba(255,255,255,${0.4 * k})`;
  ctx.beginPath();
  ctx.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, g.faceW * 0.05, g.faceW * 0.009, g.roll, 0, TAU);
  ctx.fill();
}

export function catFace(ctx, g, k, t) {
  ctx.globalAlpha = k;
  headFrame(ctx, g, (u) => {
    ear(ctx, -0.3 * u, 0.04 * u, 0.3 * u, 0.36 * u, -0.3, '#fff0e4', '#ffb3c7', false);
    ear(ctx, 0.3 * u, 0.04 * u, 0.3 * u, 0.36 * u, 0.3, '#fff0e4', '#ffb3c7', false);
  });
  const n = g.nose;
  const s = g.faceW * 0.05;
  ctx.fillStyle = '#ff8fb0';
  ctx.beginPath();
  ctx.moveTo(n.x - s, n.y - s * 0.5);
  ctx.quadraticCurveTo(n.x, n.y - s * 0.9, n.x + s, n.y - s * 0.5);
  ctx.quadraticCurveTo(n.x + s * 0.6, n.y + s * 0.6, n.x, n.y + s);
  ctx.quadraticCurveTo(n.x - s * 0.6, n.y + s * 0.6, n.x - s, n.y - s * 0.5);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.95)';
  ctx.lineWidth = Math.max(1.5, g.faceW * 0.008);
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(90,50,70,.5)';
  ctx.shadowBlur = 3;
  for (const side of [-1, 1]) {
    for (let i = -1; i <= 1; i++) {
      const a = rel(g, side * 0.14, 0.05 + i * 0.02);
      const ang = g.roll + (side < 0 ? Math.PI : 0) + side * i * 0.22 + Math.sin(t * 2 + i) * 0.03;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(a.x + Math.cos(ang) * g.faceW * 0.36, a.y + Math.sin(ang) * g.faceW * 0.36);
      ctx.stroke();
    }
  }
}

export function puppy(ctx, g, k) {
  ctx.globalAlpha = k;
  headFrame(ctx, g, (u) => {
    ellipse(ctx, -0.43 * u, 0.2 * u, 0.13 * u, 0.27 * u, 0.28, '#b97f4f', 'rgba(90,50,30,.4)');
    ellipse(ctx, 0.43 * u, 0.2 * u, 0.13 * u, 0.27 * u, -0.28, '#b97f4f', 'rgba(90,50,30,.4)');
  });
  const n = g.nose;
  const u = g.faceW;
  if (g.mouthOpen > 0.07) {
    const m = g.p(17);
    ellipse(ctx, m.x, m.y + u * 0.035, u * 0.08, u * 0.07 + g.mouthOpen * u * 0.1, g.roll, '#ff8fa8', 'rgba(180,50,80,.45)');
  }
  ellipse(ctx, n.x, n.y - u * 0.005, u * 0.075, u * 0.052, g.roll, '#2d1f2b');
  ellipse(ctx, n.x - u * 0.025, n.y - u * 0.02, u * 0.025, u * 0.012, g.roll, 'rgba(255,255,255,.7)');
}

export function bunny(ctx, g, k, t) {
  ctx.globalAlpha = k;
  headFrame(ctx, g, (u) => {
    for (const side of [-1, 1]) {
      const sway = Math.sin(t * 2 + side) * 0.07;
      ear(ctx, side * 0.17 * u, 0.05 * u, 0.2 * u, 0.72 * u, side * 0.14 + sway, '#ffffff', '#ffc2d9', true);
    }
  });
  drawHeart(ctx, g.nose.x, g.nose.y, g.faceW * 0.035, '#ff7aa8');
}

export function bear(ctx, g, k) {
  ctx.globalAlpha = k;
  headFrame(ctx, g, (u) => {
    for (const side of [-1, 1]) {
      ellipse(ctx, side * 0.33 * u, 0.0, 0.15 * u, 0.15 * u, 0, '#a9714b', 'rgba(70,40,25,.4)');
      ellipse(ctx, side * 0.33 * u, 0.01 * u, 0.085 * u, 0.085 * u, 0, '#f3c4a8');
    }
  });
  const n = g.nose;
  const u = g.faceW;
  ctx.globalAlpha = k * 0.92;
  ellipse(ctx, n.x, n.y + u * 0.03, u * 0.13, u * 0.1, g.roll, '#f2d2b6', 'rgba(120,80,60,.3)');
  ctx.globalAlpha = k;
  ellipse(ctx, n.x, n.y, u * 0.055, u * 0.04, g.roll, '#47292a');
}

export function angel(ctx, g, k, t) {
  const bob = Math.sin(t * 2) * g.faceH * 0.012;
  ctx.globalAlpha = k;
  headFrame(ctx, g, (u, h) => {
    ctx.lineWidth = u * 0.04;
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(255,225,90,1)';
    ctx.shadowBlur = u * 0.12;
    ctx.strokeStyle = '#ffe36e';
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.2 + bob, u * 0.26, u * 0.065, 0, 0, TAU);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.lineWidth = u * 0.014;
    ctx.strokeStyle = 'rgba(255,255,255,.85)';
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.2 + bob - u * 0.008, u * 0.26, u * 0.06, 0, Math.PI * 1.1, Math.PI * 1.7);
    ctx.stroke();
  });
  sparkleField(ctx, g, t, k, ['#fff7c2', '#ffffff', '#ffe36e'], 12, 40, 'rgba(255,220,90,.95)');
}

export function heartEyes(ctx, g, k, t) {
  const s = g.faceW * 0.075 * (1 + 0.12 * Math.sin(t * 6));
  ctx.globalAlpha = k;
  for (const e of [g.eyeL, g.eyeR]) drawHeart(ctx, e.x, e.y, s, '#ff3b6b');
  floatingHearts(ctx, g, t, k, 8);
}

export function starryFace(ctx, g, k, t) {
  ctx.globalAlpha = k;
  const spots = [[-0.3, 0.1, 0.045], [0.3, 0.1, 0.045], [-0.22, 0.2, 0.03], [0.22, 0.2, 0.03], [0, -0.52, 0.04]];
  spots.forEach(([dx, dy, s], i) => {
    const p = rel(g, dx, dy);
    const pulse = 1 + 0.15 * Math.sin(t * 4 + i * 2);
    drawStar(ctx, p.x, p.y, g.faceW * s * pulse, i % 2 ? '#fff08a' : '#ffd95e');
  });
  sparkleField(ctx, g, t, k, ['#fff7c2', '#ffffff', '#ffd95e'], 14, 70, 'rgba(255,210,80,.95)');
}

export function rainbowMagic(ctx, g, k, t) {
  const colors = ['#ff5e7e', '#ff9d5c', '#ffe45e', '#7be495', '#5ec8ff', '#8e7bff', '#d57bff'];
  ctx.globalAlpha = k * 0.9;
  headFrame(ctx, g, (u, h) => {
    ctx.lineWidth = u * 0.036;
    ctx.lineCap = 'butt';
    colors.forEach((c, i) => {
      ctx.strokeStyle = c;
      ctx.beginPath();
      ctx.arc(0, h * 0.08, u * (0.6 - i * 0.034), Math.PI, TAU);
      ctx.stroke();
    });
  });
  sparkleField(ctx, g, t, k, colors, 12, 90, 'rgba(255,255,255,.9)');
}

function bow(ctx, x, y, s, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = '#ff8fb8';
  ctx.strokeStyle = 'rgba(190,60,110,.5)';
  ctx.lineWidth = Math.max(1.5, s * 0.06);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(side * s * 0.5, -s * 0.7, side * s * 1.25, -s * 0.55, side * s * 1.2, 0);
    ctx.bezierCurveTo(side * s * 1.25, s * 0.55, side * s * 0.5, s * 0.7, 0, 0);
    ctx.fill();
    ctx.stroke();
  }
  ellipse(ctx, 0, 0, s * 0.26, s * 0.26, 0, '#ff5c9a', 'rgba(190,60,110,.5)');
  ctx.restore();
}

export function kawaiiSparkles(ctx, g, k, t) {
  ctx.globalAlpha = k;
  headFrame(ctx, g, (u) => bow(ctx, -0.34 * u, 0.0, u * 0.1, -0.35));
  for (const [dx, dy] of [[-0.36, 0.16], [0.36, 0.16], [0.3, -0.5]]) {
    const p = rel(g, dx, dy);
    drawHeart(ctx, p.x, p.y, g.faceW * 0.035, '#ff8fb8');
  }
  sparkleField(ctx, g, t, k, ['#ffffff', '#ffc2e0', '#ffe6f2'], 16, 120, 'rgba(255,100,180,.95)');
}

export function superCute(ctx, g, k, t) {
  blush(ctx, g, k);
  floatingHearts(ctx, g, t, k, 6);
  sparkleField(ctx, g, t, k, ['#ffffff', '#ffc2e0', '#fff2a8'], 12, 150, 'rgba(255,100,180,.95)');
  ctx.globalAlpha = k;
  headFrame(ctx, g, (u) => bow(ctx, 0.34 * u, 0.0, u * 0.09, 0.35));
  const p = rel(g, -0.3, 0.12);
  drawStar(ctx, p.x, p.y, g.faceW * 0.04, '#fff08a');
}
