/**
 * Extracts the opaque color palette (RGB only) from an image.
 * Only includes fully opaque pixels (alpha === 255).
 * 
 * @param imageDataObj - ImageData object containing pixel data
 * @returns Map of hex colors to their RGB values
 */
const extractOpaqueColorPalette = (imageDataObj: ImageData): Map<string, { r: number; g: number; b: number }> => {
  const data = imageDataObj.data;
  const colorPalette = new Map<string, { r: number; g: number; b: number }>();

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    // Only include fully opaque pixels
    if (a === 255) {
      const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
      if (!colorPalette.has(hex)) {
        colorPalette.set(hex, { r, g, b });
      }
    }
  }

  return colorPalette;
};

/**
 * Finds the nearest color in the palette using Euclidean distance in RGB space.
 */
const findNearestColor = (
  r: number,
  g: number,
  b: number,
  palette: Map<string, { r: number; g: number; b: number }>
): { hex: string; r: number; g: number; b: number } => {
  let nearestHex = '#000000';
  let nearestRGB = { r: 0, g: 0, b: 0 };
  let minDistance = Infinity;

  for (const [hex, rgb] of palette) {
    const distance = Math.sqrt(
      Math.pow(r - rgb.r, 2) + Math.pow(g - rgb.g, 2) + Math.pow(b - rgb.b, 2)
    );

    if (distance < minDistance) {
      minDistance = distance;
      nearestHex = hex;
      nearestRGB = rgb;
    }
  }

  return { hex: nearestHex, ...nearestRGB };
};

/**
 * Applies a transparency mask to an image based on an alpha threshold.
 * Pixels with alpha < threshold become fully transparent (0).
 * Pixels with alpha >= threshold become fully opaque (255).
 * Optionally applies color palette reduction to newly opaque pixels.
 * 
 * @param imageData - The base64 string of the image.
 * @param threshold - The alpha threshold (0-255).
 * @param useTemplatePalette - If true, map newly opaque pixels to nearest opaque colors.
 * @returns A Promise that resolves to the processed base64 string.
 */
export const applyTransparencyMask = (
  imageData: string,
  threshold: number,
  useTemplatePalette: boolean = true
): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const img = new Image();
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }

          ctx.drawImage(img, 0, 0);
          const imageDataObj = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageDataObj.data;

          // Extract opaque color palette before processing if needed
          let opaqueColorPalette: Map<string, { r: number; g: number; b: number }> | null = null;
          if (useTemplatePalette) {
            opaqueColorPalette = extractOpaqueColorPalette(imageDataObj);
          }

          for (let i = 0; i < data.length; i += 4) {
            const alpha = data[i + 3];
            
            // If alpha === 0, continue (keep transparent)
            if (alpha === 0) {
              continue;
            }

            // If alpha < threshold, set data[i + 3] = 0 (make transparent)
            if (alpha < threshold) {
              data[i + 3] = 0;
            } else {
              // Else, set data[i + 3] = 255 (make opaque)
              // If using template palette, map ONLY semi-transparent pixels becoming opaque
              // Don't touch already-opaque pixels (alpha === 255)
              if (useTemplatePalette && opaqueColorPalette && opaqueColorPalette.size > 0 && alpha < 255) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const nearest = findNearestColor(r, g, b, opaqueColorPalette);
                data[i] = nearest.r;
                data[i + 1] = nearest.g;
                data[i + 2] = nearest.b;
              }
              data[i + 3] = 255;
            }
          }

          ctx.putImageData(imageDataObj, 0, 0);
          resolve(canvas.toDataURL());
        } catch (err) {
          console.error('Error processing image data:', err);
          reject(err);
        }
      };

      img.onerror = (err) => {
        console.error('Error loading image for processing:', err);
        reject(new Error('Failed to load image'));
      };

      img.src = imageData;
    } catch (err) {
      console.error('Error initiating image processing:', err);
      reject(err);
    }
  });
};

/**
 * Converts a Blob to a base64 data URI
 * Used for clipboard image pasting
 */
export const blobToDataUrl = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      resolve(result);
    };
    reader.onerror = () => {
      reject(new Error('Failed to read blob'));
    };
    reader.readAsDataURL(blob);
  });
};

/**
 * Converts a base64 data URI to a Blob
 * Preserves transparency for PNG images
 */
export const dataUrlToBlob = (dataUrl: string): Blob => {
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const bstr = atob(parts[1]);
  const n = bstr.length;
  const u8arr = new Uint8Array(n);
  
  for (let i = 0; i < n; i++) {
    u8arr[i] = bstr.charCodeAt(i);
  }
  
  return new Blob([u8arr], { type: mime });
};

/**
 * Remove background by flood-filling from image corners using color tolerance.
 * Optionally return a heatmap (remaining pixels shown in red) instead of normal alpha mask.
 *
 * @param imageData - base64 data URL
 * @param tolerance - color distance tolerance (0-255)
 * @param makeHeatmap - if true, produces a red heatmap showing kept pixels
 * @returns Promise<string> - processed data URL (PNG)
 */
export const removeBackground = (
  imageData: string,
  tolerance: number = 30,
  makeHeatmap: boolean = false
): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const w = img.naturalWidth;
          const h = img.naturalHeight;
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }
          ctx.drawImage(img, 0, 0);
          const imageDataObj = ctx.getImageData(0, 0, w, h);
          const data = imageDataObj.data;

          const visited = new Uint8Array(w * h);
          const maskBg = new Uint8Array(w * h); // 1 = background

          const pixelIndex = (x: number, y: number) => y * w + x;

          const colorAt = (x: number, y: number) => {
            const i = (y * w + x) * 4;
            return { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] };
          };

          const colorDistance = (c1: any, c2: any) => {
            const dr = c1.r - c2.r;
            const dg = c1.g - c2.g;
            const db = c1.b - c2.b;
            return Math.sqrt(dr * dr + dg * dg + db * db);
          };

          // Seed points: four corners (and small 3x3 around them)
          const seeds: Array<{ x: number; y: number }> = [];
          const pushSeeds = (cx: number, cy: number) => {
            for (let yy = Math.max(0, cy - 1); yy <= Math.min(h - 1, cy + 1); yy++) {
              for (let xx = Math.max(0, cx - 1); xx <= Math.min(w - 1, cx + 1); xx++) {
                seeds.push({ x: xx, y: yy });
              }
            }
          };
          pushSeeds(0, 0);
          pushSeeds(w - 1, 0);
          pushSeeds(0, h - 1);
          pushSeeds(w - 1, h - 1);

          // Use first seed color as reference per seed
          const queue: Array<{ x: number; y: number; base: { r: number; g: number; b: number } }> = [];
          for (const s of seeds) {
            const c = colorAt(s.x, s.y);
            queue.push({ x: s.x, y: s.y, base: c });
          }

          const inBounds = (x: number, y: number) => x >= 0 && x < w && y >= 0 && y < h;

          while (queue.length > 0) {
            const { x, y, base } = queue.shift() as any;
            const idx = pixelIndex(x, y);
            if (visited[idx]) continue;
            visited[idx] = 1;

            const cur = colorAt(x, y);
            const dist = colorDistance(cur, base);
            if (dist <= tolerance) {
              maskBg[idx] = 1;
              // enqueue neighbors
              const nbs = [
                { x: x + 1, y },
                { x: x - 1, y },
                { x, y: y + 1 },
                { x, y: y - 1 },
              ];
              for (const nb of nbs) {
                if (inBounds(nb.x, nb.y)) {
                  const nidx = pixelIndex(nb.x, nb.y);
                  if (!visited[nidx]) {
                    queue.push({ x: nb.x, y: nb.y, base });
                  }
                }
              }
            }
          }

          // Apply mask: if maskBg==1 => transparent, else keep. If makeHeatmap, color kept pixels red.
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const pi = (y * w + x) * 4;
              const m = maskBg[pixelIndex(x, y)];
              if (m === 1) {
                // background => transparent
                data[pi + 3] = 0;
              } else {
                // kept pixel
                if (makeHeatmap) {
                  data[pi] = 255;
                  data[pi + 1] = 0;
                  data[pi + 2] = 0;
                  data[pi + 3] = 255;
                } else {
                  data[pi + 3] = 255;
                }
              }
            }
          }

          ctx.putImageData(imageDataObj, 0, 0);
          resolve(canvas.toDataURL());
        } catch (err) {
          console.error('removeBackground processing error:', err);
          reject(err);
        }
      };
      img.onerror = (err) => {
        console.error('removeBackground load error:', err);
        reject(new Error('Failed to load image'));
      };
      img.src = imageData;
    } catch (err) {
      console.error('removeBackground init error:', err);
      reject(err);
    }
  });
};

/**
 * Composite multiple layers onto a canvas, preserving transparency
 * Layers are composited in z-index order
 */
export const compositeLayersToBlob = (
  layers: Array<{
    imageData: string;
    x: number;
    y: number;
    width: number;
    height: number;
    opacity: number;
  }>
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    if (layers.length === 0) {
      reject(new Error('No layers to composite'));
      return;
    }

    // Calculate bounding box
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const layer of layers) {
      minX = Math.min(minX, layer.x);
      minY = Math.min(minY, layer.y);
      maxX = Math.max(maxX, layer.x + layer.width);
      maxY = Math.max(maxY, layer.y + layer.height);
    }

    const width = Math.ceil(maxX - minX);
    const height = Math.ceil(maxY - minY);

    // Create canvas with transparent background
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }

    // Clear canvas (transparent background)
    ctx.clearRect(0, 0, width, height);

    let loadedCount = 0;
    let hasError = false;

    // Load and composite each layer
    for (const layer of layers) {
      const img = new Image();
      img.onload = () => {
        if (hasError) return;

        ctx.globalAlpha = layer.opacity;
        ctx.drawImage(
          img,
          layer.x - minX,
          layer.y - minY,
          layer.width,
          layer.height
        );

        loadedCount++;
        if (loadedCount === layers.length) {
          // All layers loaded and composited
          ctx.globalAlpha = 1.0; // Reset alpha
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('Failed to create blob from canvas'));
              }
            },
            'image/png'
          );
        }
      };

      img.onerror = () => {
        hasError = true;
        reject(new Error(`Failed to load image for layer at (${layer.x}, ${layer.y})`));
      };

      img.src = layer.imageData;
    }
  });
};
