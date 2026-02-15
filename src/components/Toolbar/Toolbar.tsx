import { useState, useEffect, Fragment } from 'react';
import useCompositorStore from '../../store/compositorStore';
import { savePreferences, loadPreferences } from '../../hooks/useLocalStorage';
import ZoomControls from './ZoomControls';
import FileOperations from './FileOperations';
import HistoryControls from './HistoryControls';
import GridToggle from './GridToggle';
import { usePortraitMode } from '../../hooks/usePortraitMode';

/**
 * Top toolbar component
 * Contains project name, file operations, zoom controls
 */
function Toolbar({ onHelpClick }: { onHelpClick?: () => void }) {
  const project = useCompositorStore((state) => state.project);
  const setProjectName = useCompositorStore((state) => state.setProjectName);
  const showSelectionBorders = useCompositorStore((state) => state.ui.showSelectionBorders);
  const toggleSelectionBorders = useCompositorStore((state) => state.toggleSelectionBorders);
  const showSelectionTools = useCompositorStore((state) => state.ui.showSelectionTools);
  const toggleSelectionTools = useCompositorStore((state) => state.toggleSelectionTools);
  const borderAnimationSpeed = useCompositorStore((state) => state.ui.selectionBorderAnimationSpeed);
  const setSelectionBorderAnimationSpeed = useCompositorStore((state) => state.setSelectionBorderAnimationSpeed);
  const [isEditingName, setIsEditingName] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [tempName, setTempName] = useState(project.projectName);
  const isPortrait = usePortraitMode();

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

  // Shared grid/border/tools controls — rendered in different locations based on orientation
  const gridBorderToolsControls = (
    <>
      <GridToggle />
      {/* Hidden: Borders toggle + animation speed (code preserved) */}
      {false && (
        <>
          <div className="w-px h-6 bg-border"></div>
          <button
            id="btn-toggle-borders"
            onClick={toggleSelectionBorders}
            title={showSelectionBorders ? 'Hide selection borders' : 'Show selection borders'}
            aria-label={showSelectionBorders ? 'Hide selection borders' : 'Show selection borders'}
            aria-pressed={showSelectionBorders}
            className={`px-3 py-1 rounded transition-colors text-sm font-medium ${
              showSelectionBorders
                ? 'bg-gray-600 text-white hover:bg-gray-500'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Borders
          </button>
          {showSelectionBorders && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400 whitespace-nowrap">Speed:</label>
              <input
                id="input-border-speed"
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={borderAnimationSpeed}
                onChange={(e) => setSelectionBorderAnimationSpeed(parseFloat(e.target.value))}
                className="w-24 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                title="Border animation speed (0 = static, 1 = max speed)"
                aria-label="Border animation speed"
              />
            </div>
          )}
          <div className="w-px h-6 bg-border"></div>
          <button
            id="btn-toggle-tools"
            onClick={toggleSelectionTools}
            title={showSelectionTools ? 'Hide selection tools' : 'Show selection tools'}
            aria-label={showSelectionTools ? 'Hide selection tools' : 'Show selection tools'}
            aria-pressed={showSelectionTools}
            className={`px-3 py-1 rounded transition-colors text-sm font-medium ${
              showSelectionTools
                ? 'bg-gray-600 text-white hover:bg-gray-500'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Tools
          </button>
        </>
      )}
    </>
  );

  return (
    <>
    <div className="bg-panel-bg border-b border-border px-4 py-2" data-region="toolbar">
      {/* Row 1 */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Branding + Name */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="text-lg font-semibold whitespace-nowrap">
            <span className="text-red-500">Pi</span><span className="text-sky-400 hidden sm:inline">xelConnect</span>
          </div>
          <div className="text-gray-500 hidden sm:block">|</div>
        
        {isEditingName ? (
          <input
            id="input-project-name"
            autoFocus
            type="text"
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            onBlur={handleNameSave}
            onKeyDown={handleKeyDown}
            className="flex-1 px-2 py-1 bg-canvas-bg border border-blue-500 rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Project name..."
            aria-label="Project name"
          />
        ) : (
          <button
            id="btn-rename-project"
            onClick={() => {
              setTempName(project.projectName);
              setIsEditingName(true);
            }}
            className="flex-1 text-left px-2 py-1 text-gray-300 hover:text-white hover:bg-canvas-bg rounded transition-colors truncate"
            title="Click to rename project"
            aria-label="Rename project"
          >
            {project.projectName}
          </button>
        )}
        </div>

        {/* File + History */}
        <div className="flex items-center gap-2">
          <FileOperations />
          <div className="w-px h-6 bg-border"></div>
          <HistoryControls />
          <div className="w-px h-6 bg-border"></div>
          <button
            onClick={() => setShowShortcuts(true)}
            className="px-2 py-1 rounded text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
            title="Keyboard shortcuts"
            aria-label="Keyboard shortcuts"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <rect x="2" y="6" width="20" height="12" rx="2" />
              <path d="M6 10h0m4 0h0m4 0h0m4 0h0M8 14h8" strokeLinecap="round" />
            </svg>
          </button>
          {onHelpClick && (
            <>
              <button
                onClick={onHelpClick}
                className="px-2 py-1 rounded text-sm font-bold text-blue-400 hover:text-white hover:bg-gray-700 transition-colors"
                title="Open tutorial"
                aria-label="Open tutorial"
              >
                ?
              </button>
            </>
          )}
        </div>

        {/* Desktop: Grid/Borders/Tools + Zoom all on row 1 */}
        {!isPortrait && (
          <>
            <div className="w-px h-6 bg-border"></div>
            <div className="flex items-center gap-2">
              {gridBorderToolsControls}
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <ZoomControls />
            </div>
          </>
        )}
      </div>

      {/* Row 2: Portrait only — Grid/Borders/Tools + Zoom */}
      {isPortrait && (
        <div className="flex items-center gap-2 flex-wrap mt-2 pt-2 border-t border-border justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            {gridBorderToolsControls}
          </div>
          <ZoomControls />
        </div>
      )}
    </div>

    {/* Keyboard Shortcuts Modal */}
    {showShortcuts && (
      <div className="fixed inset-0 z-[400] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60" onClick={() => setShowShortcuts(false)} />
        <div className="relative bg-panel-bg border border-border rounded-lg shadow-2xl w-[520px] max-h-[80vh] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-gray-200">Keyboard Shortcuts</h2>
            <button onClick={() => setShowShortcuts(false)} className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="overflow-y-auto p-5 space-y-4 text-sm">
            <ShortcutSection title="General">
              <Shortcut keys="Ctrl + S" desc="Save project" />
              <Shortcut keys="Ctrl + O" desc="Open / load project" />
              <Shortcut keys="Ctrl + Z" desc="Undo" />
              <Shortcut keys="Ctrl + Shift + Z" desc="Redo" />
              <Shortcut keys="Ctrl + Y" desc="Redo (alt)" />
            </ShortcutSection>
            <ShortcutSection title="Layers">
              <Shortcut keys="Ctrl + A" desc="Select all layers" />
              <Shortcut keys="Ctrl + D" desc="Deselect all" />
              <Shortcut keys="Ctrl + C" desc="Copy selected layers" />
              <Shortcut keys="Ctrl + V" desc="Paste from clipboard" />
              <Shortcut keys="Delete / Backspace" desc="Delete selected layers" />
              <Shortcut keys="Shift + ↑ / ↓" desc="Reorder layer up / down" />
            </ShortcutSection>
            <ShortcutSection title="Movement">
              <Shortcut keys="Arrow keys" desc="Nudge selected layer (1 px)" />
              <Shortcut keys="Hold arrow keys" desc="Continuous nudge" />
            </ShortcutSection>
            <ShortcutSection title="Viewport">
              <Shortcut keys="+ / −" desc="Zoom in / out" />
              <Shortcut keys="0" desc="Reset zoom to 100%" />
              <Shortcut keys="Scroll wheel" desc="Zoom in / out (canvas)" />
              <Shortcut keys="Middle-click drag" desc="Pan canvas" />
              <Shortcut keys="Space + drag" desc="Pan canvas" />
            </ShortcutSection>
            <ShortcutSection title="Other">
              <Shortcut keys="Ctrl + Shift + D" desc="Debug history modal" />
              <Shortcut keys="Drop image file" desc="Add as new layer" />
            </ShortcutSection>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function ShortcutSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">{title}</h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Shortcut({ keys, desc }: { keys: string; desc: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-300">{desc}</span>
      <span className="flex gap-1">
        {keys.split(' + ').map((k, i) => (
          <Fragment key={i}>
            {i > 0 && <span className="text-gray-500">+</span>}
            <kbd className="px-1.5 py-0.5 bg-gray-700 border border-gray-600 rounded text-xs font-mono text-gray-200">{k.trim()}</kbd>
          </Fragment>
        ))}
      </span>
    </div>
  );
}

export default Toolbar;
