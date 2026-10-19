// Photo helpers: countdown, raw frame grabbing, export and download.
import { createCanvas } from '../utils/canvasUtils.js';
import { renderFrame } from './frameRenderer.js';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Grabs the current (unfiltered, unmirrored) video frame at up to `maxSize` pixels. */
export function grabRawFrame(video, maxSize = 1920) {
  const c = createCanvas();
  renderFrame(c, video, video.videoWidth, video.videoHeight, { raw: true, maxSize });
  return c;
}

/** Renders the final, filtered image at export resolution. */
export function renderExport(source, sw, sh, opts) {
  const c = createCanvas();
  renderFrame(c, source, sw, sh, { ...opts, maxSize: 2048 });
  return c;
}

export function canvasToBlob(canvas, type = 'image/png', quality) {
  return new Promise((resolve, reject) => {
    if (canvas.toBlob) {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), type, quality);
    } else {
      fetch(canvas.toDataURL(type, quality)).then((r) => r.blob()).then(resolve, reject);
    }
  });
}

export function timestampName() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `filtermagic-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.png`;
}

export function downloadBlob(blob, name = timestampName()) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
