/**
 * Custom hook for handling keyboard shortcuts
 * Implements all essential shortcuts from the requirements
 */

import { useEffect, useRef } from 'react';
import useCompositorStore from '../store/compositorStore';

export function useKeyboardShortcuts() {
  const project = useCompositorStore((state) => state.project);
  const selectedLayerIds = useCompositorStore((state) => state.selectedLayerIds);
  const selectAllLayers = useCompositorStore((state) => state.selectAllLayers);
  const deselectAllLayers = useCompositorStore((state) => state.deselectAllLayers);
  const deleteSelectedLayers = useCompositorStore((state) => state.deleteSelectedLayers);
  const moveSelectedLayers = useCompositorStore((state) => state.moveSelectedLayers);
  const setViewport = useCompositorStore((state) => state.setViewport);
  const undo = useCompositorStore((state) => state.undo);
  const redo = useCompositorStore((state) => state.redo);
  const copySelectedLayers = useCompositorStore((state) => state.copySelectedLayers);
  const copySelectedLayersToClipboard = useCompositorStore((state) => state.copySelectedLayersToClipboard);
  const pasteSelectedLayers = useCompositorStore((state) => state.pasteSelectedLayers);
  const pasteFromClipboard = useCompositorStore((state) => state.pasteFromClipboard);
  const reorderSelectedLayers = useCompositorStore((state) => state.reorderSelectedLayers);
  const setSpaceHeld = useCompositorStore((state) => state.setSpaceHeld);

  const isPanningRef = useRef(false);
  const panStartXRef = useRef(0);
  const panStartYRef = useRef(0);
  const keysHeldRef = useRef<Set<string>>(new Set());
  const movementIntervalRef = useRef<number | null>(null);

  // Handle continuous movement when keys are held
  const startContinuousMovement = () => {
    if (movementIntervalRef.current !== null) return;
    if (selectedLayerIds.length === 0) return;

    movementIntervalRef.current = window.setInterval(() => {
      let totalDx = 0;
      let totalDy = 0;

      const movements: Record<string, [number, number]> = {
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
      };

      // Check all arrow keys
      for (const [key, [dx, dy]] of Object.entries(movements)) {
        if (keysHeldRef.current.has(key)) {
          totalDx += dx;
          totalDy += dy;
        }
      }

      // Check shift for 10px nudges
      if (keysHeldRef.current.has('ShiftLeft') || keysHeldRef.current.has('ShiftRight')) {
        totalDx *= 10;
        totalDy *= 10;
      }

      if (totalDx !== 0 || totalDy !== 0) {
        moveSelectedLayers(totalDx, totalDy);
      }
    }, 50); // 50ms per movement
  };

  const stopContinuousMovement = () => {
    if (movementIntervalRef.current !== null) {
      clearInterval(movementIntervalRef.current);
      movementIntervalRef.current = null;
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if typing in an input field
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        // Allow Ctrl+S and Ctrl+O even in input fields
        if (!((event.ctrlKey || event.metaKey) && (event.key === 's' || event.key === 'o'))) {
          return;
        }
      }

      const isCtrlOrCmd = event.ctrlKey || event.metaKey;
      const isShift = event.shiftKey;

      // Spacebar: Start pan mode (temporary override)
      if (event.code === 'Space' && !event.repeat) {
        event.preventDefault();
        isPanningRef.current = true;
        setSpaceHeld(true);
        return;
      }

      // Shift + Up/Down: Reorder selected layers (check BEFORE adding to keysHeld)
      if (isShift && !isCtrlOrCmd && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        if (selectedLayerIds.length > 0) {
          event.preventDefault();
          const direction = event.key === 'ArrowUp' ? 'up' : 'down';
          // console.log(`[DEBUG] Reorder layers triggered by Shift+${event.key} - moving ${direction}`);
          reorderSelectedLayers(direction);
        }
        return;
      }

      // Arrow keys for nudging (add to held keys for continuous movement)
      // Only if NOT shift (since shift is for layer reordering)
      if (!isShift && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault();
        keysHeldRef.current.add(event.key);
        if (keysHeldRef.current.has('ShiftLeft') || keysHeldRef.current.has('ShiftRight')) {
          keysHeldRef.current.add('ShiftLeft');
        }
        startContinuousMovement();
        return;
      }

      // Track Shift key for 10px movement
      if (event.key === 'Shift') {
        keysHeldRef.current.add(event.code);
        return;
      }

      // Ctrl/Cmd + Z: Undo
      if (isCtrlOrCmd && event.key.toLowerCase() === 'z' && !isShift) {
        event.preventDefault();
        // console.log('[DEBUG] Undo triggered by Ctrl+Z');
        undo();
        return;
      }

      // Ctrl/Cmd + Shift + Z: Redo
      if (isCtrlOrCmd && event.key.toLowerCase() === 'z' && isShift) {
        event.preventDefault();
        // console.log('[DEBUG] Redo triggered by Ctrl+Shift+Z');
        redo();
        return;
      }

      // Ctrl/Cmd + Y: Redo (auxiliary binding)
      if (isCtrlOrCmd && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        // console.log('[DEBUG] Redo triggered by Ctrl+Y');
        redo();
        return;
      }

      // Delete / Backspace: Remove selected layers
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedLayerIds.length > 0) {
          event.preventDefault();
          const confirmed = window.confirm(
            `Delete ${selectedLayerIds.length} layer${selectedLayerIds.length !== 1 ? 's' : ''}?`
          );
          if (confirmed) {
            // console.log(`[DEBUG] Delete triggered by ${event.key} - removing ${selectedLayerIds.length} layer(s)`);
            deleteSelectedLayers();
          }
        }
        return;
      }

      // Ctrl/Cmd + A: Select all layers
      if (isCtrlOrCmd && event.key === 'a') {
        event.preventDefault();
        if (project.layers.length > 0) {
          // console.log('[DEBUG] Select all triggered by Ctrl+A');
          selectAllLayers();
        }
        return;
      }

      // Ctrl/Cmd + D: Deselect all layers
      if (isCtrlOrCmd && event.key === 'd') {
        event.preventDefault();
        // console.log('[DEBUG] Deselect all triggered by Ctrl+D');
        deselectAllLayers();
        return;
      }

      // Ctrl/Cmd + C: Copy selected layers
      if (isCtrlOrCmd && event.key === 'c') {
        if (selectedLayerIds.length > 0) {
          event.preventDefault();
          // console.log(`[DEBUG] Copy triggered by Ctrl+C - copying ${selectedLayerIds.length} layer(s)`);
          copySelectedLayers();
          copySelectedLayersToClipboard();
        }
        return;
      }

      // Ctrl/Cmd + V: Paste from clipboard
      if (isCtrlOrCmd && event.key === 'v') {
        event.preventDefault();
        pasteFromClipboard();
        return;
      }

      // +/-: Zoom in/out
      if ((event.key === '+' || event.key === '=') && !isCtrlOrCmd) {
        event.preventDefault();
        const currentZoom = project.viewport.zoom;
        const zoomLevels = [25, 50, 100, 200, 400, 800, 1600];
        const nextZoom = zoomLevels.find((z) => z > currentZoom) || zoomLevels[zoomLevels.length - 1];
        // console.log(`[DEBUG] Zoom in triggered by + - ${currentZoom}% -> ${nextZoom}%`);
        setViewport({ zoom: nextZoom });
        return;
      }

      if (event.key === '-' && !isCtrlOrCmd) {
        event.preventDefault();
        const currentZoom = project.viewport.zoom;
        const zoomLevels = [25, 50, 100, 200, 400, 800, 1600];
        const nextZoom = [...zoomLevels].reverse().find((z) => z < currentZoom) || zoomLevels[0];
        // console.log(`[DEBUG] Zoom out triggered by - - ${currentZoom}% -> ${nextZoom}%`);
        setViewport({ zoom: nextZoom });
        return;
      }

      // 0: Reset zoom to 100%
      if (event.key === '0') {
        event.preventDefault();
        // console.log('[DEBUG] Reset zoom triggered by 0 key');
        setViewport({ zoom: 100 });
        return;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      // Spacebar: Stop pan mode
      if (event.code === 'Space') {
        isPanningRef.current = false;
        setSpaceHeld(false);
      }

      // Remove from held keys tracking
      keysHeldRef.current.delete(event.key);
      keysHeldRef.current.delete(event.code);

      // Stop continuous movement if no more arrow keys held
      const hasArrows = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].some(
        (key) => keysHeldRef.current.has(key)
      );
      if (!hasArrows) {
        stopContinuousMovement();
      }
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (isPanningRef.current) {
        // When leftClickPan is ON and space is held, space inverts to layer-drag mode,
        // so we should NOT start panning here — let CanvasRenderer handle it
        const leftClickPan = useCompositorStore.getState().ui.leftClickPan;
        if (leftClickPan) return;
        panStartXRef.current = event.clientX;
        panStartYRef.current = event.clientY;
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (isPanningRef.current && (event.buttons & 1) === 1) {
        // Don't pan here if leftClickPan is ON (space inverts to drag mode)
        const leftClickPan = useCompositorStore.getState().ui.leftClickPan;
        if (leftClickPan) return;
        const deltaX = event.clientX - panStartXRef.current;
        const deltaY = event.clientY - panStartYRef.current;

        const zoom = project.viewport.zoom / 100;
        const panDeltaX = -deltaX / zoom;
        const panDeltaY = -deltaY / zoom;

        setViewport({
          panX: project.viewport.panX + panDeltaX,
          panY: project.viewport.panY + panDeltaY,
        });

        panStartXRef.current = event.clientX;
        panStartYRef.current = event.clientY;

        // console.log(`[DEBUG] Panning - delta (${panDeltaX}, ${panDeltaY})`);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);

    // Reset space-held state if window loses focus (prevents stuck state)
    const handleBlur = () => {
      isPanningRef.current = false;
      setSpaceHeld(false);
    };
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('blur', handleBlur);
      stopContinuousMovement();
      // Ensure spaceHeld is cleared when effect re-runs (prevents stuck state during re-mount)
      isPanningRef.current = false;
      setSpaceHeld(false);
    };
  }, [
    selectedLayerIds,
    project,
    selectAllLayers,
    deselectAllLayers,
    deleteSelectedLayers,
    moveSelectedLayers,
    setViewport,
    undo,
    redo,
    copySelectedLayers,
    copySelectedLayersToClipboard,
    pasteSelectedLayers,
    pasteFromClipboard,
    reorderSelectedLayers,
    setSpaceHeld,
  ]);
}

export default useKeyboardShortcuts;
