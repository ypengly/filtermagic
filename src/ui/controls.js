// Thin DOM layer: element lookups plus helpers for toasts, countdown, flash and the state panel.
const $ = (id) => document.getElementById(id);

export function getElements() {
  const ids = [
    'video', 'stage', 'viewCanvas', 'beforeCanvas', 'compareLine', 'compareBadges', 'compareSlider',
    'statePanel', 'stateIcon', 'stateTitle', 'stateText', 'stateAction', 'stateSpinner',
    'faceHint', 'countdown', 'flash', 'toast',
    'modeLive', 'modeEdit', 'themeToggle',
    'uploadBtn', 'fileInput', 'timerBtn', 'shutterBtn', 'switchBtn', 'mirrorBtn',
    'cameraToggle', 'compareBtn', 'favBtn', 'resetBtn', 'downloadBtn', 'retakeBtn',
    'intensity', 'intensityValue', 'activeName',
    'filterSearch', 'filterTabs', 'filterList', 'filterEmpty', 'scrollLeft', 'scrollRight',
    'galleryGrid', 'galleryEmpty', 'clearGallery',
  ];
  return Object.fromEntries(ids.map((id) => [id, $(id)]));
}

export class UI {
  constructor(el) {
    this.el = el;
    this._toastTimer = 0;
  }

  toast(msg, ms = 2600) {
    const t = this.el.toast;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }

  /** Shows the centered panel (loading, permission help, errors, empty edit mode). */
  showState({ icon = '📷', title, text = '', action = null, onAction = null, spinner = false }) {
    const e = this.el;
    e.stateIcon.textContent = icon;
    e.stateTitle.textContent = title;
    e.stateText.textContent = text;
    e.stateSpinner.hidden = !spinner;
    e.stateIcon.hidden = spinner;
    e.stateAction.hidden = !action;
    if (action) e.stateAction.textContent = action;
    e.stateAction.onclick = onAction;
    e.statePanel.hidden = false;
  }

  hideState() { this.el.statePanel.hidden = true; }

  setHint(text) {
    this.el.faceHint.hidden = !text;
    if (text) this.el.faceHint.textContent = text;
  }

  showCountdown(n) {
    const c = this.el.countdown;
    c.hidden = false;
    c.textContent = n;
    c.classList.remove('tick');
    void c.offsetWidth; // restart the animation
    c.classList.add('tick');
  }

  hideCountdown() { this.el.countdown.hidden = true; }

  flash() {
    const f = this.el.flash;
    f.classList.remove('go');
    void f.offsetWidth;
    f.classList.add('go');
  }

  setIntensity(v) {
    this.el.intensity.value = Math.round(v * 100);
    this.el.intensityValue.textContent = `${Math.round(v * 100)}%`;
    this.el.intensity.style.setProperty('--fill', `${Math.round(v * 100)}%`);
  }

  setMode(mode) {
    const live = mode === 'live';
    this.el.modeLive.setAttribute('aria-selected', String(live));
    this.el.modeEdit.setAttribute('aria-selected', String(!live));
    document.body.dataset.mode = mode;
  }
}
