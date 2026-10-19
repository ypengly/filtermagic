// Owns the MediaStream: permission, front/rear switching and releasing the hardware.
export class CameraError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code; // unsupported | insecure | denied | nocamera | busy | unknown
  }
}

function mapError(e) {
  const n = e && e.name;
  if (n === 'NotAllowedError' || n === 'SecurityError' || n === 'PermissionDeniedError') return new CameraError('denied');
  if (n === 'NotFoundError' || n === 'DevicesNotFoundError' || n === 'OverconstrainedError') return new CameraError('nocamera');
  if (n === 'NotReadableError' || n === 'TrackStartError' || n === 'AbortError') return new CameraError('busy');
  return new CameraError('unknown', e && e.message);
}

export class CameraController {
  constructor(video) {
    this.video = video;
    this.stream = null;
    this.facing = 'user';
    this._token = 0;
  }

  static isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  get active() {
    return !!this.stream && this.stream.getVideoTracks().some((t) => t.readyState === 'live');
  }

  get ready() {
    return this.active && this.video.readyState >= 2 && this.video.videoWidth > 0;
  }

  /** Starts (or restarts) the camera. Throws CameraError with a machine-readable code. */
  async start(facing = 'user') {
    if (!CameraController.isSupported()) throw new CameraError('unsupported');
    if (!window.isSecureContext) throw new CameraError('insecure');
    this.stop();
    const token = ++this._token;
    const attempts = [
      { video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
      { video: true, audio: false },
    ];
    let stream = null;
    let lastErr = null;
    for (const constraints of attempts) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        break;
      } catch (e) {
        lastErr = e;
        if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) break;
      }
    }
    if (!stream) throw mapError(lastErr);
    if (token !== this._token) { // a newer start/stop happened while waiting for permission
      stream.getTracks().forEach((t) => t.stop());
      throw new CameraError('unknown', 'cancelled');
    }
    this.stream = stream;
    const settings = stream.getVideoTracks()[0].getSettings ? stream.getVideoTracks()[0].getSettings() : {};
    this.facing = settings.facingMode || facing;
    this.video.srcObject = stream;
    this.video.muted = true;
    this.video.setAttribute('playsinline', '');
    try {
      await this.video.play();
    } catch (e) {
      this.stop();
      throw mapError(e);
    }
    if (!this.video.videoWidth) {
      await new Promise((res) => this.video.addEventListener('loadedmetadata', res, { once: true }));
    }
    stream.getVideoTracks()[0].addEventListener('ended', () => { if (this.stream === stream) this.stop(); });
  }

  /** Stops every track so the camera light turns off. */
  stop() {
    this._token++;
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
  }

  async switchFacing() {
    const next = this.facing === 'environment' ? 'user' : 'environment';
    await this.start(next);
    return this.facing;
  }

  /** True when the device exposes more than one camera (only reliable after permission). */
  async hasMultipleCameras() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((d) => d.kind === 'videoinput').length > 1;
    } catch {
      return false;
    }
  }
}
