import React, { useState, useEffect, useRef, useCallback } from 'react';
import DraggableModal from './DraggableModal';
import { applyTransparencyMask } from '../../utils/imageProcessing';
import useCompositorStore from '../../store/compositorStore';
import { Layer } from '../../types/compositor.types';

interface TransparencyMaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  layer: Layer;
}

const TransparencyMaskModal: React.FC<TransparencyMaskModalProps> = ({
  isOpen,
  onClose,
  layer,
}) => {
  const [threshold, setThreshold] = useState<number>(128);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [zoom, setZoom] = useState<number>(1);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [useTemplatePalette, setUseTemplatePalette] = useState<boolean>(true);
  const [hasInitialFit, setHasInitialFit] = useState<boolean>(false);
  const [pinFitToScreen, setPinFitToScreen] = useState<boolean>(true);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const previewPanRef = useRef<{ startX: number; startY: number; startScrollLeft: number; startScrollTop: number } | null>(null);
  const updateLayer = useCompositorStore((state) => state.updateLayer);
  const layers = useCompositorStore((state) => state.project.layers);
  const cropCanvasToLayers = useCompositorStore((state) => state.cropCanvasToLayers);

  const previewPadding = 20;
  const minZoom = 0.1;
  const maxZoom = 20;

  useEffect(() => {
    if (!isOpen || !layer.imageData) return;
    setPreviewImage(null);
    setImageDimensions(null);
    setZoom(1);
    setHasInitialFit(false);
  }, [isOpen, layer.id, layer.imageData]);

  useEffect(() => {
    if (!isOpen || !layer.imageData) return;

    const timer = setTimeout(async () => {
      setIsProcessing(true);
      try {
        const result = await applyTransparencyMask(layer.imageData, threshold, false);
        setPreviewImage(result);
      } catch (error) {
        console.error('Failed to apply transparency mask:', error);
      } finally {
        setIsProcessing(false);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [threshold, layer.imageData, isOpen]);

  const handleApply = async () => {
    if (layer.imageData) {
      try {
        const result = await applyTransparencyMask(layer.imageData, threshold, useTemplatePalette);
        updateLayer(layer.id, { imageData: result });
        // Auto-crop canvas when there's only one layer
        if (layers.length === 1) {
          setTimeout(() => { cropCanvasToLayers(); window.fitCanvasToScreen?.(); }, 50);
        }
        onClose();
      } catch (error) {
        console.error('Failed to apply transparency mask with palette reduction:', error);
      }
    }
  };

  const calculateFitZoom = useCallback((width: number, height: number) => {
    if (!previewContainerRef.current) return 1;
    
    const containerWidth = previewContainerRef.current.clientWidth;
    const containerHeight = previewContainerRef.current.clientHeight;
    const availableWidth = containerWidth - previewPadding * 2;
    const availableHeight = containerHeight - previewPadding * 2;
    
    if (availableWidth <= 0 || availableHeight <= 0) return 1;

    const scaleX = availableWidth / width;
    const scaleY = availableHeight / height;
    
    const newZoom = Math.min(scaleX, scaleY);
    return Math.max(minZoom, newZoom);
  }, []);

  const zoomAtPoint = useCallback((updater: (previousZoom: number) => number, origin?: { x: number; y: number }) => {
    setZoom((previousZoom) => {
      const nextZoom = updater(previousZoom);
      const container = previewContainerRef.current;
      if (!container) return nextZoom;

      const viewportX = origin?.x ?? container.clientWidth / 2;
      const viewportY = origin?.y ?? container.clientHeight / 2;
      const imageX = (container.scrollLeft + viewportX - previewPadding) / previousZoom;
      const imageY = (container.scrollTop + viewportY - previewPadding) / previousZoom;

      requestAnimationFrame(() => {
        const currentContainer = previewContainerRef.current;
        if (!currentContainer) return;
        currentContainer.scrollLeft = imageX * nextZoom + previewPadding - viewportX;
        currentContainer.scrollTop = imageY * nextZoom + previewPadding - viewportY;
      });

      return nextZoom;
    });
  }, []);

  const handleZoomIn = () => {
    zoomAtPoint((previousZoom) => Math.min(previousZoom + 0.5, maxZoom));
  };

  const handleZoomOut = () => {
    zoomAtPoint((previousZoom) => Math.max(previousZoom - 0.5, minZoom));
  };

  const handleFitToScreen = useCallback(() => {
    if (imageDimensions) {
      setZoom(calculateFitZoom(imageDimensions.width, imageDimensions.height));
    }
  }, [imageDimensions, calculateFitZoom]);

  const handleResetZoom = () => {
    zoomAtPoint(() => 1);
  };

  const handlePreviewMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 1) return;
    const container = previewContainerRef.current;
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
      const currentContainer = previewContainerRef.current;
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
    const container = previewContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    zoomAtPoint(
      (previousZoom) => Math.max(minZoom, Math.min(maxZoom, previousZoom * (e.deltaY < 0 ? 1.15 : 0.87))),
      { x: e.clientX - rect.left, y: e.clientY - rect.top }
    );
  }, [zoomAtPoint]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageDimensions({
      width: img.naturalWidth,
      height: img.naturalHeight,
    });
  };

  useEffect(() => {
    if (imageDimensions && previewContainerRef.current && !hasInitialFit) {
      setTimeout(() => {
        const fitZoom = calculateFitZoom(imageDimensions.width, imageDimensions.height);
        setZoom(fitZoom);
        setHasInitialFit(true);
      }, 100);
    }
  }, [imageDimensions, hasInitialFit, calculateFitZoom]);

  useEffect(() => {
    if (pinFitToScreen && hasInitialFit) {
      handleFitToScreen();
    }
  }, [pinFitToScreen, imageDimensions, hasInitialFit, handleFitToScreen]);

  return (
    <DraggableModal isOpen={isOpen} title="Transparency Mask" onClose={onClose} modalId="modal-transparency-mask">
      <div className="flex flex-col h-full p-4 gap-4 text-gray-200">
        {/* Preview Container with Zoom and Scroll */}
        <div className="flex-1 flex flex-col min-h-0 gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium">Preview</label>
              <label className="flex items-center gap-1 cursor-pointer" title="Always fit preview after the mask updates">
                <input
                  type="checkbox"
                  checked={pinFitToScreen}
                  onChange={(e) => setPinFitToScreen(e.target.checked)}
                  className="rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-800"
                />
                <span className="text-xs text-gray-400 select-none">Pin Fit</span>
              </label>
              <span className="text-xs text-gray-500 hidden sm:inline">Scroll to zoom • Middle-drag to pan</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                id="btn-tmask-zoom-out"
                onClick={handleZoomOut}
                disabled={zoom <= minZoom}
                className="p-1 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Zoom out"
                aria-label="Zoom out"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                </svg>
              </button>
              <span className="text-xs text-gray-400 min-w-[45px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                id="btn-tmask-zoom-in"
                onClick={handleZoomIn}
                disabled={zoom >= maxZoom}
                className="p-1 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Zoom in"
                aria-label="Zoom in"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                </svg>
              </button>
              <button
                id="btn-tmask-zoom-fit"
                onClick={handleFitToScreen}
                className="text-xs px-2 py-1 text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                title="Fit to screen"
                aria-label="Fit preview to screen"
              >
                Fit
              </button>
              <button
                id="btn-tmask-zoom-reset"
                onClick={handleResetZoom}
                className="text-xs px-2 py-1 text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                title="Reset zoom"
                aria-label="Reset zoom"
              >
                Reset
              </button>
            </div>
          </div>
          <div
            ref={previewContainerRef}
            className="flex-1 relative w-full bg-gray-900 rounded border border-gray-700 overflow-auto"
            onMouseDown={handlePreviewMouseDown}
            onAuxClick={(e) => { if (e.button === 1) e.preventDefault(); }}
            onWheel={handlePreviewWheel}
          >
            {isProcessing && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                <span className="text-white font-medium">Processing...</span>
              </div>
            )}
            {previewImage ? (
              <div 
                style={{
                  display: 'inline-block',
                  padding: `${previewPadding}px`,
                }}
              >
                <img
                  ref={imgRef}
                  src={previewImage}
                  alt="Preview"
                  onLoad={handleImageLoad}
                  style={{
                    width: imageDimensions ? `${imageDimensions.width * zoom}px` : 'auto',
                    height: imageDimensions ? `${imageDimensions.height * zoom}px` : 'auto',
                    maxWidth: 'none',
                    imageRendering: 'pixelated',
                  }}
                />
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-gray-500">No preview available</div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 pt-4 border-t border-gray-700">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <label htmlFor="input-tmask-threshold">Mask Threshold: {threshold}</label>
            </div>
            <input
              id="input-tmask-threshold"
              type="range"
              min="0"
              max="255"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              aria-label="Mask threshold"
            />
            <p className="text-xs text-gray-400">
              0=Opaque, 255=Transparent
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                id="input-tmask-template-colors"
                type="checkbox"
                checked={useTemplatePalette}
                onChange={(e) => setUseTemplatePalette(e.target.checked)}
                className="w-4 h-4 rounded bg-gray-700 border-gray-600 accent-blue-500 cursor-pointer"
                aria-label="Use template colors"
              />
              <label htmlFor="input-tmask-template-colors" className="text-sm text-gray-300 cursor-pointer">
                Use template colors
              </label>
            </div>

            <div className="flex space-x-2">
              <button
                id="btn-tmask-cancel"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 rounded hover:bg-gray-600 transition-colors"
                aria-label="Cancel transparency mask"
              >
                Cancel
              </button>
              <button
                id="btn-tmask-apply"
                onClick={handleApply}
                disabled={!previewImage || isProcessing}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Apply transparency mask"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      </div>
    </DraggableModal>
  );
};

export default TransparencyMaskModal;
