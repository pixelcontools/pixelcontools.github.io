import React, { useState, useRef, useEffect, useCallback } from 'react';
import DraggableModal from './DraggableModal';
import useCompositorStore from '../../store/compositorStore';
import { Layer } from '../../types/compositor.types';

interface CropModalProps {
  isOpen: boolean;
  onClose: () => void;
  layer: Layer;
}

const MIN_SIZE = 5;
const PREVIEW_PADDING = 20;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 20;

const CropModal: React.FC<CropModalProps> = ({ isOpen, onClose, layer }) => {
  const updateLayer = useCompositorStore((s) => s.updateLayer);
  const layers = useCompositorStore((s) => s.project.layers);
  const cropCanvasToLayers = useCompositorStore((s) => s.cropCanvasToLayers);

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [cropRect, setCropRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [hasInitialFit, setHasInitialFit] = useState<boolean>(false);

  const imgContainerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const previewBoxRef = useRef<HTMLDivElement | null>(null);
  const previewPanRef = useRef<{ startX: number; startY: number; startScrollLeft: number; startScrollTop: number } | null>(null);
  const stateRef = useRef<{ cropRect: any; zoom: number; imageDimensions: any; isDragging: boolean }>({
    cropRect: null,
    zoom: 1,
    imageDimensions: null,
    isDragging: false,
  });

  useEffect(() => {
    stateRef.current.cropRect = cropRect;
    stateRef.current.zoom = zoom;
    stateRef.current.imageDimensions = imageDimensions;
  }, [cropRect, zoom, imageDimensions]);

  useEffect(() => {
    if (!isOpen || !layer.imageData) return;
    setPreviewImage(layer.imageData);
    setZoom(1);
    setCropRect(null);
    setHasInitialFit(false);
  }, [isOpen, layer.imageData]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const dims = { width: img.naturalWidth, height: img.naturalHeight };
    setImageDimensions(dims);
    setCropRect({ x: 0, y: 0, width: dims.width, height: dims.height });
  };

  const calculateFitZoom = useCallback((width: number, height: number) => {
    if (!previewBoxRef.current) return 1;
    
    const containerWidth = previewBoxRef.current.clientWidth;
    const containerHeight = previewBoxRef.current.clientHeight;
    const availableWidth = containerWidth - PREVIEW_PADDING * 2;
    const availableHeight = containerHeight - PREVIEW_PADDING * 2;
    
    if (availableWidth <= 0 || availableHeight <= 0) return 1;

    const scaleX = availableWidth / width;
    const scaleY = availableHeight / height;
    
    const newZoom = Math.min(scaleX, scaleY);
    return Math.max(MIN_ZOOM, newZoom);
  }, []);

  useEffect(() => {
    if (imageDimensions && previewBoxRef.current && !hasInitialFit) {
      setTimeout(() => {
        const fitZoom = calculateFitZoom(imageDimensions.width, imageDimensions.height);
        setZoom(fitZoom);
        setHasInitialFit(true);
      }, 100);
    }
  }, [imageDimensions, hasInitialFit, calculateFitZoom]);

  const handleMouseDown = (e: React.MouseEvent, dragType: 'move' | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w') => {
    if (e.button !== 0) return;
    e.preventDefault();
    if (!imgRef.current || !stateRef.current.cropRect || !stateRef.current.imageDimensions) return;

    stateRef.current.isDragging = true;
    const startX = e.clientX;
    const startY = e.clientY;
    const startRect = { ...stateRef.current.cropRect };
    const currentZoom = stateRef.current.zoom;
    const imageDims = stateRef.current.imageDimensions;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!stateRef.current.isDragging) return;

      const deltaX = (moveEvent.clientX - startX) / currentZoom;
      const deltaY = (moveEvent.clientY - startY) / currentZoom;

      let newRect = { ...startRect };

      if (dragType === 'move') {
        newRect.x = startRect.x + deltaX;
        newRect.y = startRect.y + deltaY;
      } else {
        // Handle corner/edge resizing
        if (dragType.includes('n')) {
          newRect.y = startRect.y + deltaY;
          newRect.height = startRect.height - deltaY;
        }
        if (dragType.includes('s')) {
          newRect.height = startRect.height + deltaY;
        }
        if (dragType.includes('w')) {
          newRect.x = startRect.x + deltaX;
          newRect.width = startRect.width - deltaX;
        }
        if (dragType.includes('e')) {
          newRect.width = startRect.width + deltaX;
        }
      }

      // Clamp and validate
      newRect.x = Math.max(0, Math.min(newRect.x, imageDims.width - MIN_SIZE));
      newRect.y = Math.max(0, Math.min(newRect.y, imageDims.height - MIN_SIZE));
      newRect.width = Math.max(MIN_SIZE, Math.min(newRect.width, imageDims.width - newRect.x));
      newRect.height = Math.max(MIN_SIZE, Math.min(newRect.height, imageDims.height - newRect.y));

      setCropRect(newRect);
      stateRef.current.cropRect = newRect;
    };

    const handleMouseUp = () => {
      stateRef.current.isDragging = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const zoomAtPoint = useCallback((updater: (previousZoom: number) => number, origin?: { x: number; y: number }) => {
    setZoom((previousZoom) => {
      const nextZoom = updater(previousZoom);
      const container = previewBoxRef.current;
      if (!container) return nextZoom;

      const viewportX = origin?.x ?? container.clientWidth / 2;
      const viewportY = origin?.y ?? container.clientHeight / 2;
      const imageX = (container.scrollLeft + viewportX - PREVIEW_PADDING) / previousZoom;
      const imageY = (container.scrollTop + viewportY - PREVIEW_PADDING) / previousZoom;

      requestAnimationFrame(() => {
        const currentContainer = previewBoxRef.current;
        if (!currentContainer) return;
        currentContainer.scrollLeft = imageX * nextZoom + PREVIEW_PADDING - viewportX;
        currentContainer.scrollTop = imageY * nextZoom + PREVIEW_PADDING - viewportY;
      });

      return nextZoom;
    });
  }, []);

  const handleZoomIn = () => zoomAtPoint((previousZoom) => Math.min(MAX_ZOOM, previousZoom + 0.5));
  const handleZoomOut = () => zoomAtPoint((previousZoom) => Math.max(MIN_ZOOM, previousZoom - 0.5));
  const handleFitToScreen = () => {
    if (imageDimensions) {
      setZoom(calculateFitZoom(imageDimensions.width, imageDimensions.height));
    }
  };
  const handleResetZoom = () => zoomAtPoint(() => 1);

  const handlePreviewMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 1) return;
    const container = previewBoxRef.current;
    if (!container) return;
    e.preventDefault();
    previewPanRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startScrollLeft: container.scrollLeft,
      startScrollTop: container.scrollTop,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const panState = previewPanRef.current;
      const currentContainer = previewBoxRef.current;
      if (!panState || !currentContainer) return;
      currentContainer.scrollLeft = panState.startScrollLeft - (moveEvent.clientX - panState.startX);
      currentContainer.scrollTop = panState.startScrollTop - (moveEvent.clientY - panState.startY);
    };

    const handleMouseUp = () => {
      previewPanRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, []);

  const handlePreviewWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const container = previewBoxRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    zoomAtPoint(
      (previousZoom) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, previousZoom * (e.deltaY < 0 ? 1.15 : 0.87))),
      { x: e.clientX - rect.left, y: e.clientY - rect.top }
    );
  }, [zoomAtPoint]);

  const findTransparentBounds = async () => {
    if (!previewImage || !imageDimensions) return;

    const img = new Image();
    img.src = previewImage;
    await new Promise((res) => {
      img.onload = res;
      img.onerror = res;
    });

    const canvas = document.createElement('canvas');
    canvas.width = imageDimensions.width;
    canvas.height = imageDimensions.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, imageDimensions.width, imageDimensions.height);
    const data = imageData.data;

    let minX = imageDimensions.width;
    let minY = imageDimensions.height;
    let maxX = -1;
    let maxY = -1;

    // Find bounds of non-transparent pixels
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      if (alpha > 0) {
        const pixelIndex = i / 4;
        const x = pixelIndex % imageDimensions.width;
        const y = Math.floor(pixelIndex / imageDimensions.width);

        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }

    // If no non-transparent pixels found, keep current crop
    if (maxX < minX || maxY < minY) {
      return;
    }

    const newRect = {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };

    setCropRect(newRect);
    stateRef.current.cropRect = newRect;
  };

  const applyCrop = async () => {
    if (!cropRect || !imageDimensions || !previewImage) return;
    const img = new Image();
    img.src = previewImage;
    await new Promise((res) => { img.onload = res; img.onerror = res; });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(cropRect.width);
    canvas.height = Math.round(cropRect.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      img,
      Math.round(cropRect.x),
      Math.round(cropRect.y),
      Math.round(cropRect.width),
      Math.round(cropRect.height),
      0,
      0,
      Math.round(cropRect.width),
      Math.round(cropRect.height)
    );
    const dataUrl = canvas.toDataURL();
    updateLayer(layer.id, { imageData: dataUrl, width: Math.round(cropRect.width), height: Math.round(cropRect.height) });
    // Auto-crop canvas when there's only one layer
    if (layers.length === 1) {
      setTimeout(() => { cropCanvasToLayers(); window.fitCanvasToScreen?.(); }, 50);
    }
    onClose();
  };

  // render
  return (
    <DraggableModal isOpen={isOpen} title="Crop" onClose={onClose} modalId="modal-crop">
      <div className="flex flex-col h-full p-4 gap-4 text-gray-200">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Preview</label>
          <div className="flex items-center gap-2">
            <button
              id="btn-crop-zoom-out"
              onClick={handleZoomOut}
              disabled={zoom <= MIN_ZOOM}
              className="p-1 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Zoom out"
              aria-label="Zoom out"
            >
              −
            </button>
            <span className="text-xs text-gray-400 min-w-[45px] text-center">{Math.round(zoom * 100)}%</span>
            <button
              id="btn-crop-zoom-in"
              onClick={handleZoomIn}
              disabled={zoom >= MAX_ZOOM}
              className="p-1 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Zoom in"
              aria-label="Zoom in"
            >
              +
            </button>
            <button
              id="btn-crop-zoom-fit"
              onClick={handleFitToScreen}
              className="text-xs px-2 py-1 text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 rounded transition-colors"
              title="Fit to screen"
              aria-label="Fit preview to screen"
            >
              Fit
            </button>
            <button
              id="btn-crop-zoom-reset"
              onClick={handleResetZoom}
              className="text-xs px-2 py-1 text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 rounded transition-colors"
              title="Reset zoom"
              aria-label="Reset zoom"
            >
              Reset
            </button>
            <button
              id="btn-crop-auto"
              onClick={findTransparentBounds}
              className="text-xs px-2 py-1 text-cyan-200 bg-cyan-900 hover:bg-cyan-800 rounded transition-colors"
              title="Auto-crop to remove transparent edges"
              aria-label="Auto-crop transparent edges"
            >
              Auto
            </button>
          </div>
        </div>

        <div className="flex gap-4 text-xs text-gray-400">
          <div>
            <span className="text-gray-500">Original:</span> {imageDimensions ? `${imageDimensions.width}×${imageDimensions.height}` : '—'}
          </div>
          <div>
            <span className="text-gray-500">Crop:</span> {cropRect ? `${Math.round(cropRect.width)}×${Math.round(cropRect.height)}` : '—'}
          </div>
          <div className="text-gray-500">Scroll to zoom • Middle-drag to pan</div>
        </div>

        <div
          className="flex-1 relative w-full bg-gray-900 rounded border border-gray-700 overflow-auto"
          ref={previewBoxRef}
          onMouseDown={handlePreviewMouseDown}
          onAuxClick={(e) => { if (e.button === 1) e.preventDefault(); }}
          onWheel={handlePreviewWheel}
        >
          {previewImage ? (
            <div ref={imgContainerRef} style={{ display: 'inline-block', padding: PREVIEW_PADDING, position: 'relative' }}>
              <img
                ref={imgRef}
                src={previewImage}
                alt="Preview"
                onLoad={handleImageLoad}
                style={{
                  width: imageDimensions ? `${imageDimensions.width * zoom}px` : 'auto',
                  height: imageDimensions ? `${imageDimensions.height * zoom}px` : 'auto',
                  display: 'block',
                  maxWidth: 'none',
                  userSelect: 'none',
                  imageRendering: 'pixelated',
                }}
              />

              {imageDimensions && cropRect && (
                <div
                  style={{
                    position: 'absolute',
                    left: PREVIEW_PADDING + cropRect.x * zoom,
                    top: PREVIEW_PADDING + cropRect.y * zoom,
                    width: Math.max(0, cropRect.width * zoom),
                    height: Math.max(0, cropRect.height * zoom),
                    boxSizing: 'border-box',
                    border: '2px dashed rgba(100,200,255,0.8)',
                    pointerEvents: 'none',
                  }}
                >
                  {/* Center move area */}
                  <div
                    onMouseDown={(e) => handleMouseDown(e, 'move')}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      cursor: 'move',
                      pointerEvents: 'auto',
                      background: 'rgba(100,200,255,0.05)',
                    }}
                  />

                  {/* Handles */}
                  {[
                    { type: 'nw', left: -6, top: -6, cursorStyle: 'nw-resize' },
                    { type: 'n', left: '50%', top: -6, transform: 'translateX(-50%)', cursorStyle: 'n-resize' },
                    { type: 'ne', right: -6, top: -6, cursorStyle: 'ne-resize' },
                    { type: 'e', right: -6, top: '50%', transform: 'translateY(-50%)', cursorStyle: 'e-resize' },
                    { type: 'se', right: -6, bottom: -6, cursorStyle: 'se-resize' },
                    { type: 's', left: '50%', bottom: -6, transform: 'translateX(-50%)', cursorStyle: 's-resize' },
                    { type: 'sw', left: -6, bottom: -6, cursorStyle: 'sw-resize' },
                    { type: 'w', left: -6, top: '50%', transform: 'translateY(-50%)', cursorStyle: 'w-resize' },
                  ].map(({ type, cursorStyle, ...pos }) => (
                    <div
                      key={type}
                      onMouseDown={(e) => handleMouseDown(e, type as any)}
                      style={{
                        position: 'absolute',
                        width: 12,
                        height: 12,
                        background: '#fff',
                        border: '1px solid #000',
                        borderRadius: 2,
                        cursor: cursorStyle,
                        pointerEvents: 'auto',
                        boxSizing: 'border-box',
                        ...(pos as any),
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-gray-500">No preview available</div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-700">
          <button
            id="btn-crop-cancel"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 rounded hover:bg-gray-600 transition-colors"
            aria-label="Cancel crop"
          >
            Cancel
          </button>
          <button
            id="btn-crop-apply"
            onClick={applyCrop}
            disabled={!cropRect}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Apply crop"
          >
            Apply
          </button>
        </div>
      </div>
    </DraggableModal>
  );
};

export default CropModal;
