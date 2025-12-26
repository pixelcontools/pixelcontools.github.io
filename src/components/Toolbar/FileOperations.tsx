import { useRef, useEffect, useState } from 'react';
import useCompositorStore from '../../store/compositorStore';
import { serializeProject, deserializeProject, exportCanvasToPNG } from '../../utils/projectSerializer';

/**
 * File operations component
 * Handles save/load project, export, new project
 */
function FileOperations() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exportScale, setExportScale] = useState(1);

  const project = useCompositorStore((state) => state.project);
  const resetProject = useCompositorStore((state) => state.resetProject);
  const loadProject = useCompositorStore((state) => state.loadProject);
  const markClean = useCompositorStore((state) => state.markClean);

  // Setup keyboard shortcuts for save/load
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isCtrlOrCmd = event.ctrlKey || event.metaKey;

      // Ctrl/Cmd + S: Save project
      if (isCtrlOrCmd && event.key === 's') {
        event.preventDefault();
        // console.log('[DEBUG] Save triggered by Ctrl+S');
        handleSaveProject();
      }

      // Ctrl/Cmd + O: Load project
      if (isCtrlOrCmd && event.key === 'o') {
        event.preventDefault();
        // console.log('[DEBUG] Load triggered by Ctrl+O');
        fileInputRef.current?.click();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [project]);

  /**
   * Save project as .pixcomp file (embedded format with base64 images)
   */
  const handleSaveProject = async () => {
    try {
      // console.log('[DEBUG] Starting project save...');
      
      const projectJson = serializeProject(project);
      const blob = new Blob([projectJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.projectName || 'untitled'}.pixcomp`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      // console.log(`[DEBUG] Project saved successfully: ${a.download}`);
      markClean();
      
      // Show success message
      alert(`Project saved: ${a.download}`);
    } catch (error) {
      console.error('[DEBUG] Save project failed:', error);
      alert(`Error saving project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  /**
   * Load project from .pixcomp file
   */
  const handleLoadProject = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      console.warn('[DEBUG] No file selected for loading');
      return;
    }

    try {
      // console.log(`[DEBUG] Loading project from file: ${file.name}`);
      
      const text = await file.text();
      const projectData = await deserializeProject(text);

      // console.log('[DEBUG] Project loaded and validated successfully');
      loadProject(projectData);
      markClean();
      
      alert(`Project loaded: ${file.name}`);
    } catch (error) {
      console.error('[DEBUG] Load project failed:', error);
      alert(`Error loading project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  /**
   * Create new project
   */
  const handleNewProject = () => {
    if (useCompositorStore.getState().isDirty) {
      const confirmed = window.confirm('You have unsaved changes. Create new project anyway?');
      if (!confirmed) {
        // console.log('[DEBUG] New project cancelled by user');
        return;
      }
    }
    
    // console.log('[DEBUG] Creating new project');
    resetProject();
  };

  /**
   * Export canvas as PNG
   */
  const handleExportPNG = async () => {
    try {
      // console.log(`[DEBUG] Exporting canvas as PNG (scale: ${exportScale}x)`);

      const blob = await exportCanvasToPNG(
        project.layers,
        project.canvas.width,
        project.canvas.height,
        exportScale,
        project.canvas.backgroundColor
      );

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.projectName || 'composite'}_${exportScale}x.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // console.log(`[DEBUG] PNG exported successfully: ${a.download}`);
      alert(`PNG exported: ${a.download}`);
    } catch (error) {
      console.error('[DEBUG] Export PNG failed:', error);
      alert(`Error exporting PNG: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={handleNewProject}
        className="px-3 py-1 text-sm font-medium text-gray-300 hover:text-white bg-panel-bg hover:bg-gray-700 rounded transition-colors"
        title="New project"
      >
        New
      </button>

      <button
        onClick={handleSaveProject}
        className="px-3 py-1 text-sm font-medium text-gray-300 hover:text-white bg-panel-bg hover:bg-gray-700 rounded transition-colors"
        title="Save project as .pixcomp file (Ctrl+S)"
      >
        Save
      </button>

      <button
        onClick={() => fileInputRef.current?.click()}
        className="px-3 py-1 text-sm font-medium text-gray-300 hover:text-white bg-panel-bg hover:bg-gray-700 rounded transition-colors"
        title="Load project from .pixcomp file (Ctrl+O)"
      >
        Load
      </button>

      <button
        onClick={handleExportPNG}
        className="px-3 py-1 text-sm font-medium text-gray-300 hover:text-white bg-panel-bg hover:bg-gray-700 rounded transition-colors"
        title="Export canvas as PNG"
      >
        Export
      </button>

      {/* Export Scale Selector (shown when hovering Export button) */}
      <div className="relative group">
        <button
          className="px-2 py-1 text-xs font-medium text-gray-400 hover:text-gray-300 bg-panel-bg hover:bg-gray-700 rounded transition-colors opacity-0 group-hover:opacity-100"
          title="Export scale"
        >
          {exportScale}x
        </button>

        {/* Scale dropdown */}
        <div className="absolute right-0 mt-1 w-16 bg-panel-bg border border-border rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
          {[1, 2, 4, 8].map((scale) => (
            <button
              key={scale}
              onClick={() => {
                setExportScale(scale);
                // console.log(`[DEBUG] Export scale changed to ${scale}x`);
              }}
              className={`w-full text-left px-2 py-1 text-xs transition-colors ${
                exportScale === scale
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
            >
              {scale}x
            </button>
          ))}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pixcomp,.json"
        onChange={handleLoadProject}
        className="hidden"
      />
    </div>
  );
}

export default FileOperations;
