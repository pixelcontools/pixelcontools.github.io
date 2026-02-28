/**
 * Text rasterizer for converting text to high-quality images
 * Renders at 4x resolution for crisp output at all zoom levels
 */

import { loadGoogleFont, getFontByValue } from './fonts';

export interface TextRasterizeOptions {
  text: string;
  fontSize: number; // Font size in pixels (at 1x scale)
  fontFamily: string; // CSS font-family value
  color: string; // Hex color
  textAlign?: 'left' | 'center' | 'right';
  maxWidth?: number; // Optional max width for word wrapping (in pixels at 1x scale)
  lineHeight?: number; // Line height multiplier (default 1.2)
  disableTransparency?: boolean; // If true, renders aliased text (no transparency/anti-aliasing)
  letterSpacing?: number; // Letter spacing in pixels
  fontWeight?: 'normal' | 'bold' | 'lighter' | string; // Font weight
}

export interface RasterizedText {
  dataUrl: string; // Base64 data URI
  width: number; // Final width in pixels (at 1x scale)
  height: number; // Final height in pixels (at 1x scale)
}

const HIGH_DPI_SCALE = 4; // 4x resolution for crisp text

/**
 * Measure text dimensions before rendering
 */
function measureText(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontSize: number,
  fontFamily: string,
  maxWidth?: number,
  lineHeight: number = 1.2,
  scale: number = HIGH_DPI_SCALE,
  letterSpacing: number = 0,
  fontWeight: string = 'normal'
): { width: number; height: number; lines: string[] } {
  ctx.font = `${fontWeight} ${fontSize * scale}px ${fontFamily}`;
  // @ts-ignore - letterSpacing is a newer property
  if (typeof ctx.letterSpacing !== 'undefined') {
     // @ts-ignore
    ctx.letterSpacing = `${letterSpacing * scale}px`;
  }
  
  const lines: string[] = [];
  const paragraphs = text.split('\n');
  
  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push('');
      continue;
    }
    
    if (!maxWidth) {
      lines.push(paragraph);
      continue;
    }
    
    // Word wrapping
    const words = paragraph.split(' ');
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width / scale;
      
      if (testWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
  }
  
  // Measure final dimensions
  let maxLineWidth = 0;
  for (const line of lines) {
    const metrics = ctx.measureText(line);
    const lineWidth = metrics.width / scale;
    maxLineWidth = Math.max(maxLineWidth, lineWidth);
  }
  
  const lineHeightPx = fontSize * lineHeight;
  const totalHeight = lines.length * lineHeightPx;
  
  return {
    width: Math.ceil(maxLineWidth),
    height: Math.ceil(totalHeight),
    lines
  };
}

/**
 * Rasterize text to a high-DPI image
 * @param options Text rendering options
 * @returns Promise with data URL and dimensions
 */
export async function rasterizeText(options: TextRasterizeOptions): Promise<RasterizedText> {
  const {
    text,
    fontSize,
    fontFamily,
    color,
    textAlign = 'left',
    maxWidth,
    lineHeight = 1.2,
    disableTransparency = false,
    letterSpacing = 0,
    fontWeight = 'normal'
  } = options;
  
  // Load Google Font if needed
  const fontOption = getFontByValue(fontFamily);
  if (fontOption?.category === 'google' && fontOption.googleFontName) {
    try {
      await loadGoogleFont(fontOption.googleFontName);
      // Force-download the specific weight+size combination we need for rendering.
      // Always load weight 400 first (universally available), then the requested weight.
      const primaryFamily = fontFamily.split(',')[0].trim();
      try {
        await document.fonts.load(`400 ${fontSize}px ${primaryFamily}`);
        if (fontWeight !== 'normal' && fontWeight !== '400') {
          // Also try to load the requested weight; this is a no-op if unavailable
          await document.fonts.load(`${fontWeight} ${fontSize}px ${primaryFamily}`).catch(() => {});
        }
      } catch {
        // Fallback: short delay if document.fonts.load is unavailable
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } catch (error) {
      console.error('Failed to load Google Font, using fallback:', error);
    }
  }
  
  // Create temporary canvas for measurement
  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d', { willReadFrequently: true });
  if (!measureCtx) {
    throw new Error('Failed to get canvas context');
  }
  
  // Determine scale
  const scale = disableTransparency ? 1 : HIGH_DPI_SCALE;
  
  // Measure text dimensions
  const { width, height, lines } = measureText(
    measureCtx,
    text,
    fontSize,
    fontFamily,
    maxWidth,
    lineHeight,
    scale,
    letterSpacing,
    fontWeight
  );
  
  // Add padding (10px at 1x scale)
  const padding = 10;
  const scaledPadding = padding * scale;
  const canvasWidth = (width + padding * 2) * scale;
  const canvasHeight = (height + padding * 2) * scale;
  
  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }
  
  // Set up rendering context
  ctx.font = `${fontWeight} ${fontSize * scale}px ${fontFamily}`;
  // @ts-ignore
  if (typeof ctx.letterSpacing !== 'undefined') {
    // @ts-ignore
    ctx.letterSpacing = `${letterSpacing * scale}px`;
  }
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';
  
  // Configure smoothing
  ctx.imageSmoothingEnabled = !disableTransparency;
  ctx.imageSmoothingQuality = disableTransparency ? 'low' : 'high';
  
  // Render each line
  const lineHeightPx = fontSize * lineHeight * scale;
  let y = scaledPadding;
  
  for (const line of lines) {
    if (!line) {
      // Empty line, just advance y
      y += lineHeightPx;
      continue;
    }
    
    let x = scaledPadding;
    
    // Apply text alignment
    if (textAlign === 'center') {
      const lineWidth = ctx.measureText(line).width;
      x = (canvasWidth - lineWidth) / 2;
    } else if (textAlign === 'right') {
      const lineWidth = ctx.measureText(line).width;
      x = canvasWidth - lineWidth - scaledPadding;
    }
    
    ctx.fillText(line, x, y);
    y += lineHeightPx;
  }
  
  // If transparency is disabled, threshold the alpha channel
  if (disableTransparency) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Parse target color
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    
    for (let i = 0; i < data.length; i += 4) {
      // Threshold alpha at 128
      if (data[i + 3] >= 128) {
        data[i + 3] = 255; // Fully opaque
        // Force exact color to remove any anti-aliasing artifacts
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
      } else {
        data[i + 3] = 0; // Fully transparent
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
  }
  
  // Create final canvas (handles downscaling if needed, or just cropping/copying)
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = width + padding * 2;
  finalCanvas.height = height + padding * 2;
  
  const finalCtx = finalCanvas.getContext('2d', { willReadFrequently: true });
  if (!finalCtx) {
    throw new Error('Failed to get final canvas context');
  }
  
  finalCtx.imageSmoothingEnabled = !disableTransparency;
  finalCtx.imageSmoothingQuality = disableTransparency ? 'low' : 'high';
  
  finalCtx.drawImage(
    canvas,
    0, 0, canvasWidth, canvasHeight,
    0, 0, finalCanvas.width, finalCanvas.height
  );
  
  // Convert to data URL
  const dataUrl = finalCanvas.toDataURL('image/png');
  
  return {
    dataUrl,
    width: finalCanvas.width,
    height: finalCanvas.height
  };
}

/**
 * Check if a layer has text metadata (is a text layer)
 */
export function isTextLayer(layer: { textContent?: string }): boolean {
  return layer.textContent !== undefined && layer.textContent !== null;
}

/**
 * Check if a layer has shape metadata (is a shape layer)
 */
export function isShapeLayer(layer: { shapeType?: string }): boolean {
  return layer.shapeType !== undefined && layer.shapeType !== null;
}

