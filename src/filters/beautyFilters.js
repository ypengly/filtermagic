// Beauty / softness filters: pixel grade stages plus blur-based canvas stages.
import { makeGrade } from './colorFilters.js';
import { drawBlurred } from '../utils/canvasUtils.js';

export const softBeautyPixel = makeGrade({ tint: [255, 226, 226], amount: 0.07, brightness: 1.06, contrast: 0.95, saturation: 1.04, lift: 4 });

/** Skin-smoothing style softening: blend a blurred copy over the sharp frame. */
export function softBeautyPost(ctx, w, h, k) {
  drawBlurred(ctx, w, h, { scale: 0.4, alpha: 0.55 * k });
}

export const dreamyPixel = makeGrade({ tint: [255, 214, 245], amount: 0.2, brightness: 1.08, contrast: 0.88, saturation: 0.95, lift: 10 });

export function dreamyPost(ctx, w, h, k) {
  drawBlurred(ctx, w, h, { scale: 0.3, alpha: 0.35 * k });
  drawBlurred(ctx, w, h, { scale: 0.14, alpha: 0.5 * k, composite: 'screen' });
}

/** Soft rainbow wash across the frame. */
export function rainbowWash(ctx, w, h, k) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  ['#ff6b9a', '#ffb36b', '#fff17a', '#8eeea0', '#7ad7ff', '#b79cff'].forEach((c, i, a) => g.addColorStop(i / (a.length - 1), c));
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.45 * k;
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  drawBlurred(ctx, w, h, { scale: 0.15, alpha: 0.3 * k, composite: 'screen' });
}
