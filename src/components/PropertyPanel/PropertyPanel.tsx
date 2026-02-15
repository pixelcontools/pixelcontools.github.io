import useCompositorStore from '../../store/compositorStore';
import PositionInputs from './PositionInputs';
import OpacityControl from './OpacityControl';
import ColorAnalysis from './ColorAnalysis';
import ShapeProperties from './ShapeProperties';
import TransparencyMaskModal from '../Modals/TransparencyMaskModal';
import BgRemovalModal from '../Modals/BgRemovalModal';
import PixelatorModal from '../Modals/PixelatorModal';
import CropModal from '../Modals/CropModal';
import { useState } from 'react';

/**
 * Property panel component
 * Displays properties for selected layers and canvas settings
 */
function PropertyPanel() {
  const project = useCompositorStore((state) => state.project);
  const selectedLayerIds = useCompositorStore((state) => state.selectedLayerIds);
  const selectedLayers = project.layers.filter((layer) =>
    selectedLayerIds.includes(layer.id)
  );

  const [isTransparencyModalOpen, setIsTransparencyModalOpen] = useState(false);
  const [isPixelatorModalOpen, setIsPixelatorModalOpen] = useState(false);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [isBgRemovalModalOpen, setIsBgRemovalModalOpen] = useState(false);

  return (
    <div className="h-full flex flex-col bg-canvas-bg overflow-hidden" data-region="property-panel">
      <div className="px-3 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-gray-300">Properties</h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {selectedLayerIds.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500">
            <div className="mb-2">No layer selected</div>
            <div className="text-xs">Select a layer to edit properties</div>
          </div>
        ) : (
          <div className="p-3 space-y-4">
            {/* Selected Layers Info */}
            <div className="bg-panel-bg rounded p-2 text-xs text-gray-400">
              <div className="font-semibold text-gray-300 mb-1">Selected</div>
              {selectedLayers.map((layer) => (
                <div key={layer.id} className="truncate">
                  {layer.name}
                </div>
              ))}
            </div>

            {/* Position Controls (if single layer selected) */}
            {selectedLayerIds.length === 1 && selectedLayers.length > 0 && <PositionInputs layer={selectedLayers[0]} />}

            {/* Opacity Controls (if single layer selected) */}
            {selectedLayerIds.length === 1 && selectedLayers.length > 0 && <OpacityControl layer={selectedLayers[0]} />}

            {/* Color Analysis (if single layer selected) */}
            {selectedLayerIds.length === 1 && selectedLayers.length > 0 && <ColorAnalysis layer={selectedLayers[0]} />}

            {/* Shape Properties (if single shape layer selected) */}
            {selectedLayerIds.length === 1 && selectedLayers.length > 0 && selectedLayers[0].shapeType && (
              <ShapeProperties layer={selectedLayers[0]} />
            )}

            {/* Layer Modification Menu */}
            {selectedLayerIds.length === 1 && selectedLayers.length > 0 && (
              <div data-region="actions-menu">
                <div className="text-xs font-semibold text-gray-300 mb-2">Modify</div>
                <div className="flex flex-col gap-0.5" id="modify-actions">
                  <button
                    id="btn-open-transparency-modal"
                    onClick={() => setIsTransparencyModalOpen(true)}
                    className="flex items-center gap-2 w-full text-left px-2 py-1.5 text-xs text-gray-300 hover:bg-slate-700/50 hover:text-white rounded transition-colors"
                    aria-label="Open transparency masking"
                  >
                    <svg className="w-4 h-4 flex-shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10" />
                      <path d="M12 2v20" />
                      <path d="M22 12H12" />
                      <path d="M19 15l3-3-3-3" />
                    </svg>
                    <span>Transparency Mask</span>
                  </button>
                  <button
                    id="btn-open-crop-modal"
                    onClick={() => setIsCropModalOpen(true)}
                    className="flex items-center gap-2 w-full text-left px-2 py-1.5 text-xs text-gray-300 hover:bg-slate-700/50 hover:text-white rounded transition-colors"
                    aria-label="Open crop tool"
                  >
                    <svg className="w-4 h-4 flex-shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 2v14a2 2 0 002 2h14" />
                      <path d="M18 22V8a2 2 0 00-2-2H2" />
                    </svg>
                    <span>Crop</span>
                  </button>
                  <button
                    id="btn-open-pixelator-modal"
                    onClick={() => setIsPixelatorModalOpen(true)}
                    className="flex items-center gap-2 w-full text-left px-2 py-1.5 text-xs text-gray-300 hover:bg-slate-700/50 hover:text-white rounded transition-colors"
                    aria-label="Open pixelator / resize"
                  >
                    <svg className="w-4 h-4 flex-shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="2" width="8" height="8" rx="1" />
                      <rect x="14" y="2" width="8" height="8" rx="1" />
                      <rect x="2" y="14" width="8" height="8" rx="1" />
                      <rect x="14" y="14" width="4" height="4" rx="0.5" />
                    </svg>
                    <span>Pixelator / Resize</span>
                  </button>
                  <button
                    id="btn-open-bg-removal-modal"
                    onClick={() => setIsBgRemovalModalOpen(true)}
                    className="flex items-center gap-2 w-full text-left px-2 py-1.5 text-xs text-gray-300 hover:bg-slate-700/50 hover:text-white rounded transition-colors"
                    aria-label="Open background removal"
                  >
                    <svg className="w-4 h-4 flex-shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 3a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2H5z" />
                      <path d="M9 3v18" />
                      <path d="M3 9h6" />
                      <path d="M3 15h6" />
                    </svg>
                    <span>BG Removal</span>
                  </button>
                </div>
              </div>
            )}

            {/* Modals */}
            {selectedLayerIds.length === 1 && selectedLayers.length > 0 && (
              <TransparencyMaskModal 
                isOpen={isTransparencyModalOpen}
                onClose={() => setIsTransparencyModalOpen(false)}
                layer={selectedLayers[0]}
              />
            )}

            {selectedLayerIds.length === 1 && selectedLayers.length > 0 && (
              <PixelatorModal 
                isOpen={isPixelatorModalOpen}
                onClose={() => setIsPixelatorModalOpen(false)}
                layer={selectedLayers[0]}
              />
            )}

            {selectedLayerIds.length === 1 && selectedLayers.length > 0 && (
              <BgRemovalModal
                isOpen={isBgRemovalModalOpen}
                onClose={() => setIsBgRemovalModalOpen(false)}
                layer={selectedLayers[0]}
              />
            )}

            {selectedLayerIds.length === 1 && selectedLayers.length > 0 && (
              <CropModal
                isOpen={isCropModalOpen}
                onClose={() => setIsCropModalOpen(false)}
                layer={selectedLayers[0]}
              />
            )}

            {/* Bulk Position Controls (if multiple layers selected) */}
            {selectedLayerIds.length > 1 && <BulkPositionControls />}
          </div>
        )}
      </div>

      {/* Canvas Settings moved to Layer panel */}
    </div>
  );
}

/**
 * Bulk position controls for multiple selected layers
 */
function BulkPositionControls() {
  const moveSelectedLayers = useCompositorStore((state) => state.moveSelectedLayers);
  const selectedLayerIds = useCompositorStore((state) => state.selectedLayerIds);

  const handleOffset = (deltaX: number, deltaY: number) => {
    console.log(
      `[DEBUG] Moving ${selectedLayerIds.length} layers by (${deltaX}, ${deltaY})`
    );
    moveSelectedLayers(deltaX, deltaY);
  };

  return (
    <div className="bg-panel-bg rounded p-3 space-y-3">
      <div className="text-xs font-semibold text-gray-300">Move Selected</div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Offset X</label>
          <input
            id="input-bulk-offset-x"
            type="number"
            defaultValue={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const value = parseInt((e.target as HTMLInputElement).value) || 0;
                handleOffset(value, 0);
                (e.target as HTMLInputElement).value = '0';
              }
            }}
            className="w-full px-2 py-1 bg-canvas-bg border border-border rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
            placeholder="Pixels"
            aria-label="Offset X pixels"
          />
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-1">Offset Y</label>
          <input
            id="input-bulk-offset-y"
            type="number"
            defaultValue={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const value = parseInt((e.target as HTMLInputElement).value) || 0;
                handleOffset(0, value);
                (e.target as HTMLInputElement).value = '0';
              }
            }}
            className="w-full px-2 py-1 bg-canvas-bg border border-border rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
            placeholder="Pixels"
            aria-label="Offset Y pixels"
          />
        </div>
      </div>

      <div className="flex gap-1 text-xs">
        <button
          id="btn-bulk-move-left"
          onClick={() => handleOffset(-1, 0)}
          className="flex-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
          title="Move left 1px (Shift+←)"
          aria-label="Move left 1 pixel"
        >
          ←
        </button>
        <button
          id="btn-bulk-move-right"
          onClick={() => handleOffset(1, 0)}
          className="flex-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
          title="Move right 1px (Shift+→)"
          aria-label="Move right 1 pixel"
        >
          →
        </button>
        <button
          id="btn-bulk-move-up"
          onClick={() => handleOffset(0, -1)}
          className="flex-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
          title="Move up 1px (Shift+↑)"
          aria-label="Move up 1 pixel"
        >
          ↑
        </button>
        <button
          id="btn-bulk-move-down"
          onClick={() => handleOffset(0, 1)}
          className="flex-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
          title="Move down 1px (Shift+↓)"
          aria-label="Move down 1 pixel"
        >
          ↓
        </button>
      </div>
    </div>
  );
}

export default PropertyPanel;
