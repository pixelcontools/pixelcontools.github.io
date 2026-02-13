import React, { useEffect, useRef, useState } from 'react';
import DraggableModal from './DraggableModal';
import useCompositorStore from '../../store/compositorStore';
import { Layer } from '../../types/compositor.types';
import { removeBackground } from '../../utils/imageProcessing';

interface BgRemovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  layer: Layer;
}

const BgRemovalModal: React.FC<BgRemovalModalProps> = ({ isOpen, onClose, layer }) => {
  const updateLayer = useCompositorStore((state) => state.updateLayer);
  const [tolerance, setTolerance] = useState<number>(30);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [zoom, setZoom] = useState<number>(1);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [makeHeatmap, setMakeHeatmap] = useState<boolean>(false);
  const [hasInitialFit, setHasInitialFit] = useState<boolean>(false);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen || !layer?.imageData) return;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(async () => {
      setIsProcessing(true);
      try {
        const result = await removeBackground(layer.imageData, tolerance, makeHeatmap);
        setPreviewImage(result);
      } catch (err) {
        console.error('BG removal preview failed:', err);
      } finally {
        setIsProcessing(false);
      }
    }, 120);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [isOpen, layer?.imageData, tolerance, makeHeatmap]);

  const handleApply = async () => {
    if (!layer?.imageData) return;
    setIsProcessing(true);
    try {
      // Apply actual removal (no heatmap)
      const result = await removeBackground(layer.imageData, tolerance, false);
      updateLayer(layer.id, { imageData: result });
      onClose();
    } catch (err) {
      console.error('BG removal apply failed:', err);
      alert('Background removal failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
  };

  const calculateFitZoom = (width: number, height: number) => {
    if (!previewContainerRef.current) return 1;
    const containerWidth = previewContainerRef.current.clientWidth;
    const containerHeight = previewContainerRef.current.clientHeight;
    if (containerWidth <= 0 || containerHeight <= 0) return 1;
    const scaleX = containerWidth / width;
    const scaleY = containerHeight / height;
    const newZoom = Math.min(scaleX, scaleY);
    return Math.max(0.1, newZoom * 0.9);
  };

  useEffect(() => {
    if (imageDimensions && previewContainerRef.current && !hasInitialFit) {
      setTimeout(() => {
        const fitZoom = calculateFitZoom(imageDimensions.width, imageDimensions.height);
        setZoom(fitZoom);
        setHasInitialFit(true);
      }, 100);
    }
  }, [imageDimensions, hasInitialFit]);

  return (
    <DraggableModal isOpen={isOpen} title="BG Removal" onClose={onClose} modalId="modal-bg-removal">
      <div className="flex flex-col h-full p-4 gap-4 text-gray-200">
        <div className="flex-1 flex flex-col min-h-0 gap-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Preview</label>
            <div className="flex items-center gap-2">
              <button
                id="btn-bgremoval-zoom-out"
                onClick={() => setZoom((z) => Math.max(z - 0.25, 0.1))}
                className="p-1 text-gray-400 hover:text-white transition-colors"
                title="Zoom out"
                aria-label="Zoom out"
              >
                −
              </button>
              <span className="text-xs text-gray-400 min-w-[45px] text-center">{Math.round(zoom * 100)}%</span>
              <button
                id="btn-bgremoval-zoom-in"
                onClick={() => setZoom((z) => Math.min(z + 0.25, 3))}
                className="p-1 text-gray-400 hover:text-white transition-colors"
                title="Zoom in"
                aria-label="Zoom in"
              >
                +
              </button>
              <button
                id="btn-bgremoval-zoom-reset"
                onClick={() => {
                  if (imageDimensions) setZoom(calculateFitZoom(imageDimensions.width, imageDimensions.height));
                }}
                className="text-xs px-2 py-1 text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                title="Reset zoom"
                aria-label="Reset zoom"
              >
                Reset
              </button>
            </div>
          </div>

          <div ref={previewContainerRef} className="flex-1 relative w-full bg-gray-900 rounded border border-gray-700 overflow-auto">
            {isProcessing && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                <span className="text-white font-medium">Processing...</span>
              </div>
            )}

            {previewImage ? (
              <div style={{ display: 'inline-block', padding: '10px' }}>
                <img
                  ref={imgRef}
                  src={previewImage}
                  alt="Preview"
                  onLoad={handleImageLoad}
                  style={{
                    width: imageDimensions ? `${imageDimensions.width * zoom}px` : 'auto',
                    height: imageDimensions ? `${imageDimensions.height * zoom}px` : 'auto',
                    transition: 'width 0.1s ease-out, height 0.1s ease-out',
                    maxWidth: 'none',
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
              <label htmlFor="input-bgremoval-tolerance">Tolerance: {tolerance}</label>
            </div>
            <input
              id="input-bgremoval-tolerance"
              type="range"
              min="0"
              max="255"
              value={tolerance}
              onChange={(e) => setTolerance(Number(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              aria-label="Background removal tolerance"
            />
            <p className="text-xs text-gray-400">Adjust color tolerance for background selection</p>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                id="input-bgremoval-heatmap"
                type="checkbox"
                checked={makeHeatmap}
                onChange={(e) => setMakeHeatmap(e.target.checked)}
                className="w-4 h-4 rounded bg-gray-700 border-gray-600 accent-blue-500 cursor-pointer"
                aria-label="Show heatmap"
              />
              <label htmlFor="input-bgremoval-heatmap" className="text-sm text-gray-300 cursor-pointer">Show heatmap (red = kept pixels)</label>
            </div>

            <div className="flex space-x-2">
              <button
                id="btn-bgremoval-cancel"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 rounded hover:bg-gray-600 transition-colors"
                aria-label="Cancel background removal"
              >
                Cancel
              </button>
              <button
                id="btn-bgremoval-apply"
                onClick={handleApply}
                disabled={!previewImage || isProcessing}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Apply background removal"
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

export default BgRemovalModal;
