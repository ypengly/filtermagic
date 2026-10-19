// The registry of all 30 filters and the staged pipeline that applies them.
// Stages run in this order: pre (canvas) -> pixel (ImageData) -> post (canvas) -> overlay (face-anchored).
import * as color from './colorFilters.js';
import * as beauty from './beautyFilters.js';
import * as art from './artisticFilters.js';
import * as over from './overlayFilters.js';

export const CATEGORIES = [
  { id: 'beauty', label: 'Beauty', emoji: '💄' },
  { id: 'animals', label: 'Animals', emoji: '🐱' },
  { id: 'colors', label: 'Colors', emoji: '🎨' },
  { id: 'artistic', label: 'Artistic', emoji: '🖌️' },
  { id: 'cute', label: 'Cute', emoji: '💖' },
];

const softTint = (rgb, amount) => color.makeGrade({ tint: rgb, amount, brightness: 1.04 });

export const FILTERS = [
  { id: 'original', name: 'Original', category: 'beauty', emoji: '📷' },
  { id: 'cute-pink', name: 'Cute Pink', category: 'beauty', emoji: '🌸', pixel: color.cutePink },
  { id: 'soft-beauty', name: 'Soft Beauty', category: 'beauty', emoji: '✨', pixel: beauty.softBeautyPixel, post: beauty.softBeautyPost },
  { id: 'rosy-blush', name: 'Rosy Blush', category: 'beauty', emoji: '😊', needsFace: true, pixel: softTint([255, 190, 205], 0.1), overlay: over.blush },
  { id: 'cherry-lips', name: 'Cherry Lips', category: 'beauty', emoji: '💋', needsFace: true, pixel: softTint([255, 215, 220], 0.06), overlay: over.lips },

  { id: 'cat-face', name: 'Cat Face', category: 'animals', emoji: '🐱', needsFace: true, pixel: softTint([255, 225, 215], 0.1), overlay: over.catFace },
  { id: 'puppy', name: 'Puppy', category: 'animals', emoji: '🐶', needsFace: true, pixel: softTint([255, 215, 175], 0.1), overlay: over.puppy },
  { id: 'bunny', name: 'Bunny', category: 'animals', emoji: '🐰', needsFace: true, pixel: softTint([255, 205, 225], 0.1), overlay: over.bunny },
  { id: 'bear', name: 'Bear', category: 'animals', emoji: '🐻', needsFace: true, pixel: softTint([240, 205, 170], 0.1), overlay: over.bear },
  { id: 'angel', name: 'Angel', category: 'animals', emoji: '😇', needsFace: true, pixel: color.makeGrade({ tint: [255, 245, 210], amount: 0.14, brightness: 1.08, contrast: 0.94 }), post: beauty.dreamyPost, overlay: over.angel },

  { id: 'vintage', name: 'Vintage', category: 'colors', emoji: '📻', pixel: color.vintage },
  { id: 'retro-film', name: 'Retro Film', category: 'colors', emoji: '🎞️', pixel: color.retroFilm },
  { id: 'black-white', name: 'Black & White', category: 'colors', emoji: '⚫', pixel: color.blackAndWhite },
  { id: 'sepia', name: 'Sepia', category: 'colors', emoji: '🟤', pixel: color.sepia },
  { id: 'sunset', name: 'Sunset', category: 'colors', emoji: '🌅', pixel: color.sunset },
  { id: 'ocean-blue', name: 'Ocean Blue', category: 'colors', emoji: '🌊', pixel: color.oceanBlue },
  { id: 'lavender-dream', name: 'Lavender Dream', category: 'colors', emoji: '💜', pixel: color.lavenderDream },
  { id: 'mint-fresh', name: 'Mint Fresh', category: 'colors', emoji: '🍃', pixel: color.mintFresh },
  { id: 'golden-glow', name: 'Golden Glow', category: 'colors', emoji: '🌟', pixel: color.goldenGlow },
  { id: 'neon-glow', name: 'Neon Glow', category: 'colors', emoji: '🌈', pixel: color.neonGlow, post: color.neonBloom },

  { id: 'cartoon', name: 'Cartoon', category: 'artistic', emoji: '🎨', pre: art.softenPre, pixel: art.cartoon },
  { id: 'sketch', name: 'Sketch', category: 'artistic', emoji: '✏️', pre: art.softenPre, pixel: art.sketch },
  { id: 'dreamy', name: 'Dreamy', category: 'artistic', emoji: '☁️', pixel: beauty.dreamyPixel, post: beauty.dreamyPost },
  { id: 'glitch', name: 'Glitch', category: 'artistic', emoji: '👾', pixel: art.glitch },
  { id: 'pixel-art', name: 'Pixel Art', category: 'artistic', emoji: '🕹️', pre: art.pixelatePre, pixel: art.pixelPalette },

  { id: 'heart-eyes', name: 'Heart Eyes', category: 'cute', emoji: '😍', needsFace: true, pixel: softTint([255, 190, 210], 0.1), overlay: over.heartEyes },
  { id: 'starry-face', name: 'Starry Face', category: 'cute', emoji: '🤩', needsFace: true, pixel: softTint([255, 240, 190], 0.1), overlay: over.starryFace },
  { id: 'rainbow-magic', name: 'Rainbow Magic', category: 'cute', emoji: '🦄', needsFace: true, pixel: color.makeGrade({ saturation: 1.2, brightness: 1.04 }), post: beauty.rainbowWash, overlay: over.rainbowMagic },
  { id: 'kawaii-sparkles', name: 'Kawaii Sparkles', category: 'cute', emoji: '🎀', needsFace: true, pixel: color.pastel, overlay: over.kawaiiSparkles },
  { id: 'super-cute', name: 'Super Cute', category: 'cute', emoji: '💖', needsFace: true, pixel: color.pastel, post: beauty.softBeautyPost, overlay: over.superCute },
];

export const getFilter = (id) => FILTERS.find((f) => f.id === id) || FILTERS[0];

/** Filters matching a search string, optionally within a category or the favorites set. */
export function searchFilters(query = '', category = 'all', favorites = new Set()) {
  const q = query.trim().toLowerCase();
  return FILTERS.filter((f) => {
    if (category === 'favorites' && !favorites.has(f.id)) return false;
    if (category !== 'all' && category !== 'favorites' && f.category !== category) return false;
    return !q || f.name.toLowerCase().includes(q);
  });
}

/**
 * Applies a filter to whatever is currently drawn on ctx (a w x h canvas).
 * `geo` is face geometry (or null); `t` is time in seconds for animated effects.
 */
export function applyFilter(ctx, filter, w, h, intensity, t = 0, geo = null) {
  if (!filter || filter.id === 'original' || intensity <= 0) return;
  if (filter.pre) filter.pre(ctx, w, h, intensity, t);
  if (filter.pixel) {
    const img = ctx.getImageData(0, 0, w, h);
    filter.pixel(img, intensity, t);
    ctx.putImageData(img, 0, 0);
  }
  if (filter.post) filter.post(ctx, w, h, intensity, t);
  if (filter.overlay && geo) {
    ctx.save();
    filter.overlay(ctx, geo, intensity, t);
    ctx.restore();
  }
}
