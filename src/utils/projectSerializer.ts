/**
 * Project serialization and deserialization utilities
 * Handles save/load operations for .pixcomp files
 */

import { ProjectData } from '../types/compositor.types';

const CURRENT_VERSION = '1.0.0';
const MIN_SUPPORTED_VERSION = '1.0.0';

/**
 * Serialize project to JSON string
 */
export function serializeProject(project: ProjectData): string {
  // Filter out temporary canvas preview layers before serializing
  const filteredLayers = project.layers.filter(
    layer => layer.id !== '__text_canvas_preview__' && layer.id !== '__shape_canvas_preview__'
  );

  const serialized: ProjectData = {
    ...project,
    layers: filteredLayers,
    modified: new Date().toISOString(),
  };

  return JSON.stringify(serialized, null, 2);
}

/**
 * Deserialize project from JSON string
 * Validates version and required fields
 */
export async function deserializeProject(jsonString: string): Promise<ProjectData> {
  try {
    // console.log('[DEBUG] Parsing project JSON...');
    const data = JSON.parse(jsonString);

    // Validate version exists
    if (!data.version) {
      throw new Error('Invalid project file: missing version field');
    }

    // console.log(`[DEBUG] Project version: ${data.version}`);

    // Check version compatibility
    if (!isVersionCompatible(data.version)) {
      throw new Error(
        `Project version ${data.version} is not supported. ` +
        `Current version: ${CURRENT_VERSION}, ` +
        `minimum supported: ${MIN_SUPPORTED_VERSION}`
      );
    }

    // Filter out temporary canvas preview layers
    if (data.layers) {
      data.layers = data.layers.filter(
        (layer: any) => layer.id !== '__text_canvas_preview__' && layer.id !== '__shape_canvas_preview__'
      );
    }

    // Validate required fields
    validateProjectData(data);

    // console.log('[DEBUG] Project validation passed');

    // Validate and load all images
    // console.log(`[DEBUG] Validating ${data.layers.length} image(s)...`);
    await validateLayerImages(data.layers);

    // console.log('[DEBUG] All images validated successfully');
    return data as ProjectData;
  } catch (error) {
    console.error('[DEBUG] Project deserialization failed:', error);
    throw error;
  }
}

/**
 * Check if project version is compatible with current version
 */
function isVersionCompatible(version: string): boolean {
  const [major, minor] = version.split('.').map(Number);
  const [minMajor, minMinor] = MIN_SUPPORTED_VERSION.split('.').map(Number);

  // Allow same or newer version up to next major version
  if (major > minMajor) {
    return false; // Too new
  }

  if (major < minMajor) {
    return false; // Too old
  }

  // Same major version, check minor
  return minor >= minMinor;
}

/**
 * Validate project data structure
 */
function validateProjectData(data: any): void {
  const requiredFields = ['version', 'canvas', 'layers', 'viewport', 'grid', 'rulers'];

  for (const field of requiredFields) {
    if (!(field in data)) {
      throw new Error(`Invalid project file: missing required field '${field}'`);
    }
  }

  // Validate canvas config
  if (typeof data.canvas.width !== 'number' || data.canvas.width <= 0) {
    throw new Error('Invalid project file: canvas width must be a positive number');
  }

  if (typeof data.canvas.height !== 'number' || data.canvas.height <= 0) {
    throw new Error('Invalid project file: canvas height must be a positive number');
  }

  // Validate layers array
  if (!Array.isArray(data.layers)) {
    throw new Error('Invalid project file: layers must be an array');
  }

  // Validate each layer
  for (let i = 0; i < data.layers.length; i++) {
    const layer = data.layers[i];

    const requiredLayerFields = ['id', 'name', 'imageData', 'x', 'y', 'zIndex', 'visible', 'locked', 'width', 'height'];

    for (const field of requiredLayerFields) {
      if (!(field in layer)) {
        throw new Error(`Invalid layer ${i}: missing required field '${field}'`);
      }
    }

    if (typeof layer.x !== 'number' || typeof layer.y !== 'number') {
      throw new Error(`Invalid layer ${i}: x and y must be numbers`);
    }

    if (!layer.imageData.startsWith('data:image/')) {
      throw new Error(`Invalid layer ${i}: imageData must be a valid data URL`);
    }
  }
}

/**
 * Validate that all layer images can be loaded
 */
async function validateLayerImages(layers: any[]): Promise<void> {
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];

    try {
      await loadImage(layer.imageData);
      // console.log(`[DEBUG] Layer ${i} image validated: ${layer.name}`);
    } catch (error) {
      throw new Error(`Failed to load image for layer ${i} (${layer.name}): ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Load image from data URL
 */
function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timeout = setTimeout(() => {
      reject(new Error('Image load timeout'));
    }, 5000);

    img.onload = () => {
      clearTimeout(timeout);
      resolve(img);
    };

    img.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('Failed to load image'));
    };

    img.src = dataUrl;
  });
}

/**
 * Export canvas to PNG blob at specified scale
 */
export async function exportCanvasToPNG(
  layers: any[],
  width: number,
  height: number,
  scale: number = 1,
  backgroundColor: string | null = null
): Promise<Blob> {
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = width * scale;
  exportCanvas.height = height * scale;

  const ctx = exportCanvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // CRITICAL: Disable image smoothing
  ctx.imageSmoothingEnabled = false;
  (ctx as any).webkitImageSmoothingEnabled = false;
  (ctx as any).mozImageSmoothingEnabled = false;

  // Scale context
  ctx.scale(scale, scale);

  // Fill background if set
  if (backgroundColor) {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);
  }

  // Render visible layers sorted by z-index
  const sortedLayers = [...layers]
    .filter((layer) => layer.visible)
    .sort((a, b) => a.zIndex - b.zIndex);

  for (const layer of sortedLayers) {
    try {
      const img = await loadImage(layer.imageData);
      ctx.drawImage(img, layer.x, layer.y);
    } catch (error) {
      console.warn(`Failed to export layer ${layer.name}:`, error);
    }
  }

  return new Promise((resolve) => {
    exportCanvas.toBlob((blob) => {
      if (!blob) {
        throw new Error('Failed to create PNG blob');
      }
      resolve(blob);
    }, 'image/png');
  });
}
