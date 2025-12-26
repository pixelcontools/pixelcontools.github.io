/**
 * Zustand store for global application state management
 * Handles project data, layers, selection, and UI state
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { 
  AppState, 
  ProjectData, 
  Layer, 
  CanvasConfig,
  ViewportState,
  ProjectMetadata,
  HistoryState,
  UIState
} from '../types/compositor.types';
import { blobToDataUrl, dataUrlToBlob, compositeLayersToBlob } from '../utils/imageProcessing';
import { rasterizeText } from '../utils/textRasterizer';

// Default project configuration
const DEFAULT_PROJECT_DATA: ProjectData = {
  version: '1.0.0',
  projectName: 'Untitled',
  created: new Date().toISOString(),
  modified: new Date().toISOString(),
  canvas: {
    width: 3276,
    height: 3276,
    backgroundColor: null, // Transparent by default
    borderColor: '#000000',
    borderWidth: 0,
    borderOpacity: 1,
    borderEnabled: true,
    shadowIntensity: 0.5,
    showCheckeredBackground: false,
    dragInfoEnabled: true,
  },
  viewport: {
    zoom: 100,
    panX: 0,
    panY: 0,
  },
  grid: {
    enabled: false,
    density: 4,
  },
  rulers: {
    enabled: false,
    guides: [],
  },
  layers: [],
  metadata: {
    author: '',
    description: '',
    tags: [],
  },
};

const DEFAULT_HISTORY: HistoryState = {
  past: [],
  future: [],
  maxSteps: 50,
};

const DEFAULT_UI: UIState = {
  activeTool: 'select',
  showRulers: false,
  showSelectionBorders: true,
  showSelectionTools: true,
  selectionBorderAnimationSpeed: 0.1,
  clipboardLayers: [],
  isDraggingLayer: false,
  dragLayerId: null,
  dragStartX: 0,
  dragStartY: 0,
  dragOffsetX: 0,
  dragOffsetY: 0,
};

interface CompositorStore extends AppState {
  // Project operations
  setProjectName: (name: string) => void;
  setCanvasConfig: (config: Partial<CanvasConfig>) => void;
  setViewport: (viewport: Partial<ViewportState>) => void;
  setProjectMetadata: (metadata: Partial<ProjectMetadata>) => void;

  // Layer operations
  addLayer: (layer: Omit<Layer, 'id'> & { id?: string }) => void;
  removeLayer: (layerId: string) => void;
  updateLayer: (layerId: string, updates: Partial<Layer>) => void;
  duplicateLayer: (layerId: string) => void;
  moveLayer: (layerId: string, deltaX: number, deltaY: number) => void;
  reorderLayer: (layerId: string, direction: 'up' | 'down') => void;
  reorderSelectedLayers: (direction: 'up' | 'down') => void;
  bringLayerToFront: (layerId: string) => void;
  sendLayerToBack: (layerId: string) => void;

  // Multi-layer operations
  selectLayer: (layerId: string, multiSelect?: boolean) => void;
  selectAllLayers: () => void;
  deselectAllLayers: () => void;
  selectLayerRange: (fromId: string, toId: string) => void;
  moveSelectedLayers: (deltaX: number, deltaY: number) => void;
  deleteSelectedLayers: () => void;
  toggleVisibilitySelected: () => void;

  // Drag operations
  startDraggingLayer: (layerId: string, startX: number, startY: number) => void;
  updateDragPosition: (currentX: number, currentY: number) => void;
  stopDraggingLayer: () => void;

  // History operations
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;

  // UI operations
  setActiveTool: (tool: 'select' | 'pan' | 'zoom') => void;
  toggleGrid: () => void;
  setGridDensity: (density: number) => void;
  toggleRulers: () => void;
  toggleSelectionBorders: () => void;
  toggleSelectionTools: () => void;
  setSelectionBorderAnimationSpeed: (speed: number) => void;
  copySelectedLayers: () => void;
  copySelectedLayersToClipboard: () => Promise<void>;
  pasteSelectedLayers: () => void;
  pasteFromClipboard: () => Promise<void>;

  // Canvas operations
  cropCanvasToLayers: () => void;

  // File operations
  resetProject: () => void;
  loadProject: (projectData: ProjectData) => void;
  markDirty: () => void;
  markClean: () => void;
}

const useCompositorStore = create<CompositorStore>()(
  devtools(
    (set) => ({
      // Initial state
      project: DEFAULT_PROJECT_DATA,
      selectedLayerIds: [],
      isDirty: false,
      history: DEFAULT_HISTORY,
      ui: DEFAULT_UI,

      // Project operations
      setProjectName: (name: string) => {
        set((state) => ({
          project: {
            ...state.project,
            projectName: name,
            modified: new Date().toISOString(),
          },
          isDirty: true,
        }));
      },

      setCanvasConfig: (config: Partial<CanvasConfig>) => {
        set((state) => ({
          project: {
            ...state.project,
            canvas: {
              ...state.project.canvas,
              ...config,
            },
            modified: new Date().toISOString(),
          },
          isDirty: true,
        }));
      },

      setViewport: (viewport: Partial<ViewportState>) => {
        set((state) => ({
          project: {
            ...state.project,
            viewport: {
              ...state.project.viewport,
              ...viewport,
            },
          },
          // Note: NOT marking isDirty or affecting history - viewport is UI state, not project state
        }));
      },

      setProjectMetadata: (metadata: Partial<ProjectMetadata>) => {
        set((state) => ({
          project: {
            ...state.project,
            metadata: {
              ...state.project.metadata,
              ...metadata,
            },
            modified: new Date().toISOString(),
          },
          isDirty: true,
        }));
      },

      // Layer operations
      addLayer: (layer: Omit<Layer, 'id'> & { id?: string }) => {
        set((state) => ({
          project: {
            ...state.project,
            layers: [
              ...state.project.layers,
              {
                ...layer,
                id: layer.id || `layer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              },
            ],
            modified: new Date().toISOString(),
          },
          isDirty: true,
        }));
      },

      removeLayer: (layerId: string) => {
        set((state) => ({
          project: {
            ...state.project,
            layers: state.project.layers.filter((l) => l.id !== layerId),
            modified: new Date().toISOString(),
          },
          selectedLayerIds: state.selectedLayerIds.filter((id) => id !== layerId),
          isDirty: true,
        }));
      },

      updateLayer: (layerId: string, updates: Partial<Layer>) => {
        set((state) => ({
          project: {
            ...state.project,
            layers: state.project.layers.map((layer) =>
              layer.id === layerId
                ? {
                    ...layer,
                    ...updates,
                  }
                : layer
            ),
            modified: new Date().toISOString(),
          },
          isDirty: true,
        }));
      },

      duplicateLayer: (layerId: string) => {
        set((state) => {
          const layerToClone = state.project.layers.find((l) => l.id === layerId);
          if (!layerToClone) return state;

          const newLayer: Layer = {
            ...layerToClone,
            id: `layer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: `${layerToClone.name} (copy)`,
            zIndex: Math.max(...state.project.layers.map((l) => l.zIndex), 0) + 1,
          };

          return {
            project: {
              ...state.project,
              layers: [...state.project.layers, newLayer],
              modified: new Date().toISOString(),
            },
            isDirty: true,
          };
        });
      },

      moveLayer: (layerId: string, deltaX: number, deltaY: number) => {
        set((state) => {
          const currentState = useCompositorStore.getState();
          const newPast = [...currentState.history.past, currentState.project];
          if (newPast.length > currentState.history.maxSteps) {
            newPast.shift();
          }

          return {
            project: {
              ...state.project,
              layers: state.project.layers.map((layer) => {
                if (layer.id === layerId && !layer.locked) {
                  const newX = Math.floor(layer.x + deltaX);
                  const newY = Math.floor(layer.y + deltaY);

                  return { ...layer, x: newX, y: newY };
                }
                return layer;
              }),
              modified: new Date().toISOString(),
            },
            history: {
              ...currentState.history,
              past: newPast,
              future: [],
            },
            isDirty: true,
          };
        });
      },

      reorderLayer: (layerId: string, direction: 'up' | 'down') => {
        set((state) => {
          const currentZIndex = state.project.layers.find((l) => l.id === layerId)?.zIndex;
          if (currentZIndex === undefined) return state;

          const zIndices = state.project.layers.map((l) => l.zIndex).sort((a, b) => a - b);
          const currentPos = zIndices.indexOf(currentZIndex);

          if (
            (direction === 'up' && currentPos === zIndices.length - 1) ||
            (direction === 'down' && currentPos === 0)
          ) {
            return state;
          }

          const newZIndex =
            direction === 'up' ? zIndices[currentPos + 1] : zIndices[currentPos - 1];
          const otherLayerId = state.project.layers.find((l) => l.zIndex === newZIndex)?.id;

          if (!otherLayerId) return state;

          return {
            project: {
              ...state.project,
              layers: state.project.layers.map((layer) => {
                if (layer.id === layerId) return { ...layer, zIndex: newZIndex };
                if (layer.id === otherLayerId) return { ...layer, zIndex: currentZIndex };
                return layer;
              }),
              modified: new Date().toISOString(),
            },
            isDirty: true,
          };
        });
      },

      reorderSelectedLayers: (direction: 'up' | 'down') => {
        set((state) => {
          if (state.selectedLayerIds.length === 0) return state;

          const zIndices = state.project.layers.map((l) => l.zIndex).sort((a, b) => a - b);
          const selectedZIndices = state.project.layers
            .filter((l) => state.selectedLayerIds.includes(l.id))
            .map((l) => l.zIndex)
            .sort((a, b) => a - b);

          // Check if we can move in this direction
          const minSelectedZ = Math.min(...selectedZIndices);
          const maxSelectedZ = Math.max(...selectedZIndices);

          if (direction === 'up' && maxSelectedZ === zIndices[zIndices.length - 1]) return state;
          if (direction === 'down' && minSelectedZ === zIndices[0]) return state;

          // Find the target z-index to swap with
          if (direction === 'up') {
            const targetZIndex = zIndices.find((z) => z > maxSelectedZ);
            if (targetZIndex === undefined) return state;

            return {
              project: {
                ...state.project,
                layers: state.project.layers.map((layer) => {
                  if (state.selectedLayerIds.includes(layer.id)) {
                    return { ...layer, zIndex: targetZIndex };
                  }
                  if (layer.zIndex === targetZIndex) {
                    return { ...layer, zIndex: maxSelectedZ };
                  }
                  return layer;
                }),
                modified: new Date().toISOString(),
              },
              isDirty: true,
            };
          } else {
            const targetZIndex = [...zIndices].reverse().find((z) => z < minSelectedZ);
            if (targetZIndex === undefined) return state;

            return {
              project: {
                ...state.project,
                layers: state.project.layers.map((layer) => {
                  if (state.selectedLayerIds.includes(layer.id)) {
                    return { ...layer, zIndex: targetZIndex };
                  }
                  if (layer.zIndex === targetZIndex) {
                    return { ...layer, zIndex: minSelectedZ };
                  }
                  return layer;
                }),
                modified: new Date().toISOString(),
              },
              isDirty: true,
            };
          }
        });
      },

      bringLayerToFront: (layerId: string) => {
        set((state) => {
          const maxZIndex = Math.max(...state.project.layers.map((l) => l.zIndex), 0);
          return {
            project: {
              ...state.project,
              layers: state.project.layers.map((layer) =>
                layer.id === layerId ? { ...layer, zIndex: maxZIndex + 1 } : layer
              ),
              modified: new Date().toISOString(),
            },
            isDirty: true,
          };
        });
      },

      sendLayerToBack: (layerId: string) => {
        set((state) => {
          const minZIndex = Math.min(...state.project.layers.map((l) => l.zIndex), 0);
          return {
            project: {
              ...state.project,
              layers: state.project.layers.map((layer) =>
                layer.id === layerId ? { ...layer, zIndex: minZIndex - 1 } : layer
              ),
              modified: new Date().toISOString(),
            },
            isDirty: true,
          };
        });
      },

      // Multi-layer operations
      selectLayer: (layerId: string, multiSelect: boolean = false) => {
        set((state) => {
          if (multiSelect) {
            return {
              selectedLayerIds: state.selectedLayerIds.includes(layerId)
                ? state.selectedLayerIds.filter((id) => id !== layerId)
                : [...state.selectedLayerIds, layerId],
            };
          }
          return { selectedLayerIds: [layerId] };
        });
      },

      selectAllLayers: () => {
        set((state) => ({
          selectedLayerIds: state.project.layers.map((l) => l.id),
        }));
      },

      deselectAllLayers: () => {
        set({ selectedLayerIds: [] });
      },

      selectLayerRange: (fromId: string, toId: string) => {
        set((state) => {
          const layerIds = state.project.layers.map((l) => l.id);
          const fromIndex = layerIds.indexOf(fromId);
          const toIndex = layerIds.indexOf(toId);

          if (fromIndex === -1 || toIndex === -1) return state;

          const [start, end] = fromIndex < toIndex ? [fromIndex, toIndex] : [toIndex, fromIndex];
          const selectedLayerIds = layerIds.slice(start, end + 1);

          return { selectedLayerIds };
        });
      },

      moveSelectedLayers: (deltaX: number, deltaY: number) => {
        set((state) => ({
          project: {
            ...state.project,
            layers: state.project.layers.map((layer) => {
              if (state.selectedLayerIds.includes(layer.id) && !layer.locked) {
                const newX = Math.floor(layer.x + deltaX);
                const newY = Math.floor(layer.y + deltaY);

                return { ...layer, x: newX, y: newY };
              }
              return layer;
            }),
            modified: new Date().toISOString(),
          },
          isDirty: true,
        }));
      },

      deleteSelectedLayers: () => {
        set((state) => ({
          project: {
            ...state.project,
            layers: state.project.layers.filter(
              (l) => !state.selectedLayerIds.includes(l.id)
            ),
            modified: new Date().toISOString(),
          },
          selectedLayerIds: [],
          isDirty: true,
        }));
      },

      toggleVisibilitySelected: () => {
        set((state) => {
          const allVisible = state.selectedLayerIds.every((id) =>
            state.project.layers.find((l) => l.id === id)?.visible
          );

          return {
            project: {
              ...state.project,
              layers: state.project.layers.map((layer) =>
                state.selectedLayerIds.includes(layer.id)
                  ? { ...layer, visible: !allVisible }
                  : layer
              ),
              modified: new Date().toISOString(),
            },
            isDirty: true,
          };
        });
      },

      // Drag operations
      startDraggingLayer: (layerId: string, startX: number, startY: number) => {
        set((state) => ({
          ui: {
            ...state.ui,
            isDraggingLayer: true,
            dragLayerId: layerId,
            dragStartX: startX,
            dragStartY: startY,
          },
        }));
      },

      updateDragPosition: (currentX: number, currentY: number) => {
        set((state) => {
          if (!state.ui.isDraggingLayer) return state;

          // Calculate offset from original drag start
          let offsetX = currentX - state.ui.dragStartX;
          let offsetY = currentY - state.ui.dragStartY;

          // Snap to integer pixels for pixel-perfect rendering (no sub-pixel smearing)
          offsetX = Math.round(offsetX);
          offsetY = Math.round(offsetY);

          // Only update UI state - don't modify project.layers during drag
          // This prevents multiple history entries from rapid mouse movements
          return {
            ui: {
              ...state.ui,
              dragOffsetX: offsetX,
              dragOffsetY: offsetY,
            },
          };
        });
      },

      stopDraggingLayer: () => {
        set((state) => {
          if (!state.ui.isDraggingLayer || !state.ui.dragLayerId) return state;

          // Get the layers to move
          const layersToMove = state.selectedLayerIds.includes(state.ui.dragLayerId)
            ? state.selectedLayerIds
            : [state.ui.dragLayerId];

          // Apply the accumulated drag offset to project layers
          const offsetX = state.ui.dragOffsetX;
          const offsetY = state.ui.dragOffsetY;

          // Only push history if layers actually moved
          const layersActuallyMoved = offsetX !== 0 || offsetY !== 0;

          const newProject = {
            ...state.project,
            layers: state.project.layers.map((layer) => {
              if (layersToMove.includes(layer.id) && !layer.locked) {
                return {
                  ...layer,
                  x: Math.floor(layer.x + offsetX),
                  y: Math.floor(layer.y + offsetY),
                };
              }
              return layer;
            }),
            modified: new Date().toISOString(),
          };

          const newState = {
            project: newProject,
            ui: {
              ...state.ui,
              isDraggingLayer: false,
              dragLayerId: null,
              dragOffsetX: 0,
              dragOffsetY: 0,
            },
            isDirty: true,
          };

          // Push history exactly once if layers moved
          if (layersActuallyMoved) {
            const currentState = useCompositorStore.getState();
            const { viewport, ...projectWithoutViewport } = currentState.project;
            const newPast = [...currentState.history.past, projectWithoutViewport as ProjectData];
            if (newPast.length > currentState.history.maxSteps) {
              newPast.shift();
            }

            return {
              ...newState,
              history: {
                ...currentState.history,
                past: newPast,
                future: [],
              },
              _lastHistoryPushAt: Date.now(), // Prevent useAutoHistory from pushing after drag
            };
          }

          return newState;
        });
      },

      // History operations
      pushHistory: () => {
        set((state) => {
          // Store project WITHOUT viewport - we'll preserve the current viewport during undo
          const { viewport, ...projectWithoutViewport } = state.project;
          const newPast = [...state.history.past, projectWithoutViewport as ProjectData];
          if (newPast.length > state.history.maxSteps) {
            newPast.shift();
          }

          return {
            history: {
              ...state.history,
              past: newPast,
              future: [],
            },
            _lastHistoryPushAt: Date.now(), // Mark when history was manually pushed
          };
        });
      },

      undo: () => {
        set((state) => {
          if (state.history.past.length === 0) return state;

          const newPast = [...state.history.past];
          const previousProject = newPast.pop();
          
          if (!previousProject) return state;

          // Add current project to future, but strip viewport like we do in pushHistory
          const { viewport, ...projectWithoutViewport } = state.project;
          const newFuture = [projectWithoutViewport as ProjectData, ...state.history.future];

          return {
            project: {
              ...previousProject,
              viewport: state.project.viewport, // Preserve current viewport
            },
            history: {
              ...state.history,
              past: newPast,
              future: newFuture,
            },
            _lastHistoryPushAt: Date.now(), // Prevent useAutoHistory from pushing during undo
          };
        });
      },

      redo: () => {
        set((state) => {
          if (state.history.future.length === 0) return state;

          const newFuture = [...state.history.future];
          const nextProject = newFuture.shift();
          
          // Add current project to past, but strip viewport like we do in pushHistory
          const { viewport, ...projectWithoutViewport } = state.project;
          const newPast = [...state.history.past, projectWithoutViewport as ProjectData];

          if (!nextProject) return state;

          return {
            project: {
              ...nextProject,
              viewport: state.project.viewport, // Preserve current viewport
            },
            history: {
              ...state.history,
              past: newPast,
              future: newFuture,
            },
            _lastHistoryPushAt: Date.now(), // Prevent useAutoHistory from pushing during redo
          };
        });
      },

      // UI operations
      setActiveTool: (tool: 'select' | 'pan' | 'zoom') => {
        set((state) => ({
          ui: {
            ...state.ui,
            activeTool: tool,
          },
        }));
      },

      toggleGrid: () => {
        set((state) => ({
          project: {
            ...state.project,
            grid: {
              ...state.project.grid,
              enabled: !state.project.grid.enabled,
            },
            modified: new Date().toISOString(),
          },
          isDirty: true,
        }));
      },

      setGridDensity: (density: number) => {
        set((state) => ({
          project: {
            ...state.project,
            grid: {
              ...state.project.grid,
              density: Math.max(1, Math.min(8, density)),
            },
            modified: new Date().toISOString(),
          },
          isDirty: true,
        }));
      },

      toggleRulers: () => {
        set((state) => ({
          project: {
            ...state.project,
            rulers: {
              ...state.project.rulers,
              enabled: !state.project.rulers.enabled,
            },
            modified: new Date().toISOString(),
          },
          isDirty: true,
        }));
      },

      toggleSelectionBorders: () => {
        set((state) => ({
          ui: {
            ...state.ui,
            showSelectionBorders: !state.ui.showSelectionBorders,
          },
        }));
      },

      toggleSelectionTools: () => {
        set((state) => ({
          ui: {
            ...state.ui,
            showSelectionTools: !state.ui.showSelectionTools,
          },
        }));
      },

      setSelectionBorderAnimationSpeed: (speed: number) => {
        set((state) => ({
          ui: {
            ...state.ui,
            selectionBorderAnimationSpeed: Math.max(0, Math.min(1, speed)),
          },
        }));
      },

      copySelectedLayers: () => {
        set((state) => ({
          ui: {
            ...state.ui,
            clipboardLayers: state.project.layers.filter((l) =>
              state.selectedLayerIds.includes(l.id)
            ),
          },
        }));
      },

      copySelectedLayersToClipboard: async () => {
        try {
          const state = useCompositorStore.getState();
          const selectedLayers = state.project.layers.filter((l) =>
            state.selectedLayerIds.includes(l.id)
          );

          if (selectedLayers.length === 0) {
            console.warn('No layers selected to copy');
            return;
          }

          let blob: Blob;

          if (selectedLayers.length === 1) {
            // Single layer: copy directly
            blob = dataUrlToBlob(selectedLayers[0].imageData);
          } else {
            // Multiple layers: composite them together
            // Sort by zIndex to maintain layer order
            const sortedLayers = selectedLayers.sort((a, b) => a.zIndex - b.zIndex);
            blob = await compositeLayersToBlob(sortedLayers);
          }

          // Write to system clipboard
          const clipboardItem = new ClipboardItem({ 'image/png': blob });
          await navigator.clipboard.write([clipboardItem]);
        } catch (error) {
          console.error('Failed to copy layers to clipboard:', error);
        }
      },

      pasteSelectedLayers: () => {
        set((state) => {
          const maxZIndex = Math.max(...state.project.layers.map((l) => l.zIndex), 0);

          const pastedLayers: Layer[] = state.ui.clipboardLayers.map((layer, index) => ({
            ...layer,
            id: `layer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            x: layer.x + 10, // Offset to show pasted layers
            y: layer.y + 10,
            zIndex: maxZIndex + index + 1,
          }));

          return {
            project: {
              ...state.project,
              layers: [...state.project.layers, ...pastedLayers],
              modified: new Date().toISOString(),
            },
            selectedLayerIds: pastedLayers.map((l) => l.id),
            isDirty: true,
          };
        });
      },

      pasteFromClipboard: async () => {
        try {
          // Try Clipboard API first (for modern browsers)
          if (navigator.clipboard) {
            try {
              // Try to read image from clipboard
              const clipboardItems = await navigator.clipboard.read();
              
              for (const item of clipboardItems) {
                // Check for image types
                const imageTypes = Array.from(item.types).filter((type) =>
                  type.startsWith('image/')
                );

                if (imageTypes.length > 0) {
                  // Handle image paste
                  const imageType = imageTypes[0];
                  const blob = await item.getType(imageType);
                  const dataUrl = await blobToDataUrl(blob);

                  // Get image dimensions
                  const img = new Image();
                  img.src = dataUrl;

                  await new Promise<void>((resolve, reject) => {
                    img.onload = () => resolve();
                    img.onerror = () => reject(new Error('Failed to load image'));
                  });

                  const state = useCompositorStore.getState();
                  const maxZIndex = Math.max(...state.project.layers.map((l) => l.zIndex), 0);

                  useCompositorStore.setState((prevState) => ({
                    project: {
                      ...prevState.project,
                      layers: [
                        ...prevState.project.layers,
                        {
                          id: `layer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                          name: 'Pasted Image',
                          imageData: dataUrl,
                          x: 0,
                          y: 0,
                          zIndex: maxZIndex + 1,
                          visible: true,
                          locked: false,
                          opacity: 1.0,
                          width: img.naturalWidth,
                          height: img.naturalHeight,
                        },
                      ],
                      modified: new Date().toISOString(),
                    },
                    isDirty: true,
                  }));
                  return;
                }
              }

              // Fall through to text reading if no image found
            } catch (error) {
              // Image reading failed, try text
              console.debug('Image paste failed, trying text paste:', error);
            }

            // Try to read text from clipboard
            try {
              const text = await navigator.clipboard.readText();
              if (text.trim()) {
                // Create text layer
                const rasterized = await rasterizeText({
                  text,
                  fontSize: 16,
                  fontFamily: 'Arial',
                  color: '#000000',
                  textAlign: 'left',
                  lineHeight: 1.2,
                });

                const state = useCompositorStore.getState();
                const maxZIndex = Math.max(...state.project.layers.map((l) => l.zIndex), 0);

                useCompositorStore.setState((prevState) => ({
                  project: {
                    ...prevState.project,
                    layers: [
                      ...prevState.project.layers,
                      {
                        id: `layer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        name: `Text: ${text.substring(0, 20)}${text.length > 20 ? '...' : ''}`,
                        imageData: rasterized.dataUrl,
                        x: 0,
                        y: 0,
                        zIndex: maxZIndex + 1,
                        visible: true,
                        locked: false,
                        opacity: 1.0,
                        width: rasterized.width,
                        height: rasterized.height,
                        textContent: text,
                        fontSize: 16,
                        fontFamily: 'Arial',
                        fontColor: '#000000',
                        textAlign: 'left',
                        lineHeight: 1.2,
                      },
                    ],
                    modified: new Date().toISOString(),
                  },
                  isDirty: true,
                }));
              }
            } catch (error) {
              console.debug('Text paste failed:', error);
            }
          }
        } catch (error) {
          console.error('Clipboard paste error:', error);
        }
      },

      // Canvas operations
      cropCanvasToLayers: () => {
        set((state) => {
          if (state.project.layers.length === 0) {
            console.warn('[DEBUG] No layers to crop to');
            return state;
          }

          // Calculate the bounding box of all layers
          let minX = Infinity;
          let minY = Infinity;
          let maxX = -Infinity;
          let maxY = -Infinity;

          state.project.layers.forEach((layer) => {
            minX = Math.min(minX, layer.x);
            minY = Math.min(minY, layer.y);
            maxX = Math.max(maxX, layer.x + layer.width);
            maxY = Math.max(maxY, layer.y + layer.height);
          });

          const newWidth = Math.ceil(maxX - minX);
          const newHeight = Math.ceil(maxY - minY);
          const offsetX = minX;
          const offsetY = minY;

          // If no layers or dimensions are invalid, don't change canvas
          if (newWidth <= 0 || newHeight <= 0) {
            console.warn('[DEBUG] Invalid bounds for crop');
            return state;
          }

          console.log(
            `[DEBUG] Cropping canvas to layers: ${newWidth}x${newHeight} at offset (${offsetX}, ${offsetY})`
          );

          // Update canvas dimensions and reposition layers
          const updatedLayers = state.project.layers.map((layer) => ({
            ...layer,
            x: layer.x - offsetX,
            y: layer.y - offsetY,
          }));

          return {
            project: {
              ...state.project,
              canvas: {
                ...state.project.canvas,
                width: newWidth,
                height: newHeight,
              },
              layers: updatedLayers,
              modified: new Date().toISOString(),
            },
            isDirty: true,
          };
        });
      },

      // File operations
      resetProject: () => {
        set({
          project: DEFAULT_PROJECT_DATA,
          selectedLayerIds: [],
          isDirty: false,
          history: DEFAULT_HISTORY,
          ui: DEFAULT_UI,
        });
      },

      loadProject: (projectData: ProjectData) => {
        // Filter out preview layers before loading
        const filteredProject = {
          ...projectData,
          layers: projectData.layers.filter(
            l => l.id !== '__text_canvas_preview__' && l.id !== '__shape_canvas_preview__'
          )
        };
        set({
          project: filteredProject,
          selectedLayerIds: [],
          isDirty: false,
          history: DEFAULT_HISTORY,
          ui: DEFAULT_UI,
        });
      },

      markDirty: () => {
        set({ isDirty: true });
      },

      markClean: () => {
        set({ isDirty: false });
      },
    }),
    {
      name: 'CompositorStore',
      enabled: true,
    }
  )
);

export default useCompositorStore;
