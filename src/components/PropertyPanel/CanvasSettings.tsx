import { useEffect, useState } from 'react';
import useCompositorStore from '../../store/compositorStore';
import { savePreferences, loadPreferences } from '../../hooks/useLocalStorage';

/**
 * Canvas settings component
 * Allows configuration of canvas size and background
 */
function CanvasSettings() {
  const canvas = useCompositorStore((state) => state.project.canvas);
  const layers = useCompositorStore((state) => state.project.layers);
  const setCanvasConfig = useCompositorStore((state) => state.setCanvasConfig);
  const cropCanvasToLayers = useCompositorStore((state) => state.cropCanvasToLayers);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [displayWidth, setDisplayWidth] = useState(String(canvas.width));
  const [displayHeight, setDisplayHeight] = useState(String(canvas.height));

  const handleWidthChange = (value: string) => {
    // Allow any input including empty strings for display
    setDisplayWidth(value);
    // Only update state if it's a valid positive number
    if (value !== '' && value !== '-') {
      const width = parseInt(value, 10);
      if (!isNaN(width) && width > 0) {
        setCanvasConfig({ width });
      }
    }
  };

  const handleHeightChange = (value: string) => {
    // Allow any input including empty strings for display
    setDisplayHeight(value);
    // Only update state if it's a valid positive number
    if (value !== '' && value !== '-') {
      const height = parseInt(value, 10);
      if (!isNaN(height) && height > 0) {
        setCanvasConfig({ height });
      }
    }
  };

  // Sync display values when canvas config changes from outside
  useEffect(() => {
    setDisplayWidth(String(canvas.width));
  }, [canvas.width]);

  useEffect(() => {
    setDisplayHeight(String(canvas.height));
  }, [canvas.height]);

  // Sync canvas settings to localStorage
  useEffect(() => {
    const preferences = loadPreferences();
    preferences.canvasBorderEnabled = canvas.borderEnabled;
    preferences.canvasShadowIntensity = canvas.shadowIntensity;
    savePreferences(preferences);
  }, [canvas.borderEnabled, canvas.shadowIntensity]);

  const handleBackgroundColorChange = (value: string) => {
    if (value === 'transparent') {
      setCanvasConfig({ backgroundColor: null });
      // console.log('[DEBUG] Canvas background set to transparent');
    } else if (value.startsWith('#')) {
      setCanvasConfig({ backgroundColor: value });
      // console.log(`[DEBUG] Canvas background color changed to ${value}`);
    }
  };

  const handleCommonSizeChange = (size: string) => {
    const [w, h] = size.split('x').map(Number);
    if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
      setCanvasConfig({ width: w, height: h });
    }
  };

  return (
    <div className="border-t border-border bg-gray-850" data-region="canvas-settings">
      {/* Collapsible Header */}
      <button
        id="btn-toggle-canvas-settings"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full px-3 py-2 flex items-center justify-between text-xs font-semibold text-gray-300 hover:bg-gray-800 transition-colors group"
        aria-label={isCollapsed ? 'Expand canvas settings' : 'Collapse canvas settings'}
        aria-expanded={!isCollapsed}
      >
        <span>Canvas</span>
        <span className={`text-gray-400 transition-transform group-hover:drop-shadow-lg group-hover:text-gray-200 ${isCollapsed ? '' : 'rotate-180'}`}>▼</span>
      </button>

      {/* Collapsible Content */}
      {!isCollapsed && (
        <div className="p-3 space-y-3 bg-gray-850">

      {/* Common Sizes Dropdown */}
      <div>
        <label className="text-xs text-gray-400 block mb-1">Common Sizes</label>
        <select
          id="select-canvas-size"
          onChange={(e) => handleCommonSizeChange(e.target.value)}
          className="w-full px-2 py-1 bg-canvas-bg border border-border rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer"
          defaultValue=""
          aria-label="Common canvas sizes"
        >
          <option value="">Select a size...</option>
          <option value="1024x1024">1024x1024</option>
          <option value="2048x2048">2048x2048</option>
          <option value="1920x1080">1920x1080</option>
          <option value="3840x2160">3840x2160 (4K)</option>
          <option value="4632x2316">4632x2316</option>
          <option value="2316x4632">2316x4632 (Vertical)</option>
          <option value="3276x3276">3276x3276</option>
        </select>
      </div>

      {/* Canvas Size */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Width</label>
          <input
            id="input-canvas-width"
            type="text"
            inputMode="numeric"
            value={displayWidth}
            onChange={(e) => handleWidthChange(e.target.value)}
            className="w-full px-2 py-1 bg-canvas-bg border border-border rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
            placeholder="Width"
            aria-label="Canvas width"
          />
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-1">Height</label>
          <input
            id="input-canvas-height"
            type="text"
            inputMode="numeric"
            value={displayHeight}
            onChange={(e) => handleHeightChange(e.target.value)}
            className="w-full px-2 py-1 bg-canvas-bg border border-border rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
            placeholder="Height"
            aria-label="Canvas height"
          />
        </div>
      </div>

      {/* Crop to Layers Button */}
      <button
        id="btn-crop-canvas-to-layers"
        onClick={() => {
          cropCanvasToLayers();
          // Auto-fit zoom after crop settles
          (window as any).fitCanvasToScreen?.();
        }}
        disabled={layers.length === 0}
        className={`w-full px-3 py-2 rounded transition-colors text-xs font-medium ${
          layers.length === 0
            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
            : 'bg-slate-700 text-white hover:bg-slate-600'
        }`}
        title={layers.length === 0 ? 'Add layers first to crop canvas' : 'Crop canvas to layer bounds'}
        aria-label="Crop canvas to layer bounds"
      >
        Crop Canvas to Layers
      </button>

      {/* Background Color */}
      <div>
        <label className="text-xs text-gray-400 block mb-1">Background</label>
        <div className="flex gap-1">
          <input
            id="input-bg-color"
            type="color"
            value={canvas.backgroundColor || '#ffffff'}
            onChange={(e) => handleBackgroundColorChange(e.target.value)}
            className="flex-1 h-8 rounded cursor-pointer border border-border"
            title="Pick background color"
            aria-label="Background color"
          />
          <button
            id="btn-bg-transparent"
            onClick={() => handleBackgroundColorChange('transparent')}
            className={`flex-1 px-2 py-1 text-xs font-medium rounded transition-colors ${
              canvas.backgroundColor === null
                ? 'bg-blue-600 text-white'
                : 'bg-panel-bg text-gray-400 hover:text-gray-300'
            }`}
            title="Set background to transparent"
            aria-label="Set background to transparent"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Border Settings */}
      <div className="space-y-2 pt-2 border-t border-border">
        <div className="text-xs font-semibold text-gray-300">Border</div>
        
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="input-border-enabled"
            checked={canvas.borderEnabled ?? true}
            onChange={(e) => setCanvasConfig({ borderEnabled: e.target.checked })}
            className="w-4 h-4 rounded cursor-pointer"
            title="Enable or disable canvas border"
            aria-label="Enable or disable canvas border"
          />
          <label htmlFor="input-border-enabled" className="text-xs text-gray-400 cursor-pointer flex-1">
            Show Border
          </label>
        </div>
      </div>

      {/* Shadow Settings */}
      <div className="space-y-2 pt-2 border-t border-border">
        <div className="text-xs font-semibold text-gray-300">Shadow</div>
        
        <div>
          <label className="text-xs text-gray-400 block mb-1">Intensity</label>
          <input
            id="input-shadow-intensity"
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={canvas.shadowIntensity ?? 0.5}
            onChange={(e) => setCanvasConfig({ shadowIntensity: parseFloat(e.target.value) })}
            className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            title="Shadow intensity (0 = off, 1 = max)"
            aria-label="Shadow intensity"
          />
          <div className="text-xs text-gray-500 mt-1">
            {Math.round((canvas.shadowIntensity ?? 0.5) * 100)}%
          </div>
        </div>
      </div>

      {/* Checkered Background */}
      <div className="space-y-2 pt-2 border-t border-border">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="input-checkered-bg"
            checked={canvas.showCheckeredBackground ?? false}
            onChange={(e) => setCanvasConfig({ showCheckeredBackground: e.target.checked })}
            disabled={canvas.backgroundColor !== null}
            className="w-4 h-4 rounded cursor-pointer disabled:opacity-50"
            title="Show checkered pattern for transparency (only available when background is transparent)"
            aria-label="Show checkered background"
          />
          <label htmlFor="input-checkered-bg" className={`text-xs cursor-pointer flex-1 ${canvas.backgroundColor !== null ? 'text-gray-600' : 'text-gray-400'}`}>
            Checkered Background
          </label>
        </div>
      </div>

      {/* Drag Info */}
      <div className="space-y-2 pt-2 border-t border-border">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="input-drag-info"
            checked={canvas.dragInfoEnabled ?? true}
            onChange={(e) => setCanvasConfig({ dragInfoEnabled: e.target.checked })}
            className="w-4 h-4 rounded cursor-pointer"
            title="Show drag translation info when dragging layers"
            aria-label="Show drag info tooltip"
          />
          <label htmlFor="input-drag-info" className="text-xs text-gray-400 cursor-pointer flex-1">
            Show Drag Info
          </label>
        </div>
      </div>
        </div>
      )}
    </div>
  );
}

export default CanvasSettings;
