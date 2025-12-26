import React, { useState, useEffect, useRef } from 'react';
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
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const updateLayer = useCompositorStore((state) => state.updateLayer);

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

    setHasInitialFit(false);
    return () => clearTimeout(timer);
  }, [threshold, layer.imageData, isOpen]);

  const handleApply = async () => {
    if (layer.imageData) {
      try {
        const result = await applyTransparencyMask(layer.imageData, threshold, useTemplatePalette);
        updateLayer(layer.id, { imageData: result });
        onClose();
      } catch (error) {
        console.error('Failed to apply transparency mask with palette reduction:', error);
      }
    }
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.25, 0.1));
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

  const handleResetZoom = () => {
    if (imageDimensions) {
      setZoom(calculateFitZoom(imageDimensions.width, imageDimensions.height));
    } else {
      setZoom(1);
    }
  };

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
  }, [imageDimensions, hasInitialFit]);

  return (
    <DraggableModal isOpen={isOpen} title="Transparency Mask" onClose={onClose}>
      <div className="flex flex-col h-full p-4 gap-4 text-gray-200">
        {/* Preview Container with Zoom and Scroll */}
        <div className="flex-1 flex flex-col min-h-0 gap-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Preview</label>
            <div className="flex items-center gap-2">
              <button
                onClick={handleZoomOut}
                disabled={zoom <= 0.1}
                className="p-1 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Zoom out"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                </svg>
              </button>
              <span className="text-xs text-gray-400 min-w-[45px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                disabled={zoom >= 3}
                className="p-1 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Zoom in"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                </svg>
              </button>
              <button
                onClick={handleResetZoom}
                className="text-xs px-2 py-1 text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                title="Reset zoom"
              >
                Reset
              </button>
            </div>
          </div>
          <div
            ref={previewContainerRef}
            className="flex-1 relative w-full bg-gray-900 rounded border border-gray-700 overflow-auto"
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
                  padding: '10px',
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
              <label htmlFor="threshold-slider">Mask Threshold: {threshold}</label>
            </div>
            <input
              id="threshold-slider"
              type="range"
              min="0"
              max="255"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <p className="text-xs text-gray-400">
              0=Opaque, 255=Transparent
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                id="use-template-colors"
                type="checkbox"
                checked={useTemplatePalette}
                onChange={(e) => setUseTemplatePalette(e.target.checked)}
                className="w-4 h-4 rounded bg-gray-700 border-gray-600 accent-blue-500 cursor-pointer"
              />
              <label htmlFor="use-template-colors" className="text-sm text-gray-300 cursor-pointer">
                Use template colors
              </label>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 rounded hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                disabled={!previewImage || isProcessing}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
