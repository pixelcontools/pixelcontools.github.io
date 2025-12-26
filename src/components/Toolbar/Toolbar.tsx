import { useState, useEffect } from 'react';
import useCompositorStore from '../../store/compositorStore';
import { savePreferences, loadPreferences } from '../../hooks/useLocalStorage';
import ZoomControls from './ZoomControls';
import FileOperations from './FileOperations';
import HistoryControls from './HistoryControls';
import GridToggle from './GridToggle';

/**
 * Top toolbar component
 * Contains project name, file operations, zoom controls
 */
function Toolbar() {
  const project = useCompositorStore((state) => state.project);
  const setProjectName = useCompositorStore((state) => state.setProjectName);
  const showSelectionBorders = useCompositorStore((state) => state.ui.showSelectionBorders);
  const toggleSelectionBorders = useCompositorStore((state) => state.toggleSelectionBorders);
  const showSelectionTools = useCompositorStore((state) => state.ui.showSelectionTools);
  const toggleSelectionTools = useCompositorStore((state) => state.toggleSelectionTools);
  const borderAnimationSpeed = useCompositorStore((state) => state.ui.selectionBorderAnimationSpeed);
  const setSelectionBorderAnimationSpeed = useCompositorStore((state) => state.setSelectionBorderAnimationSpeed);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(project.projectName);

  // Sync border settings to localStorage
  useEffect(() => {
    const preferences = loadPreferences();
    preferences.showSelectionBorders = showSelectionBorders;
    preferences.selectionBorderAnimationSpeed = borderAnimationSpeed;
    savePreferences(preferences);
  }, [showSelectionBorders, borderAnimationSpeed]);

  const handleNameSave = () => {
    if (tempName.trim()) {
      setProjectName(tempName.trim());
      // console.log(`[DEBUG] Project name updated to: ${tempName.trim()}`);
    } else {
      setTempName(project.projectName);
    }
    setIsEditingName(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSave();
    } else if (e.key === 'Escape') {
      setTempName(project.projectName);
      setIsEditingName(false);
    }
  };

  return (
    <div className="h-16 bg-panel-bg border-b border-border flex items-center justify-between px-4 gap-4">
      {/* Left: Project Name Section */}
      <div className="flex items-center gap-3 flex-1 min-w-0 max-w-xs">
        <div className="text-lg font-semibold whitespace-nowrap">
          <span className="text-red-500">Pixel</span>
          <span className="text-sky-400">Connect</span>
        </div>
        <div className="text-gray-500">|</div>
        
        {isEditingName ? (
          <input
            autoFocus
            type="text"
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            onBlur={handleNameSave}
            onKeyDown={handleKeyDown}
            className="flex-1 px-2 py-1 bg-canvas-bg border border-blue-500 rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Project name..."
          />
        ) : (
          <button
            onClick={() => {
              setTempName(project.projectName);
              setIsEditingName(true);
            }}
            className="flex-1 text-left px-2 py-1 text-gray-300 hover:text-white hover:bg-canvas-bg rounded transition-colors truncate"
            title="Click to rename project"
          >
            {project.projectName}
          </button>
        )}
      </div>

      {/* Center: File and History Operations */}
      <div className="flex items-center gap-2">
        <FileOperations />
        <div className="w-px h-6 bg-border"></div>
        <HistoryControls />
        <div className="w-px h-6 bg-border"></div>
        <GridToggle />
        <div className="w-px h-6 bg-border"></div>
        <button
          onClick={toggleSelectionBorders}
          title={showSelectionBorders ? 'Hide selection borders' : 'Show selection borders'}
          className={`px-3 py-1 rounded transition-colors text-sm font-medium ${
            showSelectionBorders
              ? 'bg-gray-600 text-white hover:bg-gray-500'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Borders
        </button>
        
        <button
          onClick={toggleSelectionTools}
          title={showSelectionTools ? 'Hide selection tools' : 'Show selection tools'}
          className={`px-3 py-1 rounded transition-colors text-sm font-medium ${
            showSelectionTools
              ? 'bg-gray-600 text-white hover:bg-gray-500'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Tools
        </button>
        
        {showSelectionBorders && (
          <div className="flex items-center gap-2 pl-2">
            <label className="text-xs text-gray-400 whitespace-nowrap">Speed:</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={borderAnimationSpeed}
              onChange={(e) => setSelectionBorderAnimationSpeed(parseFloat(e.target.value))}
              className="w-24 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              title="Border animation speed (0 = static, 1 = max speed)"
            />
          </div>
        )}
      </div>

      {/* Right: Zoom Controls */}
      <div className="flex items-center gap-2 ml-auto">
        <ZoomControls />
      </div>
    </div>
  );
}

export default Toolbar;
