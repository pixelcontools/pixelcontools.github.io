/**
 * Core type definitions for PixelConnect
 * All types related to the compositor application
 */

// Canvas Configuration
export interface CanvasConfig {
  width: number;
  height: number;
  backgroundColor: string | null; // Hex color or null for transparent
  borderColor: string; // Hex color for border
  borderWidth: number; // Thickness in pixels (expands outward)
  borderOpacity: number; // 0-1
  borderEnabled: boolean; // Whether to show the border
  shadowIntensity: number; // 0-1, shadow opacity/intensity
  showCheckeredBackground: boolean; // Show checkerboard pattern for transparency
  dragInfoEnabled: boolean; // Show drag translation info when dragging layers
}


// Layer representation
export interface Layer {
  id: string; // UUID
  name: string; // User-defined or filename
  imageData: string; // Base64 data URI
  x: number; // Can be negative
  y: number; // Can be negative
  zIndex: number; // Higher = more in front
  visible: boolean;
  locked: boolean;
  opacity: number; // 0.0 to 1.0 (1.0 = fully opaque)
  width: number; // Image width in pixels
  height: number; // Image height in pixels
  
  // Optional text layer metadata (enables re-editing)
  textContent?: string; // Original text content with \n for line breaks
  fontSize?: number; // Font size in pixels
  fontFamily?: string; // Font family name (system or Google Font)
  fontColor?: string; // Hex color for text
  textAlign?: 'left' | 'center' | 'right'; // Text alignment
  disableTransparency?: boolean; // If true, text is rendered without anti-aliasing
  
  // Optional shape layer metadata (enables re-editing)
  shapeType?: 'rectangle' | 'circle' | 'triangle' | 'hexagon' | 'octagon' | 'star'; // Shape type
  shapeSize?: number; // Base size in pixels (width/height)
  shapeStretchX?: number; // Horizontal stretch (0.1-20.0, where 1.0 is normal)
  shapeStretchY?: number; // Vertical stretch (0.1-20.0, where 1.0 is normal)
  shapeColor?: string; // Hex color for shape
  lineHeight?: number; // Text line height
  letterSpacing?: number; // Text letter spacing
  fontWeight?: 'normal' | 'bold' | 'lighter'; // Text font weight
}

// Viewport state
export interface ViewportState {
  zoom: number; // Percentage (100 = actual size)
  panX: number; // Horizontal offset in pixels
  panY: number; // Vertical offset in pixels
}

// Grid configuration
export interface GridConfig {
  enabled: boolean;
  density: number; // Only render every Nth grid line (1-8, default 4)
}

// Ruler configuration
export interface Guide {
  axis: 'x' | 'y';
  position: number;
  id: string;
}

export interface RulerConfig {
  enabled: boolean;
  guides: Guide[];
}

// Project metadata
export interface ProjectMetadata {
  author: string;
  description: string;
  tags: string[];
}

// Complete project data
export interface ProjectData {
  version: string; // Semantic version
  projectName: string;
  created: string; // ISO 8601
  modified: string; // ISO 8601
  canvas: CanvasConfig;
  viewport: ViewportState;
  grid: GridConfig;
  rulers: RulerConfig;
  layers: Layer[];
  metadata: ProjectMetadata;
}

// Application state
export interface AppState {
  project: ProjectData;
  selectedLayerIds: string[];
  isDirty: boolean;
  history: HistoryState;
  ui: UIState;
  _lastHistoryPushAt?: number; // Internal: timestamp of last manual history push, used to prevent double-pushing
}

// History tracking
export interface HistoryState {
  past: ProjectData[];
  future: ProjectData[];
  maxSteps: number;
}

// UI state
export interface UIState {
  activeTool: 'select' | 'pan' | 'zoom';
  leftClickPan: boolean; // When true, left-click pans and middle-click drags layers
  spaceHeld: boolean; // When true, temporarily inverts leftClickPan behavior
  showRulers: boolean;
  showSelectionBorders: boolean;
  showSelectionTools: boolean; // Show edit/delete/visibility icons on selected layers
  selectionBorderAnimationSpeed: number; // 0 = no movement, 1 = max speed
  clipboardLayers: Layer[];
  isDraggingLayer: boolean;
  dragLayerId: string | null;
  dragStartX: number;
  dragStartY: number;
  dragOffsetX: number; // Temporary offset during drag - not part of history
  dragOffsetY: number; // Temporary offset during drag - not part of history
}

// Linked project format (post-MVP)
export interface LinkedLayer {
  id: string;
  name: string;
  source: string; // Relative path
  x: number;
  y: number;
  zIndex: number;
  visible: boolean;
  locked: boolean;
  width: number;
  height: number;
}

export interface LinkedProjectData {
  version: string;
  projectName: string;
  created: string;
  modified: string;
  canvas: CanvasConfig;
  viewport: ViewportState;
  grid: GridConfig;
  rulers: RulerConfig;
  layers: LinkedLayer[];
  metadata: ProjectMetadata;
}
