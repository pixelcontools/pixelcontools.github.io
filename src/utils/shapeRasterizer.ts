/**
 * Shape rasterizer for converting shapes to high-quality images
 */

export interface ShapeRasterizeOptions {
  shapeType: 'rectangle' | 'circle' | 'triangle' | 'hexagon' | 'octagon' | 'star';
  size: number;
  stretchX: number; // 0.1-20.0
  stretchY: number; // 0.1-20.0
  color: string; // Hex color
}

export interface RasterizedShape {
  dataUrl: string;
  width: number;
  height: number;
  offsetX: number; // Offset from center for proper positioning
  offsetY: number;
}

/**
 * Calculate bounding box for the shape
 */
function getShapeBounds(options: ShapeRasterizeOptions, radius: number): { minX: number; maxX: number; minY: number; maxY: number } {
  const { shapeType, stretchX, stretchY } = options;
  
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

  const updateBounds = (x: number, y: number) => {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  };

  if (shapeType === 'rectangle' || shapeType === 'circle') {
    // For rectangle and circle (ellipse), bounds are simple
    const width = radius * 2 * stretchX;
    const height = radius * 2 * stretchY;
    return {
      minX: -width / 2,
      maxX: width / 2,
      minY: -height / 2,
      maxY: height / 2
    };
  }

  // For polygons and stars, calculate vertices
  let sides = 3;
  if (shapeType === 'hexagon') sides = 6;
  if (shapeType === 'octagon') sides = 8;
  
  if (shapeType === 'star') {
    const points = 5;
    const outerRadius = radius * stretchX;
    const innerRadius = (radius * 0.4) * stretchX;
    const angleStep = (Math.PI * 2) / (points * 2);
    let startAngle = -Math.PI / 2;

    for (let i = 0; i < points * 2; i++) {
      const currentAngle = startAngle + angleStep * i;
      const isOuter = i % 2 === 0;
      
      // Calculate raw coordinates on unit circle (scaled by radius)
      // We use the same logic as drawStar but we need to be careful about stretch
      // In drawStar:
      // outerRadius = radius * stretchX
      // innerRadius = radius * 0.4 * stretchX
      // px = x + cos * r
      // py = y + sin * r * stretchY
      // This means X is scaled by stretchX (via r), and Y is scaled by stretchX * stretchY?
      // No, wait.
      // In drawStar:
      // const r = isOuter ? outerRadius : innerRadius;
      // const px = x + Math.cos(currentAngle) * r;
      // const py = y + Math.sin(currentAngle) * r * stretchY;
      
      // If stretchX=1, stretchY=1: r=radius. px=cos*radius. py=sin*radius. Correct.
      // If stretchX=2, stretchY=1: r=2*radius. px=cos*2*radius. py=sin*2*radius. Correct (2x width).
      // If stretchX=1, stretchY=2: r=radius. px=cos*radius. py=sin*radius*2. Correct (2x height).
      
      // So we need to replicate this exactly.
      const r = isOuter ? outerRadius : innerRadius;
      const px = Math.cos(currentAngle) * r;
      const py = Math.sin(currentAngle) * r * stretchY;
      
      updateBounds(px, py);
    }
  } else {
    // Polygons
    const angleStep = (Math.PI * 2) / sides;
    let startAngle = -Math.PI / 2;
    
    for (let i = 0; i < sides; i++) {
      const currentAngle = startAngle + angleStep * i;
      const rawX = Math.cos(currentAngle) * radius;
      const rawY = Math.sin(currentAngle) * radius;
      updateBounds(rawX * stretchX, rawY * stretchY);
    }
  }

  return { minX, maxX, minY, maxY };
}

/**
 * Rasterize shape to a high-DPI image
 */
export async function rasterizeShape(options: ShapeRasterizeOptions): Promise<RasterizedShape> {
  const { shapeType, size, stretchX, stretchY, color } = options;

  // For pixel-perfect rendering (no AA), we use 1x scale
  // This matches the behavior of the text tool's "disable transparency" mode
  const scale = 1;

  const radius = (size * scale) / 2;
  
  // Calculate exact bounds
  const bounds = getShapeBounds(options, radius);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  
  // No padding for pixel-perfect rendering
  const padding = 0; 
  const canvasWidth = Math.ceil(width + padding * 2);
  const canvasHeight = Math.ceil(height + padding * 2);

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');

  // Disable smoothing for pixel-perfect rendering
  ctx.imageSmoothingEnabled = false;
  ctx.imageSmoothingQuality = 'low';

  // Draw shape
  ctx.fillStyle = color;
  
  // Center the shape in the canvas
  ctx.translate(padding - bounds.minX, padding - bounds.minY);

  switch (shapeType) {
    case 'rectangle':
      drawRectangle(ctx, 0, 0, radius, stretchX, stretchY);
      break;
    case 'circle':
      drawCircle(ctx, 0, 0, radius, stretchX, stretchY);
      break;
    case 'triangle':
      drawPolygon(ctx, 0, 0, radius, 3, stretchX, stretchY);
      break;
    case 'hexagon':
      drawPolygon(ctx, 0, 0, radius, 6, stretchX, stretchY);
      break;
    case 'octagon':
      drawPolygon(ctx, 0, 0, radius, 8, stretchX, stretchY);
      break;
    case 'star':
      drawStar(ctx, 0, 0, radius, stretchX, stretchY);
      break;
  }

  // Apply alpha thresholding to remove any anti-aliasing artifacts
  // This ensures pixels are either fully transparent or fully opaque
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  // Parse target color
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  
  for (let i = 0; i < data.length; i += 4) {
    // Threshold alpha at 128
    if (data[i + 3] >= 128) {
      data[i + 3] = 255; // Fully opaque
      // Force exact color to remove any anti-aliasing artifacts
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    } else {
      data[i + 3] = 0; // Fully transparent
    }
  }
  
  ctx.putImageData(imageData, 0, 0);

  // Convert to data URL
  const dataUrl = canvas.toDataURL('image/png');

  return {
    dataUrl,
    width: canvasWidth,
    height: canvasHeight,
    offsetX: 0,
    offsetY: 0
  };
}

function drawRectangle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  stretchX: number,
  stretchY: number
) {
  const width = radius * 2 * stretchX;
  const height = radius * 2 * stretchY;
  ctx.fillRect(x - width / 2, y - height / 2, width, height);
}

function drawCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  stretchX: number,
  stretchY: number
) {
  ctx.beginPath();
  // For circles with stretch, use ellipse
  if (stretchX === stretchY) {
    ctx.arc(x, y, radius * stretchX, 0, Math.PI * 2);
  } else {
    ctx.ellipse(x, y, radius * stretchX, radius * stretchY, 0, 0, Math.PI * 2);
  }
  ctx.fill();
}

function drawPolygon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  sides: number,
  stretchX: number,
  stretchY: number
) {
  ctx.beginPath();

  const angle = (Math.PI * 2) / sides;
  let startAngle = -Math.PI / 2;

  for (let i = 0; i < sides; i++) {
    const currentAngle = startAngle + angle * i;
    const px = x + Math.cos(currentAngle) * radius * stretchX;
    const py = y + Math.sin(currentAngle) * radius * stretchY;

    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }

  ctx.closePath();
  ctx.fill();
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  stretchX: number,
  stretchY: number
) {
  const points = 5;
  const outerRadius = radius * stretchX;
  const innerRadius = (radius * 0.4) * stretchX;

  ctx.beginPath();

  const angle = (Math.PI * 2) / (points * 2);
  let startAngle = -Math.PI / 2;

  for (let i = 0; i < points * 2; i++) {
    const currentAngle = startAngle + angle * i;
    const isOuter = i % 2 === 0;
    const r = isOuter ? outerRadius : innerRadius;

    const px = x + Math.cos(currentAngle) * r;
    const py = y + Math.sin(currentAngle) * r * stretchY;

    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }

  ctx.closePath();
  ctx.fill();
}
