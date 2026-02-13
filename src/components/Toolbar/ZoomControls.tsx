import useCompositorStore from '../../store/compositorStore';

/**
 * Zoom controls component
 * Provides zoom in/out, reset, and preset zoom levels
 */
function ZoomControls() {
  const viewport = useCompositorStore((state) => state.project.viewport);
  const canvas = useCompositorStore((state) => state.project.canvas);
  const setViewport = useCompositorStore((state) => state.setViewport);

  const ZOOM_LEVELS = [25, 33, 50, 66, 75, 100, 125, 150, 200, 400, 800, 1600, 3200];

  const calculateFitZoom = (): number => {
    // Find the canvas container element
    const container = document.querySelector('[data-region="canvas"]');
    if (!container) {
      return 100; // Fallback to 100%
    }

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    if (containerWidth <= 0 || containerHeight <= 0) {
      return 100;
    }

    if (canvas.width <= 0 || canvas.height <= 0) {
      return 100;
    }

    const scaleX = containerWidth / canvas.width;
    const scaleY = containerHeight / canvas.height;

    const fitZoom = Math.min(scaleX, scaleY) * 100;
    // Snap to a preset zoom level, then go one level smaller for better visibility
    const nearestZoom = ZOOM_LEVELS.reduce((prev, curr) =>
      Math.abs(curr - fitZoom) < Math.abs(prev - fitZoom) ? curr : prev
    );
    
    // Find the index of nearest zoom and go one level smaller for better visibility
    const nearestIndex = ZOOM_LEVELS.indexOf(nearestZoom);
    const resetZoom = nearestIndex > 0 ? ZOOM_LEVELS[nearestIndex - 1] : nearestZoom;

    return resetZoom;
  };

  const handleZoom = (zoomLevel: number) => {
    // console.log(`[DEBUG] Zoom level changed to ${zoomLevel}%`);
    setViewport({ zoom: zoomLevel });
  };

  const handleZoomIn = () => {
    const currentZoom = viewport.zoom;
    const nextZoom = ZOOM_LEVELS.find((z) => z > currentZoom) || ZOOM_LEVELS[ZOOM_LEVELS.length - 1];
    handleZoom(nextZoom);
  };

  const handleZoomOut = () => {
    const currentZoom = viewport.zoom;
    const nextZoom = [...ZOOM_LEVELS].reverse().find((z) => z < currentZoom) || ZOOM_LEVELS[0];
    handleZoom(nextZoom);
  };

  const handleResetZoom = () => {
    const fitZoom = calculateFitZoom();
    setViewport({ zoom: fitZoom, panX: 0, panY: 0 });
  };

  return (
    <div className="flex items-center gap-2 bg-canvas-bg rounded px-2 py-1" data-region="zoom-controls">
      <button
        id="btn-zoom-out"
        onClick={handleZoomOut}
        className="px-2 py-1 text-sm font-medium text-gray-300 hover:text-white bg-panel-bg hover:bg-gray-700 rounded transition-colors"
        title="Zoom Out"
        aria-label="Zoom out"
      >
        −
      </button>

      <div className="relative group">
        <button
          id="btn-zoom-level"
          className="px-3 py-1 text-sm font-medium text-gray-300 hover:text-white bg-panel-bg hover:bg-gray-700 rounded transition-colors min-w-16 text-right"
          title="Click to select zoom level"
          aria-label={`Current zoom: ${viewport.zoom}%`}
        >
          {viewport.zoom}%
        </button>

        {/* Dropdown menu */}
        <div className="absolute right-0 mt-1 w-24 bg-panel-bg border border-border rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
          {ZOOM_LEVELS.map((zoom) => (
            <button
              key={zoom}
              id={`btn-zoom-preset-${zoom}`}
              onClick={() => handleZoom(zoom)}
              className={`w-full text-left px-3 py-1 text-sm transition-colors ${
                viewport.zoom === zoom
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
              aria-label={`Set zoom to ${zoom}%`}
            >
              {zoom}%
            </button>
          ))}
        </div>
      </div>

      <button
        id="btn-zoom-in"
        onClick={handleZoomIn}
        className="px-2 py-1 text-sm font-medium text-gray-300 hover:text-white bg-panel-bg hover:bg-gray-700 rounded transition-colors"
        title="Zoom In"
        aria-label="Zoom in"
      >
        +
      </button>

      <div className="w-px h-4 bg-border"></div>

      <button
        id="btn-zoom-reset"
        onClick={handleResetZoom}
        className="px-2 py-1 text-xs font-medium text-gray-400 hover:text-gray-300 hover:bg-gray-700 rounded transition-colors"
        title="Fit canvas to screen"
        aria-label="Fit canvas to screen"
      >
        Reset
      </button>
    </div>
  );
}

export default ZoomControls;
