import { useEffect, useRef } from 'react';
import useCompositorStore from '../store/compositorStore';

/**
 * Hook that automatically resets zoom to fit canvas when the first layer is added
 * to an empty canvas
 */
export function useAutoResetZoom() {
  const layers = useCompositorStore((state) => state.project.layers);
  const canvas = useCompositorStore((state) => state.project.canvas);
  const setViewport = useCompositorStore((state) => state.setViewport);
  const hadLayersRef = useRef(false);
  const ZOOM_LEVELS = [25, 33, 50, 66, 100, 150, 200, 400, 800, 1600, 3200];

  useEffect(() => {
    const hasLayers = layers.length > 0;

    // Trigger zoom reset when transitioning from no layers to having layers
    if (hasLayers && !hadLayersRef.current) {
      hadLayersRef.current = true;

      // Defer to next frame to ensure DOM is ready
      const timer = setTimeout(() => {
        const container = document.querySelector('[data-canvas-container="true"]');
        if (!container) return;

        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;

        if (containerWidth <= 0 || containerHeight <= 0 || canvas.width <= 0 || canvas.height <= 0) {
          return;
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

        setViewport({ zoom: resetZoom, panX: 0, panY: 0 });
      }, 50);

      return () => clearTimeout(timer);
    }

    // Reset flag when all layers are removed
    if (!hasLayers) {
      hadLayersRef.current = false;
    }
  }, [layers.length, canvas.width, canvas.height, setViewport]);
}
