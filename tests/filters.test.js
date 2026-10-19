import test from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, FILTERS, applyFilter, getFilter, searchFilters } from '../src/filters/filterRegistry.js';
import { buildGeometry } from '../src/face/faceTracker.js';

const EXPECTED = [
  'Original', 'Cute Pink', 'Soft Beauty', 'Rosy Blush', 'Cherry Lips',
  'Cat Face', 'Puppy', 'Bunny', 'Bear', 'Angel',
  'Vintage', 'Retro Film', 'Black & White', 'Sepia', 'Sunset', 'Ocean Blue', 'Lavender Dream', 'Mint Fresh', 'Golden Glow', 'Neon Glow',
  'Cartoon', 'Sketch', 'Dreamy', 'Glitch', 'Pixel Art',
  'Heart Eyes', 'Starry Face', 'Rainbow Magic', 'Kawaii Sparkles', 'Super Cute',
];

function makeImage(w = 96, h = 64) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      data[i] = (x * 37 + y * 11) % 256;
      data[i + 1] = (x * 13 + y * 29) % 256;
      data[i + 2] = (x * 7 + y * 3 + (x > w / 2 ? 90 : 0)) % 256;
      data[i + 3] = 255;
    }
  }
  return { width: w, height: h, data };
}

const meanDiff = (a, b) => {
  let s = 0;
  for (let i = 0; i < a.length; i += 4) s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
  return s / (a.length / 4);
};

function faceLandmarks() {
  const lm = Array.from({ length: 478 }, (_, i) => ({ x: 0.4 + ((i * 17) % 100) / 500, y: 0.35 + ((i * 31) % 100) / 400, z: 0 }));
  const set = (i, x, y) => { lm[i] = { x, y, z: 0 }; };
  set(10, 0.5, 0.2); set(152, 0.5, 0.8); set(234, 0.3, 0.5); set(454, 0.7, 0.5);
  set(33, 0.38, 0.4); set(133, 0.46, 0.4); set(263, 0.62, 0.4); set(362, 0.54, 0.4);
  set(205, 0.36, 0.58); set(425, 0.64, 0.58); set(1, 0.5, 0.55); set(13, 0.5, 0.7); set(14, 0.5, 0.73); set(17, 0.5, 0.76);
  return lm;
}

/** A canvas-context stand-in that accepts any call and counts drawing operations. */
function mockCtx() {
  const state = { draws: 0 };
  const handler = {
    get(t, k) {
      if (k in t) return t[k];
      return (...args) => {
        if (['fill', 'stroke', 'fillRect', 'drawImage'].includes(k)) state.draws++;
        return new Proxy({}, handler);
      };
    },
    set(t, k, v) { t[k] = v; return true; },
  };
  return { ctx: new Proxy({}, handler), state };
}

test('registry has exactly the 30 requested filters in order', () => {
  assert.equal(FILTERS.length, 30);
  assert.deepEqual(FILTERS.map((f) => f.name), EXPECTED);
});

test('filter ids are unique and categories are valid', () => {
  const ids = new Set(FILTERS.map((f) => f.id));
  assert.equal(ids.size, 30);
  const cats = new Set(CATEGORIES.map((c) => c.id));
  for (const f of FILTERS) assert.ok(cats.has(f.category), `${f.id} has bad category`);
});

test('every non-original filter has at least one visible stage', () => {
  for (const f of FILTERS.filter((x) => x.id !== 'original')) {
    assert.ok(f.pre || f.pixel || f.post || f.overlay, `${f.id} does nothing`);
  }
});

test('every face filter has a face overlay, every overlay filter needs a face', () => {
  for (const f of FILTERS) assert.equal(!!f.overlay, !!f.needsFace, f.id);
});

test('pixel filters change the image at full intensity and not at zero', () => {
  for (const f of FILTERS.filter((x) => x.pixel)) {
    const base = makeImage();
    const full = makeImage();
    f.pixel(full, 1, 0.5);
    assert.ok(meanDiff(base.data, full.data) > 1, `${f.id} has no visible effect`);
    const none = makeImage();
    f.pixel(none, 0, 0.5);
    assert.equal(meanDiff(base.data, none.data), 0, `${f.id} changes pixels at 0%`);
  }
});

test('pixel filter strength grows with intensity', () => {
  for (const f of FILTERS.filter((x) => x.pixel)) {
    const base = makeImage(160, 120);
    const half = makeImage(160, 120);
    const full = makeImage(160, 120);
    f.pixel(half, 0.5, 0.5);
    f.pixel(full, 1, 0.5);
    assert.ok(meanDiff(base.data, half.data) < meanDiff(base.data, full.data), `${f.id} is not monotonic`);
  }
});

test('search and category helpers', () => {
  assert.equal(searchFilters('cat').map((f) => f.id)[0], 'cat-face');
  assert.equal(searchFilters('', 'colors').length, 10);
  assert.equal(searchFilters('', 'artistic').length, 5);
  assert.equal(searchFilters('', 'favorites', new Set(['sepia'])).length, 1);
  assert.equal(searchFilters('zzzz').length, 0);
  assert.equal(getFilter('nope').id, 'original');
});

test('face geometry flips x when mirrored and has sane sizes', () => {
  const lm = faceLandmarks();
  const a = buildGeometry(lm, 200, 100, false);
  const b = buildGeometry(lm, 200, 100, true);
  assert.ok(a.faceW > 0 && a.faceH > 0);
  assert.ok(Math.abs(a.nose.x + b.nose.x - 200) < 1e-9);
  assert.ok(a.eyeL.x < a.eyeR.x && b.eyeL.x < b.eyeR.x);
  assert.equal(buildGeometry(null, 10, 10, false), null);
});

test('every face overlay draws something when a face is present, and nothing without one', () => {
  const geo = buildGeometry(faceLandmarks(), 640, 480, true);
  for (const f of FILTERS.filter((x) => x.overlay)) {
    const { ctx, state } = mockCtx();
    f.overlay(ctx, geo, 1, 1.2);
    assert.ok(state.draws > 0, `${f.id} drew nothing`);
    const empty = mockCtx();
    applyFilter(empty.ctx, { ...f, pre: null, pixel: null, post: null }, 640, 480, 1, 0, null);
    assert.equal(empty.state.draws, 0, `${f.id} draws static decorations without face tracking`);
  }
});
