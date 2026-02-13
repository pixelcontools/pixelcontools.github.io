import useCompositorStore from '../../store/compositorStore';

/**
 * Undo/Redo controls component
 */
function HistoryControls() {
  const history = useCompositorStore((state) => state.history);
  const undo = useCompositorStore((state) => state.undo);
  const redo = useCompositorStore((state) => state.redo);

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  const handleUndo = () => {
    // console.log('[DEBUG] Undo clicked');
    undo();
  };

  const handleRedo = () => {
    // console.log('[DEBUG] Redo clicked');
    redo();
  };

  return (
    <div className="flex items-center gap-1" data-region="history-controls">
      <button
        id="btn-undo"
        onClick={handleUndo}
        disabled={!canUndo}
        className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
          canUndo
            ? 'text-gray-300 hover:text-white bg-panel-bg hover:bg-gray-700'
            : 'text-gray-600 bg-panel-bg cursor-not-allowed opacity-50'
        }`}
        title={`Undo (${history.past.length} operation${history.past.length !== 1 ? 's' : ''} available) - Ctrl+Z`}
        aria-label="Undo"
      >
        ↶
      </button>

      <button
        id="btn-redo"
        onClick={handleRedo}
        disabled={!canRedo}
        className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
          canRedo
            ? 'text-gray-300 hover:text-white bg-panel-bg hover:bg-gray-700'
            : 'text-gray-600 bg-panel-bg cursor-not-allowed opacity-50'
        }`}
        title={`Redo (${history.future.length} operation${history.future.length !== 1 ? 's' : ''} available) - Ctrl+Shift+Z`}
        aria-label="Redo"
      >
        ↷
      </button>
    </div>
  );
}

export default HistoryControls;
