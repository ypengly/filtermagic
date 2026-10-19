// Filter carousel: category tabs, search, favorites and generated thumbnails.
import { CATEGORIES, FILTERS, applyFilter, searchFilters } from '../filters/filterRegistry.js';
import { createCanvas } from '../utils/canvasUtils.js';

const TABS = [
  { id: 'all', label: 'All', emoji: '🌷' },
  { id: 'favorites', label: 'Favorites', emoji: '⭐' },
  ...CATEGORIES,
];

/** Draws a small illustrated portrait so colour filters have something to act on. */
function sampleScene(size) {
  const c = createCanvas(size, size);
  const x = c.getContext('2d', { willReadFrequently: true });
  const sky = x.createLinearGradient(0, 0, size, size);
  sky.addColorStop(0, '#9fd8ff');
  sky.addColorStop(1, '#ffd6e8');
  x.fillStyle = sky;
  x.fillRect(0, 0, size, size);
  x.fillStyle = '#7a4a3a';
  x.beginPath(); x.arc(size / 2, size * 0.46, size * 0.3, Math.PI, 0); x.fill();
  x.fillRect(size * 0.2, size * 0.44, size * 0.6, size * 0.2);
  x.fillStyle = '#ffd9c2';
  x.beginPath(); x.arc(size / 2, size * 0.54, size * 0.25, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#3b2a2a';
  x.beginPath(); x.arc(size * 0.42, size * 0.52, size * 0.025, 0, Math.PI * 2); x.arc(size * 0.58, size * 0.52, size * 0.025, 0, Math.PI * 2); x.fill();
  x.strokeStyle = '#c85a6a'; x.lineWidth = size * 0.02; x.lineCap = 'round';
  x.beginPath(); x.arc(size / 2, size * 0.58, size * 0.07, 0.2, Math.PI - 0.2); x.stroke();
  x.fillStyle = '#6fbf73';
  x.fillRect(0, size * 0.86, size, size * 0.14);
  return c;
}

const thumbs = new Map();
function thumbFor(filter, size = 84) {
  if (!thumbs.has(filter.id)) {
    const c = sampleScene(size);
    applyFilter(c.getContext('2d', { willReadFrequently: true }), filter, size, size, 1, 0.8, null);
    thumbs.set(filter.id, c);
  }
  return thumbs.get(filter.id);
}

export class FilterGallery {
  constructor({ listEl, tabsEl, searchEl, emptyEl, onSelect }) {
    Object.assign(this, { listEl, tabsEl, searchEl, emptyEl, onSelect });
    this.category = 'all';
    this.activeId = 'original';
    this.favorites = new Set();
    this.tabsEl.innerHTML = '';
    TABS.forEach((t) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tab';
      b.dataset.cat = t.id;
      b.textContent = `${t.emoji} ${t.label}`;
      b.addEventListener('click', () => { this.category = t.id; this.render(); });
      this.tabsEl.appendChild(b);
    });
    this.searchEl.addEventListener('input', () => this.render());
    this.render();
  }

  setFavorites(set) { this.favorites = set; this.render(); }

  setActive(id) {
    this.activeId = id;
    this.listEl.querySelectorAll('.filter-card').forEach((el) => {
      const on = el.dataset.id === id;
      el.classList.toggle('active', on);
      el.setAttribute('aria-pressed', String(on));
      if (on) el.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    });
  }

  render() {
    this.tabsEl.querySelectorAll('.tab').forEach((b) => {
      const on = b.dataset.cat === this.category;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
    });
    const items = searchFilters(this.searchEl.value, this.category, this.favorites);
    this.listEl.innerHTML = '';
    this.emptyEl.hidden = items.length > 0;
    this.emptyEl.textContent = this.category === 'favorites' && !this.searchEl.value
      ? 'No favorites yet. Pick a filter and tap the heart to save it here.'
      : 'No filters match that search.';
    for (const f of items) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'filter-card';
      card.dataset.id = f.id;
      card.setAttribute('aria-label', f.name);
      const canvas = createCanvas(84, 84);
      canvas.getContext('2d').drawImage(thumbFor(f), 0, 0);
      const badge = document.createElement('span');
      badge.className = 'thumb-emoji';
      badge.textContent = f.emoji;
      const fav = document.createElement('span');
      fav.className = 'thumb-fav';
      fav.textContent = '💗';
      fav.hidden = !this.favorites.has(f.id);
      const thumb = document.createElement('span');
      thumb.className = 'thumb';
      thumb.append(canvas, badge, fav);
      const label = document.createElement('span');
      label.className = 'filter-name';
      label.textContent = f.name;
      card.append(thumb, label);
      card.addEventListener('click', () => this.onSelect(f.id));
      this.listEl.appendChild(card);
    }
    this.setActive(this.activeId);
  }
}

export const FILTER_COUNT = FILTERS.length;
