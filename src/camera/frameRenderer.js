// Draws a source (video, image, canvas) onto a target canvas and applies the active filter.
// The same function renders the live preview and the full-resolution export, so what you see is what you save.
import { applyFilter } from '../filters/filterRegistry.js';
import { buildGeometry } from '../face/faceTracker.js';
import { fitSize } from '../utils/canvasUtils.js';

const contexts = new WeakMap();
function getCtx(canvas) {
  let ctx = contexts.get(canvas);
  if (!ctx) {
    ctx = canvas.getContext('2d', { willReadFrequently: true });
    contexts.set(canvas, ctx);
  }
  return ctx;
}

/**
 * @returns the face geometry used (or null).
 * opts: { filter, intensity, mirror, t, landmarks, maxSize, raw }
 */
export function renderFrame(canvas, source, sw, sh, opts) {
  const { filter, intensity = 1, mirror = false, t = 0, landmarks = null, maxSize = 720, raw = false } = opts;
  const { w, h } = fitSize(sw, sh, maxSize);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = getCtx(canvas);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  if (mirror) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, 0, 0, w, h);
  ctx.restore();
  if (raw) return null;
  const geo = landmarks ? buildGeometry(landmarks, w, h, mirror) : null;
  applyFilter(ctx, filter, w, h, intensity, t, geo);
  return geo;
}
