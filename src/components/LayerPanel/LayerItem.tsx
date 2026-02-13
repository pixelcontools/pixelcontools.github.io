import { useState, useRef, useEffect } from 'react';
import useCompositorStore from '../../store/compositorStore';
import { Layer } from '../../types/compositor.types';
import { isTextLayer, isShapeLayer } from '../../utils/textRasterizer';

interface LayerItemProps {
  layer: Layer;
  isSelected: boolean;
}

// Global drag state shared across all LayerItem instances
let globalDraggedLayerId: string | null = null;

/**
 * Individual layer item component
 * Displays layer thumbnail, name, and controls
 */
function LayerItem({ layer, isSelected }: LayerItemProps) {
  const selectLayer = useCompositorStore((state) => state.selectLayer);
  const selectLayerRange = useCompositorStore((state) => state.selectLayerRange);
  const updateLayer = useCompositorStore((state) => state.updateLayer);
  const removeLayer = useCompositorStore((state) => state.removeLayer);
  const reorderLayer = useCompositorStore((state) => state.reorderLayer);
  const bringLayerToFront = useCompositorStore((state) => state.bringLayerToFront);
  const sendLayerToBack = useCompositorStore((state) => state.sendLayerToBack);
  const duplicateLayer = useCompositorStore((state) => state.duplicateLayer);

  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(layer.name);
  const [isDragOver, setIsDragOver] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  // Set up global listeners to handle mouseup and mouse leaving window
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (globalDraggedLayerId) {
        // console.log(`[DEBUG] Global drag released`);
        globalDraggedLayerId = null;
        setIsDragOver(false);
      }
    };

    // Listen for mouseup anywhere in the document
    document.addEventListener('mouseup', handleGlobalMouseUp);

    // Also listen for when mouse leaves the window entirely
    const handleMouseLeaveWindow = (e: MouseEvent) => {
      // clientY < 0 means mouse left the top of the window
      // clientX < 0 or clientX > window.innerWidth means left/right
      // clientY > window.innerHeight means bottom
      if (e.clientY < 0 || e.clientX < 0 || e.clientX > window.innerWidth || e.clientY > window.innerHeight) {
        if (globalDraggedLayerId) {
          // console.log(`[DEBUG] Mouse left window, canceling drag`);
          globalDraggedLayerId = null;
          setIsDragOver(false);
        }
      }
    };

    document.addEventListener('mousemove', handleMouseLeaveWindow);

    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('mousemove', handleMouseLeaveWindow);
    };
  }, []);

  const handleSelectLayer = (e: React.MouseEvent) => {
    const multiSelect = e.ctrlKey || e.metaKey;
    const rangeSelect = e.shiftKey;
    
    if (rangeSelect && useCompositorStore.getState().selectedLayerIds.length > 0) {
      // Shift+Click for range selection
      const lastSelectedId = useCompositorStore.getState().selectedLayerIds[useCompositorStore.getState().selectedLayerIds.length - 1];
      selectLayerRange(lastSelectedId, layer.id);
      // console.log(`[DEBUG] Layer range selected from ${lastSelectedId} to ${layer.id}`);
    } else {
      // Regular or multi-select
      selectLayer(layer.id, multiSelect);
      // console.log(`[DEBUG] Layer selected: ${layer.name} (multiSelect: ${multiSelect})`);
    }
  };

  const handleCheckboxChange = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    // Toggle selection with multi-select enabled
    selectLayer(layer.id, true);
    // console.log(`[DEBUG] Layer toggled via checkbox: ${layer.name}`);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Check if clicking on control buttons - don't start drag
    if ((e.target as HTMLElement).closest('button') || isEditingName) {
      return;
    }

    // Start drag by setting global dragged layer
    globalDraggedLayerId = layer.id;
    
    // If not selected, select it
    if (!isSelected) {
      selectLayer(layer.id, false);
    }
    
    // console.log(`[DEBUG] Starting drag of layer: ${layer.name}`);
  };

  const handleMouseEnter = () => {
    if (!globalDraggedLayerId || globalDraggedLayerId === layer.id) {
      setIsDragOver(false);
      return;
    }

    setIsDragOver(true);
    
    // Determine direction to move: if dragged layer has lower z-index, move it up
    const draggedLayer = useCompositorStore.getState().project.layers.find(l => l.id === globalDraggedLayerId);
    const direction = draggedLayer && draggedLayer.zIndex < layer.zIndex ? 'up' : 'down';
    
    reorderLayer(globalDraggedLayerId, direction);
    // console.log(`[DEBUG] Swapped: moved layer ${globalDraggedLayerId} ${direction}`);
  };

  const handleMouseLeave = () => {
    setIsDragOver(false);
  };

  const handleMouseUp = () => {
    if (globalDraggedLayerId) {
      // console.log(`[DEBUG] Drag released`);
      globalDraggedLayerId = null;
    }
  };

  const handleToggleVisibility = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateLayer(layer.id, { visible: !layer.visible });
    // console.log(`[DEBUG] Layer visibility toggled: ${layer.name} -> ${!layer.visible}`);
  };

  const handleToggleLock = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateLayer(layer.id, { locked: !layer.locked });
    // console.log(`[DEBUG] Layer lock toggled: ${layer.name} -> ${!layer.locked}`);
  };

  const handleNameSave = () => {
    if (tempName.trim()) {
      updateLayer(layer.id, { name: tempName.trim() });
      // console.log(`[DEBUG] Layer renamed: ${layer.name} -> ${tempName.trim()}`);
    } else {
      setTempName(layer.name);
    }
    setIsEditingName(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSave();
    } else if (e.key === 'Escape') {
      setTempName(layer.name);
      setIsEditingName(false);
    }
  };

  const handleRemoveLayer = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeLayer(layer.id);
    // console.log(`[DEBUG] Layer removed: ${layer.name}`);
  };

  const handleDuplicateLayer = (e: React.MouseEvent) => {
    e.stopPropagation();
    duplicateLayer(layer.id);
    // console.log(`[DEBUG] Layer duplicated: ${layer.name}`);
  };

  const handleBringToFront = (e: React.MouseEvent) => {
    e.stopPropagation();
    bringLayerToFront(layer.id);
    // console.log(`[DEBUG] Layer brought to front: ${layer.name}`);
  };

  const handleSendToBack = (e: React.MouseEvent) => {
    e.stopPropagation();
    sendLayerToBack(layer.id);
    // console.log(`[DEBUG] Layer sent to back: ${layer.name}`);
  };

  return (
    <div
      ref={elementRef}
      id={`layer-item-${layer.id}`}
      onClick={handleSelectLayer}
      onMouseDown={handleMouseDown}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseUp={handleMouseUp}
      title="Click to select • Ctrl/Cmd+Click for multi-select • Shift+Click for range select"
      aria-label={`Layer: ${layer.name}`}
      aria-selected={isSelected}
      role="option"
      className={`group p-2 rounded border transition-all cursor-pointer select-none ${
        isDragOver ? 'bg-green-900 border-green-400 scale-105' : ''
      } ${
        isSelected
          ? 'bg-blue-900 border-blue-500 text-white'
          : 'bg-panel-bg border-border text-gray-300 hover:bg-gray-800'
      }`}
    >
      {/* Layer Header */}
      <div className="flex items-center gap-2 mb-1">
        {/* Selection Checkbox - Custom Styled */}
        <button
          id={`btn-layer-select-${layer.id}`}
          onClick={handleCheckboxChange}
          onMouseDown={(e) => e.stopPropagation()}
          className={`w-4 h-4 flex-shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
            isSelected
              ? 'bg-white border-white'
              : 'bg-gray-700 border-gray-600 hover:border-gray-500'
          }`}
          title="Select/deselect this layer"
          aria-label={isSelected ? `Deselect ${layer.name}` : `Select ${layer.name}`}
        >
          {isSelected && (
            <svg className="w-3 h-3 text-black" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
        </button>
        
        {/* Thumbnail */}
        <div className="w-8 h-8 flex-shrink-0 bg-canvas-bg border border-gray-600 rounded overflow-hidden relative">
          <img
            src={layer.imageData}
            alt={layer.name}
            className="w-full h-full object-contain"
            style={{ imageRendering: 'pixelated' }}
          />
          {/* Text Layer Badge */}
          {isTextLayer(layer) && (
            <div className="absolute bottom-0 right-0 bg-blue-600 text-white text-[8px] font-bold px-1 rounded-tl" title="Text Layer">
              T
            </div>
          )}
        </div>

        {/* Layer Name */}
        <div className="flex-1 min-w-0">
          {isEditingName ? (
            <input
              id={`input-layer-name-${layer.id}`}
              autoFocus
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onBlur={handleNameSave}
              onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
              className="w-full px-1 py-0 bg-canvas-bg border border-blue-400 rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-300"
              placeholder="Layer name..."
              aria-label="Layer name"
            />
          ) : (
            <span className="text-xs font-medium truncate block" title={layer.name}>
              {layer.name}
            </span>
          )}
        </div>

        {/* Rename Button */}
        {!isEditingName && (
          <button
            id={`btn-layer-rename-${layer.id}`}
            onClick={(e) => {
              e.stopPropagation();
              setTempName(layer.name);
              setIsEditingName(true);
            }}
            className="w-4 h-4 flex items-center justify-center flex-shrink-0 rounded transition-colors hover:bg-gray-600 opacity-0 group-hover:opacity-100"
            title="Rename layer"
            aria-label={`Rename ${layer.name}`}
          >
            <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
          </button>
        )}

        {/* Visibility Toggle */}
        <button
          id={`btn-layer-visibility-${layer.id}`}
          onClick={handleToggleVisibility}
          className="w-5 h-5 flex items-center justify-center flex-shrink-0 rounded transition-colors hover:bg-gray-600"
          title={layer.visible ? 'Hide layer' : 'Show layer'}
          aria-label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
        >
          {layer.visible ? (
            <svg className="w-4 h-4 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-5.838 1.834l-2.455-2.541zM12.305 15.93A9.959 9.959 0 0110 15c-4.478 0-8.268-2.943-9.542-7a9.88 9.88 0 011.964-2.964l2.386 2.386c-.078.464-.12.94-.12 1.424 0 3.314 2.686 6 6 6a5.975 5.975 0 002.717-.632l2.472 2.472z" clipRule="evenodd" />
            </svg>
          )}
        </button>

        {/* Lock Toggle */}
        <button
          id={`btn-layer-lock-${layer.id}`}
          onClick={handleToggleLock}
          className="w-5 h-5 flex items-center justify-center flex-shrink-0 rounded transition-colors hover:bg-gray-600"
          title={layer.locked ? 'Unlock layer' : 'Lock layer'}
          aria-label={layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`}
        >
          {layer.locked ? (
            <svg className="w-4 h-4 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2V7a5 5 0 00-5-5zm0 2a3 3 0 013 3v2H7V7a3 3 0 013-3z" />
            </svg>
          )}
        </button>
      </div>

      {/* Layer Info */}
      <div className="text-xs text-gray-500 px-10 mb-2">
        {layer.width}×{layer.height} • z:{layer.zIndex}
      </div>

      {/* Layer Controls */}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Edit Text Button (only for text layers) */}
        {isTextLayer(layer) && (
          <button
            id={`btn-layer-edit-text-${layer.id}`}
            onClick={(e) => {
              e.stopPropagation();
              (window as any).openTextLayerModal?.(layer);
            }}
            className="flex-1 px-1 py-1 text-xs bg-blue-700 hover:bg-blue-600 rounded transition-colors flex items-center justify-center"
            title="Edit text"
            aria-label={`Edit text for ${layer.name}`}
          >
            <span className="font-bold text-sm">T</span>
          </button>
        )}

        {/* Edit Shape Button (only for shape layers) */}
        {isShapeLayer(layer) && (
          <button
            id={`btn-layer-edit-shape-${layer.id}`}
            onClick={(e) => {
              e.stopPropagation();
              (window as any).openShapeModal?.(layer);
            }}
            className="flex-1 px-1 py-1 text-xs bg-purple-700 hover:bg-purple-600 rounded transition-colors flex items-center justify-center"
            title="Edit shape"
            aria-label={`Edit shape for ${layer.name}`}
          >
            ◆
          </button>
        )}
        <button
          id={`btn-layer-bring-front-${layer.id}`}
          onClick={handleBringToFront}
          className="flex-1 px-1 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors flex items-center justify-center"
          title="Bring to front"
          aria-label={`Bring ${layer.name} to front`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 20 20">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
          </svg>
        </button>
        <button
          id={`btn-layer-send-back-${layer.id}`}
          onClick={handleSendToBack}
          className="flex-1 px-1 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors flex items-center justify-center"
          title="Send to back"
          aria-label={`Send ${layer.name} to back`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 20 20">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l-5 5m0 0l-5-5m5 5V2" />
          </svg>
        </button>
        <button
          id={`btn-layer-duplicate-${layer.id}`}
          onClick={handleDuplicateLayer}
          className="flex-1 px-1 py-1 text-xs bg-blue-700 hover:bg-blue-600 rounded transition-colors flex items-center justify-center"
          title="Duplicate layer"
          aria-label={`Duplicate ${layer.name}`}
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M4 4a2 2 0 012-2h6a2 2 0 012 2v12a1 1 0 110 2h-6a2 2 0 01-2-2V4z" />
            <path d="M14 4a2 2 0 00-2-2v12a2 2 0 002 2h2a2 2 0 002-2V4h-4z" />
          </svg>
        </button>
        <button
          id={`btn-layer-remove-${layer.id}`}
          onClick={handleRemoveLayer}
          className="flex-1 px-1 py-1 text-xs bg-red-700 hover:bg-red-600 rounded transition-colors flex items-center justify-center"
          title="Remove layer"
          aria-label={`Remove ${layer.name}`}
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default LayerItem;
