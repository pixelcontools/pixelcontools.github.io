import { useRef, useEffect, useState, useCallback } from 'react';
import useCompositorStore from '../../store/compositorStore';
import { serializeProject, deserializeProject, exportCanvasToPNG } from '../../utils/projectSerializer';
import {
  listSavedProjects, saveProjectLocal, loadProjectLocal, deleteProjectLocal,
  renameProjectLocal, generateThumbnail, formatBytes,
  SavedProjectMeta, SavedProject,
} from '../../utils/projectStorage';

/**
 * File operations component
 * Handles save/load project, export, new project
 * Save & Load are dropdowns; includes local (IndexedDB) project storage
 */
function FileOperations() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exportScale, setExportScale] = useState(1);
  const [saveOpen, setSaveOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);
  const [showSavedProjects, setShowSavedProjects] = useState(false);

  const project = useCompositorStore((state) => state.project);
  const resetProject = useCompositorStore((state) => state.resetProject);
  const loadProject = useCompositorStore((state) => state.loadProject);
  const markClean = useCompositorStore((state) => state.markClean);

  // Close dropdowns when clicking outside
  const saveRef = useRef<HTMLDivElement>(null);
  const loadRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (saveRef.current && !saveRef.current.contains(e.target as Node)) setSaveOpen(false);
      if (loadRef.current && !loadRef.current.contains(e.target as Node)) setLoadOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Keyboard shortcuts for save/load
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isCtrlOrCmd = event.ctrlKey || event.metaKey;
      if (isCtrlOrCmd && event.key === 's') {
        event.preventDefault();
        handleSaveProjectFile();
      }
      if (isCtrlOrCmd && event.key === 'o') {
        event.preventDefault();
        fileInputRef.current?.click();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [project]);

  // ─── Save handlers ──────────────────────────────────────────────────────

  /** Export project as .pixcomp file download */
  const handleSaveProjectFile = async () => {
    setSaveOpen(false);
    try {
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
      markClean();
    } catch (error) {
      alert(`Error saving project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  /** Export canvas as PNG */
  const handleExportPNG = async () => {
    setSaveOpen(false);
    try {
      const blob = await exportCanvasToPNG(
        project.layers, project.canvas.width, project.canvas.height,
        exportScale, project.canvas.backgroundColor,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.projectName || 'composite'}_${exportScale}x.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      alert(`Error exporting PNG: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  /** Save project to IndexedDB */
  const handleSaveLocal = async () => {
    setSaveOpen(false);
    try {
      const projectJson = serializeProject(project);
      const sizeBytes = new Blob([projectJson]).size;
      const thumbnail = await generateThumbnail(
        project.layers, project.canvas.width, project.canvas.height,
      );
      const entry: SavedProject = {
        id: `proj_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        name: project.projectName || 'Untitled',
        savedAt: new Date().toISOString(),
        sizeBytes,
        thumbnailDataUrl: thumbnail,
        layerCount: project.layers.length,
        canvasWidth: project.canvas.width,
        canvasHeight: project.canvas.height,
        projectJson,
      };
      await saveProjectLocal(entry);
      markClean();
      alert(`Project saved locally: ${entry.name}`);
    } catch (error) {
      alert(`Error saving locally: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // ─── Load handlers ──────────────────────────────────────────────────────

  /** Open file picker */
  const handleLoadFile = () => {
    setLoadOpen(false);
    fileInputRef.current?.click();
  };

  /** Show saved projects modal */
  const handleLoadLocal = () => {
    setLoadOpen(false);
    setShowSavedProjects(true);
  };

  /** Actually load from file input */
  const handleFileInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      if (file.name.toLowerCase().endsWith('.pixcomp') || file.name.toLowerCase().endsWith('.json')) {
        try {
          const text = await file.text();
          const projectData = await deserializeProject(text);
          loadProject(projectData);
          markClean();
        } catch (error) {
          alert(`Error loading project: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      } else if (file.type.startsWith('image/')) {
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
          const addLayer = useCompositorStore.getState().addLayer;
          addLayer({
            name: file.name,
            imageData: dataUrl,
            x: 0, y: 0,
            zIndex: useCompositorStore.getState().project.layers.length,
            visible: true, locked: false, opacity: 1.0,
            width: img.naturalWidth, height: img.naturalHeight,
          });
        } catch (error) {
          alert(`Error loading image ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /** Create new project */
  const handleNewProject = () => {
    if (useCompositorStore.getState().isDirty) {
      if (!window.confirm('You have unsaved changes. Create new project anyway?')) return;
    }
    resetProject();
  };

  /** Load a saved project from the modal */
  const handleLoadSavedProject = async (id: string) => {
    try {
      const entry = await loadProjectLocal(id);
      if (!entry) { alert('Project not found'); return; }
      const projectData = await deserializeProject(entry.projectJson);
      loadProject(projectData);
      markClean();
      setShowSavedProjects(false);
    } catch (error) {
      alert(`Error loading project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <>
      <div className="flex items-center gap-1" data-region="file-operations">
        {/* New */}
        <button
          onClick={handleNewProject}
          className="px-3 py-1 text-sm font-medium text-gray-300 hover:text-white bg-panel-bg hover:bg-gray-700 rounded transition-colors"
          title="New project"
        >
          New
        </button>

        {/* Save dropdown */}
        <div ref={saveRef} className="relative">
          <button
            onClick={() => { setSaveOpen(!saveOpen); setLoadOpen(false); }}
            className="px-3 py-1 text-sm font-medium text-gray-300 hover:text-white bg-panel-bg hover:bg-gray-700 rounded transition-colors flex items-center gap-1"
            title="Save options"
          >
            Save
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M19 9l-7 7-7-7" /></svg>
          </button>
          {saveOpen && (
            <div className="absolute left-0 mt-1 w-52 bg-panel-bg border border-border rounded shadow-lg z-50">
              <button
                onClick={handleSaveProjectFile}
                className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 transition-colors rounded-t"
              >
                <div className="font-medium">Export Project</div>
                <div className="text-xs text-gray-500">.pixcomp file download</div>
              </button>
              <button
                onClick={handleExportPNG}
                className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium">Export Image</div>
                  <select
                    onClick={(e) => e.stopPropagation()}
                    value={exportScale}
                    onChange={(e) => setExportScale(parseInt(e.target.value))}
                    className="bg-gray-700 text-xs rounded px-1 py-0.5 text-gray-300 border border-gray-600"
                  >
                    {[1, 2, 4, 8].map(s => <option key={s} value={s}>{s}x</option>)}
                  </select>
                </div>
                <div className="text-xs text-gray-500">PNG at {exportScale}x scale</div>
              </button>
              <div className="border-t border-border" />
              <button
                onClick={handleSaveLocal}
                className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 transition-colors rounded-b"
              >
                <div className="font-medium">Save Local</div>
                <div className="text-xs text-gray-500">Store in browser cache</div>
              </button>
            </div>
          )}
        </div>

        {/* Load dropdown */}
        <div ref={loadRef} className="relative">
          <button
            onClick={() => { setLoadOpen(!loadOpen); setSaveOpen(false); }}
            className="px-3 py-1 text-sm font-medium text-gray-300 hover:text-white bg-panel-bg hover:bg-gray-700 rounded transition-colors flex items-center gap-1"
            title="Load options (Ctrl+O)"
          >
            Load
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M19 9l-7 7-7-7" /></svg>
          </button>
          {loadOpen && (
            <div className="absolute left-0 mt-1 w-52 bg-panel-bg border border-border rounded shadow-lg z-50">
              <button
                onClick={handleLoadFile}
                className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 transition-colors rounded-t"
              >
                <div className="font-medium">Load File</div>
                <div className="text-xs text-gray-500">.pixcomp, PNG, GIF, BMP, JPEG</div>
              </button>
              <div className="border-t border-border" />
              <button
                onClick={handleLoadLocal}
                className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 transition-colors rounded-b"
              >
                <div className="font-medium">Load Local</div>
                <div className="text-xs text-gray-500">From browser cache</div>
              </button>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pixcomp,.json,image/png,image/gif,image/bmp,image/jpeg"
          onChange={handleFileInputChange}
          className="hidden"
        />
      </div>

      {/* Saved Projects Modal */}
      {showSavedProjects && (
        <SavedProjectsModal
          onClose={() => setShowSavedProjects(false)}
          onLoad={handleLoadSavedProject}
        />
      )}
    </>
  );
}

// ─── Saved Projects Modal ─────────────────────────────────────────────────

function SavedProjectsModal({ onClose, onLoad }: { onClose: () => void; onLoad: (id: string) => void }) {
  const [projects, setProjects] = useState<SavedProjectMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listSavedProjects();
      setProjects(list);
    } catch (e) {
      console.error('Failed to list saved projects:', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete saved project "${name}"?`)) return;
    await deleteProjectLocal(id);
    refresh();
  };

  const handleRenameStart = (id: string, currentName: string) => {
    setRenamingId(id);
    setRenameValue(currentName);
  };

  const handleRenameSubmit = async (id: string) => {
    if (renameValue.trim()) {
      await renameProjectLocal(id, renameValue.trim());
      refresh();
    }
    setRenamingId(null);
  };

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-panel-bg border border-border rounded-lg shadow-2xl w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-gray-200">Saved Projects (Local)</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-4">
          {loading ? (
            <div className="text-center text-gray-400 py-8">Loading...</div>
          ) : projects.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              <div className="text-3xl mb-2">📁</div>
              <div className="text-sm">No saved projects yet</div>
              <div className="text-xs text-gray-600 mt-1">Use Save → Save Local to store projects in your browser</div>
            </div>
          ) : (
            <div className="space-y-2">
              {projects.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 p-3 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg transition-colors group"
                >
                  {/* Thumbnail */}
                  <div className="w-14 h-14 rounded bg-gray-900 overflow-hidden flex-shrink-0 border border-gray-700">
                    {p.thumbnailDataUrl ? (
                      <img src={p.thumbnailDataUrl} alt="" className="w-full h-full object-contain" style={{ imageRendering: 'pixelated' }} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-600 text-lg">?</div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    {renamingId === p.id ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => handleRenameSubmit(p.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameSubmit(p.id);
                          if (e.key === 'Escape') setRenamingId(null);
                        }}
                        className="bg-gray-900 border border-blue-500 rounded px-2 py-0.5 text-sm text-white w-full focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    ) : (
                      <div className="text-sm font-medium text-gray-200 truncate">{p.name}</div>
                    )}
                    <div className="text-xs text-gray-500 mt-0.5">
                      {formatBytes(p.sizeBytes)} · {p.layerCount} layer{p.layerCount !== 1 ? 's' : ''} · {p.canvasWidth}×{p.canvasHeight}
                    </div>
                    <div className="text-xs text-gray-600">
                      {new Date(p.savedAt).toLocaleDateString()} {new Date(p.savedAt).toLocaleTimeString()}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button
                      onClick={() => onLoad(p.id)}
                      className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
                      title="Load this project"
                    >
                      Load
                    </button>
                    <button
                      onClick={() => handleRenameStart(p.id, p.name)}
                      className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-600 rounded transition-colors"
                      title="Rename"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(p.id, p.name)}
                      className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-600 rounded transition-colors"
                      title="Delete"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default FileOperations;
