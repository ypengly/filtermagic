import { loadSettings, saveSetting } from '../utils/storage.js';

function apply(theme, button) {
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#1e1626' : '#fff1f8');
  if (button) {
    button.textContent = theme === 'dark' ? '☀️' : '🌙';
    button.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  }
}

export function initTheme(button) {
  const saved = loadSettings().theme;
  let theme = saved || (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  apply(theme, button);
  button.addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    apply(theme, button);
    saveSetting('theme', theme);
  });
}
