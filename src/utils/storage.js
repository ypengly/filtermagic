// Tiny LocalStorage wrapper. Everything stays in the browser; failures are silent.
const KEY = 'filtermagic:v1';

const DEFAULTS = {
  favorites: [],
  theme: null,
  mirror: true,
  timer: 0,
  intensity: 1,
  filterId: 'original',
  facing: 'user',
};

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

function write(obj) {
  try {
    localStorage.setItem(KEY, JSON.stringify(obj));
    return true;
  } catch {
    return false;
  }
}

export function loadSettings() {
  return { ...DEFAULTS, ...read() };
}

export function saveSetting(key, value) {
  const all = read();
  all[key] = value;
  return write(all);
}
