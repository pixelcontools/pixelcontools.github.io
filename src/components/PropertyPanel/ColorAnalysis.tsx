import { useState, useRef, useEffect } from 'react';
import { Layer } from '../../types/compositor.types';

interface ColorCount {
  hex: string;
  count: number;
  percent: number;
  hasAlpha?: boolean;
  alpha?: number;
}

/**
 * Analyzes layer(s) image data to extract color information
 * Supports single or multiple layers — when multiple layers are provided,
 * colors are analyzed from ALL layers combined (not composited)
 * Uses efficient virtual scrolling for large color sets
 */
function ColorAnalysis({ layer, layers }: { layer?: Layer; layers?: Layer[] }) {
  // Determine effective list of layers to analyze
  const effectiveLayers = layers || (layer ? [layer] : []);
  const layerIdKey = effectiveLayers.map(l => l.id).join(',');
  const [colorsRGB, setColorsRGB] = useState<ColorCount[] | null>(null);
  const [colorsRGBA, setColorsRGBA] = useState<ColorCount[] | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [visibleColorsRGB, setVisibleColorsRGB] = useState<Set<number>>(new Set());
  const [visibleColorsRGBA, setVisibleColorsRGBA] = useState<Set<number>>(new Set());
  const scrollContainerRGBRef = useRef<HTMLDivElement>(null);
  const scrollContainerRGBARef = useRef<HTMLDivElement>(null);
  const itemHeightRef = useRef(28); // Approximate height of each color item in pixels

  // Clear results when layer(s) change to avoid showing stale data
  useEffect(() => {
    setColorsRGB(null);
    setColorsRGBA(null);
    setVisibleColorsRGB(new Set());
    setVisibleColorsRGBA(new Set());
  }, [layerIdKey]);

  // Virtual scroll handler for RGB colors
  const handleScrollRGB = () => {
    if (!scrollContainerRGBRef.current || !colorsRGB) return;

    const container = scrollContainerRGBRef.current;
    const scrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;
    const itemHeight = itemHeightRef.current;

    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - 2);
    const endIndex = Math.min(colorsRGB.length, Math.ceil((scrollTop + containerHeight) / itemHeight) + 2);

    const newVisibleColors = new Set<number>();
    for (let i = startIndex; i < endIndex; i++) {
      newVisibleColors.add(i);
    }

    setVisibleColorsRGB(newVisibleColors);
  };

  // Virtual scroll handler for RGBA colors
  const handleScrollRGBA = () => {
    if (!scrollContainerRGBARef.current || !colorsRGBA) return;

    const container = scrollContainerRGBARef.current;
    const scrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;
    const itemHeight = itemHeightRef.current;

    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - 2);
    const endIndex = Math.min(colorsRGBA.length, Math.ceil((scrollTop + containerHeight) / itemHeight) + 2);

    const newVisibleColors = new Set<number>();
    for (let i = startIndex; i < endIndex; i++) {
      newVisibleColors.add(i);
    }

    setVisibleColorsRGBA(newVisibleColors);
  };

  // Setup scroll listeners
  useEffect(() => {
    const rgbContainer = scrollContainerRGBRef.current;
    if (rgbContainer) {
      rgbContainer.addEventListener('scroll', handleScrollRGB);
      handleScrollRGB();
      return () => rgbContainer.removeEventListener('scroll', handleScrollRGB);
    }
  }, [colorsRGB]);

  useEffect(() => {
    const rgbaContainer = scrollContainerRGBARef.current;
    if (rgbaContainer) {
      rgbaContainer.addEventListener('scroll', handleScrollRGBA);
      handleScrollRGBA();
      return () => rgbaContainer.removeEventListener('scroll', handleScrollRGBA);
    }
  }, [colorsRGBA]);

      const analyzeColors = async (includeAlpha: boolean) => {
    setIsAnalyzing(true);
    try {
      // Collect image data from all layers
      const allImageDatas: ImageData[] = [];
      
      for (const l of effectiveLayers) {
        await new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) { resolve(); return; }
            ctx.drawImage(img, 0, 0);
            allImageDatas.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
            resolve();
          };
          img.onerror = () => { reject(new Error('Failed to load image')); };
          img.src = l.imageData;
        });
      }

      if (allImageDatas.length === 0) {
        setIsAnalyzing(false);
        return;
      }

      if (includeAlpha) {
          // RGBA mode: Count colors with alpha channel across all layers
          const colorMap = new Map<string, number>();
          let totalPixels = 0;

          for (const imageData of allImageDatas) {
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              const a = data[i + 3];
              if (a === 0) continue;
              totalPixels++;
              const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
              const hexWithAlpha = `${hex}${a.toString(16).padStart(2, '0').toUpperCase()}`;
              colorMap.set(hexWithAlpha, (colorMap.get(hexWithAlpha) || 0) + 1);
            }
          }

          totalPixels = Math.max(1, totalPixels);
          const colors: ColorCount[] = Array.from(colorMap.entries())
            .map(([colorKey, pixelCount]) => {
              const hex = colorKey.substring(0, 7);
              const alpha = parseInt(colorKey.substring(7), 16);
              return {
                hex,
                count: pixelCount,
                percent: (pixelCount / totalPixels) * 100,
                hasAlpha: true,
                alpha,
              };
            })
            .filter(color => !(color.hex === '#000000' && color.alpha === 0))
            .sort((a, b) => b.count - a.count);

          setColorsRGBA(colors);
          setVisibleColorsRGBA(new Set());
        } else {
          // RGB mode: Count only fully opaque colors across all layers
          const colorMap = new Map<string, number>();
          let totalPixels = 0;

          for (const imageData of allImageDatas) {
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              const a = data[i + 3];
              if (a !== 255) continue;
              totalPixels++;
              const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
              colorMap.set(hex, (colorMap.get(hex) || 0) + 1);
            }
          }

          totalPixels = Math.max(1, totalPixels);
          const colors: ColorCount[] = Array.from(colorMap.entries())
            .map(([hex, pixelCount]) => ({
              hex,
              count: pixelCount,
              percent: (pixelCount / totalPixels) * 100,
              hasAlpha: false,
              alpha: undefined,
            }))
            .sort((a, b) => b.count - a.count);

          setColorsRGB(colors);
          setVisibleColorsRGB(new Set());
        }
    } catch (err) {
      console.error('Color analysis failed:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {
      console.error('Failed to copy to clipboard');
    });
  };

  const copyAllColorsToClipboard = (colors: ColorCount[] | null, includeAlpha: boolean) => {
    if (!colors || colors.length === 0) return;

    const colorStrings = colors.map(color => {
      if (includeAlpha && color.alpha !== undefined) {
        return `${color.hex}${color.alpha.toString(16).toUpperCase().padStart(2, '0')}`;
      }
      return color.hex;
    });

    const clipboardText = colorStrings.join('\n');
    copyToClipboard(clipboardText);
  };

  const renderColorList = (
    colors: ColorCount[] | null,
    visibleIndices: Set<number>,
    scrollRef: React.RefObject<HTMLDivElement>
  ) => {
    if (!colors || colors.length === 0) {
      return <p className="text-xs text-gray-500 p-2">No colors found</p>;
    }

    // Render only visible colors
    const renderedItems: React.ReactNode[] = [];
    const sortedIndices = Array.from(visibleIndices).sort((a, b) => a - b);

    for (const index of sortedIndices) {
      const color = colors[index];
      if (!color) continue;

      renderedItems.push(
        <div
          key={`${color.hex}-${index}`}
          className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-gray-700 border-b border-gray-700/50 last:border-b-0 transition-colors"
          style={{ height: `${itemHeightRef.current}px` }}
        >
          {/* Color swatch */}
          <div
            className="w-4 h-4 rounded border border-gray-600 flex-shrink-0"
            style={{
              backgroundColor: color.hex,
            }}
            title={color.hex}
          />

          {/* Hex value */}
          <span className="font-mono text-gray-300 min-w-fit text-xs">{color.hex}</span>

          {/* Alpha value if applicable */}
          {color.hasAlpha && color.alpha !== undefined && (
            <span className="font-mono text-gray-500 text-xs">α{color.alpha.toString(16).toUpperCase().padStart(2, '0')}</span>
          )}

          {/* Count and percentage */}
          <div className="ml-auto flex items-center gap-1 flex-shrink-0">
            <span className="font-mono text-gray-400 text-xs">{color.count}</span>
            <span className="text-gray-600 text-xs">({color.percent.toFixed(2)}%)</span>
          </div>
        </div>
      );
    }

    // Calculate spacer heights for virtual scrolling
    const minIndex = visibleIndices.size > 0 ? Math.min(...visibleIndices) : 0;
    const maxIndex = visibleIndices.size > 0 ? Math.max(...visibleIndices) : 0;
    const spacerTopHeight = Math.max(0, minIndex) * itemHeightRef.current;
    const spacerBottomHeight = Math.max(0, colors.length - (maxIndex + 1)) * itemHeightRef.current;

    return (
      <div
        ref={scrollRef}
        className="max-h-64 overflow-y-auto bg-gray-800/50 rounded border border-gray-700 text-xs"
        style={{ height: '256px' }}
      >
        <div style={{ height: spacerTopHeight }} />
        {renderedItems}
        <div style={{ height: spacerBottomHeight }} />
      </div>
    );
  };

  return (
    <div className="bg-panel-bg rounded p-3 space-y-2" data-region="color-analysis">
      <div className="text-xs font-semibold text-gray-300">Analyze Colors</div>

      {/* RGB Analysis Button */}
      <button
        id="btn-analyze-rgb"
        onClick={() => analyzeColors(false)}
        disabled={isAnalyzing}
        className="w-full px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-xs font-medium text-blue-400 rounded transition-colors"
        aria-label="Analyze RGB colors"
      >
        {isAnalyzing ? 'Analyzing...' : 'Get Colors...'}
      </button>

      {/* RGB Results */}
      {colorsRGB && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>{colorsRGB.length} colors (RGB) • {Math.floor(colorsRGB.reduce((sum, c) => sum + c.count, 0))} pixels</span>
            <button
              id="btn-copy-rgb-colors"
              onClick={() => copyAllColorsToClipboard(colorsRGB, false)}
              className="p-1 text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0"
              title="Copy all colors to clipboard"
              aria-label="Copy all RGB colors to clipboard"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2z" />
                <path fillOpacity="0.5" d="M2 6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-2h-2v2H2V8h2V6H2z" />
              </svg>
            </button>
          </div>
          {renderColorList(colorsRGB, visibleColorsRGB, scrollContainerRGBRef)}
        </div>
      )}

      {/* Divider */}
      {colorsRGB && <div className="my-2 border-t border-gray-700" />}

      {/* RGBA Analysis Button */}
      <button
        id="btn-analyze-rgba"
        onClick={() => analyzeColors(true)}
        disabled={isAnalyzing}
        className="w-full px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-xs font-medium text-purple-400 rounded transition-colors"
        aria-label="Analyze RGBA colors"
      >
        {isAnalyzing ? 'Analyzing...' : 'Get Colors (inc. transparent pixels)...'}
      </button>

      {/* RGBA Results */}
      {colorsRGBA && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>{colorsRGBA.length} colors (RGBA) • {Math.floor(colorsRGBA.reduce((sum, c) => sum + c.count, 0))} pixels</span>
            <button
              id="btn-copy-rgba-colors"
              onClick={() => copyAllColorsToClipboard(colorsRGBA, true)}
              className="p-1 text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0"
              title="Copy all colors to clipboard"
              aria-label="Copy all RGBA colors to clipboard"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2z" />
                <path fillOpacity="0.5" d="M2 6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-2h-2v2H2V8h2V6H2z" />
              </svg>
            </button>
          </div>
          {renderColorList(colorsRGBA, visibleColorsRGBA, scrollContainerRGBARef)}
        </div>
      )}
    </div>
  );
}

export default ColorAnalysis;
