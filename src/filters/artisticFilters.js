// Artistic filters built on custom image processing (edges, posterize, channel shifts, pixelation).
import { perPixel } from './colorFilters.js';
import { drawBlurred, getScratch, seeded } from '../utils/canvasUtils.js';

let grayBuf = null;
let edgeBuf = null;
let copyBuf = null;

/** Sobel edge magnitude of the image, in a reusable buffer. */
function edgeMap(img) {
  const { width: w, height: h, data: d } = img;
  const n = w * h;
  if (!grayBuf || grayBuf.length !== n) {
    grayBuf = new Float32Array(n);
    edgeBuf = new Float32Array(n);
  }
  for (let i = 0, j = 0; j < n; i += 4, j++) grayBuf[j] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  edgeBuf.fill(0);
  const g = grayBuf;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = -g[i - w - 1] - 2 * g[i - 1] - g[i + w - 1] + g[i - w + 1] + 2 * g[i + 1] + g[i + w + 1];
      const gy = -g[i - w - 1] - 2 * g[i - w] - g[i - w + 1] + g[i + w - 1] + 2 * g[i + w] + g[i + w + 1];
      edgeBuf[i] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  return edgeBuf;
}

export function softenPre(ctx, w, h, k) {
  drawBlurred(ctx, w, h, { scale: 0.5, alpha: k });
}

export function cartoon(img, k) {
  const e = edgeMap(img);
  const d = img.data;
  const step = 64;
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    let r = d[i];
    let g = d[i + 1];
    let b = d[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const or = r;
    const og = g;
    const ob = b;
    r = lum + (r - lum) * 1.3;
    g = lum + (g - lum) * 1.3;
    b = lum + (b - lum) * 1.3;
    const ink = Math.min(1, Math.max(0, (e[j] - 70) / 110));
    const f = 1 - ink * 0.92;
    const nr = Math.round(r / step) * step * f;
    const ng = Math.round(g / step) * step * f;
    const nb = Math.round(b / step) * step * f;
    d[i] = or + (nr - or) * k;
    d[i + 1] = og + (ng - og) * k;
    d[i + 2] = ob + (nb - ob) * k;
  }
}

export function sketch(img, k) {
  const e = edgeMap(img);
  const d = img.data;
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = (255 - Math.min(255, e[j] * 1.7)) * (0.84 + 0.16 * (lum / 255));
    d[i] += (v - d[i]) * k;
    d[i + 1] += (v - d[i + 1]) * k;
    d[i + 2] += (v - d[i + 2]) * k;
  }
}

/** RGB channel offset plus jittering horizontal slices. `t` is time in seconds. */
export function glitch(img, k, t = 0) {
  const { width: w, height: h, data: d } = img;
  if (!copyBuf || copyBuf.length !== d.length) copyBuf = new Uint8ClampedArray(d.length);
  copyBuf.set(d);
  const s = copyBuf;
  const off = Math.round(Math.max(2, (6 + 10 * Math.abs(Math.sin(t * 3.1))) * (w / 640)) * k);
  const burst = Math.floor(t * 8);
  const bandH = Math.max(1, Math.floor(h / 12));
  const cl = (x) => (x < 0 ? 0 : x >= w ? w - 1 : x);
  for (let y = 0; y < h; y++) {
    const band = Math.floor(y / bandH);
    const shift = seeded(band + burst * 13) > 0.82 ? Math.round((seeded(band * 7 + burst) - 0.5) * w * 0.14 * k) : 0;
    const row = y * w * 4;
    const dim = y % 2 ? 1 - 0.07 * k : 1;
    for (let x = 0; x < w; x++) {
      const sx = x + shift;
      const i = row + x * 4;
      d[i] = s[row + cl(sx + off) * 4] * dim;
      d[i + 1] = s[row + cl(sx) * 4 + 1] * dim;
      d[i + 2] = s[row + cl(sx - off) * 4 + 2] * dim;
    }
  }
}

/** Pixelates the canvas; block size grows with intensity. */
export function pixelatePre(ctx, w, h, k) {
  const block = 1 + Math.round(k * 9);
  if (block <= 1) return;
  const small = getScratch('pixelate', Math.ceil(w / block), Math.ceil(h / block));
  const sctx = small.getContext('2d');
  sctx.imageSmoothingEnabled = true;
  sctx.drawImage(ctx.canvas, 0, 0, small.width, small.height);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(small, 0, 0, small.width, small.height, 0, 0, small.width * block, small.height * block);
  ctx.restore();
}

export function pixelPalette(img, k) {
  perPixel(img, k, (r, g, b, o) => {
    const s = 42;
    o[0] = Math.round(r / s) * s;
    o[1] = Math.round(g / s) * s;
    o[2] = Math.round(b / s) * s;
  });
}
