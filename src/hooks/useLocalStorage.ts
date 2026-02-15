/**
 * Custom hook for syncing store state with localStorage
 * Persists UI preferences and canvas settings across sessions
 */

import { useEffect } from 'react';
import useCompositorStore from '../store/compositorStore';

const STORAGE_KEY = 'pixelconnect-preferences';

interface StoredPreferences {
  // Grid settings
  gridDensity?: number;
  gridEnabled?: boolean;
  
  // Border settings
  showSelectionBorders?: boolean;
  selectionBorderAnimationSpeed?: number;
  
  // Canvas border settings
  canvasBorderColor?: string;
  canvasBorderWidth?: number;
  canvasBorderOpacity?: number;
  canvasBorderEnabled?: boolean;
  canvasShadowIntensity?: number;

  // Pan mode
  leftClickPan?: boolean;
}

/**
 * Load preferences from localStorage
 */
export function loadPreferences(): StoredPreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.warn('[DEBUG] Failed to load preferences from localStorage:', error);
  }
  return {};
}

/**
 * Save preferences to localStorage
 */
export function savePreferences(preferences: StoredPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch (error) {
    console.warn('[DEBUG] Failed to save preferences to localStorage:', error);
  }
}

/**
 * Hook to initialize preferences on app load
 */
export function useInitializePreferences(): void {
  useEffect(() => {
    const preferences = loadPreferences();
    
    // Apply stored preferences to store
    if (preferences.gridDensity !== undefined) {
      useCompositorStore.getState().setGridDensity(preferences.gridDensity);
    }
    if (preferences.gridEnabled !== undefined) {
      const currentGridEnabled = useCompositorStore.getState().project.grid.enabled;
      if (currentGridEnabled !== preferences.gridEnabled) {
        useCompositorStore.getState().toggleGrid();
      }
    }
    if (preferences.showSelectionBorders !== undefined) {
      const currentShowBorders = useCompositorStore.getState().ui.showSelectionBorders;
      if (currentShowBorders !== preferences.showSelectionBorders) {
        useCompositorStore.getState().toggleSelectionBorders();
      }
    }
    if (preferences.selectionBorderAnimationSpeed !== undefined) {
      useCompositorStore.getState().setSelectionBorderAnimationSpeed(preferences.selectionBorderAnimationSpeed);
    }
    if (preferences.leftClickPan !== undefined) {
      const current = useCompositorStore.getState().ui.leftClickPan;
      if (current !== preferences.leftClickPan) {
        useCompositorStore.getState().toggleLeftClickPan();
      }
    }
    
    // Apply canvas border settings
    const canvasUpdates: any = {};
    if (preferences.canvasBorderColor !== undefined) {
      canvasUpdates.borderColor = preferences.canvasBorderColor;
    }
    if (preferences.canvasBorderWidth !== undefined) {
      canvasUpdates.borderWidth = preferences.canvasBorderWidth;
    }
    if (preferences.canvasBorderOpacity !== undefined) {
      canvasUpdates.borderOpacity = preferences.canvasBorderOpacity;
    }
    if (Object.keys(canvasUpdates).length > 0) {
      useCompositorStore.getState().setCanvasConfig(canvasUpdates);
    }
    
    // console.log('[DEBUG] Preferences loaded from localStorage');
  }, []);
}
