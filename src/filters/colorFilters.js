// Per-pixel colour grading filters. Every function: (imageData, intensity 0..1) -> mutates in place.
import { drawBlurred } from '../utils/canvasUtils.js';

/** Runs fn for each pixel and blends the result with the original by `k`. */
export function perPixel(img, k, fn) {
  const d = img.data;
  const w = img.width;
  const o = [0, 0, 0];
  let x = 0;
  let y = 0;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    fn(r, g, b, o, x, y);
    d[i] = r + (o[0] - r) * k;
    d[i + 1] = g + (o[1] - g) * k;
    d[i + 2] = b + (o[2] - b) * k;
    if (++x === w) {
      x = 0;
      y++;
    }
  }
}

/** Builds a colour grade: saturation, contrast, brightness, lift, warmth, tint and vignette. */
export function makeGrade({
  tint = [255, 255, 255], amount = 0, brightness = 1, contrast = 1,
  saturation = 1, lift = 0, warm = 0, vignette = 0,
} = {}) {
  return (img, k) => {
    const cx = img.width / 2;
    const cy = img.height / 2;
    const maxD = Math.hypot(cx, cy);
    perPixel(img, k, (r, g, b, o, x, y) => {
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      r = lum + (r - lum) * saturation;
      g = lum + (g - lum) * saturation;
      b = lum + (b - lum) * saturation;
      r = (r - 128) * contrast + 128;
      g = (g - 128) * contrast + 128;
      b = (b - 128) * contrast + 128;
      r = r * brightness + lift + warm;
      g = g * brightness + lift;
      b = b * brightness + lift - warm;
      r += (tint[0] - r) * amount;
      g += (tint[1] - g) * amount;
      b += (tint[2] - b) * amount;
      if (vignette) {
        const d = Math.hypot(x - cx, y - cy) / maxD;
        const v = 1 - vignette * d * d;
        r *= v;
        g *= v;
        b *= v;
      }
      o[0] = r;
      o[1] = g;
      o[2] = b;
    });
  };
}

export const cutePink = makeGrade({ tint: [255, 165, 205], amount: 0.24, brightness: 1.08, contrast: 0.92, saturation: 1.1, lift: 8 });
export const vintage = makeGrade({ tint: [255, 222, 175], amount: 0.2, contrast: 0.85, saturation: 0.72, lift: 18, warm: 12, vignette: 0.35 });
export const sunset = makeGrade({ tint: [255, 128, 105], amount: 0.3, brightness: 1.05, saturation: 1.2, warm: 20 });
export const oceanBlue = makeGrade({ tint: [60, 145, 235], amount: 0.3, brightness: 1.02, saturation: 1.1, warm: -16 });
export const lavenderDream = makeGrade({ tint: [200, 168, 255], amount: 0.32, brightness: 1.08, contrast: 0.9, saturation: 0.9, lift: 8 });
export const mintFresh = makeGrade({ tint: [165, 240, 208], amount: 0.3, brightness: 1.08, contrast: 0.92, lift: 6 });
export const goldenGlow = makeGrade({ tint: [255, 196, 80], amount: 0.24, brightness: 1.1, saturation: 1.15, warm: 22 });
export const pastel = makeGrade({ tint: [255, 205, 232], amount: 0.2, brightness: 1.08, contrast: 0.9, saturation: 0.95, lift: 10 });

export function sepia(img, k) {
  perPixel(img, k, (r, g, b, o) => {
    o[0] = 0.393 * r + 0.769 * g + 0.189 * b;
    o[1] = 0.349 * r + 0.686 * g + 0.168 * b;
    o[2] = 0.272 * r + 0.534 * g + 0.131 * b;
  });
}

export function blackAndWhite(img, k) {
  perPixel(img, k, (r, g, b, o) => {
    const l = (0.299 * r + 0.587 * g + 0.114 * b - 128) * 1.1 + 128;
    o[0] = o[1] = o[2] = l;
  });
}

const filmGrade = makeGrade({ tint: [255, 214, 160], amount: 0.16, contrast: 1.12, saturation: 0.82, lift: 6, warm: 10, vignette: 0.4 });
export function retroFilm(img, k) {
  filmGrade(img, k);
  perPixel(img, k, (r, g, b, o) => {
    const n = (Math.random() - 0.5) * 52;
    o[0] = r + n;
    o[1] = g + n;
    o[2] = b + n;
  });
}

export function neonGlow(img, k) {
  perPixel(img, k, (r, g, b, o) => {
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    r = lum + (r - lum) * 1.9;
    g = lum + (g - lum) * 1.9;
    b = lum + (b - lum) * 1.9;
    r = (r - 128) * 1.3 + 128;
    g = (g - 128) * 1.3 + 128;
    b = (b - 128) * 1.3 + 128;
    const shadow = 1 - lum / 255;
    const hi = (lum / 255) * (lum / 255);
    o[0] = r + shadow * 60 + hi * 10;
    o[1] = g - shadow * 20 + hi * 34;
    o[2] = b + shadow * 80 + hi * 20;
  });
}

/** Canvas stage that adds a bloom on top of the neon grade. */
export function neonBloom(ctx, w, h, k) {
  drawBlurred(ctx, w, h, { scale: 0.12, alpha: 0.6 * k, composite: 'lighter' });
}
