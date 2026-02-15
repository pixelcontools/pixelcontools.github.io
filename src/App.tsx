import { useEffect, useState, useCallback, useRef } from 'react';
import Canvas from './components/Canvas/Canvas';
import LayerPanel from './components/LayerPanel/LayerPanel';
import PropertyPanel from './components/PropertyPanel/PropertyPanel';
import Toolbar from './components/Toolbar/Toolbar';
import DebugHistoryModal from './components/DebugMenu/DebugHistoryModal';
import TextLayerModal from './components/Modals/TextLayerModal';
import ShapeModal from './components/Modals/ShapeModal';
import useCompositorStore from './store/compositorStore';
import useKeyboardShortcuts from './hooks/useKeyboardShortcuts';
import useAutoHistory from './hooks/useAutoHistory';
import useDebugMenu from './hooks/useDebugMenu';
import { useAutoSave } from './hooks/useAutoSave';
import { useAutoResetZoom } from './hooks/useAutoResetZoom';
import { useInitializePreferences } from './hooks/useLocalStorage';
import { usePortraitMode } from './hooks/usePortraitMode';
import { Layer } from './types/compositor.types';
import TutorialOverlay, { useTutorialFirstVisit } from './components/Tutorial/TutorialOverlay';

/**
 * Main application component
 * Manages layout and global event handling
 */
function App() {
  const project = useCompositorStore((state) => state.project);
  const isDirty = useCompositorStore((state) => state.isDirty);
  
  // Text layer modal state
  const [isTextModalOpen, setIsTextModalOpen] = useState(false);
  const [editingTextLayer, setEditingTextLayer] = useState<Layer | undefined>(undefined);
  
  // Shape layer modal state
  const [isShapeModalOpen, setIsShapeModalOpen] = useState(false);
  const [editingShapeLayer, setEditingShapeLayer] = useState<Layer | undefined>(undefined);

  // Portrait/mobile layout
  const isPortrait = usePortraitMode();
  const { showTutorial, setShowTutorial, isFirstVisit } = useTutorialFirstVisit();
  const [showLayersDrawer, setShowLayersDrawer] = useState(false);
  const [showPropertiesDrawer, setShowPropertiesDrawer] = useState(false);

  // Initialize preferences from localStorage
  useInitializePreferences();

  // Initialize keyboard shortcuts
  useKeyboardShortcuts();

  // Initialize automatic history tracking
  useAutoHistory();

  // Initialize auto-save
  useAutoSave();

  // Load sample image on first visit
  const addLayer = useCompositorStore((state) => state.addLayer);
  const selectLayer = useCompositorStore((state) => state.selectLayer);
  useEffect(() => {
    if (!isFirstVisit) return;
    // Small delay to let auto-save attempt finish first
    const timer = setTimeout(async () => {
      // Only load if canvas is still empty (no auto-save restored)
      if (useCompositorStore.getState().project.layers.length > 0) return;
      try {
        const resp = await fetch('/kanoe.jpg');
        if (!resp.ok) return;
        const blob = await resp.blob();
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        const img = new Image();
        img.src = dataUrl;
        await new Promise<void>((resolve) => { img.onload = () => resolve(); });
        addLayer({
          name: 'kanoe.jpg',
          imageData: dataUrl,
          x: 0,
          y: 0,
          zIndex: 0,
          visible: true,
          locked: false,
          opacity: 1.0,
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
        // Select the layer so the properties panel shows Actions
        const layers = useCompositorStore.getState().project.layers;
        if (layers.length > 0) {
          selectLayer(layers[layers.length - 1].id, false);
        }
      } catch {
        // Silently fail — it's just a demo image
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [isFirstVisit, addLayer, selectLayer]);

  // Initialize auto-reset zoom when first layer is added
  useAutoResetZoom();

  // ─── Drag-and-drop for image files (canvas area only) ─────────────────
  const [isDroppingFile, setIsDroppingFile] = useState(false);
  const canvasDropRef = useRef<HTMLDivElement>(null);

  const handleDroppedFiles = useCallback(async (files: FileList) => {
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(file);
        });
        const img = new Image();
        img.src = dataUrl;
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Failed to load image'));
        });
        const store = useCompositorStore.getState();
        store.addLayer({
          name: file.name,
          imageData: dataUrl,
          x: 0,
          y: 0,
          zIndex: store.project.layers.length,
          visible: true,
          locked: false,
          opacity: 1.0,
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
        // Select the newly added layer
        const layers = useCompositorStore.getState().project.layers;
        if (layers.length > 0) {
          useCompositorStore.getState().selectLayer(layers[layers.length - 1].id, false);
        }
      } catch (err) {
        console.error(`Error loading dropped image ${file.name}:`, err);
      }
    }
  }, []);

  useEffect(() => {
    let counter = 0;

    // Show overlay when files are dragged anywhere over the window
    const onDragEnter = (e: DragEvent) => {
      e.preventDefault();
      counter++;
      if (e.dataTransfer?.types.includes('Files')) {
        setIsDroppingFile(true);
      }
    };
    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        // Show 'copy' cursor when over canvas area, 'none' elsewhere
        const el = canvasDropRef.current;
        if (el && el.contains(e.target as Node)) {
          e.dataTransfer.dropEffect = 'copy';
        } else {
          e.dataTransfer.dropEffect = 'none';
        }
      }
    };
    const onDragLeave = (e: DragEvent) => {
      e.preventDefault();
      counter--;
      if (counter <= 0) {
        counter = 0;
        setIsDroppingFile(false);
      }
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      counter = 0;
      setIsDroppingFile(false);
      // Only accept drop if it landed on the canvas area
      const el = canvasDropRef.current;
      if (el && el.contains(e.target as Node) && e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        handleDroppedFiles(e.dataTransfer.files);
      }
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [handleDroppedFiles]);

  // Initialize debug menu
  const { isOpen: isDebugMenuOpen, setIsOpen: setIsDebugMenuOpen } = useDebugMenu();
  
  // Handle opening text modal for new or existing layer
  const handleOpenTextModal = (layer?: Layer) => {
    setEditingTextLayer(layer);
    setIsTextModalOpen(true);
  };
  
  const handleCloseTextModal = () => {
    setIsTextModalOpen(false);
    setEditingTextLayer(undefined);
  };
  
  // Handle opening shape modal for new or existing layer
  const handleOpenShapeModal = (layer?: Layer) => {
    setEditingShapeLayer(layer);
    setIsShapeModalOpen(true);
  };
  
  const handleCloseShapeModal = () => {
    setIsShapeModalOpen(false);
    setEditingShapeLayer(undefined);
  };
  
  // Expose text modal handler globally so Toolbar and LayerItem can access it
  useEffect(() => {
    (window as any).openTextLayerModal = handleOpenTextModal;
    return () => {
      delete (window as any).openTextLayerModal;
    };
  }, []);
  
  // Expose shape modal handler globally so Toolbar and LayerItem can access it
  useEffect(() => {
    (window as any).openShapeModal = handleOpenShapeModal;
    return () => {
      delete (window as any).openShapeModal;
    };
  }, []);

  // Handle unsaved changes warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
        console.warn('[DEBUG] Unsaved changes detected - warning user before closing');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Update document title with project name and dirty indicator
  useEffect(() => {
    const title = isDirty 
      ? `● ${project.projectName} - PixelConnect`
      : `${project.projectName} - PixelConnect`;
    document.title = title;
  }, [project.projectName, isDirty]);

  return (
    <div className="h-screen flex flex-col bg-canvas-bg text-white overflow-hidden">
      {/* Top Toolbar */}
      <Toolbar onHelpClick={() => setShowTutorial(true)} />

      {/* Main Content Area */}
      <div className="flex flex-1 gap-0 overflow-hidden relative">
        {isPortrait ? (
          <>
            {/* Portrait: Canvas fills full width, panels are overlay drawers */}
            <div ref={canvasDropRef} className="flex-1 overflow-hidden relative">
              <Canvas />
              {isDroppingFile && (
                <div className="absolute inset-0 z-[300] bg-black/60 flex items-center justify-center pointer-events-none rounded">
                  <div className="border-4 border-dashed border-blue-400 rounded-2xl px-12 py-10 bg-gray-900/80 text-center">
                    <div className="text-5xl mb-3">📂</div>
                    <div className="text-xl font-semibold text-blue-300">Drop image(s) here</div>
                    <div className="text-sm text-gray-400 mt-1">PNG, JPG, GIF, WebP, SVG</div>
                  </div>
                </div>
              )}
            </div>

            {/* Hamburger buttons - bottom corners */}
            <button
              id="btn-mobile-layers-toggle"
              onClick={() => { setShowLayersDrawer(!showLayersDrawer); setShowPropertiesDrawer(false); }}
              className={`fixed bottom-4 left-4 z-[200] w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-lg transition-colors ${
                showLayersDrawer ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
              }`}
              aria-label={showLayersDrawer ? 'Close layers panel' : 'Open layers panel'}
            >
              ☰
            </button>
            <button
              id="btn-mobile-properties-toggle"
              onClick={() => { setShowPropertiesDrawer(!showPropertiesDrawer); setShowLayersDrawer(false); }}
              className={`fixed bottom-4 right-4 z-[200] w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-lg transition-colors ${
                showPropertiesDrawer ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
              }`}
              aria-label={showPropertiesDrawer ? 'Close properties panel' : 'Open properties panel'}
            >
              ⚙
            </button>

            {/* Layers Drawer Overlay */}
            {showLayersDrawer && (
              <>
                <div className="fixed inset-0 bg-black/50 z-[150]" onClick={() => setShowLayersDrawer(false)} />
                <div id="mobile-layers-drawer" className="fixed top-16 left-0 bottom-0 w-72 bg-panel-bg border-r border-border z-[160] overflow-hidden flex flex-col animate-slide-in-left shadow-2xl">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                    <span className="text-sm font-semibold text-gray-300">Layers</span>
                    <button onClick={() => setShowLayersDrawer(false)} className="text-gray-400 hover:text-white text-lg px-1">✕</button>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <LayerPanel />
                  </div>
                </div>
              </>
            )}

            {/* Properties Drawer Overlay */}
            {showPropertiesDrawer && (
              <>
                <div className="fixed inset-0 bg-black/50 z-[150]" onClick={() => setShowPropertiesDrawer(false)} />
                <div id="mobile-properties-drawer" className="fixed top-16 right-0 bottom-0 w-72 bg-panel-bg border-l border-border z-[160] overflow-hidden flex flex-col animate-slide-in-right shadow-2xl">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                    <span className="text-sm font-semibold text-gray-300">Properties</span>
                    <button onClick={() => setShowPropertiesDrawer(false)} className="text-gray-400 hover:text-white text-lg px-1">✕</button>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <PropertyPanel />
                  </div>
                </div>
              </>
            )}
          </>
        ) : (
          <>
            {/* Landscape: Normal three-column layout */}
            <div className="w-64 border-r border-border overflow-hidden flex flex-col">
              <LayerPanel />
            </div>
            <div ref={canvasDropRef} className="flex-1 overflow-hidden relative">
              <Canvas />
              {isDroppingFile && (
                <div className="absolute inset-0 z-[300] bg-black/60 flex items-center justify-center pointer-events-none rounded">
                  <div className="border-4 border-dashed border-blue-400 rounded-2xl px-12 py-10 bg-gray-900/80 text-center">
                    <div className="text-5xl mb-3">📂</div>
                    <div className="text-xl font-semibold text-blue-300">Drop image(s) here</div>
                    <div className="text-sm text-gray-400 mt-1">PNG, JPG, GIF, WebP, SVG</div>
                  </div>
                </div>
              )}
            </div>
            <div className="w-64 border-l border-border overflow-hidden flex flex-col">
              <PropertyPanel />
            </div>
          </>
        )}
      </div>

      {/* Debug History Modal (Ctrl+Shift+D) */}
      <DebugHistoryModal
        isOpen={isDebugMenuOpen}
        onClose={() => setIsDebugMenuOpen(false)}
      />
      
      {/* Text Layer Modal */}
      <TextLayerModal
        isOpen={isTextModalOpen}
        onClose={handleCloseTextModal}
        existingLayer={editingTextLayer}
      />
      
      {/* Shape Layer Modal */}
      <ShapeModal
        isOpen={isShapeModalOpen}
        onClose={handleCloseShapeModal}
        existingLayer={editingShapeLayer}
      />

      {/* Tutorial Overlay */}
      <TutorialOverlay
        isOpen={showTutorial}
        onClose={() => setShowTutorial(false)}
      />

    </div>
  );
}

export default App;
