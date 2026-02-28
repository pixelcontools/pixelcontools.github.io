/**
 * Font management for text layers
 * Includes system fonts and curated Google Fonts
 */

export interface FontOption {
  name: string;
  value: string; // CSS font-family value
  category: 'system' | 'google' | 'local';
  googleFontName?: string; // For constructing Google Fonts URL
  weights?: number[]; // Available font weights (e.g. [400] or [300,400,700])
}

// System fonts available across Windows, macOS, and Linux
export const SYSTEM_FONTS: FontOption[] = [
  { name: 'Arial', value: 'Arial, sans-serif', category: 'system', weights: [400, 700] },
  { name: 'Times New Roman', value: '"Times New Roman", Times, serif', category: 'system', weights: [400, 700] },
  { name: 'Courier New', value: '"Courier New", Courier, monospace', category: 'system', weights: [400, 700] },
  { name: 'Georgia', value: 'Georgia, serif', category: 'system', weights: [400, 700] },
  { name: 'Verdana', value: 'Verdana, sans-serif', category: 'system', weights: [400, 700] },
  { name: 'Comic Sans MS', value: '"Comic Sans MS", "Comic Sans", cursive', category: 'system', weights: [400, 700] },
  { name: 'Impact', value: 'Impact, Charcoal, sans-serif', category: 'system', weights: [400] },
  { name: 'Trebuchet MS', value: '"Trebuchet MS", Helvetica, sans-serif', category: 'system', weights: [400, 700] },
  { name: 'Jokerman', value: 'Jokerman, fantasy', category: 'system', weights: [400] },
];

// Top 50 most popular Google Fonts (by usage statistics)
export const GOOGLE_FONTS: FontOption[] = [
  // Sans-serif (most popular)
  { name: 'Roboto', value: 'Roboto, sans-serif', category: 'google', googleFontName: 'Roboto', weights: [300, 400, 700] },
  { name: 'Open Sans', value: '"Open Sans", sans-serif', category: 'google', googleFontName: 'Open+Sans', weights: [300, 400, 700] },
  { name: 'Lato', value: 'Lato, sans-serif', category: 'google', googleFontName: 'Lato', weights: [300, 400, 700] },
  { name: 'Montserrat', value: 'Montserrat, sans-serif', category: 'google', googleFontName: 'Montserrat', weights: [300, 400, 700] },
  { name: 'Poppins', value: 'Poppins, sans-serif', category: 'google', googleFontName: 'Poppins', weights: [300, 400, 700] },
  { name: 'Oswald', value: 'Oswald, sans-serif', category: 'google', googleFontName: 'Oswald', weights: [300, 400, 700] },
  { name: 'Raleway', value: 'Raleway, sans-serif', category: 'google', googleFontName: 'Raleway', weights: [300, 400, 700] },
  { name: 'Ubuntu', value: 'Ubuntu, sans-serif', category: 'google', googleFontName: 'Ubuntu', weights: [300, 400, 700] },
  { name: 'Nunito', value: 'Nunito, sans-serif', category: 'google', googleFontName: 'Nunito', weights: [300, 400, 700] },
  { name: 'PT Sans', value: '"PT Sans", sans-serif', category: 'google', googleFontName: 'PT+Sans', weights: [400, 700] },
  
  // Serif
  { name: 'Merriweather', value: 'Merriweather, serif', category: 'google', googleFontName: 'Merriweather', weights: [300, 400, 700] },
  { name: 'Playfair Display', value: '"Playfair Display", serif', category: 'google', googleFontName: 'Playfair+Display', weights: [400, 700] },
  { name: 'Lora', value: 'Lora, serif', category: 'google', googleFontName: 'Lora', weights: [400, 700] },
  { name: 'PT Serif', value: '"PT Serif", serif', category: 'google', googleFontName: 'PT+Serif', weights: [400, 700] },
  { name: 'Crimson Text', value: '"Crimson Text", serif', category: 'google', googleFontName: 'Crimson+Text', weights: [400, 700] },
  { name: 'EB Garamond', value: '"EB Garamond", serif', category: 'google', googleFontName: 'EB+Garamond', weights: [400, 700] },
  { name: 'Libre Baskerville', value: '"Libre Baskerville", serif', category: 'google', googleFontName: 'Libre+Baskerville', weights: [400, 700] },
  { name: 'Cormorant', value: 'Cormorant, serif', category: 'google', googleFontName: 'Cormorant', weights: [300, 400, 700] },
  { name: 'Spectral', value: 'Spectral, serif', category: 'google', googleFontName: 'Spectral', weights: [300, 400, 700] },
  { name: 'Bitter', value: 'Bitter, serif', category: 'google', googleFontName: 'Bitter', weights: [300, 400, 700] },
  
  // Display
  { name: 'Bebas Neue', value: '"Bebas Neue", cursive', category: 'google', googleFontName: 'Bebas+Neue', weights: [400] },
  { name: 'Pacifico', value: 'Pacifico, cursive', category: 'google', googleFontName: 'Pacifico', weights: [400] },
  { name: 'Righteous', value: 'Righteous, cursive', category: 'google', googleFontName: 'Righteous', weights: [400] },
  { name: 'Bangers', value: 'Bangers, cursive', category: 'google', googleFontName: 'Bangers', weights: [400] },
  { name: 'Permanent Marker', value: '"Permanent Marker", cursive', category: 'google', googleFontName: 'Permanent+Marker', weights: [400] },
  { name: 'Lobster', value: 'Lobster, cursive', category: 'google', googleFontName: 'Lobster', weights: [400] },
  { name: 'Press Start 2P', value: '"Press Start 2P", cursive', category: 'google', googleFontName: 'Press+Start+2P', weights: [400] },
  { name: 'Fredoka One', value: '"Fredoka One", cursive', category: 'google', googleFontName: 'Fredoka+One', weights: [400] },
  { name: 'Alfa Slab One', value: '"Alfa Slab One", cursive', category: 'google', googleFontName: 'Alfa+Slab+One', weights: [400] },
  { name: 'Rubik Mono One', value: '"Rubik Mono One", sans-serif', category: 'google', googleFontName: 'Rubik+Mono+One', weights: [400] },
  
  // Handwriting
  { name: 'Dancing Script', value: '"Dancing Script", cursive', category: 'google', googleFontName: 'Dancing+Script', weights: [400, 700] },
  { name: 'Caveat', value: 'Caveat, cursive', category: 'google', googleFontName: 'Caveat', weights: [400, 700] },
  { name: 'Shadows Into Light', value: '"Shadows Into Light", cursive', category: 'google', googleFontName: 'Shadows+Into+Light', weights: [400] },
  { name: 'Satisfy', value: 'Satisfy, cursive', category: 'google', googleFontName: 'Satisfy', weights: [400] },
  { name: 'Indie Flower', value: '"Indie Flower", cursive', category: 'google', googleFontName: 'Indie+Flower', weights: [400] },
  { name: 'Architects Daughter', value: '"Architects Daughter", cursive', category: 'google', googleFontName: 'Architects+Daughter', weights: [400] },
  { name: 'Kalam', value: 'Kalam, cursive', category: 'google', googleFontName: 'Kalam', weights: [300, 400, 700] },
  { name: 'Amatic SC', value: '"Amatic SC", cursive', category: 'google', googleFontName: 'Amatic+SC', weights: [400, 700] },
  { name: 'Patrick Hand', value: '"Patrick Hand", cursive', category: 'google', googleFontName: 'Patrick+Hand', weights: [400] },
  { name: 'Courgette', value: 'Courgette, cursive', category: 'google', googleFontName: 'Courgette', weights: [400] },
  
  // Monospace
  { name: 'Roboto Mono', value: '"Roboto Mono", monospace', category: 'google', googleFontName: 'Roboto+Mono', weights: [300, 400, 700] },
  { name: 'Source Code Pro', value: '"Source Code Pro", monospace', category: 'google', googleFontName: 'Source+Code+Pro', weights: [300, 400, 700] },
  { name: 'Fira Code', value: '"Fira Code", monospace', category: 'google', googleFontName: 'Fira+Code', weights: [300, 400, 700] },
  { name: 'JetBrains Mono', value: '"JetBrains Mono", monospace', category: 'google', googleFontName: 'JetBrains+Mono', weights: [300, 400, 700] },
  { name: 'Space Mono', value: '"Space Mono", monospace', category: 'google', googleFontName: 'Space+Mono', weights: [400, 700] },
  { name: 'Courier Prime', value: '"Courier Prime", monospace', category: 'google', googleFontName: 'Courier+Prime', weights: [400, 700] },
  { name: 'Inconsolata', value: 'Inconsolata, monospace', category: 'google', googleFontName: 'Inconsolata', weights: [300, 400, 700] },
  { name: 'IBM Plex Mono', value: '"IBM Plex Mono", monospace', category: 'google', googleFontName: 'IBM+Plex+Mono', weights: [300, 400, 700] },
  { name: 'Anonymous Pro', value: '"Anonymous Pro", monospace', category: 'google', googleFontName: 'Anonymous+Pro', weights: [400, 700] },
  { name: 'Overpass Mono', value: '"Overpass Mono", monospace', category: 'google', googleFontName: 'Overpass+Mono', weights: [300, 400, 700] },
  
  // Fun / Silly
  { name: 'Creepster', value: '"Creepster", cursive', category: 'google', googleFontName: 'Creepster', weights: [400] },
  { name: 'Frijole', value: '"Frijole", cursive', category: 'google', googleFontName: 'Frijole', weights: [400] },
  { name: 'Spicy Rice', value: '"Spicy Rice", cursive', category: 'google', googleFontName: 'Spicy+Rice', weights: [400] },
  { name: 'Ranchers', value: '"Ranchers", cursive', category: 'google', googleFontName: 'Ranchers', weights: [400] },
  { name: 'Chewy', value: '"Chewy", cursive', category: 'google', googleFontName: 'Chewy', weights: [400] },
];

/**
 * Detect whether a font is actually available in the current browser.
 * Uses canvas measurement: renders text in the target font and a known fallback,
 * then compares widths. If they differ, the font is available.
 * This catches Firefox's font-visibility restrictions and missing OS fonts.
 */
function isFontAvailable(fontFamily: string): boolean {
  const testString = 'mmmmmmmmmmlli1WWWWW';
  const testSize = '72px';
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return true; // Can't detect — assume available

  // Measure with a baseline monospace font
  ctx.font = `${testSize} monospace`;
  const baselineWidth = ctx.measureText(testString).width;

  // Measure with the target font + monospace fallback
  const primaryName = fontFamily.split(',')[0].trim();
  ctx.font = `${testSize} ${primaryName}, monospace`;
  const targetWidth = ctx.measureText(testString).width;

  // If widths differ, the browser found the target font
  if (targetWidth !== baselineWidth) return true;

  // Double-check against sans-serif baseline (in case the font is itself monospace-like)
  ctx.font = `${testSize} sans-serif`;
  const sansWidth = ctx.measureText(testString).width;
  ctx.font = `${testSize} ${primaryName}, sans-serif`;
  const targetSansWidth = ctx.measureText(testString).width;

  return targetSansWidth !== sansWidth;
}

/** Cached list of available system fonts (computed once on first access) */
let _availableSystemFonts: FontOption[] | null = null;
function getAvailableSystemFonts(): FontOption[] {
  if (_availableSystemFonts !== null) return _availableSystemFonts;
  // In SSR / non-browser environments, return all
  if (typeof document === 'undefined') return SYSTEM_FONTS;
  _availableSystemFonts = SYSTEM_FONTS.filter(f => isFontAvailable(f.value));
  return _availableSystemFonts;
}

// All fonts combined (system fonts filtered to only those the browser can render)
export function getAllFonts(): FontOption[] {
  return [...getAvailableSystemFonts(), ...GOOGLE_FONTS];
}
/** @deprecated Use getAllFonts() for runtime-filtered list */
export const ALL_FONTS: FontOption[] = [...SYSTEM_FONTS, ...GOOGLE_FONTS];

// Track which Google Fonts have been loaded
const loadedGoogleFonts = new Set<string>();

/**
 * Load a Google Font dynamically
 * @param fontName The Google Font name (URL-encoded)
 * @returns Promise that resolves when font is loaded
 */
export async function loadGoogleFont(fontName: string): Promise<void> {
  if (loadedGoogleFonts.has(fontName)) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${fontName}:wght@300;400;700&display=swap`;
    
    link.onload = async () => {
      loadedGoogleFonts.add(fontName);
      // The stylesheet only defines @font-face rules; with display=swap the
      // browser won't download the actual woff2 binaries until text needs them.
      // Force-download the font binary now via document.fonts.load().
      const fontOption = GOOGLE_FONTS.find(f => f.googleFontName === fontName);
      if (fontOption) {
        const primaryFamily = fontOption.value.split(',')[0].trim();
        try {
          await document.fonts.load(`400 16px ${primaryFamily}`);
        } catch { /* ignore */ }
      }
      resolve();
    };
    
    link.onerror = () => {
      console.error(`Failed to load Google Font: ${fontName}`);
      reject(new Error(`Failed to load font: ${fontName}`));
    };
    
    document.head.appendChild(link);
  });
}

/**
 * Preload ALL Google Fonts in a single request.
 * Uses a batched Google Fonts CSS URL so the browser downloads them all at once.
 * Returns a promise that resolves when the stylesheet has loaded.
 */
let _googleFontsPreloaded = false;
export function preloadAllGoogleFonts(): Promise<void> {
  if (_googleFontsPreloaded) return Promise.resolve();
  _googleFontsPreloaded = true;

  const families = GOOGLE_FONTS
    .filter(f => f.googleFontName)
    .map(f => `family=${f.googleFontName}:wght@300;400;700`)
    .join('&');

  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
    link.onload = async () => {
      // Mark every font as loaded so individual loadGoogleFont calls are no-ops
      GOOGLE_FONTS.forEach(f => { if (f.googleFontName) loadedGoogleFonts.add(f.googleFontName); });
      // The stylesheet only defines @font-face rules; with display=swap the
      // browser won't download the woff2 binaries until text needs them.
      // Force-trigger all font binary downloads in parallel now.
      const loadPromises = GOOGLE_FONTS.map(f => {
        const primaryFamily = f.value.split(',')[0].trim();
        return document.fonts.load(`400 16px ${primaryFamily}`).catch(() => {});
      });
      await Promise.allSettled(loadPromises);
      resolve();
    };
    link.onerror = () => resolve(); // fail silently
    document.head.appendChild(link);
  });
}

/**
 * Get font option by value
 */
export function getFontByValue(value: string): FontOption | undefined {
  return ALL_FONTS.find(font => font.value === value);
}

/**
 * Get font option by name
 */
export function getFontByName(name: string): FontOption | undefined {
  return ALL_FONTS.find(font => font.name === name);
}

/**
 * Detect locally installed fonts using the Local Font Access API.
 * Only available in Chromium-based browsers (Chrome 103+, Edge 103+).
 * Returns deduplicated FontOption[] with category 'local'.
 * Falls back to empty array if the API is unavailable or the user denies permission.
 */
export async function detectLocalFonts(): Promise<FontOption[]> {
  try {
    // Check if the API exists
    if (!('queryLocalFonts' in window)) {
      return [];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fonts: any[] = await (window as any).queryLocalFonts();

    // Deduplicate by family name — the API returns one entry per style variant
    const seenFamilies = new Set<string>();
    // Also skip families we already have in SYSTEM_FONTS or GOOGLE_FONTS
    const existingNames = new Set(
      ALL_FONTS.map(f => f.name.toLowerCase())
    );

    const localFonts: FontOption[] = [];
    for (const font of fonts) {
      const family: string = font.family;
      const key = family.toLowerCase();
      if (seenFamilies.has(key) || existingNames.has(key)) continue;
      seenFamilies.add(key);
      localFonts.push({
        name: family,
        value: `"${family}"`,
        category: 'local',
      });
    }

    // Sort alphabetically
    localFonts.sort((a, b) => a.name.localeCompare(b.name));
    return localFonts;
  } catch {
    // User denied permission or API error — silently return empty
    return [];
  }
}
