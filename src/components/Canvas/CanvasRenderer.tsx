/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useRef, useState } from 'react';
import useCompositorStore from '../../store/compositorStore';
import GridOverlay from './GridOverlay';
import DragInfoTooltip from './DragInfoTooltip';

/**
 * Canvas renderer component
 * Handles drawing and pixel-perfect rendering
 */
function CanvasRenderer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const project = useCompositorStore((state) => state.project);
  const selectedLayerIds = useCompositorStore((state) => state.selectedLayerIds);
  const showSelectionBorders = useCompositorStore((state) => state.ui.showSelectionBorders);
  const showSelectionTools = useCompositorStore((state) => state.ui.showSelectionTools);
  const borderAnimationSpeed = useCompositorStore((state) => state.ui.selectionBorderAnimationSpeed);
  const isDraggingLayer = useCompositorStore((state) => state.ui.isDraggingLayer);
  const dragLayerId = useCompositorStore((state) => state.ui.dragLayerId);
  const dragOffsetX = useCompositorStore((state) => state.ui.dragOffsetX);
  const dragOffsetY = useCompositorStore((state) => state.ui.dragOffsetY);
  const selectLayer = useCompositorStore((state) => state.selectLayer);
  const deselectAllLayers = useCompositorStore((state) => state.deselectAllLayers);
  const startDraggingLayer = useCompositorStore((state) => state.startDraggingLayer);
  const updateDragPosition = useCompositorStore((state) => state.updateDragPosition);
  const stopDraggingLayer = useCompositorStore((state) => state.stopDraggingLayer);
  const setViewport = useCompositorStore((state) => state.setViewport);
  const removeLayer = useCompositorStore((state) => state.removeLayer);
  const updateLayer = useCompositorStore((state) => state.updateLayer);

  const [loadedImages, setLoadedImages] = useState<Map<string, HTMLImageElement>>(new Map());
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [hoverCoords, setHoverCoords] = useState<{ x: number; y: number } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  /**
   * Decode base64 image data and cache it
   */
  useEffect(() => {
    const loadImages = async () => {
      const newImages = new Map<string, HTMLImageElement>();

      for (const layer of project.layers) {
        if (!loadedImages.has(layer.id) || loadedImages.get(layer.id)?.src !== layer.imageData) {
          try {
            const img = new Image();
            img.src = layer.imageData;
            
            await new Promise<void>((resolve, reject) => {
              img.onload = () => resolve();
              img.onerror = () => reject(new Error(`Failed to load image for layer: ${layer.name}`));
            });

            newImages.set(layer.id, img);
            // console.log(`[DEBUG] Image loaded for layer: ${layer.name} (${layer.width}x${layer.height})`);
          } catch (error) {
            // console.error(`[DEBUG] Error loading image for layer ${layer.name}:`, error);
          }
        }
      }

      setLoadedImages((prev) => new Map([...prev, ...newImages]));
    };

    loadImages();
  }, [project.layers]);

  /**
   * Initialize viewport to show canvas centered and fit on screen
   */
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    // Only run once on mount - check if viewport is at defaults
    if (project.viewport.zoom !== 100 || project.viewport.panX !== 0 || project.viewport.panY !== 0) {
      return;
    }

    // Calculate zoom to fit canvas in view
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    const canvasWidth = project.canvas.width;
    const canvasHeight = project.canvas.height;

    // Calculate zoom with some padding (90% of available space)
    const zoomX = (containerWidth / canvasWidth) * 100 * 0.9;
    const zoomY = (containerHeight / canvasHeight) * 100 * 0.9;
    const zoomToFit = Math.min(zoomX, zoomY, 100); // Don't zoom in, max 100%

    // console.log(`[DEBUG] Initializing viewport - zoom to fit: ${zoomToFit.toFixed(1)}%`);
    setViewport({ zoom: Math.max(zoomToFit, 10) }); // Minimum 10% zoom
  }, []); // Empty deps - only run once on mount

  /**
   * Render canvas
   * CRITICAL: Must set imageSmoothingEnabled = false for pixel-perfect rendering
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.warn('[DEBUG] Canvas element not found');
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('[DEBUG] Failed to get canvas context');
      return;
    }

    // CRITICAL: Disable image smoothing for pixel-perfect rendering
    ctx.imageSmoothingEnabled = false;
    (ctx as any).webkitImageSmoothingEnabled = false;
    (ctx as any).mozImageSmoothingEnabled = false;

    // Set canvas size
    canvas.width = project.canvas.width;
    canvas.height = project.canvas.height;

    // console.log(`[DEBUG] Canvas size set to ${canvas.width}x${canvas.height}`);

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Fill background color if set
    if (project.canvas.backgroundColor) {
      ctx.fillStyle = project.canvas.backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // console.log(`[DEBUG] Background color applied: ${project.canvas.backgroundColor}`);
    }

    // Draw checkered background for transparency
    if (project.canvas.showCheckeredBackground && !project.canvas.backgroundColor) {
      // Use a fixed pattern size (in pixels) that scales with zoom for consistent appearance
      const patternSize = 8;
      
      // Create an off-screen canvas for the pattern
      const patternCanvas = document.createElement('canvas');
      patternCanvas.width = patternSize * 2;
      patternCanvas.height = patternSize * 2;
      const patternCtx = patternCanvas.getContext('2d');
      
      if (patternCtx) {
        // Draw checkerboard pattern on small canvas
        patternCtx.fillStyle = '#ffffff';
        patternCtx.fillRect(0, 0, patternSize * 2, patternSize * 2);
        patternCtx.fillStyle = '#cccccc';
        patternCtx.fillRect(0, 0, patternSize, patternSize);
        patternCtx.fillRect(patternSize, patternSize, patternSize, patternSize);
        
        // Use the pattern to fill the entire canvas
        const pattern = ctx.createPattern(patternCanvas, 'repeat');
        if (pattern) {
          ctx.fillStyle = pattern;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      }
    }

    // Draw canvas border (expands outward from canvas edge)
    if (project.canvas.borderWidth && project.canvas.borderWidth > 0) {
      const borderWidth = project.canvas.borderWidth;
      ctx.strokeStyle = project.canvas.borderColor;
      ctx.globalAlpha = project.canvas.borderOpacity;
      ctx.lineWidth = borderWidth * 2; // Double width so it expands outward evenly
      
      // Offset by half the border width so it expands outward
      const offset = borderWidth / 2;
      ctx.strokeRect(offset, offset, canvas.width - borderWidth, canvas.height - borderWidth);
      
      ctx.globalAlpha = 1; // Reset alpha
      // console.log(`[DEBUG] Canvas border drawn: ${borderWidth}px ${project.canvas.borderColor}`);
    }

    // Sort layers by z-index for rendering
    const sortedLayers = [...project.layers]
      .filter((layer) => layer.visible)
      .sort((a, b) => a.zIndex - b.zIndex);

    // console.log(`[DEBUG] Rendering ${sortedLayers.length} visible layers`);

    // Render each layer
    for (const layer of sortedLayers) {
      const img = loadedImages.get(layer.id);
      if (!img) {
        console.warn(`[DEBUG] Image not loaded for layer: ${layer.name}`);
        continue;
      }

      // Get the current state for drag offset
      const state = useCompositorStore.getState();
      const isDraggingThisLayer = state.ui.isDraggingLayer && 
        (state.ui.dragLayerId === layer.id || 
         state.selectedLayerIds.includes(layer.id) && state.selectedLayerIds.includes(state.ui.dragLayerId!));

      // Use floor to ensure integer positioning for pixel precision
      let x = Math.floor(layer.x);
      let y = Math.floor(layer.y);

      // Apply drag offset for visual feedback during drag
      if (isDraggingThisLayer) {
        x += state.ui.dragOffsetX;
        y += state.ui.dragOffsetY;
      }

      // Apply opacity
      const prevAlpha = ctx.globalAlpha;
      ctx.globalAlpha = layer.opacity !== undefined ? layer.opacity : 1.0;

      ctx.drawImage(img, x, y);
      
      // Restore opacity
      ctx.globalAlpha = prevAlpha;
      
      // console.log(`[DEBUG] Layer rendered: ${layer.name} at (${x}, ${y}) with opacity ${ctx.globalAlpha}`);
    }
  }, [project, loadedImages, isDraggingLayer, dragLayerId, dragOffsetX, dragOffsetY]);

  /**
   * Calculate world coordinates from mouse position
   * This accounts for the canvas transform: translate(-panX*zoom, -panY*zoom) scale(zoom)
   */
  const getWorldCoordinates = (screenX: number, screenY: number): { x: number; y: number } => {
    const container = containerRef.current;
    if (!container) return { x: 0, y: 0 };

    const containerRect = container.getBoundingClientRect();
    
    // Position relative to the container (accounting for 20px padding on container)
    const relativeX = screenX - containerRect.left - 20;
    const relativeY = screenY - containerRect.top - 20;
    
    // The inner div has width: calc(100% - 20px) inside a container with padding 20px
    // So total reduction is 40px (20px padding + 20px from calc)
    const viewportWidth = containerRect.width - 40;
    const viewportHeight = containerRect.height - 40;
    
    const centerX = viewportWidth / 2;
    const centerY = viewportHeight / 2;
    
    const offsetFromCenterX = relativeX - centerX;
    const offsetFromCenterY = relativeY - centerY;
    
    const zoom = project.viewport.zoom / 100;
    const canvasDistX = offsetFromCenterX / zoom;
    const canvasDistY = offsetFromCenterY / zoom;
    
    const canvasCenterX = project.canvas.width / 2;
    const canvasCenterY = project.canvas.height / 2;
    
    const worldX = canvasCenterX + canvasDistX + project.viewport.panX;
    const worldY = canvasCenterY + canvasDistY + project.viewport.panY;
    
    return { x: worldX, y: worldY };
  };

  /**
   * Handle canvas mouse events for layer dragging and panning
   */
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // console.log('[DEBUG] Canvas mouse down event fired');
    const canvas = canvasRef.current;
    if (!canvas) {
      console.warn('[DEBUG] Canvas ref not available');
      return;
    }

    // Middle-click (button 1) for panning
    if (e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      // console.log('[DEBUG] Started panning with middle-click');
      return;
    }

    // Left-click (button 0) for layer selection/dragging or canvas panning
    if (e.button !== 0) {
      // console.log(`[DEBUG] Ignoring mouse button ${e.button}`);
      return;
    }

    const { x: worldX, y: worldY } = getWorldCoordinates(e.clientX, e.clientY);

    // console.log(
    //   `[DEBUG] Left-click at world (${worldX.toFixed(1)}, ${worldY.toFixed(1)})`
    // );

    // Find layer at this position (check in reverse order - top layer first)
    const sortedLayers = [...project.layers]
      .filter((layer) => layer.visible)
      .sort((a, b) => b.zIndex - a.zIndex);

    // console.log(`[DEBUG] Checking ${sortedLayers.length} layers for click intersection`);

    for (const layer of sortedLayers) {
      if (
        worldX >= layer.x &&
        worldX < layer.x + layer.width &&
        worldY >= layer.y &&
        worldY < layer.y + layer.height
      ) {
        // console.log(`[DEBUG] Layer clicked: ${layer.name} at (${layer.x}, ${layer.y}) size (${layer.width}x${layer.height})`);

        // Don't start dragging if layer is locked
        if (layer.locked) {
          // Still allow selection, just not dragging
          selectLayer(layer.id, e.ctrlKey || e.metaKey);
          return;
        }

        const isMultiSelect = e.ctrlKey || e.metaKey;
        
        // If clicking a layer that's already selected (without Ctrl), keep other selections
        // This allows multi-layer dragging by dragging any selected layer
        const isAlreadySelected = selectedLayerIds.includes(layer.id);
        const shouldKeepSelection = isAlreadySelected && !isMultiSelect;
        
        if (!shouldKeepSelection) {
          selectLayer(layer.id, isMultiSelect);
        }
        
        startDraggingLayer(layer.id, worldX, worldY);
        // console.log(`[DEBUG] Started dragging layer: ${layer.name}`);
        return;
      } else {
        // console.log(`[DEBUG] Layer ${layer.name} at (${layer.x}, ${layer.y}) size (${layer.width}x${layer.height}) - no hit`);
      }
    }

    // No layer clicked - start panning with left-click instead
    // console.log('[DEBUG] No layer clicked - starting left-click pan');
    deselectAllLayers();
    setIsPanning(true);
    setPanStart({ x: e.clientX, y: e.clientY });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Track mouse position for drag tooltip
    setMousePos({ x: e.clientX, y: e.clientY });

    const { x: worldX, y: worldY } = getWorldCoordinates(e.clientX, e.clientY);

    // Update hover coordinates
    setHoverCoords({ x: Math.floor(worldX), y: Math.floor(worldY) });

    // Handle middle-click panning
    if (isPanning) {
      const zoom = project.viewport.zoom / 100;
      const deltaX = e.clientX - panStart.x;
      const deltaY = e.clientY - panStart.y;
      
      const newPanX = project.viewport.panX - (deltaX / zoom);
      const newPanY = project.viewport.panY - (deltaY / zoom);
      
      setViewport({ panX: newPanX, panY: newPanY });
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    const isDragging = useCompositorStore.getState().ui.isDraggingLayer;
    if (isDragging) {
      updateDragPosition(worldX, worldY);
    }
  };

  const handleCanvasMouseUp = () => {
    setIsPanning(false);
    stopDraggingLayer();
    // console.log('[DEBUG] Layer drag ended');
  };

  const handleCanvasWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();

    const direction = e.deltaY > 0 ? -1 : 1;
    const currentZoom = project.viewport.zoom;
    const zoomLevels = [25, 33, 50, 66, 75, 100, 125, 150, 200, 400, 800, 1600, 3200];

    let newZoom = currentZoom;
    if (direction > 0) {
      newZoom = zoomLevels.find((z) => z > currentZoom) || zoomLevels[zoomLevels.length - 1];
    } else {
      newZoom =
        [...zoomLevels].reverse().find((z) => z < currentZoom) || zoomLevels[0];
    }

    // console.log(`[DEBUG] Mouse wheel zoom: ${currentZoom}% -> ${newZoom}%`);
    setViewport({ zoom: newZoom });
  };

  return (
    <div
      ref={containerRef}
      id="canvas-renderer"
      className="relative w-full h-full bg-canvas-bg overflow-hidden cursor-crosshair"
      style={{ paddingTop: '20px', paddingLeft: '20px' }}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={handleCanvasMouseUp}
      onMouseLeave={handleCanvasMouseUp}
      onWheel={handleCanvasWheel}
    >
      {/* Canvas container with centering and scrollbars */}
      <div
        className="w-full h-full flex items-center justify-center"
        style={{ width: 'calc(100% - 20px)', height: 'calc(100% - 20px)', overflowX: 'auto', overflowY: 'auto' }}
      >
        <div
          style={{
            transform: `translate(${-project.viewport.panX * (project.viewport.zoom / 100)}px, ${-project.viewport.panY * (project.viewport.zoom / 100)}px) scale(${project.viewport.zoom / 100})`,
            transformOrigin: 'center center',
            position: 'absolute',
          }}
        >
          <canvas
            ref={canvasRef}
            style={{
              imageRendering: 'pixelated',
              backfaceVisibility: 'hidden',
              WebkitFontSmoothing: 'antialiased',
              outline: project.canvas.borderEnabled ? '1px solid rgb(75, 85, 99)' : 'none',
              outlineOffset: '0px',
              boxShadow: project.canvas.shadowIntensity > 0 
                ? `0 10px 40px rgba(0, 0, 0, ${0.5 * project.canvas.shadowIntensity})`
                : 'none',
            }}
          />

          {/* Selection borders overlay - SVG with CSS animation */}
          {showSelectionBorders && selectedLayerIds.length > 0 && (
            <svg
              width={project.canvas.width}
              height={project.canvas.height}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                pointerEvents: 'none',
                overflow: 'visible',
                display: 'block',
              }}
            >
              {project.layers.map((layer) => {
                if (!selectedLayerIds.includes(layer.id)) return null;

                const isDraggingThisLayer = isDraggingLayer && 
                  (dragLayerId === layer.id || 
                   selectedLayerIds.includes(dragLayerId!));

                let x = Math.floor(layer.x);
                let y = Math.floor(layer.y);

                // Apply drag offset for visual feedback during drag
                if (isDraggingThisLayer) {
                  x += dragOffsetX;
                  y += dragOffsetY;
                }

                // Check for text layer and single selection
                const isTextLayer = layer.textContent !== undefined;
                const isShapeLayer = layer.shapeType !== undefined;
                const showEditIcon = (isTextLayer || isShapeLayer) && selectedLayerIds.length === 1;

                return (
                  <g key={layer.id}>
                    {/* Light gray stripe */}
                    <rect
                      x={x-0.12}
                      y={y-0.25}
                      width={layer.width+0.3}
                      height={layer.height+0.3}
                      fill="none"
                      stroke="#b0b0b0"
                      strokeWidth="0.25"
                      strokeDasharray="4,4"
                      style={{
                        animation: borderAnimationSpeed > 0 ? `marching-ants ${8 / (0.125 * borderAnimationSpeed) / 1000}s linear infinite` : 'none',
                      }}
                    />
                    {/* Dark gray stripe offset */}
                    <rect
                      x={x-0.12}
                      y={y-0.25}
                      width={layer.width+0.3}
                      height={layer.height+0.3}
                      fill="none"
                      stroke="#505050"
                      strokeWidth="0.25"
                      strokeDasharray="4,4"
                      strokeDashoffset="2"
                      style={{
                        animation: borderAnimationSpeed > 0 ? `marching-ants ${8 / (0.125 * borderAnimationSpeed) / 1000}s linear infinite` : 'none',
                      }}
                    />
                    
                    {/* Delete Icon (All Layers) */}
                    {showSelectionTools && selectedLayerIds.includes(layer.id) && selectedLayerIds.length === 1 && (
                      <g
                        className="selection-tool-icon"
                        transform={`translate(${x + 4}, ${y - 14})`}
                        style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeLayer(layer.id);
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <circle cx="6" cy="6" r="5" fill="none" stroke="none" pointerEvents="all" />
                        <path
                          d="M4 4l16 16M20 4l-16 16"
                          stroke="#9ca3af"
                          strokeWidth="1"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          transform="scale(0.4)"
                          pointerEvents="none"
                        />
                      </g>
                    )}

                    {/* Visibility Toggle Icon (All Layers) */}
                    {showSelectionTools && selectedLayerIds.includes(layer.id) && selectedLayerIds.length === 1 && (
                      <g
                        className="selection-tool-icon"
                        transform={`translate(${x + 14}, ${y - 14})`}
                        style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          updateLayer(layer.id, { visible: !layer.visible });
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <circle cx="6" cy="6" r="5" fill="none" stroke="none" pointerEvents="all" />
                        {layer.visible ? (
                          <path
                            d="M12 4.5C7.244 4.5 3.226 7.662 1.934 12c1.292 4.338 5.31 7.5 10.066 7.5s8.773-3.162 10.065-7.5c-1.292-4.338-5.31-7.5-10.065-7.5zm0 12a4.5 4.5 0 110-9 4.5 4.5 0 010 9z"
                            fill="#9ca3af"
                            stroke="#4b5563"
                            strokeWidth="0.5"
                            transform="scale(0.4)"
                            pointerEvents="none"
                          />
                        ) : (
                          <g pointerEvents="none">
                            <circle cx="6" cy="6" r="4" fill="none" stroke="#9ca3af" strokeWidth="0.5" />
                            <line x1="2" y1="2" x2="10" y2="10" stroke="#9ca3af" strokeWidth="0.5" />
                          </g>
                        )}
                      </g>
                    )}

                    {/* Edit Icon (Text or Shape) */}
                    {showSelectionTools && showEditIcon && (
                      <g
                        className="selection-tool-icon"
                        transform={`translate(${x + 24}, ${y - 14})`}
                        style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isTextLayer) {
                            (window as any).openTextLayerModal?.(layer);
                          } else if (isShapeLayer) {
                            (window as any).openShapeModal?.(layer);
                          }
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <circle cx="6" cy="6" r="5" fill="none" stroke="none" pointerEvents="all" />
                        <path
                          d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                          fill="#9ca3af"
                          stroke="#4b5563"
                          strokeWidth="0.5"
                          transform="scale(0.4)"
                          pointerEvents="none"
                        />
                      </g>
                    )}
                  </g>
                );
              })}
              <style>{`
                @keyframes marching-ants {
                  0% {
                    stroke-dashoffset: 0;
                  }
                  100% {
                    stroke-dashoffset: -8;
                  }
                }
                .selection-tool-icon {
                  opacity: 0.6;
                  transition: opacity 0.2s ease, filter 0.2s ease;
                }
                .selection-tool-icon:hover {
                  opacity: 1;
                  filter: drop-shadow(0 0 4px rgba(156, 163, 175, 0.8));
                }
              `}</style>
            </svg>
          )}
        </div>

        {/* Grid Overlay - NOT transformed, stays fixed to viewport */}
        <GridOverlay
          canvas={canvasRef.current}
          gridEnabled={project.grid.enabled}
          viewport={project.viewport}
          canvasWidth={project.canvas.width}
          canvasHeight={project.canvas.height}
          gridDensity={project.grid.density}
          canvasBorderEnabled={project.canvas.borderEnabled}
        />
      </div>

      {/* Coordinate Display */}
      <div id="canvas-status-bar" className="absolute bottom-4 right-4 bg-panel-bg border border-border rounded px-3 py-2 text-xs text-gray-400 space-y-1" aria-label="Canvas status">
        <div>Canvas: {project.canvas.width}x{project.canvas.height}</div>
        <div>Zoom: {project.viewport.zoom}%</div>
        <div>Layers: {project.layers.length}</div>
        {hoverCoords && <div>Coords: ({hoverCoords.x}, {hoverCoords.y})</div>}
        <div className="text-gray-500 text-xs mt-2 pt-2 border-t border-border">Middle-click to pan</div>
      </div>

      {/* Selected Layers Info */}
      {selectedLayerIds.length > 0 && (
        <div id="canvas-selection-info" className="absolute top-4 right-4 bg-panel-bg border border-blue-600 rounded px-3 py-2 text-xs text-blue-400" aria-live="polite">
          Selected: {selectedLayerIds.length} layer{selectedLayerIds.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* Drag Info Tooltip */}
      {isDraggingLayer && project.canvas.dragInfoEnabled && (
        <DragInfoTooltip
          offsetX={dragOffsetX}
          offsetY={dragOffsetY}
          mouseX={mousePos.x}
          mouseY={mousePos.y}
        />
      )}
    </div>
  );
}

export default CanvasRenderer;
