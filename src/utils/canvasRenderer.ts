/**
 * Canvas rendering utilities
 * Handles pixel-perfect rendering operations
 */

import { Layer, CanvasConfig, ViewportState } from '../types/compositor.types';

/**
 * Render all visible layers to a canvas context
 * CRITICAL: Sets imageSmoothingEnabled = false for pixel-perfect rendering
 */
export function renderCanvasContent(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  config: CanvasConfig,
  layers: Layer[],
  loadedImages: Map<string, HTMLImageElement>,
  viewport?: ViewportState
) {
  // CRITICAL: Disable image smoothing
  ctx.imageSmoothingEnabled = false;
  (ctx as any).webkitImageSmoothingEnabled = false;
  (ctx as any).mozImageSmoothingEnabled = false;

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Fill background color if set
  if (config.backgroundColor) {
    ctx.fillStyle = config.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Sort layers by z-index
  const sortedLayers = [...layers]
    .filter((layer) => layer.visible)
    .sort((a, b) => a.zIndex - b.zIndex);

  // Save context state before applying viewport transforms
  ctx.save();

  // Apply viewport transforms if provided
  if (viewport) {
    const zoom = viewport.zoom / 100;
    ctx.scale(zoom, zoom);
    ctx.translate(-viewport.panX, -viewport.panY);
  }

  // Render each layer
  for (const layer of sortedLayers) {
    const img = loadedImages.get(layer.id);
    if (img && img.complete) {
      // Use floor to ensure integer positioning
      ctx.drawImage(img, Math.floor(layer.x), Math.floor(layer.y));
    }
  }

  ctx.restore();
}

/**
 * Get the layer at a specific canvas coordinate
 * Returns the topmost visible layer at that position, or null
 */
export function getLayerAtPoint(
  x: number,
  y: number,
  layers: Layer[]
): Layer | null {
  // Check in reverse order (top layer first)
  const sortedLayers = [...layers]
    .filter((layer) => layer.visible)
    .sort((a, b) => b.zIndex - a.zIndex);

  for (const layer of sortedLayers) {
    if (
      x >= layer.x &&
      x < layer.x + layer.width &&
      y >= layer.y &&
      y < layer.y + layer.height
    ) {
      return layer;
    }
  }

  return null;
}

/**
 * Convert canvas screen coordinates to world coordinates
 */
export function screenToWorld(
  screenX: number,
  screenY: number,
  rect: DOMRect,
  viewport: ViewportState
): [number, number] {
  const canvasX = screenX - rect.left;
  const canvasY = screenY - rect.top;

  const zoom = viewport.zoom / 100;
  const worldX = canvasX / zoom + viewport.panX;
  const worldY = canvasY / zoom + viewport.panY;

  return [worldX, worldY];
}

/**
 * Convert world coordinates to canvas screen coordinates
 */
export function worldToScreen(
  worldX: number,
  worldY: number,
  rect: DOMRect,
  viewport: ViewportState
): [number, number] {
  const zoom = viewport.zoom / 100;
  const canvasX = (worldX - viewport.panX) * zoom;
  const canvasY = (worldY - viewport.panY) * zoom;

  const screenX = canvasX + rect.left;
  const screenY = canvasY + rect.top;

  return [screenX, screenY];
}

/**
 * Load image from data URL
 */
export async function loadImageFromDataURL(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}
