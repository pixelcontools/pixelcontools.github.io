import useCompositorStore from '../../store/compositorStore';
import { Layer } from '../../types/compositor.types';
import { rasterizeShape } from '../../utils/shapeRasterizer';

interface ShapePropertiesProps {
  layer: Layer;
}

/**
 * Shape properties component
 * Displays and allows editing of shape-specific properties
 */
function ShapeProperties({ layer }: ShapePropertiesProps) {
  const updateLayer = useCompositorStore((state) => state.updateLayer);

  if (!layer.shapeType) {
    return null;
  }

  const handleShapeTypeChange = async (newType: typeof layer.shapeType) => {
    if (!newType) return;

    try {
      const result = await rasterizeShape({
        shapeType: newType,
        size: layer.shapeSize || 200,
        stretchX: layer.shapeStretchX || 1,
        stretchY: layer.shapeStretchY || 1,
        color: layer.shapeColor || '#FFFFFF',
      });

      updateLayer(layer.id, {
        imageData: result.dataUrl,
        width: result.width,
        height: result.height,
        x: layer.x - result.offsetX,
        y: layer.y - result.offsetY,
        shapeType: newType,
      } as any);
    } catch (error) {
      console.error('Failed to update shape type:', error);
    }
  };

  const handleSizeChange = async (newSize: number) => {
    try {
      if (!layer.shapeType) return;
      const result = await rasterizeShape({
        shapeType: layer.shapeType,
        size: newSize,
        stretchX: layer.shapeStretchX || 1,
        stretchY: layer.shapeStretchY || 1,
        color: layer.shapeColor || '#FFFFFF',
      });

      updateLayer(layer.id, {
        imageData: result.dataUrl,
        width: result.width,
        height: result.height,
        x: layer.x - result.offsetX,
        y: layer.y - result.offsetY,
        shapeSize: newSize,
      } as any);
    } catch (error) {
      console.error('Failed to update shape size:', error);
    }
  };

  const handleStretchXChange = async (newStretch: number) => {
    try {
      if (!layer.shapeType) return;
      const result = await rasterizeShape({
        shapeType: layer.shapeType,
        size: layer.shapeSize || 200,
        stretchX: newStretch,
        stretchY: layer.shapeStretchY || 1,
        color: layer.shapeColor || '#FFFFFF',
      });

      updateLayer(layer.id, {
        imageData: result.dataUrl,
        width: result.width,
        height: result.height,
        x: layer.x - result.offsetX,
        y: layer.y - result.offsetY,
        shapeStretchX: newStretch,
      } as any);
    } catch (error) {
      console.error('Failed to update shape stretch X:', error);
    }
  };

  const handleStretchYChange = async (newStretch: number) => {
    try {
      if (!layer.shapeType) return;
      const result = await rasterizeShape({
        shapeType: layer.shapeType,
        size: layer.shapeSize || 200,
        stretchX: layer.shapeStretchX || 1,
        stretchY: newStretch,
        color: layer.shapeColor || '#FFFFFF',
      });

      updateLayer(layer.id, {
        imageData: result.dataUrl,
        width: result.width,
        height: result.height,
        x: layer.x - result.offsetY,
        y: layer.y - result.offsetY,
        shapeStretchY: newStretch,
      } as any);
    } catch (error) {
      console.error('Failed to update shape stretch Y:', error);
    }
  };

  const handleColorChange = async (newColor: string) => {
    try {
      if (!layer.shapeType) return;
      const result = await rasterizeShape({
        shapeType: layer.shapeType,
        size: layer.shapeSize || 200,
        stretchX: layer.shapeStretchX || 1,
        stretchY: layer.shapeStretchY || 1,
        color: newColor,
      });

      updateLayer(layer.id, {
        imageData: result.dataUrl,
        width: result.width,
        height: result.height,
        x: layer.x - result.offsetX,
        y: layer.y - result.offsetY,
        shapeColor: newColor,
      } as any);
    } catch (error) {
      console.error('Failed to update shape color:', error);
    }
  };

  const SHAPE_TYPES = ['rectangle', 'circle', 'triangle', 'hexagon', 'octagon', 'star'] as const;

  return (
    <div className="bg-panel-bg rounded p-3 space-y-3" data-region="shape-properties">
      <div className="text-xs font-semibold text-gray-300">Shape Properties</div>

      {/* Shape Type */}
      <div>
        <label className="text-xs text-gray-400 block mb-1">Type</label>
        <select
          id="select-shape-type"
          value={layer.shapeType}
          onChange={(e) => handleShapeTypeChange(e.target.value as typeof layer.shapeType)}
          className="w-full px-2 py-1 bg-canvas-bg border border-border rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
          aria-label="Shape type"
        >
          {SHAPE_TYPES.map((type) => (
            <option key={type} value={type}>
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Size */}
      <div>
        <label className="text-xs text-gray-400 block mb-1">
          Size: {layer.shapeSize || 200}px
        </label>
        <input
          id="input-shape-size"
          type="range"
          min="10"
          max="500"
          value={layer.shapeSize || 200}
          onChange={(e) => handleSizeChange(Number(e.target.value))}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
          aria-label="Shape size"
        />
      </div>

      {/* Stretch X */}
      <div>
        <label className="text-xs text-gray-400 block mb-1">
          Stretch X: {(layer.shapeStretchX || 1).toFixed(2)}x
        </label>
        <input
          id="input-shape-stretch-x"
          type="range"
          min="0.1"
          max="20"
          step="0.1"
          value={layer.shapeStretchX || 1}
          onChange={(e) => handleStretchXChange(Number(e.target.value))}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
          aria-label="Shape stretch X"
        />
      </div>

      {/* Stretch Y */}
      <div>
        <label className="text-xs text-gray-400 block mb-1">
          Stretch Y: {(layer.shapeStretchY || 1).toFixed(2)}x
        </label>
        <input
          id="input-shape-stretch-y"
          type="range"
          min="0.1"
          max="20"
          step="0.1"
          value={layer.shapeStretchY || 1}
          onChange={(e) => handleStretchYChange(Number(e.target.value))}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
          aria-label="Shape stretch Y"
        />
      </div>

      {/* Color */}
      <div>
        <label className="text-xs text-gray-400 block mb-1">Color</label>
        <div className="flex gap-2">
          <input
            id="input-shape-color"
            type="color"
            value={layer.shapeColor || '#FFFFFF'}
            onChange={(e) => handleColorChange(e.target.value)}
            className="w-12 h-8 rounded cursor-pointer border border-border"
            aria-label="Shape color"
          />
          <input
            id="input-shape-color-hex"
            type="text"
            value={layer.shapeColor || '#FFFFFF'}
            onChange={(e) => {
              if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
                handleColorChange(e.target.value);
              }
            }}
            placeholder="#FFFFFF"
            className="flex-1 px-2 py-1 bg-canvas-bg border border-border rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
            aria-label="Shape color hex value"
          />
        </div>
      </div>

      {/* Edit Button */}
      <button
        id="btn-edit-shape"
        onClick={() => (window as any).openShapeModal?.(layer)}
        className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded transition-colors"
        aria-label="Edit shape in modal"
      >
        Edit Shape
      </button>
    </div>
  );
}

export default ShapeProperties;
