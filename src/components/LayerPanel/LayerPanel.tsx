import { useRef } from 'react';
import useCompositorStore from '../../store/compositorStore';
import LayerItem from './LayerItem';
import CanvasSettings from '../PropertyPanel/CanvasSettings';

/**
 * Layer panel component
 * Displays list of layers and layer management controls
 */
function LayerPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const project = useCompositorStore((state) => state.project);
  const selectedLayerIds = useCompositorStore((state) => state.selectedLayerIds);
  const selectAllLayers = useCompositorStore((state) => state.selectAllLayers);
  const deselectAllLayers = useCompositorStore((state) => state.deselectAllLayers);
  const deleteSelectedLayers = useCompositorStore((state) => state.deleteSelectedLayers);
  const addLayer = useCompositorStore((state) => state.addLayer);

  // Sort layers by z-index for display (highest z-index at top)
  const sortedLayers = [...project.layers].sort((a, b) => b.zIndex - a.zIndex);

  const handleDeleteSelected = () => {
    if (selectedLayerIds.length === 0) {
      console.warn('[DEBUG] No layers selected for deletion');
      return;
    }

    const confirmed = window.confirm(
      `Delete ${selectedLayerIds.length} layer${selectedLayerIds.length !== 1 ? 's' : ''}?`
    );

    if (confirmed) {
      // console.log(`[DEBUG] Deleting ${selectedLayerIds.length} selected layer(s)`);
      deleteSelectedLayers();
    }
  };

  /**
   * Handle image file upload
   * Converts images to base64 data URIs
   */
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.currentTarget.files;
    if (!files) {
      console.warn('[DEBUG] No files selected');
      return;
    }

    // console.log(`[DEBUG] Processing ${files.length} image file(s)`);

    for (const file of Array.from(files)) {
      try {
        // Validate file type
        if (!['image/png', 'image/gif', 'image/bmp', 'image/jpeg'].includes(file.type)) {
          console.warn(`[DEBUG] Unsupported file type: ${file.type}`);
          alert(`Unsupported file type: ${file.type}. Please use PNG, GIF, BMP, or JPEG.`);
          continue;
        }

        // console.log(`[DEBUG] Loading image: ${file.name} (${file.size} bytes, ${file.type})`);

        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(file);
        });

        // Create a temporary image to get dimensions
        const img = new Image();
        img.src = dataUrl;

        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Failed to load image'));
        });

        const width = img.naturalWidth;
        const height = img.naturalHeight;

        // console.log(`[DEBUG] Image loaded: ${file.name} (${width}x${height})`);

        // Add layer to store
        addLayer({
          name: file.name,
          imageData: dataUrl,
          x: 0,
          y: 0,
          zIndex: useCompositorStore.getState().project.layers.length,
          visible: true,
          locked: false,
          opacity: 1.0,
          width,
          height,
        });

        // console.log(`[DEBUG] Layer added: ${file.name}`);
      } catch (error) {
        // console.error(`[DEBUG] Error loading image ${file.name}:`, error);
        alert(`Error loading image ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="h-full flex flex-col bg-canvas-bg" data-region="layer-panel">
      {/* Header */}
      <div className="px-3 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Layers</h2>

        {/* Layer Panel Controls */}
        <div className="flex gap-1 flex-wrap">
          <button
            id="btn-select-all-layers"
            onClick={selectAllLayers}
            disabled={project.layers.length === 0}
            className="flex-1 min-w-16 px-2 py-1 text-xs font-medium text-gray-400 hover:text-gray-300 bg-panel-bg hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Select all layers (Ctrl+A)"
            aria-label="Select all layers"
          >
            All
          </button>

          <button
            id="btn-deselect-all-layers"
            onClick={deselectAllLayers}
            disabled={selectedLayerIds.length === 0}
            className="flex-1 min-w-16 px-2 py-1 text-xs font-medium text-gray-400 hover:text-gray-300 bg-panel-bg hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Deselect all layers (Ctrl+D)"
            aria-label="Deselect all layers"
          >
            None
          </button>

          <button
            id="btn-delete-selected-layers"
            onClick={handleDeleteSelected}
            disabled={selectedLayerIds.length === 0}
            className="flex-1 min-w-16 px-2 py-1 text-xs font-medium text-red-400 hover:text-red-300 bg-panel-bg hover:bg-red-900 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Delete selected layers (Delete)"
            aria-label="Delete selected layers"
          >
            Delete
          </button>

          <button
            id="btn-create-text-layer"
            onClick={() => (window as any).openTextLayerModal?.()}
            className="flex-1 min-w-16 px-2 py-1 text-xs font-medium text-blue-400 hover:text-blue-300 bg-panel-bg hover:bg-blue-900 rounded transition-colors flex items-center justify-center gap-1"
            title="Create text layer"
            aria-label="Create text layer"
          >
            <span className="font-bold">T</span>
          </button>

          <button
            id="btn-create-shape-layer"
            onClick={() => (window as any).openShapeModal?.()}
            className="flex-1 min-w-16 px-2 py-1 text-xs font-medium text-purple-400 hover:text-purple-300 bg-panel-bg hover:bg-purple-900 rounded transition-colors"
            title="Create shape layer"
            aria-label="Create shape layer"
          >
            ◆
          </button>

          <button
            id="btn-upload-images"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 min-w-16 px-2 py-1 text-xs font-medium text-green-400 hover:text-green-300 bg-panel-bg hover:bg-green-900 rounded transition-colors"
            title="Upload additional images"
            aria-label="Upload additional images"
          >
            Add
          </button>
        </div>
      </div>

      {/* Layer List */}
      <div className="flex-1 overflow-y-auto">
        {sortedLayers.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-gray-500">
            <div className="mb-2">No layers yet</div>
            <div className="text-xs">Upload images to get started</div>
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {sortedLayers.map((layer) => (
              <LayerItem
                key={layer.id}
                layer={layer}
                isSelected={selectedLayerIds.includes(layer.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer Info */}
      {project.layers.length > 0 && (
        <div className="px-3 py-2 border-t border-border text-xs text-gray-500">
          {project.layers.length} layer{project.layers.length !== 1 ? 's' : ''}
          {selectedLayerIds.length > 0 && ` • ${selectedLayerIds.length} selected`}
        </div>
      )}

      {/* Canvas Settings (moved from Property panel) */}
      <div className="border-t border-border px-3 py-2 bg-panel-bg">
        <CanvasSettings />
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        id="input-upload-images"
        type="file"
        multiple
        accept="image/png,image/gif,image/bmp,image/jpeg"
        onChange={handleImageUpload}
        className="hidden"
        aria-label="Upload images"
      />
    </div>
  );
}

export default LayerPanel;
