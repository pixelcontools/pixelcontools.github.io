import { useEffect, useState } from 'react';
import useCompositorStore from '../../store/compositorStore';
import { Layer } from '../../types/compositor.types';

interface PositionInputsProps {
  layer: Layer;
}

/**
 * Position input controls for a single layer
 */
function PositionInputs({ layer }: PositionInputsProps) {
  const updateLayer = useCompositorStore((state) => state.updateLayer);
  const pushHistory = useCompositorStore((state) => state.pushHistory);
  const isDraggingLayer = useCompositorStore((state) => state.ui.isDraggingLayer);
  const dragLayerId = useCompositorStore((state) => state.ui.dragLayerId);
  const dragOffsetX = useCompositorStore((state) => state.ui.dragOffsetX);
  const dragOffsetY = useCompositorStore((state) => state.ui.dragOffsetY);
  
  // Local state for display values to allow clearing
  const [inputX, setInputX] = useState(String(layer.x));
  const [inputY, setInputY] = useState(String(layer.y));

  // Show preview position during drag, otherwise show actual position
  const isDraggingThisLayer = isDraggingLayer && dragLayerId === layer.id;
  const displayX = isDraggingThisLayer ? Math.floor(layer.x + dragOffsetX) : layer.x;
  const displayY = isDraggingThisLayer ? Math.floor(layer.y + dragOffsetY) : layer.y;

  // Sync display values when layer position changes from outside
  useEffect(() => {
    setInputX(String(displayX));
  }, [displayX]);

  useEffect(() => {
    setInputY(String(displayY));
  }, [displayY]);

  const handleXChange = (value: string) => {
    // Allow any input including empty strings for display
    setInputX(value);
    // Only update state if it's a valid number
    if (value !== '' && value !== '-') {
      const x = parseInt(value, 10);
      if (!isNaN(x)) {
        updateLayer(layer.id, { x });
      }
    }
  };

  const handleYChange = (value: string) => {
    // Allow any input including empty strings for display
    setInputY(value);
    // Only update state if it's a valid number
    if (value !== '' && value !== '-') {
      const y = parseInt(value, 10);
      if (!isNaN(y)) {
        updateLayer(layer.id, { y });
      }
    }
  };

  // Push history when position input loses focus (finalized)
  const handlePositionFinalized = () => {
    pushHistory();
  };

  return (
    <div className="bg-panel-bg rounded p-3 space-y-3">
      <div className="text-xs font-semibold text-gray-300">Position</div>

      {/* X Position */}
      <div>
        <label className="text-xs text-gray-400 block mb-1">X</label>
        <input
          type="text"
          inputMode="numeric"
          value={inputX}
          onChange={(e) => handleXChange(e.target.value)}
          onBlur={handlePositionFinalized}
          className="w-full px-2 py-1 bg-canvas-bg border border-border rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
          placeholder="X position"
        />
      </div>

      {/* Y Position */}
      <div>
        <label className="text-xs text-gray-400 block mb-1">Y</label>
        <input
          type="text"
          inputMode="numeric"
          value={inputY}
          onChange={(e) => handleYChange(e.target.value)}
          onBlur={handlePositionFinalized}
          className="w-full px-2 py-1 bg-canvas-bg border border-border rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
          placeholder="Y position"
        />
      </div>

      {/* Dimensions (read-only) */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Width</label>
          <div className="px-2 py-1 bg-canvas-bg border border-border rounded text-xs text-gray-500">
            {layer.width}
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Height</label>
          <div className="px-2 py-1 bg-canvas-bg border border-border rounded text-xs text-gray-500">
            {layer.height}
          </div>
        </div>
      </div>

      {/* Z-Index (read-only) */}
      <div>
        <label className="text-xs text-gray-400 block mb-1">Z-Index</label>
        <div className="px-2 py-1 bg-canvas-bg border border-border rounded text-xs text-gray-500">
          {layer.zIndex}
        </div>
      </div>
    </div>
  );
}

export default PositionInputs;
