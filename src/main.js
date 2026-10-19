// FilterMagic - application entry. Wires camera, filters, face tracking and the UI together.
import { CameraController } from './camera/cameraController.js';
import { renderFrame } from './camera/frameRenderer.js';
import { canvasToBlob, downloadBlob, grabRawFrame, renderExport, sleep } from './camera/photoCapture.js';
import { FaceTracker } from './face/faceTracker.js';
import { getFilter } from './filters/filterRegistry.js';
import { FilterGallery } from './ui/filterGallery.js';
import { UI, getElements } from './ui/controls.js';
import { initTheme } from './ui/theme.js';
import { clamp, createCanvas, fitSize } from './utils/canvasUtils.js';
import { loadSettings, saveSetting } from './utils/storage.js';

const el = getElements();
const ui = new UI(el);
const settings = loadSettings();
const camera = new CameraController(el.video);
const tracker = new FaceTracker();
const TIMERS = [0, 3, 5, 10];
const PREVIEW_MAX = window.matchMedia && matchMedia('(pointer: coarse)').matches ? 560 : 720;
const EDIT_MAX = 1000;

const state = {
  mode: 'live', // live | edit
  filterId: getFilter(settings.filterId).id,
  intensity: clamp(Number(settings.intensity) || 0, 0, 1),
  mirror: !!settings.mirror,
  userMirror: !!settings.mirror,
  timer: TIMERS.includes(settings.timer) ? settings.timer : 0,
  facing: settings.facing === 'environment' ? 'environment' : 'user',
  cameraState: 'off', // off | starting | on | error
  compare: false,
  counting: false,
  edit: null, // { source, w, h, landmarks, fromCapture, savedKey }
  favorites: new Set(Array.isArray(settings.favorites) ? settings.favorites : []),
  lastLandmarks: null,
  dirty: true,
  lastEditDraw: 0,
  hasStarted: false,
};

const markDirty = () => { state.dirty = true; };
const currentFilter = () => getFilter(state.filterId);

/* ---------- filter selection, favorites, intensity ---------- */
const gallery = new FilterGallery({
  listEl: el.filterList,
  tabsEl: el.filterTabs,
  searchEl: el.filterSearch,
  emptyEl: el.filterEmpty,
  onSelect: (id) => selectFilter(id),
});

function selectFilter(id) {
  state.filterId = getFilter(id).id;
  saveSetting('filterId', state.filterId);
  gallery.setActive(state.filterId);
  const f = currentFilter();
  el.activeName.textContent = `${f.emoji} ${f.name}`;
  updateFavButton();
  maybeInitTracker();
  ensureEditLandmarks();
  markDirty();
}

function updateFavButton() {
  const on = state.favorites.has(state.filterId);
  el.favBtn.setAttribute('aria-pressed', String(on));
  el.favBtn.querySelector('.label').textContent = on ? 'Saved' : 'Save';
  el.favBtn.querySelector('.ico').textContent = on ? '💗' : '🤍';
}

function toggleFavorite() {
  const f = currentFilter();
  const adding = !state.favorites.has(f.id);
  if (adding) state.favorites.add(f.id);
  else state.favorites.delete(f.id);
  saveSetting('favorites', [...state.favorites]);
  gallery.setFavorites(new Set(state.favorites));
  updateFavButton();
  el.favBtn.classList.remove('pop');
  void el.favBtn.offsetWidth;
  el.favBtn.classList.add('pop');
  ui.toast(adding ? `${f.name} added to favorites 💗` : `${f.name} removed from favorites`);
}

function setIntensity(v) {
  state.intensity = clamp(v, 0, 1);
  ui.setIntensity(state.intensity);
  saveSetting('intensity', state.intensity);
  markDirty();
}

function resetFilter() {
  state.compare = false;
  applyCompare();
  selectFilter('original');
  setIntensity(1);
  ui.toast('Filter reset ✨');
}

/* ---------- face tracking ---------- */
function maybeInitTracker() {
  if (!currentFilter().needsFace || tracker.status !== 'idle') return;
  if (state.cameraState !== 'on' && !state.edit) return;
  tracker.init().then(() => ensureEditLandmarks());
}

async function ensureEditLandmarks() {
  const e = state.edit;
  if (!e || !currentFilter().needsFace || e.landmarks !== undefined || e.detecting) return;
  e.detecting = true;
  await tracker.init();
  if (tracker.status === 'ready') {
    const lm = await tracker.detectImage(e.source);
    if (state.edit === e) e.landmarks = lm;
  } else if (state.edit === e) {
    e.landmarks = null;
  }
  e.detecting = false;
  markDirty();
}

let hintText = null;
function setHint(text) {
  if (text !== hintText) { hintText = text; ui.setHint(text); }
}

function computeHint(filter, geo) {
  if (!filter.needsFace || geo) return '';
  if (tracker.status === 'unavailable') return 'Face tracking is not available here, so only the color effects are shown.';
  if (tracker.status !== 'ready') return 'Loading face tracking…';
  if (state.mode === 'live') return 'Looking for your face… try facing the light.';
  return state.edit && state.edit.landmarks === undefined ? 'Finding the face…' : 'No face found in this photo.';
}

/* ---------- camera lifecycle ---------- */
const CAMERA_ERRORS = {
  unsupported: { icon: '🙈', title: 'This browser can’t open a camera', text: 'Try a recent Chrome, Edge, Firefox or Safari. You can still decorate a photo from your device.', action: 'Choose a photo' },
  insecure: { icon: '🔒', title: 'Camera needs a secure page', text: 'Browsers only allow camera access on https:// pages or on localhost. Open FilterMagic over HTTPS (see the README), then try again.', action: null },
  denied: { icon: '🚫', title: 'Camera access is blocked', text: 'Click the camera or lock icon in the address bar and choose Allow. On iPhone or iPad: Settings > Safari > Camera. Then press Try again.', action: 'Try again' },
  nocamera: { icon: '🔍', title: 'No camera found', text: 'Connect or enable a camera and try again, or choose a photo from your device.', action: 'Try again' },
  busy: { icon: '📵', title: 'Camera is busy', text: 'Another app or tab may be using it. Close it and press Try again.', action: 'Try again' },
};

function showCameraError(e) {
  const info = CAMERA_ERRORS[e.code] || { icon: '😿', title: 'Couldn’t start the camera', text: e.message || 'Something went wrong.', action: 'Try again' };
  const pickPhoto = e.code === 'unsupported';
  ui.showState({ ...info, onAction: info.action ? (pickPhoto ? () => el.fileInput.click() : startCamera) : null });
}

async function startCamera() {
  if (state.cameraState === 'starting') return;
  state.cameraState = 'starting';
  ui.showState({ spinner: true, title: 'Starting your camera…', text: 'Allow camera access if your browser asks. Your video stays on this device.' });
  updateCameraUI();
  try {
    await camera.start(state.facing);
    state.facing = camera.facing === 'environment' ? 'environment' : 'user';
    state.mirror = state.facing === 'user' ? state.userMirror : false;
    state.cameraState = 'on';
    state.hasStarted = true;
    tracker.reset();
    updateCameraUI();
    refreshPanels();
    markDirty();
    maybeInitTracker();
    camera.hasMultipleCameras().then((multi) => { el.switchBtn.hidden = !multi; });
  } catch (e) {
    if (e.message === 'cancelled') return;
    state.cameraState = 'error';
    updateCameraUI();
    showCameraError(e);
  }
}

function stopCamera() {
  camera.stop();
  tracker.reset();
  state.cameraState = 'off';
  state.lastLandmarks = null;
  cancelCountdown();
  updateCameraUI();
  refreshPanels();
}

function updateCameraUI() {
  const on = state.cameraState === 'on';
  el.cameraToggle.setAttribute('aria-pressed', String(on));
  el.cameraToggle.querySelector('.ico').textContent = on ? '📹' : '📷';
  el.cameraToggle.querySelector('.label').textContent = state.cameraState === 'starting' ? 'Starting…' : on ? 'Camera on' : 'Camera off';
  el.mirrorBtn.setAttribute('aria-pressed', String(state.mirror));
}

/** Chooses which centered panel (if any) belongs on the stage right now. */
function refreshPanels() {
  if (state.mode === 'edit') {
    if (state.edit) return ui.hideState();
    return ui.showState({ icon: '🖼️', title: 'Pick a photo to decorate', text: 'Choose an image from your device. It never leaves your browser.', action: 'Choose a photo', onAction: () => el.fileInput.click() });
  }
  if (state.cameraState === 'on') return ui.hideState();
  if (state.cameraState === 'starting' || state.cameraState === 'error') return undefined;
  return ui.showState({
    icon: '🌸',
    title: state.hasStarted ? 'Camera is off' : 'Ready for your close-up?',
    text: 'FilterMagic uses your camera right in your browser. Nothing is uploaded or sent to a server.',
    action: 'Start camera',
    onAction: startCamera,
  });
}

async function switchCamera() {
  if (state.cameraState !== 'on') return;
  el.switchBtn.disabled = true;
  try {
    state.facing = await camera.switchFacing();
    state.facing = state.facing === 'environment' ? 'environment' : 'user';
    state.mirror = state.facing === 'user' ? state.userMirror : false;
    saveSetting('facing', state.facing);
    tracker.reset();
    updateCameraUI();
    markDirty();
  } catch (e) {
    if (e.message !== 'cancelled') ui.toast('Couldn’t switch cameras on this device');
    if (!camera.active) { state.cameraState = 'off'; updateCameraUI(); await startCamera(); }
  } finally {
    el.switchBtn.disabled = false;
  }
}

/* ---------- modes ---------- */
function setMode(mode) {
  cancelCountdown();
  state.mode = mode;
  ui.setMode(mode);
  applyCompare();
  refreshPanels();
  setHint('');
  hintText = null;
  markDirty();
  if (mode === 'edit') { maybeInitTracker(); ensureEditLandmarks(); }
}

/* ---------- compare (before / after) ---------- */
function applyCompare() {
  const on = state.compare;
  el.beforeCanvas.hidden = !on;
  el.compareLine.hidden = !on;
  el.compareBadges.hidden = !on;
  el.compareSlider.hidden = !on;
  el.compareBtn.setAttribute('aria-pressed', String(on));
  const v = Number(el.compareSlider.value);
  el.beforeCanvas.style.clipPath = `inset(0 ${100 - v}% 0 0)`;
  el.compareLine.style.left = `${v}%`;
  markDirty();
}

/* ---------- render loop ---------- */
let stageW = 0;
let stageH = 0;
function syncStage() {
  const c = el.viewCanvas;
  if (c.width !== stageW || c.height !== stageH) {
    stageW = c.width;
    stageH = c.height;
    el.stage.style.setProperty('--ar', (stageW / stageH).toFixed(4));
  }
}

function liveFrame(t, now) {
  if (state.cameraState === 'on' && !camera.active) { // permission revoked / device unplugged / tab suspended
    stopCamera();
    ui.toast('The camera stopped. Press Start camera to continue.');
    return;
  }
  if (!camera.ready) return;
  const v = el.video;
  const f = currentFilter();
  let lm = null;
  if (f.needsFace && tracker.status === 'ready') lm = tracker.detect(v, now);
  state.lastLandmarks = lm;
  const geo = renderFrame(el.viewCanvas, v, v.videoWidth, v.videoHeight, {
    filter: f, intensity: state.intensity, mirror: state.mirror, t, landmarks: lm, maxSize: PREVIEW_MAX,
  });
  if (state.compare) renderFrame(el.beforeCanvas, v, v.videoWidth, v.videoHeight, { raw: true, mirror: state.mirror, maxSize: PREVIEW_MAX });
  syncStage();
  setHint(computeHint(f, geo));
}

function editFrame(t, now) {
  const e = state.edit;
  if (!e) return;
  const f = currentFilter();
  const animated = !!f.overlay || f.id === 'glitch';
  if (!state.dirty && !(animated && now - state.lastEditDraw > 50)) return;
  state.dirty = false;
  state.lastEditDraw = now;
  const geo = renderFrame(el.viewCanvas, e.source, e.w, e.h, {
    filter: f, intensity: state.intensity, mirror: state.mirror, t, landmarks: f.needsFace ? e.landmarks : null, maxSize: EDIT_MAX,
  });
  if (state.compare) renderFrame(el.beforeCanvas, e.source, e.w, e.h, { raw: true, mirror: state.mirror, maxSize: EDIT_MAX });
  syncStage();
  setHint(computeHint(f, geo));
}

function loop(now) {
  requestAnimationFrame(loop);
  const t = now / 1000;
  if (state.mode === 'live') liveFrame(t, now);
  else editFrame(t, now);
}

/* ---------- photo capture, countdown, export ---------- */
let countToken = 0;
function cancelCountdown() {
  countToken++;
  state.counting = false;
  ui.hideCountdown();
  el.shutterBtn.classList.remove('counting');
}

async function runCountdown(seconds) {
  const mine = ++countToken;
  state.counting = true;
  el.shutterBtn.classList.add('counting');
  for (let s = seconds; s > 0; s--) {
    ui.showCountdown(s);
    await sleep(1000);
    if (mine !== countToken) return false;
  }
  cancelCountdown();
  return true;
}

function exportOptions() {
  const f = currentFilter();
  const e = state.edit;
  return { filter: f, intensity: state.intensity, mirror: state.mirror, t: performance.now() / 1000, landmarks: f.needsFace ? e.landmarks : null };
}

const editKey = () => `${state.filterId}|${state.intensity}|${state.mirror}`;

async function renderCurrentToBlob() {
  const e = state.edit;
  await ensureEditLandmarks();
  const out = renderExport(e.source, e.w, e.h, exportOptions());
  return canvasToBlob(out, 'image/png');
}

async function takePhoto() {
  if (state.counting) { cancelCountdown(); ui.toast('Countdown cancelled'); return; }
  if (state.mode !== 'live' || !camera.ready) { ui.toast('Turn the camera on first 📷'); return; }
  if (state.timer > 0 && !(await runCountdown(state.timer))) return;
  if (!camera.ready) return;
  ui.flash();
  const raw = grabRawFrame(el.video);
  const lm = state.lastLandmarks ? state.lastLandmarks.map((l) => ({ x: l.x, y: l.y, z: l.z })) : undefined;
  state.edit = { source: raw, w: raw.width, h: raw.height, landmarks: lm, fromCapture: true, savedKey: null };
  await sleep(160);
  setMode('edit');
  try {
    const blob = await renderCurrentToBlob();
    state.edit.savedKey = editKey();
    addPhoto(blob);
    ui.toast('Saved to your gallery 💖');
  } catch {
    ui.toast('Photo taken, but it couldn’t be saved to the gallery');
  }
}

async function downloadCurrent() {
  if (!state.edit) { ui.toast('Take or upload a photo first'); return; }
  try {
    const blob = await renderCurrentToBlob();
    downloadBlob(blob);
    if (state.edit.savedKey !== editKey()) { addPhoto(blob); state.edit.savedKey = editKey(); }
    ui.toast('Photo downloaded 💾');
  } catch {
    ui.toast('Couldn’t export this photo');
  }
}

/* ---------- uploads ---------- */
async function loadImageFile(file) {
  if (!file || !file.type.startsWith('image/')) { ui.toast('Please choose an image file'); return; }
  ui.showState({ spinner: true, title: 'Opening your photo…' });
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const { w, h } = fitSize(img.naturalWidth, img.naturalHeight, 2048);
    const c = createCanvas(w, h);
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    if (state.cameraState === 'on') stopCamera();
    state.mirror = false;
    state.edit = { source: c, w, h, landmarks: undefined, fromCapture: false, savedKey: null };
    updateCameraUI();
    setMode('edit');
  } catch {
    refreshPanels();
    ui.toast('That image couldn’t be opened. Try a JPG or PNG.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* ---------- photo gallery ---------- */
const photos = [];
function iconButton(emoji, label, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = emoji;
  b.setAttribute('aria-label', label);
  b.addEventListener('click', onClick);
  return b;
}

function addPhoto(blob) {
  photos.unshift({ blob, url: URL.createObjectURL(blob) });
  while (photos.length > 24) URL.revokeObjectURL(photos.pop().url);
  renderPhotos();
}

function renderPhotos() {
  el.galleryGrid.innerHTML = '';
  el.galleryEmpty.hidden = photos.length > 0;
  el.clearGallery.hidden = photos.length === 0;
  for (const p of photos) {
    const fig = document.createElement('figure');
    fig.className = 'photo';
    const img = new Image();
    img.src = p.url;
    img.alt = 'Captured photo';
    const bar = document.createElement('div');
    bar.className = 'photo-actions';
    bar.append(
      iconButton('⬇️', 'Download photo', () => downloadBlob(p.blob)),
      iconButton('🗑️', 'Delete photo', () => { photos.splice(photos.indexOf(p), 1); URL.revokeObjectURL(p.url); renderPhotos(); }),
    );
    fig.append(img, bar);
    el.galleryGrid.append(fig);
  }
}

/* ---------- events ---------- */
function bindEvents() {
  el.cameraToggle.addEventListener('click', () => {
    if (state.cameraState === 'on') { stopCamera(); } else { setMode('live'); startCamera(); }
  });
  el.switchBtn.addEventListener('click', switchCamera);
  el.shutterBtn.addEventListener('click', takePhoto);
  el.timerBtn.addEventListener('click', () => {
    state.timer = TIMERS[(TIMERS.indexOf(state.timer) + 1) % TIMERS.length];
    saveSetting('timer', state.timer);
    updateTimerButton();
  });
  el.mirrorBtn.addEventListener('click', () => {
    state.mirror = !state.mirror;
    if (state.facing === 'user' && state.mode === 'live') { state.userMirror = state.mirror; saveSetting('mirror', state.mirror); }
    updateCameraUI();
    markDirty();
  });
  el.intensity.addEventListener('input', () => setIntensity(Number(el.intensity.value) / 100));
  el.resetBtn.addEventListener('click', resetFilter);
  el.favBtn.addEventListener('click', toggleFavorite);
  el.compareBtn.addEventListener('click', () => { state.compare = !state.compare; applyCompare(); });
  el.compareSlider.addEventListener('input', applyCompare);
  el.downloadBtn.addEventListener('click', downloadCurrent);
  el.retakeBtn.addEventListener('click', () => { state.edit = null; setMode('live'); });
  el.modeLive.addEventListener('click', () => setMode('live'));
  el.modeEdit.addEventListener('click', () => setMode('edit'));
  el.uploadBtn.addEventListener('click', () => el.fileInput.click());
  el.fileInput.addEventListener('change', () => {
    const file = el.fileInput.files && el.fileInput.files[0];
    el.fileInput.value = '';
    loadImageFile(file);
  });
  el.stage.addEventListener('dragover', (e) => e.preventDefault());
  el.stage.addEventListener('drop', (e) => {
    e.preventDefault();
    loadImageFile(e.dataTransfer && e.dataTransfer.files[0]);
  });
  el.clearGallery.addEventListener('click', () => { photos.forEach((p) => URL.revokeObjectURL(p.url)); photos.length = 0; renderPhotos(); });
  el.scrollLeft.addEventListener('click', () => el.filterList.scrollBy({ left: -260, behavior: 'smooth' }));
  el.scrollRight.addEventListener('click', () => el.filterList.scrollBy({ left: 260, behavior: 'smooth' }));
  window.addEventListener('pagehide', () => camera.stop());
  window.addEventListener('beforeunload', () => camera.stop());
}

function updateTimerButton() {
  el.timerBtn.querySelector('.label').textContent = state.timer ? `${state.timer}s` : 'Off';
  el.timerBtn.setAttribute('aria-label', state.timer ? `Timer ${state.timer} seconds` : 'Timer off');
  el.timerBtn.setAttribute('aria-pressed', String(state.timer > 0));
}

/* ---------- boot ---------- */
initTheme(el.themeToggle);
gallery.setFavorites(new Set(state.favorites));
ui.setIntensity(state.intensity);
ui.setMode('live');
updateTimerButton();
updateCameraUI();
renderPhotos();
bindEvents();
selectFilter(state.filterId);
refreshPanels();
requestAnimationFrame(loop);
