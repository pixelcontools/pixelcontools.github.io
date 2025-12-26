import useCompositorStore from '../../store/compositorStore';

interface OpacityControlsProps {
  layer: { id: string; opacity: number };
}

/**
 * Opacity controls for a single layer
 */
function OpacityControl({ layer }: OpacityControlsProps) {
  const updateLayer = useCompositorStore((state) => state.updateLayer);

  const handleOpacityChange = (value: number) => {
    const opacity = Math.max(0, Math.min(1, value / 100));
    updateLayer(layer.id, { opacity });
    // console.log(`[DEBUG] Layer opacity changed to ${(opacity * 100).toFixed(1)}%`);
  };

  const opacity = layer.opacity !== undefined ? layer.opacity : 1.0;

  return (
    <div className="bg-panel-bg rounded p-3 space-y-2">
      <div className="text-xs font-semibold text-gray-300">Opacity</div>
      
      {/* Opacity Slider */}
      <div className="space-y-2">
        <input
          type="range"
          min="0"
          max="100"
          value={opacity * 100}
          onChange={(e) => handleOpacityChange(parseInt(e.target.value))}
          className="w-full h-2 bg-canvas-bg rounded appearance-none cursor-pointer accent-blue-400"
        />
        
        {/* Opacity Percentage Display */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {(opacity * 100).toFixed(0)}%
          </span>
          
          {/* Quick presets */}
          <div className="flex gap-1">
            <button
              onClick={() => handleOpacityChange(50)}
              className="px-2 py-1 text-xs bg-canvas-bg hover:bg-border rounded transition"
              title="50% opacity"
            >
              50%
            </button>
            <button
              onClick={() => handleOpacityChange(100)}
              className="px-2 py-1 text-xs bg-canvas-bg hover:bg-border rounded transition"
              title="100% opacity (fully opaque)"
            >
              100%
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OpacityControl;
