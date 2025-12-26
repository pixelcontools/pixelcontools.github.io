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
import { Layer } from './types/compositor.types';

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

  // Initialize preferences from localStorage
  useInitializePreferences();

  // Initialize keyboard shortcuts
  useKeyboardShortcuts();

  // Initialize automatic history tracking
  useAutoHistory();

  // Initialize auto-save
  useAutoSave();

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
      <Toolbar />

      {/* Main Content Area */}
      <div className="flex flex-1 gap-0 overflow-hidden">
        {/* Left Panel - Layer Management */}
        <div className="w-64 border-r border-border overflow-hidden flex flex-col">
          <LayerPanel />
        </div>

        {/* Center - Canvas */}
        <div className="flex-1 overflow-hidden">
          <Canvas />
        </div>

        {/* Right Panel - Properties */}
        <div className="w-64 border-l border-border overflow-hidden flex flex-col">
          <PropertyPanel />
        </div>
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
    </div>
  );
}

export default App;
