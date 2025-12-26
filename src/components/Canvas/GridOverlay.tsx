/**
 * Grid overlay component
 * Renders a 1-pixel photoshop-style grid overlay
 * Grid is rendered in viewport coordinates, not canvas coordinates
 */

import { useEffect, useRef } from 'react';
import { ViewportState } from '../../types/compositor.types';

interface GridOverlayProps {
  canvas: HTMLCanvasElement | null;
  gridEnabled: boolean;
  viewport: ViewportState;
  canvasWidth: number;
  canvasHeight: number;
  gridDensity: number;
  canvasBorderEnabled: boolean;
}

function GridOverlay({ canvas, gridEnabled, viewport, canvasWidth, canvasHeight, gridDensity, canvasBorderEnabled }: GridOverlayProps) {
  const gridCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!gridCanvasRef.current || !canvas || !containerRef.current) {
      return;
    }

    const gridCanvas = gridCanvasRef.current;
    const ctx = gridCanvas.getContext('2d');
    if (!ctx) return;

    // Grid renders at all zoom levels with opacity fade
    // At 200% and above: full opacity (100%)
    // At 100%: 50% opacity
    // At 50%: 0% opacity (invisible)
    // Below 50%: hidden
    const minZoomForVisibility = 50;

    // Only draw if enabled and zoom is at least 50%
    if (!gridEnabled || viewport.zoom < minZoomForVisibility) {
      ctx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
      return;
    }

    const zoom = viewport.zoom / 100;
    
    // Set canvas to match visible viewport
    gridCanvas.width = containerRef.current.clientWidth;
    gridCanvas.height = containerRef.current.clientHeight;

    ctx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);

    // Calculate opacity based on zoom level
    // Keep opacity lower at medium-high zoom to prevent darkening
    // 50% zoom = 0% opacity (invisible)
    // 100% zoom = 30% opacity
    // 200%+ zoom = 40% opacity (not 100% to keep it lighter)
    let opacity = 0;
    if (viewport.zoom <= minZoomForVisibility) {
      opacity = 0;
    } else if (viewport.zoom < 150) {
      // Linear interpolation from 0% (at 50% zoom) to 30% (at 150% zoom)
      opacity = (viewport.zoom - minZoomForVisibility) / (100) * 0.3;
    } else {
      // Keep at 40% for higher zoom levels (200%+)
      opacity = 0.4;
    }

    // Dynamically increase effective grid density at low zoom levels to prevent overcrowding
    // This prevents the screen from turning black with dense grids at low zoom
    let effectiveGridDensity = gridDensity;
    
    // At low zoom levels, multiply the grid density to make lines further apart
    if (zoom < 3) {
      // At 300% zoom (3x), use 3x the density
      // At 200% zoom (2x), use 4x the density  
      // At 100% zoom (1x), use 6x the density
      // At 50% zoom (0.5x), use 12x the density
      const densityMultiplier = 9 / (zoom * 3);
      effectiveGridDensity = gridDensity * densityMultiplier;
    }
    
    // Configure grid appearance - pure black lines with calculated opacity
    ctx.strokeStyle = `rgba(0, 0, 0, ${opacity})`;
    ctx.lineWidth = 1;

    // Get canvas bounds in screen space and set up clipping
    const canvasRect = canvas.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();
    
    // Calculate canvas position relative to grid container
    let canvasScreenX = canvasRect.left - containerRect.left;
    let canvasScreenY = canvasRect.top - containerRect.top;
    let canvasScreenWidth = canvasRect.width;
    let canvasScreenHeight = canvasRect.height;
    
    // Inset clipping region by border width to avoid rendering on the border
    const borderInset = canvasBorderEnabled ? 1 : 0;
    canvasScreenX += borderInset;
    canvasScreenY += borderInset;
    canvasScreenWidth -= borderInset * 2;
    canvasScreenHeight -= borderInset * 2;
    
    // Set up clipping region to only render within canvas bounds (excluding border)
    ctx.save();
    ctx.beginPath();
    ctx.rect(canvasScreenX, canvasScreenY, canvasScreenWidth, canvasScreenHeight);
    ctx.clip();

    // Calculate the top-left corner of the canvas in screen space
    const centerX = gridCanvas.width / 2;
    const centerY = gridCanvas.height / 2;
    
    const canvasCenterWorldX = canvasWidth / 2;
    const canvasCenterWorldY = canvasHeight / 2;
    
    // Optional padding on grid alignment
    const paddingLeft = 0;
    const paddingTop = 0;
    
    // World coordinates of top-left corner of visible canvas
    const worldStartX = canvasCenterWorldX - (centerX - paddingLeft) / zoom + viewport.panX;
    const worldStartY = canvasCenterWorldY - (centerY - paddingTop) / zoom + viewport.panY;

    // Draw vertical grid lines (every N pixels based on effective density)
    const firstX = Math.floor(worldStartX / effectiveGridDensity) * effectiveGridDensity;
    const lastX = Math.ceil((worldStartX + gridCanvas.width / zoom) / effectiveGridDensity) * effectiveGridDensity;
    
    for (let worldX = firstX; worldX <= lastX; worldX += effectiveGridDensity) {
      // Calculate screen position and snap to whole pixels
      const screenX = Math.round((worldX - worldStartX) * zoom);
      
      // Only draw if within bounds
      if (screenX >= 0 && screenX <= gridCanvas.width) {
        ctx.beginPath();
        ctx.moveTo(screenX, 0);
        ctx.lineTo(screenX, gridCanvas.height);
        ctx.stroke();
      }
    }

    // Draw horizontal grid lines (every N pixels based on effective density)
    const firstY = Math.floor(worldStartY / effectiveGridDensity) * effectiveGridDensity;
    const lastY = Math.ceil((worldStartY + gridCanvas.height / zoom) / effectiveGridDensity) * effectiveGridDensity;
    
    for (let worldY = firstY; worldY <= lastY; worldY += effectiveGridDensity) {
      // Calculate screen position and snap to whole pixels
      const screenY = Math.round((worldY - worldStartY) * zoom);
      
      // Only draw if within bounds
      if (screenY >= 0 && screenY <= gridCanvas.height) {
        ctx.beginPath();
        ctx.moveTo(0, screenY);
        ctx.lineTo(gridCanvas.width, screenY);
        ctx.stroke();
      }
    }
    
    // Restore context to remove clipping
    ctx.restore();
  }, [gridEnabled, viewport, canvasWidth, canvasHeight, canvas, gridDensity, canvasBorderEnabled]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <canvas
        ref={gridCanvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          imageRendering: 'pixelated',
        }}
      />
    </div>
  );
}

export default GridOverlay;