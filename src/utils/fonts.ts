/**
 * Font management for text layers
 * Includes system fonts and curated Google Fonts
 */

export interface FontOption {
  name: string;
  value: string; // CSS font-family value
  category: 'system' | 'google' | 'local';
  googleFontName?: string; // For constructing Google Fonts URL
}

// System fonts available across Windows, macOS, and Linux
export const SYSTEM_FONTS: FontOption[] = [
  { name: 'Arial', value: 'Arial, sans-serif', category: 'system' },
  { name: 'Times New Roman', value: '"Times New Roman", Times, serif', category: 'system' },
  { name: 'Courier New', value: '"Courier New", Courier, monospace', category: 'system' },
  { name: 'Georgia', value: 'Georgia, serif', category: 'system' },
  { name: 'Verdana', value: 'Verdana, sans-serif', category: 'system' },
  { name: 'Comic Sans MS', value: '"Comic Sans MS", "Comic Sans", cursive', category: 'system' },
  { name: 'Impact', value: 'Impact, Charcoal, sans-serif', category: 'system' },
  { name: 'Trebuchet MS', value: '"Trebuchet MS", Helvetica, sans-serif', category: 'system' },
  { name: 'Jokerman', value: 'Jokerman, fantasy', category: 'system' },
];

// Top 50 most popular Google Fonts (by usage statistics)
export const GOOGLE_FONTS: FontOption[] = [
  // Sans-serif (most popular)
  { name: 'Roboto', value: 'Roboto, sans-serif', category: 'google', googleFontName: 'Roboto' },
  { name: 'Open Sans', value: '"Open Sans", sans-serif', category: 'google', googleFontName: 'Open+Sans' },
  { name: 'Lato', value: 'Lato, sans-serif', category: 'google', googleFontName: 'Lato' },
  { name: 'Montserrat', value: 'Montserrat, sans-serif', category: 'google', googleFontName: 'Montserrat' },
  { name: 'Poppins', value: 'Poppins, sans-serif', category: 'google', googleFontName: 'Poppins' },
  { name: 'Oswald', value: 'Oswald, sans-serif', category: 'google', googleFontName: 'Oswald' },
  { name: 'Raleway', value: 'Raleway, sans-serif', category: 'google', googleFontName: 'Raleway' },
  { name: 'Ubuntu', value: 'Ubuntu, sans-serif', category: 'google', googleFontName: 'Ubuntu' },
  { name: 'Nunito', value: 'Nunito, sans-serif', category: 'google', googleFontName: 'Nunito' },
  { name: 'PT Sans', value: '"PT Sans", sans-serif', category: 'google', googleFontName: 'PT+Sans' },
  
  // Serif
  { name: 'Merriweather', value: 'Merriweather, serif', category: 'google', googleFontName: 'Merriweather' },
  { name: 'Playfair Display', value: '"Playfair Display", serif', category: 'google', googleFontName: 'Playfair+Display' },
  { name: 'Lora', value: 'Lora, serif', category: 'google', googleFontName: 'Lora' },
  { name: 'PT Serif', value: '"PT Serif", serif', category: 'google', googleFontName: 'PT+Serif' },
  { name: 'Crimson Text', value: '"Crimson Text", serif', category: 'google', googleFontName: 'Crimson+Text' },
  { name: 'EB Garamond', value: '"EB Garamond", serif', category: 'google', googleFontName: 'EB+Garamond' },
  { name: 'Libre Baskerville', value: '"Libre Baskerville", serif', category: 'google', googleFontName: 'Libre+Baskerville' },
  { name: 'Cormorant', value: 'Cormorant, serif', category: 'google', googleFontName: 'Cormorant' },
  { name: 'Spectral', value: 'Spectral, serif', category: 'google', googleFontName: 'Spectral' },
  { name: 'Bitter', value: 'Bitter, serif', category: 'google', googleFontName: 'Bitter' },
  
  // Display
  { name: 'Bebas Neue', value: '"Bebas Neue", cursive', category: 'google', googleFontName: 'Bebas+Neue' },
  { name: 'Pacifico', value: 'Pacifico, cursive', category: 'google', googleFontName: 'Pacifico' },
  { name: 'Righteous', value: 'Righteous, cursive', category: 'google', googleFontName: 'Righteous' },
  { name: 'Bangers', value: 'Bangers, cursive', category: 'google', googleFontName: 'Bangers' },
  { name: 'Permanent Marker', value: '"Permanent Marker", cursive', category: 'google', googleFontName: 'Permanent+Marker' },
  { name: 'Lobster', value: 'Lobster, cursive', category: 'google', googleFontName: 'Lobster' },
  { name: 'Press Start 2P', value: '"Press Start 2P", cursive', category: 'google', googleFontName: 'Press+Start+2P' },
  { name: 'Fredoka One', value: '"Fredoka One", cursive', category: 'google', googleFontName: 'Fredoka+One' },
  { name: 'Alfa Slab One', value: '"Alfa Slab One", cursive', category: 'google', googleFontName: 'Alfa+Slab+One' },
  { name: 'Rubik Mono One', value: '"Rubik Mono One", sans-serif', category: 'google', googleFontName: 'Rubik+Mono+One' },
  
  // Handwriting
  { name: 'Dancing Script', value: '"Dancing Script", cursive', category: 'google', googleFontName: 'Dancing+Script' },
  { name: 'Caveat', value: 'Caveat, cursive', category: 'google', googleFontName: 'Caveat' },
  { name: 'Shadows Into Light', value: '"Shadows Into Light", cursive', category: 'google', googleFontName: 'Shadows+Into+Light' },
  { name: 'Satisfy', value: 'Satisfy, cursive', category: 'google', googleFontName: 'Satisfy' },
  { name: 'Indie Flower', value: '"Indie Flower", cursive', category: 'google', googleFontName: 'Indie+Flower' },
  { name: 'Architects Daughter', value: '"Architects Daughter", cursive', category: 'google', googleFontName: 'Architects+Daughter' },
  { name: 'Kalam', value: 'Kalam, cursive', category: 'google', googleFontName: 'Kalam' },
  { name: 'Amatic SC', value: '"Amatic SC", cursive', category: 'google', googleFontName: 'Amatic+SC' },
  { name: 'Patrick Hand', value: '"Patrick Hand", cursive', category: 'google', googleFontName: 'Patrick+Hand' },
  { name: 'Courgette', value: 'Courgette, cursive', category: 'google', googleFontName: 'Courgette' },
  
  // Monospace
  { name: 'Roboto Mono', value: '"Roboto Mono", monospace', category: 'google', googleFontName: 'Roboto+Mono' },
  { name: 'Source Code Pro', value: '"Source Code Pro", monospace', category: 'google', googleFontName: 'Source+Code+Pro' },
  { name: 'Fira Code', value: '"Fira Code", monospace', category: 'google', googleFontName: 'Fira+Code' },
  { name: 'JetBrains Mono', value: '"JetBrains Mono", monospace', category: 'google', googleFontName: 'JetBrains+Mono' },
  { name: 'Space Mono', value: '"Space Mono", monospace', category: 'google', googleFontName: 'Space+Mono' },
  { name: 'Courier Prime', value: '"Courier Prime", monospace', category: 'google', googleFontName: 'Courier+Prime' },
  { name: 'Inconsolata', value: 'Inconsolata, monospace', category: 'google', googleFontName: 'Inconsolata' },
  { name: 'IBM Plex Mono', value: '"IBM Plex Mono", monospace', category: 'google', googleFontName: 'IBM+Plex+Mono' },
  { name: 'Anonymous Pro', value: '"Anonymous Pro", monospace', category: 'google', googleFontName: 'Anonymous+Pro' },
  { name: 'Overpass Mono', value: '"Overpass Mono", monospace', category: 'google', googleFontName: 'Overpass+Mono' },
  
  // Fun / Silly
  { name: 'Creepster', value: '"Creepster", cursive', category: 'google', googleFontName: 'Creepster' },
  { name: 'Frijole', value: '"Frijole", cursive', category: 'google', googleFontName: 'Frijole' },
  { name: 'Spicy Rice', value: '"Spicy Rice", cursive', category: 'google', googleFontName: 'Spicy+Rice' },
  { name: 'Ranchers', value: '"Ranchers", cursive', category: 'google', googleFontName: 'Ranchers' },
  { name: 'Chewy', value: '"Chewy", cursive', category: 'google', googleFontName: 'Chewy' },
];

// All fonts combined
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
    link.href = `https://fonts.googleapis.com/css2?family=${fontName}:wght@400;700&display=swap`;
    
    link.onload = () => {
      loadedGoogleFonts.add(fontName);
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
    .map(f => `family=${f.googleFontName}:wght@400;700`)
    .join('&');

  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
    link.onload = () => {
      // Mark every font as loaded so individual loadGoogleFont calls are no-ops
      GOOGLE_FONTS.forEach(f => { if (f.googleFontName) loadedGoogleFonts.add(f.googleFontName); });
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
