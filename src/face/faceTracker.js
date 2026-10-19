// Face tracking with MediaPipe Face Landmarker (loaded lazily from a CDN).
// Camera frames are processed locally in the browser by WebAssembly; nothing is uploaded.
// To self-host, download the files below and point these constants at your own paths.
export const FACE_CONFIG = {
  bundleUrl: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs',
  wasmUrl: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm',
  modelUrl: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  timeoutMs: 25000,
};

export class FaceTracker {
  constructor() {
    this.status = 'idle'; // idle | loading | ready | unavailable
    this.landmarker = null;
    this.last = null;
    this.misses = 0;
    this.lastVideoTime = -1;
    this.imageBusy = false;
    this._loading = null;
  }

  /** Loads the model once. Resolves with the final status; never throws. */
  init() {
    if (this._loading) return this._loading;
    this.status = 'loading';
    const load = async () => {
      const mod = await import(/* @vite-ignore */ FACE_CONFIG.bundleUrl);
      const fileset = await mod.FilesetResolver.forVisionTasks(FACE_CONFIG.wasmUrl);
      const make = (delegate) => mod.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: FACE_CONFIG.modelUrl, delegate },
        runningMode: 'VIDEO',
        numFaces: 1,
      });
      try {
        this.landmarker = await make('GPU');
      } catch {
        this.landmarker = await make('CPU');
      }
    };
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), FACE_CONFIG.timeoutMs));
    this._loading = Promise.race([load(), timeout])
      .then(() => { this.status = 'ready'; return this.status; })
      .catch(() => { this.status = 'unavailable'; return this.status; });
    return this._loading;
  }

  reset() {
    this.last = null;
    this.misses = 0;
    this.lastVideoTime = -1;
  }

  /** Per-frame detection on a playing video. Returns smoothed landmarks or null. */
  detect(video, nowMs) {
    if (this.status !== 'ready' || this.imageBusy || video.readyState < 2) return this.last;
    if (video.currentTime === this.lastVideoTime) return this.last;
    this.lastVideoTime = video.currentTime;
    let res;
    try {
      res = this.landmarker.detectForVideo(video, nowMs);
    } catch {
      return this.last;
    }
    const f = res.faceLandmarks && res.faceLandmarks[0];
    if (!f) {
      if (++this.misses > 8) this.last = null;
      return this.last;
    }
    this.misses = 0;
    if (!this.last) {
      this.last = f.map((l) => ({ x: l.x, y: l.y, z: l.z }));
    } else {
      const a = 0.6;
      for (let i = 0; i < f.length; i++) {
        const p = this.last[i];
        p.x += (f[i].x - p.x) * a;
        p.y += (f[i].y - p.y) * a;
        p.z += (f[i].z - p.z) * a;
      }
    }
    return this.last;
  }

  /** One-off detection on a still image/canvas (used for uploads and captured photos). */
  async detectImage(source) {
    if (this.status !== 'ready') return null;
    this.imageBusy = true;
    try {
      await this.landmarker.setOptions({ runningMode: 'IMAGE' });
      const res = this.landmarker.detect(source);
      const f = res.faceLandmarks && res.faceLandmarks[0];
      return f ? f.map((l) => ({ x: l.x, y: l.y, z: l.z })) : null;
    } catch {
      return null;
    } finally {
      try { await this.landmarker.setOptions({ runningMode: 'VIDEO' }); } catch { /* ignore */ }
      this.lastVideoTime = -1;
      this.imageBusy = false;
    }
  }
}

/**
 * Converts normalised landmarks into pixel-space geometry for a w x h canvas.
 * When `mirror` is true the x axis is flipped to match a mirrored selfie preview.
 */
export function buildGeometry(lm, w, h, mirror) {
  if (!lm) return null;
  const p = (i) => ({ x: (mirror ? 1 - lm[i].x : lm[i].x) * w, y: lm[i].y * h });
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  let e1 = mid(p(33), p(133));
  let e2 = mid(p(263), p(362));
  if (e1.x > e2.x) [e1, e2] = [e2, e1];
  let c1 = p(205);
  let c2 = p(425);
  if (c1.x > c2.x) [c1, c2] = [c2, c1];
  const top = p(10);
  const chin = p(152);
  const faceH = dist(top, chin);
  return {
    p,
    w,
    h,
    eyeL: e1,
    eyeR: e2,
    cheekL: c1,
    cheekR: c2,
    top,
    chin,
    nose: p(1),
    faceW: dist(p(234), p(454)),
    faceH,
    roll: Math.atan2(e2.y - e1.y, e2.x - e1.x),
    mouthOpen: faceH ? dist(p(13), p(14)) / faceH : 0,
  };
}
