import { useEffect, useRef, useCallback } from 'react';
import useCompositorStore from '../store/compositorStore';

const ZOOM_LEVELS = [25, 33, 50, 66, 75, 100, 125, 150, 200, 400, 800, 1600, 3200];

/**
 * Calculate the best zoom level to fit the canvas in the container
 */
function calculateFitZoom(canvasWidth: number, canvasHeight: number): number {
  const container = document.querySelector('[data-region="canvas"]');
  if (!container) return 100;

  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;

  if (containerWidth <= 0 || containerHeight <= 0 || canvasWidth <= 0 || canvasHeight <= 0) {
    return 100;
  }

  const scaleX = containerWidth / canvasWidth;
  const scaleY = containerHeight / canvasHeight;

  const fitZoom = Math.min(scaleX, scaleY) * 100;
  const nearestZoom = ZOOM_LEVELS.reduce((prev, curr) =>
    Math.abs(curr - fitZoom) < Math.abs(prev - fitZoom) ? curr : prev
  );

  // Go one level smaller for breathing room
  const nearestIndex = ZOOM_LEVELS.indexOf(nearestZoom);
  return nearestIndex > 0 ? ZOOM_LEVELS[nearestIndex - 1] : nearestZoom;
}

/**
 * Hook that automatically resets zoom to fit canvas when the first layer is added
 * to an empty canvas. Also auto-crops canvas to layers on first layer add.
 * Exposes window.fitCanvasToScreen() for other components.
 */
export function useAutoResetZoom() {
  const layers = useCompositorStore((state) => state.project.layers);
  const cropCanvasToLayers = useCompositorStore((state) => state.cropCanvasToLayers);
  const hadLayersRef = useRef(false);

  // Fit-to-screen function that reads latest state
  const fitCanvasToScreen = useCallback(() => {
    // Defer to let DOM/state settle
    setTimeout(() => {
      const state = useCompositorStore.getState();
      const fitZoom = calculateFitZoom(state.project.canvas.width, state.project.canvas.height);
      state.setViewport({ zoom: fitZoom, panX: 0, panY: 0 });
    }, 50);
  }, []);

  // Expose globally so CanvasSettings (and others) can invoke after crop
  useEffect(() => {
    (window as any).fitCanvasToScreen = fitCanvasToScreen;
    return () => { delete (window as any).fitCanvasToScreen; };
  }, [fitCanvasToScreen]);

  useEffect(() => {
    const hasLayers = layers.length > 0;

    // Trigger crop + zoom reset when transitioning from no layers to having layers
    if (hasLayers && !hadLayersRef.current) {
      hadLayersRef.current = true;

      // First crop the canvas to fit the layers, then fit-to-screen
      const timer = setTimeout(() => {
        cropCanvasToLayers();

        // After crop state settles, fit zoom
        setTimeout(() => {
          const state = useCompositorStore.getState();
          const fitZoom = calculateFitZoom(state.project.canvas.width, state.project.canvas.height);
          state.setViewport({ zoom: fitZoom, panX: 0, panY: 0 });
        }, 50);
      }, 50);

      return () => clearTimeout(timer);
    }

    // Reset flag when all layers are removed
    if (!hasLayers) {
      hadLayersRef.current = false;
    }
  }, [layers.length, cropCanvasToLayers]);
}
