import { useEffect, useState } from 'react';
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
            <div className="flex-1 overflow-hidden">
              <Canvas />
            </div>

            {/* Hamburger buttons - bottom corners */}
            <button
              onClick={() => { setShowLayersDrawer(!showLayersDrawer); setShowPropertiesDrawer(false); }}
              className={`fixed bottom-4 left-4 z-[200] w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-lg transition-colors ${
                showLayersDrawer ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
              }`}
              aria-label={showLayersDrawer ? 'Close layers panel' : 'Open layers panel'}
            >
              ☰
            </button>
            <button
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
                <div className="fixed top-16 left-0 bottom-0 w-72 bg-panel-bg border-r border-border z-[160] overflow-hidden flex flex-col animate-slide-in-left shadow-2xl">
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
                <div className="fixed top-16 right-0 bottom-0 w-72 bg-panel-bg border-l border-border z-[160] overflow-hidden flex flex-col animate-slide-in-right shadow-2xl">
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
            <div className="flex-1 overflow-hidden">
              <Canvas />
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
