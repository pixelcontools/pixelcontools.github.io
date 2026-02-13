import React, { useState, useEffect, useRef } from 'react';
import DraggableModal from './DraggableModal';
import { usePortraitMode } from '../../hooks/usePortraitMode';
import useCompositorStore from '../../store/compositorStore';
import { Layer } from '../../types/compositor.types';
import { rasterizeShape } from '../../utils/shapeRasterizer';

interface ShapeModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingLayer?: Layer;
}

const CANVAS_PREVIEW_LAYER_ID = '__shape_canvas_preview__';
const SHAPE_TYPES = ['rectangle', 'circle', 'triangle', 'hexagon', 'octagon', 'star'] as const;

const ShapeModal: React.FC<ShapeModalProps> = ({ isOpen, onClose, existingLayer }) => {
  const addLayer = useCompositorStore((state) => state.addLayer);
  const updateLayer = useCompositorStore((state) => state.updateLayer);
  const removeLayer = useCompositorStore((state) => state.removeLayer);
  const isPortrait = usePortraitMode();

  const [shapeType, setShapeType] = useState<'rectangle' | 'circle' | 'triangle' | 'hexagon' | 'octagon' | 'star'>('rectangle');
  const [size, setSize] = useState<number>(200);
  const [stretchX, setStretchX] = useState<number>(1);
  const [stretchY, setStretchY] = useState<number>(1);
  const [color, setColor] = useState<string>('#FFFFFF');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [previewOnCanvas, setPreviewOnCanvas] = useState<boolean>(true);
  const [previewX, setPreviewX] = useState<number>(0);
  const [previewY, setPreviewY] = useState<number>(0);

  const previewUpdateTimeoutRef = useRef<number | null>(null);
  const originalVisibilityRef = useRef<boolean>(true);

  // Load existing layer data if editing
  useEffect(() => {
    if (existingLayer && existingLayer.shapeType !== undefined) {
      setShapeType(existingLayer.shapeType);
      setSize(existingLayer.shapeSize || 200);
      setStretchX(existingLayer.shapeStretchX || 1);
      setStretchY(existingLayer.shapeStretchY || 1);
      setColor(existingLayer.shapeColor || '#FFFFFF');
      setPreviewX(existingLayer.x);
      setPreviewY(existingLayer.y);
      originalVisibilityRef.current = existingLayer.visible;
    }
  }, [existingLayer]);
  // Auto-generate preview when inputs change (only if modal is open)
  useEffect(() => {
    if (!isOpen) return;
    generatePreview();
  }, [shapeType, size, stretchX, stretchY, color, isOpen]);

  // Handle canvas preview
  useEffect(() => {
    if (previewOnCanvas && previewImage) {
      // Hide existing layer immediately to avoid duplicates
      if (existingLayer) {
        const currentLayers = useCompositorStore.getState().project.layers;
        const currentLayer = currentLayers.find(l => l.id === existingLayer.id);
        if (currentLayer && currentLayer.visible) {
          updateLayer(existingLayer.id, { visible: false });
        }
      }

      updateCanvasPreview();
    } else {
      removeCanvasPreview();
    }
  }, [previewOnCanvas, previewImage, previewX, previewY]);

  // Sync preview position from store (handles dragging on canvas)
  useEffect(() => {
    if (!previewOnCanvas) return;

    const unsubscribe = useCompositorStore.subscribe((state) => {
      const previewLayer = state.project.layers.find(l => l.id === CANVAS_PREVIEW_LAYER_ID);
      if (previewLayer) {
        // Only update if position changed significantly to avoid loops
        if (Math.abs(previewLayer.x - previewX) > 0.1 || Math.abs(previewLayer.y - previewY) > 0.1) {
          setPreviewX(previewLayer.x);
          setPreviewY(previewLayer.y);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [previewOnCanvas, previewX, previewY]);

  // Clean up canvas preview when modal closes
  useEffect(() => {
    if (!isOpen) {
      removeCanvasPreview();
    }
  }, [isOpen]);

  const generatePreview = async () => {
    setIsProcessing(true);

    try {
      const result = await rasterizeShape({
        shapeType,
        size,
        stretchX,
        stretchY,
        color,
      });

      setPreviewImage(result.dataUrl);
    } catch (error) {
      console.error('Failed to generate shape preview:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const updateCanvasPreview = () => {
    if (!previewImage || !previewOnCanvas) return;

    // Cancel any pending preview update
    if (previewUpdateTimeoutRef.current !== null) {
      clearTimeout(previewUpdateTimeoutRef.current);
    }

    // Debounce the preview update to avoid race conditions
    previewUpdateTimeoutRef.current = window.setTimeout(() => {
      const img = new Image();
      img.src = previewImage;
      img.onload = () => {
        const latestLayers = useCompositorStore.getState().project.layers;
        const stillExists = latestLayers.find(l => l.id === CANVAS_PREVIEW_LAYER_ID);

        if (stillExists) {
          // Update existing preview layer
          updateLayer(CANVAS_PREVIEW_LAYER_ID, {
            imageData: previewImage,
            width: img.naturalWidth,
            height: img.naturalHeight,
            opacity: 0.7,
            x: previewX,
            y: previewY
          });
        } else if (previewOnCanvas) {
          // Only create new preview layer if preview is still enabled and doesn't exist
          const previewLayer: Layer = {
            id: CANVAS_PREVIEW_LAYER_ID,
            name: '🔍 Canvas Preview (Temporary)',
            imageData: previewImage,
            x: previewX,
            y: previewY,
            zIndex: Date.now() + 1000000,
            visible: true,
            locked: false, // Allow dragging
            opacity: 0.7,
            width: img.naturalWidth,
            height: img.naturalHeight
          };
          addLayer(previewLayer);
        }
      };
    }, 50);
  };

  const removeCanvasPreview = () => {
    if (previewUpdateTimeoutRef.current !== null) {
      clearTimeout(previewUpdateTimeoutRef.current);
      previewUpdateTimeoutRef.current = null;
    }

    const currentLayers = useCompositorStore.getState().project.layers;
    const preview = currentLayers.find(l => l.id === CANVAS_PREVIEW_LAYER_ID);

    if (preview) {
      removeLayer(CANVAS_PREVIEW_LAYER_ID);
    }

    // Restore original layer visibility if we were editing
    if (existingLayer) {
      const currentLayer = useCompositorStore
        .getState()
        .project.layers.find(l => l.id === existingLayer.id);
      if (currentLayer && !currentLayer.visible) {
        updateLayer(existingLayer.id, { visible: originalVisibilityRef.current });
      }
    }
  };

  const handleCreateShape = async () => {
    if (!previewImage) return;

    setIsProcessing(true);

    try {
      const result = await rasterizeShape({
        shapeType,
        size,
        stretchX,
        stretchY,
        color,
      });

      const layerX = previewOnCanvas ? previewX : -result.offsetX;
      const layerY = previewOnCanvas ? previewY : -result.offsetY;

      if (existingLayer) {
        // Update existing layer
        updateLayer(existingLayer.id, {
          imageData: result.dataUrl,
          width: result.width,
          height: result.height,
          x: layerX,
          y: layerY,
          shapeType,
          shapeSize: size,
          shapeStretchX: stretchX,
          shapeStretchY: stretchY,
          shapeColor: color,
          name: existingLayer.name,
        } as any);
      } else {
        // Create new layer
        const newLayer: Layer = {
          id: crypto.randomUUID(),
          name: `Shape: ${shapeType}`,
          imageData: result.dataUrl,
          x: layerX,
          y: layerY,
          zIndex: Date.now(),
          visible: true,
          locked: false,
          opacity: 1,
          width: result.width,
          height: result.height,
          shapeType,
          shapeSize: size,
          shapeStretchX: stretchX,
          shapeStretchY: stretchY,
          shapeColor: color,
        } as any;

        addLayer(newLayer);
      }

      // Remove canvas preview before closing
      removeCanvasPreview();
      onClose();
    } catch (error) {
      console.error('Failed to create shape layer:', error);
      alert('Failed to create shape layer. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <DraggableModal
      isOpen={isOpen}
      onClose={onClose}
      title={existingLayer ? 'Edit Shape Layer' : 'Create Shape Layer'}
      noPadding={true}
      modalId="modal-shape"
    >
      <div className={`${isPortrait ? 'flex flex-col-reverse' : 'flex'} text-gray-200 h-full w-full overflow-hidden`}>
        {/* Controls */}
        <div className={`${isPortrait ? 'border-t max-h-[45vh]' : 'w-80 border-r'} border-gray-700 flex-shrink-0 flex flex-col overflow-hidden bg-gray-800`}>
          <div className="overflow-y-auto flex-1 p-4 space-y-4">
            
            {/* Shape Type Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase">Shape</label>
              <div className="grid grid-cols-3 gap-1">
                {SHAPE_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => setShapeType(type)}
                    className={`px-2 py-2 text-[10px] font-medium rounded transition-colors capitalize ${
                      shapeType === type
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Size Control */}
            <div className="space-y-2 border-t border-gray-700 pt-3">
              <label className="text-xs font-semibold text-gray-400 uppercase">Size</label>
              <div className="space-y-1">
                <input
                  type="range"
                  min="1"
                  max="500"
                  value={size}
                  onChange={(e) => setSize(Number(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{size}px</span>
                  <input
                    type="number"
                    value={size}
                    onChange={(e) => setSize(Math.max(1, Math.min(500, parseInt(e.target.value) || size)))}
                    className="flex-1 px-2 py-1 bg-gray-900 border border-gray-600 rounded text-xs text-white"
                  />
                </div>
              </div>

              {/* Quick Sizes */}
              <div className="flex flex-wrap gap-1">
                {[50, 100, 150, 200, 300, 400].map(s => (
                  <button
                    key={s}
                    onClick={() => setSize(s)}
                    className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${
                      size === s
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-gray-700 border-gray-600 text-gray-400 hover:bg-gray-600'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Stretch Controls - Horizontal and Vertical */}
            <div className="space-y-2 border-t border-gray-700 pt-3">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-gray-400 uppercase">Stretch</label>
                <button 
                  onClick={() => { setStretchX(1); setStretchY(1); }}
                  className="text-[10px] text-blue-400 hover:text-blue-300"
                >
                  Reset
                </button>
              </div>
              
              {/* Horizontal Stretch */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-gray-500">
                  <span>Horizontal</span>
                  <span>{stretchX.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="20"
                  step="0.1"
                  value={stretchX}
                  onChange={(e) => setStretchX(Number(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Vertical Stretch */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-gray-500">
                  <span>Vertical</span>
                  <span>{stretchY.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="20"
                  step="0.1"
                  value={stretchY}
                  onChange={(e) => setStretchY(Number(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            {/* Appearance */}
            <div className="space-y-3 border-t border-gray-700 pt-3">
              <label className="text-xs font-semibold text-gray-400 uppercase">Appearance</label>
              
              {/* Color */}
              <div className="flex gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                />
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="flex-1 px-2 py-1 bg-gray-900 border border-gray-600 rounded text-white text-sm font-mono uppercase"
                />
              </div>
              
              {/* Color Presets */}
              <div className="space-y-1">
                {[
                  // Grayscale
                  ['#FFFFFF', '#E0E0E0', '#C0C0C0', '#A0A0A0', '#808080', '#606060', '#404040', '#202020', '#000000'],
                  // Reds
                  ['#FFCDD2', '#EF9A9A', '#E57373', '#EF5350', '#F44336', '#E53935', '#D32F2F', '#C62828', '#B71C1C'],
                  // Oranges
                  ['#FFE0B2', '#FFCC80', '#FFB74D', '#FFA726', '#FF9800', '#FB8C00', '#F57C00', '#EF6C00', '#E65100'],
                  // Yellows
                  ['#FFF9C4', '#FFF59D', '#FFF176', '#FFEE58', '#FFEB3B', '#FDD835', '#FBC02D', '#F9A825', '#F57F17'],
                  // Greens
                  ['#C8E6C9', '#A5D6A7', '#81C784', '#66BB6A', '#4CAF50', '#43A047', '#388E3C', '#2E7D32', '#1B5E20'],
                  // Cyans/Teals
                  ['#B2EBF2', '#80DEEA', '#4DD0E1', '#26C6DA', '#00BCD4', '#00ACC1', '#0097A7', '#00838F', '#006064'],
                  // Blues
                  ['#BBDEFB', '#90CAF9', '#64B5F6', '#42A5F5', '#2196F3', '#1E88E5', '#1976D2', '#1565C0', '#0D47A1'],
                  // Purples
                  ['#E1BEE7', '#CE93D8', '#BA68C8', '#AB47BC', '#9C27B0', '#8E24AA', '#7B1FA2', '#6A1B9A', '#4A148C'],
                  // Pinks
                  ['#F8BBD0', '#F48FB1', '#F06292', '#EC407A', '#E91E63', '#D81B60', '#C2185B', '#AD1457', '#880E4F'],
                ].map((row, i) => (
                  <div key={i} className="flex gap-1">
                    {row.map(preset => (
                      <button
                        key={preset}
                        onClick={() => setColor(preset)}
                        className={`flex-1 aspect-square rounded-sm border ${color === preset ? 'border-white scale-110 z-10' : 'border-gray-600 hover:border-gray-400'}`}
                        style={{ backgroundColor: preset }}
                        title={preset}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Canvas Preview Toggle */}
            <div className="space-y-2 border-t border-gray-700 pt-3">
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase cursor-pointer">
                <input
                  type="checkbox"
                  checked={previewOnCanvas}
                  onChange={(e) => setPreviewOnCanvas(e.target.checked)}
                  className="rounded cursor-pointer"
                />
                Preview on Canvas
              </label>
            </div>
          </div>

          {/* Buttons */}
          <div className="border-t border-gray-700 p-3 space-y-2">
            <button
              onClick={handleCreateShape}
              disabled={isProcessing}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed uppercase"
            >
              {isProcessing ? 'Processing...' : existingLayer ? 'Update' : 'Create'}
            </button>
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-semibold rounded transition-colors uppercase"
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Right: Preview */}
        <div className="flex-1 bg-gray-900 relative flex flex-col min-w-0">
          {/* Preview Header */}
          <div className="h-10 border-b border-gray-700 flex items-center justify-between px-4 bg-gray-800/30">
            <span className="text-xs font-semibold text-gray-400 uppercase">Preview</span>
            <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer hover:text-gray-200 select-none">
              <input
                type="checkbox"
                checked={previewOnCanvas}
                onChange={(e) => setPreviewOnCanvas(e.target.checked)}
                className="rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-offset-gray-800"
              />
              <span>Show on Canvas</span>
            </label>
          </div>

          {/* Preview Area */}
          <div className="flex-1 overflow-auto flex items-center justify-center p-8 bg-[url('/grid-pattern.png')] bg-repeat">
            {isProcessing ? (
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                Rendering...
              </div>
            ) : previewImage ? (
              <div className="relative">
                <img
                  src={previewImage}
                  alt="Shape preview"
                  className="max-w-full max-h-full object-contain"
                  style={{ imageRendering: 'pixelated' }}
                />
              </div>
            ) : (
              <div className="text-gray-600 text-sm italic">
                Configure shape to generate preview
              </div>
            )}
          </div>
        </div>
      </div>
    </DraggableModal>
  );
};

export default ShapeModal;
