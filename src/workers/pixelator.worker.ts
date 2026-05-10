// src/workers/pixelator.worker.ts

const GEOPIXELS_PALETTE = [
  "#FFFFFF","#F4F59F","#FFCA3A","#FF9F1C","#FF595E","#E71D36","#F3BBC2","#FF85A1","#BD637D","#CDB4DB","#6A4C93","#4D194D","#A8D0DC","#2EC4B6","#1A535C","#6D9DCD","#1982C4","#A1C181","#8AC926","#A0A0A0","#6B4226","#505050","#CFD078","#145A7A","#8B1D24","#C07F7A","#C49A6C","#5B7B1C","#000000"
];

const WPLACE_PALETTE = [
  "#000000","#3C3C3C","#787878","#AAAAAA","#D2D2D2","#FFFFFF","#600018","#A50E1E","#ED1C24","#FA8072","#E45C1A","#FF7F27","#F6AA09","#F9DD3B","#FFFABC","#9C8431","#C5AD31","#E8D45F","#4A6B3A","#5A944A","#84C573","#0EB968","#13E67B","#87FF5E","#0C816E","#10AEA6","#13E1BE","#0F799F","#60F7F2","#BBFAF2","#28509E","#4093E4","#7DC7FF","#4D31B8","#6B50F6","#99B1FB","#4A4284","#7A71C4","#B5AEF1","#780C99","#AA38B9","#E09FF9","#CB007A","#EC1F80","#F38DA9","#9B5249","#D18078","#FAB6A4","#684634","#95682A","#DBA463","#7B6352","#9C846B","#D6B594","#D18051","#F8B277","#FFC5A5","#6D643F","#948C6B","#CDC59E","#333941","#6D758D","#B3B9D1"
];

const WPLACE_FREE_PALETTE = [
  "#000000","#3C3C3C","#787878","#D2D2D2","#FFFFFF","#600018","#ED1C24","#FF7F27","#F6AA09","#F9DD3B","#FFFABC","#0EB968","#13E67B","#87FF5E","#0C816E","#10AEA6","#13E1BE","#60F7F2","#28509E","#4093E4","#6B50F6","#99B1FB","#780C99","#AA38B9","#E09FF9","#CB007A","#EC1F80","#F38DA9","#684634","#95682A","#F8B277"
];

type ColorMatchAlgorithm = 'oklab' | 'ciede2000' | 'cie94' | 'cie76' | 'redmean';

interface RGB { r: number; g: number; b: number; }
interface LAB { l: number; a: number; b: number; }
interface OKLabColor { L: number; a: number; b: number; }

// --- Color Conversion & Distance ---

function hexToRgb(hex: string): RGB {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

function rgbToXyz(c: RGB) {
  let r = c.r / 255;
  let g = c.g / 255;
  let b = c.b / 255;

  r = r > 0.04045 ? Math.pow(((r + 0.055) / 1.055), 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow(((g + 0.055) / 1.055), 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow(((b + 0.055) / 1.055), 2.4) : b / 12.92;

  r *= 100; g *= 100; b *= 100;

  return {
    x: r * 0.4124 + g * 0.3576 + b * 0.1805,
    y: r * 0.2126 + g * 0.7152 + b * 0.0722,
    z: r * 0.0193 + g * 0.1192 + b * 0.9505
  };
}

function xyzToLab(c: { x: number, y: number, z: number }): LAB {
  let x = c.x / 95.047;
  let y = c.y / 100.000;
  let z = c.z / 108.883;

  x = x > 0.008856 ? Math.pow(x, 1/3) : (7.787 * x) + (16 / 116);
  y = y > 0.008856 ? Math.pow(y, 1/3) : (7.787 * y) + (16 / 116);
  z = z > 0.008856 ? Math.pow(z, 1/3) : (7.787 * z) + (16 / 116);

  return {
    l: (116 * y) - 16,
    a: 500 * (x - y),
    b: 200 * (y - z)
  };
}

function rgbToLab(c: RGB): LAB {
  return xyzToLab(rgbToXyz(c));
}

// --- OKLab Color Space ---

function rgbToOklab(c: RGB): OKLabColor {
  // sRGB → linear sRGB
  let r = c.r / 255;
  let g = c.g / 255;
  let b = c.b / 255;
  r = r >= 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g >= 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b >= 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  // linear sRGB → LMS (using Oklab M1 matrix)
  const l_ = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m_ = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s_ = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  // LMS → LMS^(1/3)
  const l3 = Math.cbrt(l_);
  const m3 = Math.cbrt(m_);
  const s3 = Math.cbrt(s_);

  // LMS^(1/3) → OKLab
  return {
    L: 0.2104542553 * l3 + 0.7936177850 * m3 - 0.0040720468 * s3,
    a: 1.9779984951 * l3 - 2.4285922050 * m3 + 0.4505937099 * s3,
    b: 0.0259040371 * l3 + 0.7827717662 * m3 - 0.8086757660 * s3,
  };
}

// --- Color Distance Functions ---

/** CIE76: simple Euclidean in CIELAB */
function deltaE_CIE76(labA: LAB, labB: LAB): number {
  const dL = labA.l - labB.l;
  const da = labA.a - labB.a;
  const db = labA.b - labB.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}

/** Redmean: fast weighted RGB distance (no color space conversion) */
function deltaE_Redmean(a: RGB, b: RGB): number {
  const rMean = (a.r + b.r) / 2;
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt((2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db);
}

/** CIE94: weighted Euclidean in CIELAB (graphics arts) */
function deltaE_CIE94(labA: LAB, labB: LAB): number {
  const dL = labA.l - labB.l;
  const C1 = Math.sqrt(labA.a * labA.a + labA.b * labA.b);
  const C2 = Math.sqrt(labB.a * labB.a + labB.b * labB.b);
  const dC = C1 - C2;
  const da = labA.a - labB.a;
  const db = labA.b - labB.b;
  let dH2 = da * da + db * db - dC * dC;
  if (dH2 < 0) dH2 = 0;
  const dH = Math.sqrt(dH2);
  // Graphic arts application constants
  const kL = 1, K1 = 0.045, K2 = 0.015;
  const SL = 1;
  const SC = 1 + K1 * C1;
  const SH = 1 + K2 * C1;
  const t1 = dL / (kL * SL);
  const t2 = dC / SC;
  const t3 = dH / SH;
  return Math.sqrt(t1 * t1 + t2 * t2 + t3 * t3);
}

/** CIEDE2000: the gold standard perceptual color difference */
function deltaE_CIEDE2000(labA: LAB, labB: LAB): number {
  const L1 = labA.l, a1 = labA.a, b1 = labA.b;
  const L2 = labB.l, a2 = labB.a, b2 = labB.b;

  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const avgC = (C1 + C2) / 2;

  const avgC7 = Math.pow(avgC, 7);
  const G = 0.5 * (1 - Math.sqrt(avgC7 / (avgC7 + 6103515625))); // 25^7
  const a1p = a1 * (1 + G);
  const a2p = a2 * (1 + G);
  const C1p = Math.sqrt(a1p * a1p + b1 * b1);
  const C2p = Math.sqrt(a2p * a2p + b2 * b2);
  const avgCp = (C1p + C2p) / 2;

  let h1p = Math.atan2(b1, a1p) * (180 / Math.PI); if (h1p < 0) h1p += 360;
  let h2p = Math.atan2(b2, a2p) * (180 / Math.PI); if (h2p < 0) h2p += 360;

  let dLp = L2 - L1;
  let dCp = C2p - C1p;
  let dhp: number;
  if (C1p * C2p === 0) { dhp = 0; }
  else if (Math.abs(h2p - h1p) <= 180) { dhp = h2p - h1p; }
  else if (h2p - h1p > 180) { dhp = h2p - h1p - 360; }
  else { dhp = h2p - h1p + 360; }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * Math.PI / 180) / 2);

  const avgLp = (L1 + L2) / 2;
  let avgHp: number;
  if (C1p * C2p === 0) { avgHp = h1p + h2p; }
  else if (Math.abs(h1p - h2p) <= 180) { avgHp = (h1p + h2p) / 2; }
  else if (h1p + h2p < 360) { avgHp = (h1p + h2p + 360) / 2; }
  else { avgHp = (h1p + h2p - 360) / 2; }

  const T = 1
    - 0.17 * Math.cos((avgHp - 30) * Math.PI / 180)
    + 0.24 * Math.cos((2 * avgHp) * Math.PI / 180)
    + 0.32 * Math.cos((3 * avgHp + 6) * Math.PI / 180)
    - 0.20 * Math.cos((4 * avgHp - 63) * Math.PI / 180);

  const SL = 1 + (0.015 * (avgLp - 50) * (avgLp - 50)) / Math.sqrt(20 + (avgLp - 50) * (avgLp - 50));
  const SC = 1 + 0.045 * avgCp;
  const SH = 1 + 0.015 * avgCp * T;

  const avgCp7 = Math.pow(avgCp, 7);
  const RT = -2 * Math.sqrt(avgCp7 / (avgCp7 + 6103515625))
    * Math.sin(60 * Math.PI / 180 * Math.exp(-((avgHp - 275) / 25) * ((avgHp - 275) / 25)));

  const tL = dLp / SL;
  const tC = dCp / SC;
  const tH = dHp / SH;

  return Math.sqrt(tL * tL + tC * tC + tH * tH + RT * tC * tH);
}

/** OKLab: Euclidean distance in OKLab space (modern perceptual) */
function deltaE_OKLab(a: OKLabColor, b: OKLabColor): number {
  const dL = a.L - b.L;
  const da = a.a - b.a;
  const db = a.b - b.b;
  // Scale by 100 to make values comparable to CIELAB ΔE range
  return Math.sqrt(dL * dL + da * da + db * db) * 100;
}

// Alias for backward compat
const getDeltaE = deltaE_CIE76;

// --- sRGB <-> linear-light conversions (for gamma-correct error diffusion) ---
// srgbToLinearF: 0..255 -> 0..1 linear
// linearToSrgbF: 0..1 linear -> 0..255 sRGB
function srgbToLinearF(c: number): number {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}
function linearToSrgbF(l: number): number {
  if (l <= 0) return 0;
  if (l >= 1) return 255;
  const v = l <= 0.0031308 ? 12.92 * l : 1.055 * Math.pow(l, 1 / 2.4) - 0.055;
  return v * 255;
}

// --- Resizing ---

function resampleNearest(srcData: ImageData, width: number, height: number): ImageData {
  const src = srcData.data;
  const dest = new ImageData(width, height);
  const destData = dest.data;
  const xRatio = srcData.width / width;
  const yRatio = srcData.height / height;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcX = Math.floor(x * xRatio);
      const srcY = Math.floor(y * yRatio);
      const srcIdx = (srcY * srcData.width + srcX) * 4;
      const destIdx = (y * width + x) * 4;
      
      destData[destIdx] = src[srcIdx];
      destData[destIdx + 1] = src[srcIdx + 1];
      destData[destIdx + 2] = src[srcIdx + 2];
      destData[destIdx + 3] = src[srcIdx + 3];
    }
  }
  return dest;
}

function resampleBilinear(srcData: ImageData, width: number, height: number): ImageData {
  const src = srcData.data;
  const dest = new ImageData(width, height);
  const destData = dest.data;

  // If dimensions match, return exact copy (no resampling needed)
  if (width === srcData.width && height === srcData.height) {
    destData.set(src);
    return dest;
  }
  
  // If downscaling significantly, use area averaging (box sampling) for smoother results
  if (width < srcData.width && height < srcData.height) {
      const xRatio = srcData.width / width;
      const yRatio = srcData.height / height;
      
      for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
              const srcX = x * xRatio;
              const srcY = y * yRatio;
              const srcW = xRatio;
              const srcH = yRatio;
              
              let r = 0, g = 0, b = 0, a = 0, totalWeight = 0;
              
              const startX = Math.floor(srcX);
              const startY = Math.floor(srcY);
              const endX = Math.min(Math.ceil(srcX + srcW), srcData.width);
              const endY = Math.min(Math.ceil(srcY + srcH), srcData.height);
              
              for (let sy = startY; sy < endY; sy++) {
                  for (let sx = startX; sx < endX; sx++) {
                      // Calculate weight based on overlap area
                      const weightX = Math.min(sx + 1, srcX + srcW) - Math.max(sx, srcX);
                      const weightY = Math.min(sy + 1, srcY + srcH) - Math.max(sy, srcY);
                      const weight = weightX * weightY;
                      
                      if (weight <= 0) continue;
                      
                      const srcIdx = (sy * srcData.width + sx) * 4;
                      r += src[srcIdx] * weight;
                      g += src[srcIdx + 1] * weight;
                      b += src[srcIdx + 2] * weight;
                      a += src[srcIdx + 3] * weight;
                      totalWeight += weight;
                  }
              }
              
              const destIdx = (y * width + x) * 4;
              if (totalWeight > 0) {
                  destData[destIdx] = r / totalWeight;
                  destData[destIdx + 1] = g / totalWeight;
                  destData[destIdx + 2] = b / totalWeight;
                  destData[destIdx + 3] = a / totalWeight;
              }
          }
      }
      return dest;
  }

  // Standard Bilinear for upscaling or mixed scaling
  const xRatio = (srcData.width - 1) / Math.max(width - 1, 1);
  const yRatio = (srcData.height - 1) / Math.max(height - 1, 1);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcX = x * xRatio;
      const srcY = y * yRatio;
      
      const x1 = Math.floor(srcX);
      const y1 = Math.floor(srcY);
      const x2 = Math.min(x1 + 1, srcData.width - 1);
      const y2 = Math.min(y1 + 1, srcData.height - 1);
      
      const dx = srcX - x1;
      const dy = srcY - y1;
      
      const destIdx = (y * width + x) * 4;
      
      for (let c = 0; c < 4; c++) {
        const v1 = src[(y1 * srcData.width + x1) * 4 + c];
        const v2 = src[(y1 * srcData.width + x2) * 4 + c];
        const v3 = src[(y2 * srcData.width + x1) * 4 + c];
        const v4 = src[(y2 * srcData.width + x2) * 4 + c];
        
        const top = v1 * (1 - dx) + v2 * dx;
        const bottom = v3 * (1 - dx) + v4 * dx;
        const value = top * (1 - dy) + bottom * dy;
        
        destData[destIdx + c] = Math.round(value);
      }
    }
  }
  return dest;
}

function resampleLanczos(imageData: ImageData, width: number, height: number): ImageData {
    const srcData = imageData.data;
    const srcWidth = imageData.width;
    const srcHeight = imageData.height;
    
    // 1. Horizontal Pass (Resize Width)
    // We create a temporary buffer with target width but original height
    // We use Float32Array for intermediate precision
    const tempBuffer = new Float32Array(width * srcHeight * 4);
    
    const sinc = (x: number) => {
        x = Math.abs(x);
        if (x === 0) return 1;
        const piX = Math.PI * x;
        return Math.sin(piX) / piX;
    };

    const lanczosKernel = (x: number, a: number) => {
        if (x > -a && x < a) {
            return sinc(x) * sinc(x / a);
        }
        return 0;
    };

    const a = 3;
    const ratioX = srcWidth / width;
    const scaleX = ratioX > 1 ? ratioX : 1;
    const radiusX = a * scaleX;

    for (let y = 0; y < srcHeight; y++) {
        for (let x = 0; x < width; x++) {
            const sx = (x + 0.5) * ratioX - 0.5;
            
            let r = 0, g = 0, b = 0, a_val = 0, totalWeight = 0;
            
            const startX = Math.floor(sx - radiusX + 1);
            const endX = Math.floor(sx + radiusX);
            
            for (let i = startX; i <= endX; i++) {
                if (i < 0 || i >= srcWidth) continue;
                
                const weight = lanczosKernel((sx - i) / scaleX, a);
                if (weight === 0) continue;
                
                const srcIdx = (y * srcWidth + i) * 4;
                r += srcData[srcIdx] * weight;
                g += srcData[srcIdx + 1] * weight;
                b += srcData[srcIdx + 2] * weight;
                a_val += srcData[srcIdx + 3] * weight;
                totalWeight += weight;
            }
            
            const destIdx = (y * width + x) * 4;
            if (totalWeight > 0) {
                tempBuffer[destIdx] = r / totalWeight;
                tempBuffer[destIdx + 1] = g / totalWeight;
                tempBuffer[destIdx + 2] = b / totalWeight;
                tempBuffer[destIdx + 3] = a_val / totalWeight;
            }
        }
    }

    // 2. Vertical Pass (Resize Height)
    // Resize from temp buffer (width x srcHeight) to final (width x height)
    const destImageData = new ImageData(width, height);
    const destData = destImageData.data;
    
    const ratioY = srcHeight / height;
    const scaleY = ratioY > 1 ? ratioY : 1;
    const radiusY = a * scaleY;

    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
            const sy = (y + 0.5) * ratioY - 0.5;
            
            let r = 0, g = 0, b = 0, a_val = 0, totalWeight = 0;
            
            const startY = Math.floor(sy - radiusY + 1);
            const endY = Math.floor(sy + radiusY);
            
            for (let i = startY; i <= endY; i++) {
                if (i < 0 || i >= srcHeight) continue;
                
                const weight = lanczosKernel((sy - i) / scaleY, a);
                if (weight === 0) continue;
                
                const srcIdx = (i * width + x) * 4;
                r += tempBuffer[srcIdx] * weight;
                g += tempBuffer[srcIdx + 1] * weight;
                b += tempBuffer[srcIdx + 2] * weight;
                a_val += tempBuffer[srcIdx + 3] * weight;
                totalWeight += weight;
            }
            
            const destIdx = (y * width + x) * 4;
            if (totalWeight > 0) {
                // Clamp values to 0-255 for final output
                destData[destIdx] = Math.max(0, Math.min(255, r / totalWeight));
                destData[destIdx + 1] = Math.max(0, Math.min(255, g / totalWeight));
                destData[destIdx + 2] = Math.max(0, Math.min(255, b / totalWeight));
                destData[destIdx + 3] = Math.max(0, Math.min(255, a_val / totalWeight));
            }
        }
    }

    return destImageData;
}

// --- Dithering ---

const ditherMatrices: Record<string, { matrix: number[][], size: number, divisor: number }> = {
    'bayer-4x4': {
        matrix: [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]],
        size: 4, divisor: 16
    },
    'bayer-8x8': {
        matrix: [
            [0, 32, 8, 40, 2, 34, 10, 42], [48, 16, 56, 24, 50, 18, 58, 26],
            [12, 44, 4, 36, 14, 46, 6, 38], [60, 28, 52, 20, 62, 30, 54, 22],
            [3, 35, 11, 43, 1, 33, 9, 41], [51, 19, 59, 27, 49, 17, 57, 25],
            [15, 47, 7, 39, 13, 45, 5, 37], [63, 31, 55, 23, 61, 29, 53, 21]
        ],
        size: 8, divisor: 64
    },
    'halftone-dot': {
        matrix: [[12, 5, 6, 13], [4, 0, 1, 7], [8, 2, 3, 11], [14, 9, 10, 15]],
        size: 4, divisor: 16
    },
    'diagonal-line': {
        matrix: [[15, 7, 3, 7], [7, 3, 7, 15], [3, 7, 15, 7], [7, 15, 7, 3]],
        size: 4, divisor: 16
    },
    'cross-hatch': {
        matrix: [[0, 8, 0, 8], [8, 15, 8, 15], [0, 8, 0, 8], [8, 15, 8, 15]],
        size: 4, divisor: 16
    },
    'grid': {
        matrix: [[0, 0, 0, 0], [0, 15, 15, 0], [0, 15, 15, 0], [0, 0, 0, 0]],
        size: 4, divisor: 16
    }
};

const errorKernels: Record<string, { dx: number, dy: number, f: number }[]> = {
    'floyd-steinberg': [
        { dx: 1, dy: 0, f: 7 / 16 }, { dx: -1, dy: 1, f: 3 / 16 }, { dx: 0, dy: 1, f: 5 / 16 }, { dx: 1, dy: 1, f: 1 / 16 }
    ],
    'burkes': [
        { dx: 1, dy: 0, f: 8 / 32 }, { dx: 2, dy: 0, f: 4 / 32 }, { dx: -2, dy: 1, f: 2 / 32 }, { dx: -1, dy: 1, f: 4 / 32 },
        { dx: 0, dy: 1, f: 8 / 32 }, { dx: 1, dy: 1, f: 4 / 32 }, { dx: 2, dy: 1, f: 2 / 32 }
    ],
    'stucki': [
        { dx: 1, dy: 0, f: 8 / 42 }, { dx: 2, dy: 0, f: 4 / 42 }, { dx: -2, dy: 1, f: 2 / 42 }, { dx: -1, dy: 1, f: 4 / 42 },
        { dx: 0, dy: 1, f: 8 / 42 }, { dx: 1, dy: 1, f: 4 / 42 }, { dx: 2, dy: 1, f: 2 / 42 }, { dx: -2, dy: 2, f: 1 / 42 },
        { dx: -1, dy: 2, f: 2 / 42 }, { dx: 0, dy: 2, f: 4 / 42 }, { dx: 1, dy: 2, f: 2 / 42 }, { dx: 2, dy: 2, f: 1 / 42 }
    ],
    'sierra-2': [
        { dx: 1, dy: 0, f: 4 / 16 }, { dx: 2, dy: 0, f: 3 / 16 }, { dx: -2, dy: 1, f: 1 / 16 }, { dx: -1, dy: 1, f: 2 / 16 },
        { dx: 0, dy: 1, f: 3 / 16 }, { dx: 1, dy: 1, f: 2 / 16 }, { dx: 2, dy: 1, f: 1 / 16 }
    ],
    'sierra-lite': [
        { dx: 1, dy: 0, f: 2 / 4 }, { dx: -1, dy: 1, f: 1 / 4 }, { dx: 0, dy: 1, f: 1 / 4 }
    ],
    'atkinson': [
        { dx: 1, dy: 0, f: 1 / 8 }, { dx: 2, dy: 0, f: 1 / 8 }, { dx: -1, dy: 1, f: 1 / 8 },
        { dx: 0, dy: 1, f: 1 / 8 }, { dx: 1, dy: 1, f: 1 / 8 }, { dx: 0, dy: 2, f: 1 / 8 }
    ],
    'jarvis': [
        { dx: 1, dy: 0, f: 7/48 }, { dx: 2, dy: 0, f: 5/48 },
        { dx: -2, dy: 1, f: 3/48 }, { dx: -1, dy: 1, f: 5/48 }, { dx: 0, dy: 1, f: 7/48 }, { dx: 1, dy: 1, f: 5/48 }, { dx: 2, dy: 1, f: 3/48 },
        { dx: -2, dy: 2, f: 1/48 }, { dx: -1, dy: 2, f: 3/48 }, { dx: 0, dy: 2, f: 5/48 }, { dx: 1, dy: 2, f: 3/48 }, { dx: 2, dy: 2, f: 1/48 }
    ],
    'shiau-fan': [
        { dx: 1, dy: 0, f: 4/8 },
        { dx: -2, dy: 1, f: 1/8 }, { dx: -1, dy: 1, f: 1/8 }, { dx: 0, dy: 1, f: 2/8 }
    ]
};

interface FindClosestResult { color: RGB; dist: number; index: number; }

function findClosestColor(
  pixel: RGB,
  palette: RGB[],
  paletteLab: LAB[],
  paletteOklab: OKLabColor[] | null,
  algorithm: ColorMatchAlgorithm,
  preserveDetailThreshold: number,
  cache?: Map<number, FindClosestResult>,
): FindClosestResult {
    // Round to integers for cache key (handles float RGB from error diffusion)
    const ri = Math.max(0, Math.min(255, Math.round(pixel.r)));
    const gi = Math.max(0, Math.min(255, Math.round(pixel.g)));
    const bi = Math.max(0, Math.min(255, Math.round(pixel.b)));
    const cacheKey = (ri << 16) | (gi << 8) | bi;

    if (cache) {
      const cached = cache.get(cacheKey);
      if (cached) {
        // For preserve detail, cached result already accounts for it
        return cached;
      }
    }

    let minDist = Infinity;
    let closest = palette[0];
    let closestIndex = 0;

    // Use the integer-rounded pixel for matching (avoids sub-pixel noise)
    const matchPixel = { r: ri, g: gi, b: bi };

    if (algorithm === 'oklab') {
      const pixelOk = rgbToOklab(matchPixel);
      for (let i = 0; i < palette.length; i++) {
        const dist = deltaE_OKLab(pixelOk, paletteOklab![i]);
        if (dist < minDist) { minDist = dist; closest = palette[i]; closestIndex = i; }
      }
    } else if (algorithm === 'redmean') {
      for (let i = 0; i < palette.length; i++) {
        const dist = deltaE_Redmean(matchPixel, palette[i]);
        if (dist < minDist) { minDist = dist; closest = palette[i]; closestIndex = i; }
      }
    } else {
      const pixelLab = rgbToLab(matchPixel);
      const distFn = algorithm === 'ciede2000' ? deltaE_CIEDE2000
                   : algorithm === 'cie94'     ? deltaE_CIE94
                   :                             deltaE_CIE76;
      for (let i = 0; i < palette.length; i++) {
        const dist = distFn(pixelLab, paletteLab[i]);
        if (dist < minDist) { minDist = dist; closest = palette[i]; closestIndex = i; }
      }
    }

    let result: FindClosestResult;

    // Preserve detail: if the closest palette color is within the threshold,
    // use it directly (skip dithering perturbation) but still map to the palette color
    if (preserveDetailThreshold > 0 && minDist <= preserveDetailThreshold) {
      result = { color: closest, dist: 0, index: closestIndex };
    } else {
      result = { color: closest, dist: minDist, index: closestIndex };
    }

    if (cache) {
      cache.set(cacheKey, result);
    }

    return result;
}

function applyDithering(
  imageData: ImageData,
  paletteHex: string[],
  algorithm: string,
  strength: number,
  colorMatchAlgorithm: ColorMatchAlgorithm = 'oklab',
  preserveDetailThreshold: number = 0,
  serpentine: boolean = true,
  gammaCorrect: boolean = false,
) {
    const pixels = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    
    const paletteRGB = paletteHex.map(hexToRgb);
    const paletteLab = paletteRGB.map(rgbToLab);
    const paletteOklab = colorMatchAlgorithm === 'oklab' ? paletteRGB.map(rgbToOklab) : null;

    // Color cache: avoids recomputing expensive distance functions for identical RGB values
    const colorCache = new Map<number, FindClosestResult>();

    const strengthFactor = strength / 100;

    if (algorithm === 'blue-noise') {
        // Interleaved Gradient Noise (Jorge Jimenez, 2014).
        // Blue-noise-like spatial distribution with zero memory and zero precomputation.
        const BASE_DITHER_STRENGTH = 64;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = (y * width + x) * 4;
                if (pixels[index + 3] < 128) { pixels[index + 3] = 0; continue; }
                const ign = (52.9829189 * ((0.06711056 * x + 0.00583715 * y) % 1)) % 1;
                const nudge = (ign - 0.5) * BASE_DITHER_STRENGTH * strengthFactor;
                const oldColor = {
                    r: Math.max(0, Math.min(255, pixels[index] + nudge)),
                    g: Math.max(0, Math.min(255, pixels[index + 1] + nudge)),
                    b: Math.max(0, Math.min(255, pixels[index + 2] + nudge)),
                };
                const { color: newColor } = findClosestColor(oldColor, paletteRGB, paletteLab, paletteOklab, colorMatchAlgorithm, preserveDetailThreshold, colorCache);
                pixels[index] = newColor.r;
                pixels[index + 1] = newColor.g;
                pixels[index + 2] = newColor.b;
                pixels[index + 3] = 255;
            }
        }
        return;
    }

    if (algorithm in ditherMatrices) {
        // Ordered Dithering
        const dither = ditherMatrices[algorithm];
        const matrix = dither.matrix;
        const mSize = dither.size;
        const mDiv = dither.divisor;
        const BASE_DITHER_STRENGTH = 64; // Increased base strength

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = (y * width + x) * 4;
                if (pixels[index + 3] < 128) { pixels[index + 3] = 0; continue; }

                const mX = x % mSize;
                const mY = y % mSize;
                const threshold = matrix[mY][mX];
                
                // Nudge calculation
                const nudge = (threshold / mDiv - 0.5) * BASE_DITHER_STRENGTH * strengthFactor;

                const oldColor = {
                    r: Math.max(0, Math.min(255, pixels[index] + nudge)),
                    g: Math.max(0, Math.min(255, pixels[index + 1] + nudge)),
                    b: Math.max(0, Math.min(255, pixels[index + 2] + nudge))
                };

                const { color: newColor } = findClosestColor(oldColor, paletteRGB, paletteLab, paletteOklab, colorMatchAlgorithm, preserveDetailThreshold, colorCache);

                pixels[index] = newColor.r;
                pixels[index + 1] = newColor.g;
                pixels[index + 2] = newColor.b;
                pixels[index + 3] = 255;
            }
        }
    } else {
        // Error Diffusion (with optional serpentine + linear-light gamma correction)
        const kernel = errorKernels[algorithm];
        const useLinear = !!gammaCorrect;

        // Working buffer in either sRGB (legacy) or linear-light space.
        const buf = new Float32Array(pixels.length);
        if (useLinear) {
            for (let i = 0; i < pixels.length; i += 4) {
                buf[i]     = srgbToLinearF(pixels[i]);
                buf[i + 1] = srgbToLinearF(pixels[i + 1]);
                buf[i + 2] = srgbToLinearF(pixels[i + 2]);
                buf[i + 3] = pixels[i + 3];
            }
        } else {
            buf.set(pixels);
        }

        // Pre-compute palette in linear space when needed (for error calculation only).
        const paletteLinear: { r: number; g: number; b: number }[] | null = useLinear
            ? paletteRGB.map(c => ({ r: srgbToLinearF(c.r), g: srgbToLinearF(c.g), b: srgbToLinearF(c.b) }))
            : null;

        for (let y = 0; y < height; y++) {
            const reverse = serpentine && (y & 1) === 1;
            const xStart = reverse ? width - 1 : 0;
            const xEnd   = reverse ? -1 : width;
            const xStep  = reverse ? -1 : 1;

            for (let x = xStart; x !== xEnd; x += xStep) {
                const index = (y * width + x) * 4;
                if (buf[index + 3] < 128) { pixels[index + 3] = 0; continue; }

                // Match against palette in sRGB so existing distance functions are reused.
                let matchPixel: RGB;
                if (useLinear) {
                    matchPixel = {
                        r: linearToSrgbF(buf[index]),
                        g: linearToSrgbF(buf[index + 1]),
                        b: linearToSrgbF(buf[index + 2]),
                    };
                } else {
                    matchPixel = {
                        r: buf[index],
                        g: buf[index + 1],
                        b: buf[index + 2],
                    };
                }

                const { color: newColor, index: pIdx } = findClosestColor(
                    matchPixel, paletteRGB, paletteLab, paletteOklab,
                    colorMatchAlgorithm, preserveDetailThreshold, colorCache
                );

                pixels[index] = newColor.r;
                pixels[index + 1] = newColor.g;
                pixels[index + 2] = newColor.b;
                pixels[index + 3] = 255;

                if (algorithm === 'none' || !kernel) continue;

                // Compute residual error in working space.
                let er: number, eg: number, eb: number;
                if (useLinear) {
                    const lp = paletteLinear![pIdx];
                    er = (buf[index]     - lp.r) * strengthFactor;
                    eg = (buf[index + 1] - lp.g) * strengthFactor;
                    eb = (buf[index + 2] - lp.b) * strengthFactor;
                } else {
                    er = (buf[index]     - newColor.r) * strengthFactor;
                    eg = (buf[index + 1] - newColor.g) * strengthFactor;
                    eb = (buf[index + 2] - newColor.b) * strengthFactor;
                }

                for (const k of kernel) {
                    const kdx = reverse ? -k.dx : k.dx;
                    const nX = x + kdx, nY = y + k.dy;
                    if (nX >= 0 && nX < width && nY >= 0 && nY < height) {
                        const i2 = (nY * width + nX) * 4;
                        if (buf[i2 + 3] < 128) continue;
                        buf[i2]     += er * k.f;
                        buf[i2 + 1] += eg * k.f;
                        buf[i2 + 2] += eb * k.f;
                    }
                }
            }
        }
    }
}

// --- K-Means Clustering ---

function kmeans(data: number[][], k: number, maxIterations = 20): Promise<{ centroids: number[][], assignments: number[] }> {
    return new Promise(resolve => {
        if (k > data.length) {
            k = data.length;
        }
        if (k === 0) {
            resolve({ centroids: [], assignments: [] });
            return;
        }

        let centroids: number[][] = [];
        const tempData = [...data];
        for (let i = 0; i < k; i++) {
            const index = Math.floor(Math.random() * tempData.length);
            centroids.push(tempData.splice(index, 1)[0]);
        }

        let assignments = new Array(data.length);

        for (let iter = 0; iter < maxIterations; iter++) {
            for (let i = 0; i < data.length; i++) {
                let min_dist = Infinity;
                let best_centroid = -1;
                for (let j = 0; j < k; j++) {
                    const dist = (data[i][0] - centroids[j][0]) ** 2 + (data[i][1] - centroids[j][1]) ** 2 + (data[i][2] - centroids[j][2]) ** 2;
                    if (dist < min_dist) { min_dist = dist; best_centroid = j; }
                }
                assignments[i] = best_centroid;
            }

            const newCentroids = Array.from({ length: k }, () => [0, 0, 0]);
            const counts = new Array(k).fill(0);
            for (let i = 0; i < data.length; i++) {
                const cIndex = assignments[i];
                newCentroids[cIndex][0] += data[i][0];
                newCentroids[cIndex][1] += data[i][1];
                newCentroids[cIndex][2] += data[i][2];
                counts[cIndex]++;
            }

            for (let i = 0; i < k; i++) {
                if (counts[i] > 0) {
                    newCentroids[i][0] /= counts[i];
                    newCentroids[i][1] /= counts[i];
                    newCentroids[i][2] /= counts[i];
                } else {
                    newCentroids[i] = data[Math.floor(Math.random() * data.length)];
                }
            }

            let changed = false;
            for (let i = 0; i < k; i++) {
                if (centroids[i][0] !== newCentroids[i][0] || centroids[i][1] !== newCentroids[i][1] || centroids[i][2] !== newCentroids[i][2]) {
                    changed = true; break;
                }
            }
            centroids = newCentroids;
            if (!changed) break;
        }

        resolve({ centroids, assignments });
    });
}

function rgbToHex(rgb: { r: number; g: number; b: number }): string {
    const toHex = (c: number) => {
        const hex = Math.round(c).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`.toUpperCase();
}

async function suggestMissingColors(
    imageData: ImageData, 
    paletteHex: string[], 
    numToSuggest: number,
    preferDistinct: boolean = false,
    samplingMask?: number[] | null,
    samplingMaskWidth?: number,
    samplingMaskHeight?: number,
): Promise<string[]> {
    if (paletteHex.length === 0) return [];
    
    const paletteRGB = paletteHex.map(hexToRgb);
    const paletteLAB = paletteRGB.map(rgbToLab);
    
    // Extract non-transparent pixels with sampling for performance
    const pixels = imageData.data;
    const pixelArray: number[][] = [];
    const imgW = imageData.width;
    const imgH = imageData.height;
    
    // Build a scaled mask lookup if sampling mask is provided
    const hasMask = samplingMask && samplingMask.length > 0 && samplingMaskWidth && samplingMaskHeight;
    
    // Calculate step size to limit total pixels to approx 4096 (64x64) for performance
    const totalPixels = pixels.length / 4;
    const maxPixels = 4096;
    const step = Math.ceil(totalPixels / maxPixels) * 4;

    for (let i = 0; i < pixels.length; i += step) {
        if (pixels[i + 3] > 128) {
            // Check sampling mask if present
            if (hasMask) {
                const pixIdx = i / 4;
                const px = pixIdx % imgW;
                const py = Math.floor(pixIdx / imgW);
                const mx = Math.floor(px * samplingMaskWidth! / imgW);
                const my = Math.floor(py * samplingMaskHeight! / imgH);
                const maskIdx = my * samplingMaskWidth! + mx;
                if (maskIdx < samplingMask!.length && samplingMask![maskIdx] === 0) continue;
            }
            pixelArray.push([pixels[i], pixels[i + 1], pixels[i + 2]]);
        }
    }
    
    if (pixelArray.length === 0) return [];
    
    // Run K-Means to find dominant clusters
    // If preferDistinct is true, use double the clusters for better diversity
    let k = Math.min(128, pixelArray.length);
    if (preferDistinct) {
        k = Math.min(256, pixelArray.length);
    }
    
    const kmeansResult = await kmeans(pixelArray, k);
    const centroids = kmeansResult.centroids;
    const assignments = kmeansResult.assignments;
    
    // Count pixels per cluster
    const pixelCounts = new Array(centroids.length).fill(0);
    for (const assignment of assignments) {
        pixelCounts[assignment]++;
    }
    
    // Calculate error for each centroid
    const centroidErrors: { hex: string; rgb: RGB; error: number; count: number; totalError: number }[] = [];
    
    for (let i = 0; i < centroids.length; i++) {
        const c = centroids[i];
        const count = pixelCounts[i];
        
        if (count === 0) continue;
        
        const centroidColorRGB = { r: Math.round(c[0]), g: Math.round(c[1]), b: Math.round(c[2]) };
        const centroidColorLAB = rgbToLab(centroidColorRGB);
        
        // Find closest color in palette using CIELAB
        let minDeltaE = Infinity;
        for (const colorLAB of paletteLAB) {
            const dist = getDeltaE(centroidColorLAB, colorLAB);
            if (dist < minDeltaE) {
                minDeltaE = dist;
            }
        }
        
        const totalError = minDeltaE * count;
        
        centroidErrors.push({
            hex: rgbToHex(centroidColorRGB),
            rgb: centroidColorRGB,
            error: minDeltaE,
            count: count,
            totalError: totalError
        });
    }
    
    // Sort by total error (descending)
    centroidErrors.sort((a, b) => b.totalError - a.totalError);
    
    // If not preferring distinct, just return top N
    if (!preferDistinct) {
        return centroidErrors.slice(0, numToSuggest).map(c => c.hex);
    }
    
    // Greedy selection for distinct colors
    // Start with highest error, then greedily add colors that are:
    // 1. High error (good candidates)
    // 2. Sufficiently distinct from already-selected colors
    // Progressively relax the threshold if we can't fill the requested count
    const selected: typeof centroidErrors = [];
    const thresholds = [30, 20, 12, 6, 3, 0]; // Progressively relax distinctness

    for (const threshold of thresholds) {
        if (selected.length >= numToSuggest) break;

        for (const candidate of centroidErrors) {
            if (selected.length >= numToSuggest) break;
            // Skip already-selected
            if (selected.some(s => s.hex === candidate.hex)) continue;

            if (selected.length === 0) {
                selected.push(candidate);
            } else {
                let isDistinct = true;
                const candidateLAB = rgbToLab(candidate.rgb);

                for (const sel of selected) {
                    const selLAB = rgbToLab(sel.rgb);
                    const deltaE = getDeltaE(candidateLAB, selLAB);
                    if (deltaE < threshold) {
                        isDistinct = false;
                        break;
                    }
                }

                if (isDistinct) {
                    selected.push(candidate);
                }
            }
        }
    }
    
    return selected.map(c => c.hex);
}

function applyColorModifiers(imageData: ImageData, brightness: number, contrast: number, saturation: number): ImageData {
  // ... [Keep existing implementation] ...
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  const newImageData = new ImageData(new Uint8ClampedArray(data), width, height);
  const d = newImageData.data;

  const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));

  for (let i = 0; i < d.length; i += 4) {
    let r = d[i];
    let g = d[i+1];
    let b = d[i+2];

    // Brightness
    r += brightness;
    g += brightness;
    b += brightness;

    // Contrast
    r = contrastFactor * (r - 128) + 128;
    g = contrastFactor * (g - 128) + 128;
    b = contrastFactor * (b - 128) + 128;

    // Saturation
    if (saturation !== 0) {
        const gray = 0.2989 * r + 0.5870 * g + 0.1140 * b;
        const satMult = 1 + (saturation / 100);
        r = gray + (r - gray) * satMult;
        g = gray + (g - gray) * satMult;
        b = gray + (b - gray) * satMult;
    }

    d[i] = Math.max(0, Math.min(255, r));
    d[i+1] = Math.max(0, Math.min(255, g));
    d[i+2] = Math.max(0, Math.min(255, b));
  }

  return newImageData;
}

// --- Preprocessing Filters ---

// Bilateral Filter: Blurs similar colors while preserving edges
function applyBilateralFilter(imageData: ImageData, strength: number): ImageData {
  if (strength <= 0) return imageData; // true no-op at 0%

  const src = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  const dest = new ImageData(new Uint8ClampedArray(src), width, height);
  const destData = dest.data;
  
  // Revised mapping: 
  // Strength 0-100 -> Radius 2-12 (larger radius needed for HD images)
  const spatialRadius = Math.max(2, Math.floor((strength / 100) * 12)); 
  const sigmaSpatial = spatialRadius / 2;
  const sigmaColor = 30 + (strength * 1.5); // Color tolerance
  
  // Precompute spatial weights
  const spatialWeights = [];
  for (let i = -spatialRadius; i <= spatialRadius; i++) {
      spatialWeights.push(Math.exp(-(i * i) / (2 * sigmaSpatial * sigmaSpatial)));
  }
  
  // Lookup table for color weights (speed optimization)
  const colorWeights = new Float32Array(256 * 3); // Approx max diff
  const colorCoeff = -1 / (2 * sigmaColor * sigmaColor);
  for (let i = 0; i < colorWeights.length; i++) {
      colorWeights[i] = Math.exp(i * i * colorCoeff);
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const centerR = src[idx];
      const centerG = src[idx + 1];
      const centerB = src[idx + 2];
      
      let sumR = 0, sumG = 0, sumB = 0, sumW = 0;
      
      for (let dy = -spatialRadius; dy <= spatialRadius; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        const spatialW_Y = spatialWeights[dy + spatialRadius];

        for (let dx = -spatialRadius; dx <= spatialRadius; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          
          const nIdx = (ny * width + nx) * 4;
          const nR = src[nIdx];
          const nG = src[nIdx + 1];
          const nB = src[nIdx + 2];
          
          const dist = Math.abs(nR - centerR) + Math.abs(nG - centerG) + Math.abs(nB - centerB);
          const weight = spatialW_Y * spatialWeights[dx + spatialRadius] * Math.exp(dist * dist * colorCoeff); // simple approximation

          sumR += nR * weight;
          sumG += nG * weight;
          sumB += nB * weight;
          sumW += weight;
        }
      }
      
      destData[idx] = sumR / sumW;
      destData[idx + 1] = sumG / sumW;
      destData[idx + 2] = sumB / sumW;
      destData[idx + 3] = src[idx + 3];
    }
  }
  return dest;
}

// --- Unsharp Mask (Sharpening) ---

function applySharpening(imageData: ImageData, strength: number): ImageData {
    if (strength <= 0) return imageData;
    // strength range is 1–300. Scale to amount: 1→0.04, 100→1.5, 300→4.5
    const amount = (strength / 100) * 1.5;
    const src = imageData.data;
    const w = imageData.width;
    const h = imageData.height;
    const dest = new ImageData(new Uint8ClampedArray(src), w, h);
    const d = dest.data;

    // 3×3 box blur for the "blur" term in unsharp mask
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            d[idx + 3] = src[idx + 3];
            if (src[idx + 3] < 128) { d[idx] = src[idx]; d[idx+1] = src[idx+1]; d[idx+2] = src[idx+2]; continue; }
            for (let c = 0; c < 3; c++) {
                let blurSum = 0, blurCount = 0;
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const ny = y + dy, nx = x + dx;
                        if (ny < 0 || ny >= h || nx < 0 || nx >= w) continue;
                        blurSum += src[(ny * w + nx) * 4 + c];
                        blurCount++;
                    }
                }
                const blurred = blurSum / blurCount;
                d[idx + c] = Math.min(255, Math.max(0, Math.round(src[idx + c] + amount * (src[idx + c] - blurred))));
            }
        }
    }
    return dest;
}

// --- Vibrance ---

function applyVibrance(imageData: ImageData, strength: number): ImageData {
    // Vibrance selectively boosts saturation of less-saturated colors.
    // strength: -100 to +100 (negative = reduce vibrance)
    if (strength === 0) return imageData;
    const amount = strength / 100;
    const src = imageData.data;
    const w = imageData.width;
    const h = imageData.height;
    const dest = new ImageData(new Uint8ClampedArray(src), w, h);
    const d = dest.data;

    for (let i = 0; i < w * h; i++) {
        const o = i * 4;
        if (src[o + 3] < 128) { d[o] = src[o]; d[o+1] = src[o+1]; d[o+2] = src[o+2]; d[o+3] = src[o+3]; continue; }
        const r = src[o] / 255;
        const g = src[o+1] / 255;
        const b = src[o+2] / 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const sat = max === 0 ? 0 : (max - min) / max; // simple HSV saturation
        // Weight: boost low-sat colors more (1 - sat = unsaturated fraction)
        const weight = (1 - sat) * Math.abs(amount);
        const boost = amount > 0 ? 1 + weight : 1 - weight;
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        d[o]   = Math.min(255, Math.max(0, Math.round((lum + (r - lum) * boost) * 255)));
        d[o+1] = Math.min(255, Math.max(0, Math.round((lum + (g - lum) * boost) * 255)));
        d[o+2] = Math.min(255, Math.max(0, Math.round((lum + (b - lum) * boost) * 255)));
        d[o+3] = src[o+3];
    }
    return dest;
}

// --- Edge Detection Preprocessing ---

function applyEdgeDetection(imageData: ImageData, strengthLevel: number, _unusedBlur: number, algorithm: string): ImageData {
  // strengthLevel: 0 = no effect, 1-10 mapped to 10%-100% blend.
  // Always pre-blurs with 1px Gaussian internally for clean edge detection.
  if (strengthLevel <= 0) return imageData; // true no-op at far left

  const blendFactor = Math.min(1, (strengthLevel / 10) * 0.9); // 0.09 – 0.9
  const src = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  const dest = new ImageData(new Uint8ClampedArray(src), width, height);
  const destData = dest.data;

  // Convert to grayscale for edge detection
  let gray = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      gray[y * width + x] = 0.299 * src[idx] + 0.587 * src[idx + 1] + 0.114 * src[idx + 2];
    }
  }

  // Always apply 1px Gaussian pre-blur for noise suppression
  {
    const radius = 1;
    const sigma = 0.5;
    const kernelSize = 3;
    const kernel = new Float32Array(kernelSize);
    let kernelSum = 0;
    for (let i = 0; i < kernelSize; i++) {
      const xi = i - radius;
      kernel[i] = Math.exp(-(xi * xi) / (2 * sigma * sigma));
      kernelSum += kernel[i];
    }
    for (let i = 0; i < kernelSize; i++) kernel[i] /= kernelSum;
    const temp = new Float32Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        for (let k = -radius; k <= radius; k++) {
          const sx = Math.min(width - 1, Math.max(0, x + k));
          sum += gray[y * width + sx] * kernel[k + radius];
        }
        temp[y * width + x] = sum;
      }
    }
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        for (let k = -radius; k <= radius; k++) {
          const sy = Math.min(height - 1, Math.max(0, y + k));
          sum += temp[sy * width + x] * kernel[k + radius];
        }
        gray[y * width + x] = sum;
      }
    }
  }

  // Edge detection with selected algorithm
  const edgeMag = new Float32Array(width * height);
  let maxMag = 0;

  if (algorithm === 'laplacian') {
    // Laplacian (8-connected): second-derivative edge detection in all directions
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const tl = gray[(y - 1) * width + (x - 1)];
        const tc = gray[(y - 1) * width + x];
        const tr = gray[(y - 1) * width + (x + 1)];
        const ml = gray[y * width + (x - 1)];
        const mc = gray[y * width + x];
        const mr = gray[y * width + (x + 1)];
        const bl = gray[(y + 1) * width + (x - 1)];
        const bc = gray[(y + 1) * width + x];
        const br = gray[(y + 1) * width + (x + 1)];
        const mag = Math.abs(-8 * mc + tl + tc + tr + ml + mr + bl + bc + br);
        edgeMag[y * width + x] = mag;
        if (mag > maxMag) maxMag = mag;
      }
    }
  } else {
    // Sobel: [1,2,1] center weight — general purpose
    // Scharr: [3,10,3] center weight — bolder, thicker edges with better rotational symmetry
    const w1 = algorithm === 'scharr' ? 3 : 1;
    const w2 = algorithm === 'scharr' ? 10 : 2;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const tl = gray[(y - 1) * width + (x - 1)];
        const tc = gray[(y - 1) * width + x];
        const tr = gray[(y - 1) * width + (x + 1)];
        const ml = gray[y * width + (x - 1)];
        const mr = gray[y * width + (x + 1)];
        const bl = gray[(y + 1) * width + (x - 1)];
        const bc = gray[(y + 1) * width + x];
        const br = gray[(y + 1) * width + (x + 1)];

        const gx = -w1 * tl - w2 * ml - w1 * bl + w1 * tr + w2 * mr + w1 * br;
        const gy = -w1 * tl - w2 * tc - w1 * tr + w1 * bl + w2 * bc + w1 * br;
        const mag = Math.sqrt(gx * gx + gy * gy);
        edgeMag[y * width + x] = mag;
        if (mag > maxMag) maxMag = mag;
      }
    }
  }

  // Normalize using 95th percentile instead of max to avoid outlier noise washing out edges
  const allMags: number[] = [];
  for (let i = 0; i < edgeMag.length; i++) {
    if (edgeMag[i] > 0) allMags.push(edgeMag[i]);
  }
  allMags.sort((a, b) => a - b);
  const normFactor = allMags.length > 0 ? allMags[Math.floor(allMags.length * 0.95)] : 1;
  if (normFactor === 0) return dest;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const normalized = Math.min(1, edgeMag[y * width + x] / normFactor);
      const edgeDarken = 1 - normalized * blendFactor;
      destData[idx] = Math.round(src[idx] * edgeDarken);
      destData[idx + 1] = Math.round(src[idx + 1] * edgeDarken);
      destData[idx + 2] = Math.round(src[idx + 2] * edgeDarken);
      destData[idx + 3] = src[idx + 3];
    }
  }
  return dest;
}

// --- PixelOE: Contrast-Aware Outline Expansion & Downscaling ---

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/** Morphological erosion with a 3x3 full kernel (ping-pong buffers) */
function erodeChannel(data: Float32Array, w: number, h: number, iterations: number): Float32Array {
  if (iterations === 0) return data;
  const bufA = new Float32Array(data);
  const bufB = new Float32Array(w * h);
  let src = bufA, dst = bufB;
  for (let iter = 0; iter < iterations; iter++) {
    for (let y = 0; y < h; y++) {
      const y0 = y > 0 ? y - 1 : 0;
      const y2 = y < h - 1 ? y + 1 : h - 1;
      for (let x = 0; x < w; x++) {
        const x0 = x > 0 ? x - 1 : 0;
        const x2 = x < w - 1 ? x + 1 : w - 1;
        const r0 = y0 * w, r1 = y * w, r2 = y2 * w;
        let v = src[r0 + x0]; const v2 = src[r0 + x]; if (v2 < v) v = v2;
        const v3 = src[r0 + x2]; if (v3 < v) v = v3;
        const v4 = src[r1 + x0]; if (v4 < v) v = v4;
        const v5 = src[r1 + x]; if (v5 < v) v = v5;
        const v6 = src[r1 + x2]; if (v6 < v) v = v6;
        const v7 = src[r2 + x0]; if (v7 < v) v = v7;
        const v8 = src[r2 + x]; if (v8 < v) v = v8;
        const v9 = src[r2 + x2]; if (v9 < v) v = v9;
        dst[r1 + x] = v;
      }
    }
    const tmp = src; src = dst; dst = tmp;
  }
  return src;
}

/** Morphological dilation with a 3x3 full kernel (ping-pong buffers) */
function dilateChannel(data: Float32Array, w: number, h: number, iterations: number): Float32Array {
  if (iterations === 0) return data;
  const bufA = new Float32Array(data);
  const bufB = new Float32Array(w * h);
  let src = bufA, dst = bufB;
  for (let iter = 0; iter < iterations; iter++) {
    for (let y = 0; y < h; y++) {
      const y0 = y > 0 ? y - 1 : 0;
      const y2 = y < h - 1 ? y + 1 : h - 1;
      for (let x = 0; x < w; x++) {
        const x0 = x > 0 ? x - 1 : 0;
        const x2 = x < w - 1 ? x + 1 : w - 1;
        const r0 = y0 * w, r1 = y * w, r2 = y2 * w;
        let v = src[r0 + x0]; const v2 = src[r0 + x]; if (v2 > v) v = v2;
        const v3 = src[r0 + x2]; if (v3 > v) v = v3;
        const v4 = src[r1 + x0]; if (v4 > v) v = v4;
        const v5 = src[r1 + x]; if (v5 > v) v = v5;
        const v6 = src[r1 + x2]; if (v6 > v) v = v6;
        const v7 = src[r2 + x0]; if (v7 > v) v = v7;
        const v8 = src[r2 + x]; if (v8 > v) v = v8;
        const v9 = src[r2 + x2]; if (v9 > v) v = v9;
        dst[r1 + x] = v;
      }
    }
    const tmp = src; src = dst; dst = tmp;
  }
  return src;
}

/** Morphological erosion with a 3x3 cross kernel (ping-pong buffers) */
function erodeCross(data: Float32Array, w: number, h: number, iterations: number): Float32Array {
  if (iterations === 0) return data;
  const bufA = new Float32Array(data);
  const bufB = new Float32Array(w * h);
  let src = bufA, dst = bufB;
  for (let iter = 0; iter < iterations; iter++) {
    for (let y = 0; y < h; y++) {
      const y0 = y > 0 ? y - 1 : 0;
      const y2 = y < h - 1 ? y + 1 : h - 1;
      for (let x = 0; x < w; x++) {
        const x0 = x > 0 ? x - 1 : 0;
        const x2 = x < w - 1 ? x + 1 : w - 1;
        const r1 = y * w;
        let v = src[r1 + x];
        const vt = src[y0 * w + x]; if (vt < v) v = vt;
        const vb = src[y2 * w + x]; if (vb < v) v = vb;
        const vl = src[r1 + x0]; if (vl < v) v = vl;
        const vr = src[r1 + x2]; if (vr < v) v = vr;
        dst[r1 + x] = v;
      }
    }
    const tmp = src; src = dst; dst = tmp;
  }
  return src;
}

/** Morphological dilation with a 3x3 cross kernel (ping-pong buffers) */
function dilateCross(data: Float32Array, w: number, h: number, iterations: number): Float32Array {
  if (iterations === 0) return data;
  const bufA = new Float32Array(data);
  const bufB = new Float32Array(w * h);
  let src = bufA, dst = bufB;
  for (let iter = 0; iter < iterations; iter++) {
    for (let y = 0; y < h; y++) {
      const y0 = y > 0 ? y - 1 : 0;
      const y2 = y < h - 1 ? y + 1 : h - 1;
      for (let x = 0; x < w; x++) {
        const x0 = x > 0 ? x - 1 : 0;
        const x2 = x < w - 1 ? x + 1 : w - 1;
        const r1 = y * w;
        let v = src[r1 + x];
        const vt = src[y0 * w + x]; if (vt > v) v = vt;
        const vb = src[y2 * w + x]; if (vb > v) v = vb;
        const vl = src[r1 + x0]; if (vl > v) v = vl;
        const vr = src[r1 + x2]; if (vr > v) v = vr;
        dst[r1 + x] = v;
      }
    }
    const tmp = src; src = dst; dst = tmp;
  }
  return src;
}

/** Quickselect — O(n) median finding, avoids full sort */
function quickselect(arr: Float32Array, k: number, lo: number, hi: number): number {
  while (lo < hi) {
    const pivot = arr[(lo + hi) >> 1];
    let i = lo, j = hi;
    while (i <= j) {
      while (arr[i] < pivot) i++;
      while (arr[j] > pivot) j--;
      if (i <= j) { const t = arr[i]; arr[i] = arr[j]; arr[j] = t; i++; j--; }
    }
    if (k <= j) hi = j;
    else if (k >= i) lo = i;
    else return arr[k];
  }
  return arr[lo];
}

/** Apply a sliding-window reducer over a 2D channel — optimized with flat buffer.
 *  Supported modes avoid per-patch allocation overhead. */
function applyChunkOp(
  data: Float32Array, w: number, h: number,
  kernel: number, stride: number,
  mode: 'median' | 'max' | 'min' | 'contrast-pixel'
): Float32Array {
  const kShift = Math.max(kernel - stride, 0);
  const padBefore = Math.floor(kShift / 2);
  const padAfter = padBefore + (kShift % 2);

  const pw = w + padBefore + padAfter;
  const ph = h + padBefore + padAfter;
  const padded = new Float32Array(pw * ph);
  for (let y = 0; y < ph; y++) {
    const sy = Math.min(h - 1, Math.max(0, y - padBefore));
    for (let x = 0; x < pw; x++) {
      const sx = Math.min(w - 1, Math.max(0, x - padBefore));
      padded[y * pw + x] = data[sy * w + sx];
    }
  }

  const outH = Math.floor((ph - kernel) / stride) + 1;
  const outW = Math.floor((pw - kernel) / stride) + 1;
  const patchSize = kernel * kernel;
  const output = new Float32Array(w * h);

  // Reusable patch buffer — one allocation for all patches
  const patch = new Float32Array(patchSize);

  for (let py = 0; py < outH; py++) {
    for (let px = 0; px < outW; px++) {
      // Extract patch into reusable buffer
      let idx = 0;
      for (let ky = 0; ky < kernel; ky++) {
        const rowOff = (py * stride + ky) * pw + px * stride;
        for (let kx = 0; kx < kernel; kx++) {
          patch[idx++] = padded[rowOff + kx];
        }
      }

      let result: number;
      if (mode === 'max') {
        result = patch[0];
        for (let i = 1; i < patchSize; i++) if (patch[i] > result) result = patch[i];
      } else if (mode === 'min') {
        result = patch[0];
        for (let i = 1; i < patchSize; i++) if (patch[i] < result) result = patch[i];
      } else if (mode === 'contrast-pixel') {
        // findPixelContrast inline
        const mid = patch[patchSize >> 1];
        const med = quickselect(patch, patchSize >> 1, 0, patchSize - 1);
        let sum = 0;
        let maxi = patch[0], mini = patch[0];
        for (let i = 0; i < patchSize; i++) {
          sum += patch[i];
          if (patch[i] > maxi) maxi = patch[i];
          if (patch[i] < mini) mini = patch[i];
        }
        const mu = sum / patchSize;
        if (med < mu && (maxi - med) > (med - mini)) result = mini;
        else if (med > mu && (maxi - med) < (med - mini)) result = maxi;
        else result = mid;
      } else {
        // median via quickselect
        result = quickselect(patch, patchSize >> 1, 0, patchSize - 1);
      }

      // Fill the stride x stride output region
      for (let sy = 0; sy < stride; sy++) {
        const oy = py * stride + sy;
        if (oy >= h) break;
        for (let sx = 0; sx < stride; sx++) {
          const ox = px * stride + sx;
          if (ox >= w) break;
          output[oy * w + ox] = result;
        }
      }
    }
  }
  return output;
}

/** Compute the expansion weight map (PixelOE expansion_weight) */
function computeExpansionWeight(
  grayChannel: Float32Array, w: number, h: number,
  k: number, avgScale: number, distScale: number
): Float32Array {
  const stride = Math.max(2, Math.floor(k / 4) * 2);

  const avgY = applyChunkOp(grayChannel, w, h, k * 2, stride, 'median');
  const maxY = applyChunkOp(grayChannel, w, h, k, stride, 'max');
  const minY = applyChunkOp(grayChannel, w, h, k, stride, 'min');

  const weight = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const brightDist = maxY[i] - avgY[i];
    const darkDist = avgY[i] - minY[i];
    const wVal = (avgY[i] - 0.5) * avgScale - (brightDist - darkDist) * distScale;
    weight[i] = sigmoid(wVal);
  }

  // Normalize to 0-1
  let minW = Infinity, maxW = -Infinity;
  for (let i = 0; i < weight.length; i++) {
    if (weight[i] < minW) minW = weight[i];
    if (weight[i] > maxW) maxW = weight[i];
  }
  const range = maxW > 0 ? maxW : 1;
  for (let i = 0; i < weight.length; i++) {
    weight[i] = (weight[i] - minW) / range;
  }

  return weight;
}

/** PixelOE outline expansion — operates on full RGB ImageData, returns expanded ImageData. */
function pixeloeOutlineExpansion(imageData: ImageData, erodeIter: number, dilateIter: number, k: number): ImageData {
  const w = imageData.width;
  const h = imageData.height;
  const src = imageData.data;

  // Extract grayscale (luminance) normalized to 0-1
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    gray[i] = (0.299 * src[idx] + 0.587 * src[idx + 1] + 0.114 * src[idx + 2]) / 255;
  }

  const weight = computeExpansionWeight(gray, w, h, k, 10, 3);
  const origWeight = new Float32Array(w * h);
  for (let i = 0; i < weight.length; i++) {
    origWeight[i] = sigmoid((weight[i] - 0.5) * 5) * 0.25;
  }

  // Process each channel: erode, dilate, blend
  const result = new ImageData(w, h);
  const destData = result.data;

  for (let c = 0; c < 3; c++) {
    const channel = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) channel[i] = src[i * 4 + c];

    const eroded = erodeChannel(channel, w, h, erodeIter);
    const dilated = dilateChannel(channel, w, h, dilateIter);

    // Blend: eroded * weight + dilated * (1-weight), then blend with original
    const blended = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const mixed = eroded[i] * weight[i] + dilated[i] * (1 - weight[i]);
      blended[i] = mixed * (1 - origWeight[i]) + channel[i] * origWeight[i];
    }

    // Closing + opening with cross kernel: erode→dilate→dilate→erode
    let smoothed = erodeCross(blended, w, h, erodeIter);
    smoothed = dilateCross(smoothed, w, h, dilateIter * 2);
    smoothed = erodeCross(smoothed, w, h, erodeIter);

    for (let i = 0; i < w * h; i++) {
      destData[i * 4 + c] = Math.max(0, Math.min(255, Math.round(smoothed[i])));
    }
  }

  // Copy alpha channel
  for (let i = 0; i < w * h; i++) {
    destData[i * 4 + 3] = src[i * 4 + 3];
  }

  return result;
}

/** PixelOE contrast-based downscale — processes in LAB space, returns resized ImageData */
function pixeloeContrastDownscale(imageData: ImageData, targetW: number, targetH: number): ImageData {
  const w = imageData.width;
  const h = imageData.height;
  const src = imageData.data;

  const patchW = Math.max(1, Math.round(w / targetW));
  const patchH = Math.max(1, Math.round(h / targetH));
  const patchSize = Math.max(patchW, patchH);

  // Convert to LAB
  const labL = new Float32Array(w * h);
  const labA = new Float32Array(w * h);
  const labB = new Float32Array(w * h);
  const alpha = new Uint8Array(w * h);

  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    const lab = xyzToLab(rgbToXyz({ r: src[idx], g: src[idx + 1], b: src[idx + 2] }));
    labL[i] = lab.l;
    labA[i] = lab.a;
    labB[i] = lab.b;
    alpha[i] = src[idx + 3];
  }

  // Process L channel with contrast-based find_pixel
  const processedL = applyChunkOp(labL, w, h, patchSize, patchSize, 'contrast-pixel');

  // Process A and B channels with median
  const processedA = applyChunkOp(labA, w, h, patchSize, patchSize, 'median');
  const processedB = applyChunkOp(labB, w, h, patchSize, patchSize, 'median');

  // Convert back to RGB and resize to target using nearest neighbor
  const tempData = new ImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const lab: LAB = { l: processedL[i], a: processedA[i], b: processedB[i] };
    // LAB to RGB via XYZ
    const xyz = labToXyz(lab);
    const rgb = xyzToRgb(xyz);
    const idx = i * 4;
    tempData.data[idx] = rgb.r;
    tempData.data[idx + 1] = rgb.g;
    tempData.data[idx + 2] = rgb.b;
    tempData.data[idx + 3] = alpha[i];
  }

  return resampleNearest(tempData, targetW, targetH);
}

/** Inverse LAB → XYZ */
function labToXyz(lab: LAB): { x: number; y: number; z: number } {
  let y = (lab.l + 16) / 116;
  let x = lab.a / 500 + y;
  let z = y - lab.b / 200;

  const y3 = y * y * y;
  const x3 = x * x * x;
  const z3 = z * z * z;

  y = y3 > 0.008856 ? y3 : (y - 16 / 116) / 7.787;
  x = x3 > 0.008856 ? x3 : (x - 16 / 116) / 7.787;
  z = z3 > 0.008856 ? z3 : (z - 16 / 116) / 7.787;

  return { x: x * 95.047, y: y * 100.000, z: z * 108.883 };
}

/** Inverse XYZ → RGB */
function xyzToRgb(xyz: { x: number; y: number; z: number }): RGB {
  const x = xyz.x / 100;
  const y = xyz.y / 100;
  const z = xyz.z / 100;

  let r = x * 3.2406 + y * -1.5372 + z * -0.4986;
  let g = x * -0.9689 + y * 1.8758 + z * 0.0415;
  let b = x * 0.0557 + y * -0.2040 + z * 1.0570;

  r = r > 0.0031308 ? 1.055 * Math.pow(r, 1 / 2.4) - 0.055 : 12.92 * r;
  g = g > 0.0031308 ? 1.055 * Math.pow(g, 1 / 2.4) - 0.055 : 12.92 * g;
  b = b > 0.0031308 ? 1.055 * Math.pow(b, 1 / 2.4) - 0.055 : 12.92 * b;

  return {
    r: Math.max(0, Math.min(255, Math.round(r * 255))),
    g: Math.max(0, Math.min(255, Math.round(g * 255))),
    b: Math.max(0, Math.min(255, Math.round(b * 255))),
  };
}

/** K-Centroid downscale: per-tile k-means to find dominant color */
function pixeloeKCentroidDownscale(imageData: ImageData, targetW: number, targetH: number, centroids: number): ImageData {
  const w = imageData.width;
  const h = imageData.height;
  const src = imageData.data;
  const dest = new ImageData(targetW, targetH);
  const destData = dest.data;

  const wFactor = w / targetW;
  const hFactor = h / targetH;

  for (let ty = 0; ty < targetH; ty++) {
    for (let tx = 0; tx < targetW; tx++) {
      // Extract tile pixels
      const x0 = Math.floor(tx * wFactor);
      const y0 = Math.floor(ty * hFactor);
      const x1 = Math.min(w, Math.floor((tx + 1) * wFactor));
      const y1 = Math.min(h, Math.floor((ty + 1) * hFactor));

      const pixels: number[][] = [];
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const idx = (y * w + x) * 4;
          if (src[idx + 3] > 128) {
            pixels.push([src[idx], src[idx + 1], src[idx + 2]]);
          }
        }
      }

      if (pixels.length === 0) {
        const dIdx = (ty * targetW + tx) * 4;
        destData[dIdx + 3] = 0;
        continue;
      }

      // Simple k-means within the tile
      const k = Math.min(centroids, pixels.length);
      // Init centroids by evenly spaced sampling
      let cents: number[][] = [];
      for (let i = 0; i < k; i++) {
        cents.push([...pixels[Math.floor(i * pixels.length / k)]]);
      }

      for (let iter = 0; iter < 8; iter++) {
        const sums = Array.from({ length: k }, () => [0, 0, 0]);
        const counts = new Array(k).fill(0);
        for (const px of pixels) {
          let minD = Infinity, best = 0;
          for (let c = 0; c < k; c++) {
            const d = (px[0] - cents[c][0]) ** 2 + (px[1] - cents[c][1]) ** 2 + (px[2] - cents[c][2]) ** 2;
            if (d < minD) { minD = d; best = c; }
          }
          sums[best][0] += px[0]; sums[best][1] += px[1]; sums[best][2] += px[2];
          counts[best]++;
        }
        for (let c = 0; c < k; c++) {
          if (counts[c] > 0) {
            cents[c] = [sums[c][0] / counts[c], sums[c][1] / counts[c], sums[c][2] / counts[c]];
          }
        }
      }

      // Find most common cluster
      const assignments = new Array(k).fill(0);
      for (const px of pixels) {
        let minD = Infinity, best = 0;
        for (let c = 0; c < k; c++) {
          const d = (px[0] - cents[c][0]) ** 2 + (px[1] - cents[c][1]) ** 2 + (px[2] - cents[c][2]) ** 2;
          if (d < minD) { minD = d; best = c; }
        }
        assignments[best]++;
      }
      let bestCluster = 0, bestCount = 0;
      for (let c = 0; c < k; c++) {
        if (assignments[c] > bestCount) { bestCount = assignments[c]; bestCluster = c; }
      }

      const dIdx = (ty * targetW + tx) * 4;
      destData[dIdx] = Math.round(cents[bestCluster][0]);
      destData[dIdx + 1] = Math.round(cents[bestCluster][1]);
      destData[dIdx + 2] = Math.round(cents[bestCluster][2]);
      destData[dIdx + 3] = 255;
    }
  }

  return dest;
}

// --- Outline Color Consistency (post-quantization pass) ---

/**
 * Detects dark contour/edge pixels in an already-quantized image and
 * unifies them to the most-dominant palette colors that naturally appear
 * on those edges. Works after any downscaler.
 *
 * Key design: after dithering, every pixel is already a palette color.
 * Instead of re-clustering in color space (which produces averages that
 * can snap inconsistently to far-away palette entries), we:
 *   1. Detect outline pixels by luminance-contrast in the 3×3 neighborhood.
 *   2. Tally which palette colors are already most frequent on those pixels.
 *   3. Keep only the top N colors by frequency — no averaging, no centroids.
 *   4. Snap each outline pixel to its nearest of those N colors (OKLab dist).
 *
 * Result is deterministic and consistent: the outline color is always the
 * palette entry that already dominates the edge region.
 */
function applyOutlineConsistency(
    imageData: ImageData,
    paletteHex: string[],
    colorCount: number,
): void {
    const w = imageData.width;
    const h = imageData.height;
    const data = imageData.data;
    const total = w * h;
    if (colorCount < 1 || total < 4 || paletteHex.length === 0) return;

    // Step 1: compute per-pixel luminance for edge detection.
    const luma = new Float32Array(total);
    for (let i = 0; i < total; i++) {
        const o = i * 4;
        if (data[o + 3] < 128) { luma[i] = -1; continue; }
        luma[i] = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
    }

    // Step 2: classify outline pixels.
    // A pixel is an "outline" if it sits on a high-contrast edge (max-min luma
    // in its 3×3 neighborhood ≥ threshold) AND is darker than the neighborhood mean.
    const isOutline = new Uint8Array(total);
    const EDGE_CONTRAST = 40;  // min max-min luma in 3×3 to count as an edge
    const DARK_OFFSET   = 20;  // pixel must be ≥ this much below 3×3 mean
    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            const p = y * w + x;
            const self = luma[p];
            if (self < 0) continue;
            let mn = 255, mx = 0, sum = 0, cnt = 0;
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const nl = luma[p + dy * w + dx];
                    if (nl < 0) continue;
                    if (nl < mn) mn = nl;
                    if (nl > mx) mx = nl;
                    sum += nl; cnt++;
                }
            }
            if (cnt === 0) continue;
            if ((mx - mn) >= EDGE_CONTRAST && self <= (sum / cnt) - DARK_OFFSET) {
                isOutline[p] = 1;
            }
        }
    }

    // Step 3: tally which palette colors already appear on outline pixels.
    // Build a fast packed-RGB → palette-index lookup.
    const paletteRGB = paletteHex.map(hexToRgb);
    const paletteOklab = paletteRGB.map(rgbToOklab);
    const lookup = new Map<number, number>();
    for (let p = 0; p < paletteRGB.length; p++) {
        const c = paletteRGB[p];
        lookup.set((c.r << 16) | (c.g << 8) | c.b, p);
    }

    const freq = new Int32Array(paletteRGB.length);
    let outlineCount = 0;
    for (let i = 0; i < total; i++) {
        if (!isOutline[i]) continue;
        const o = i * 4;
        const key = (data[o] << 16) | (data[o + 1] << 8) | data[o + 2];
        const pIdx = lookup.get(key);
        if (pIdx !== undefined) freq[pIdx]++;
        outlineCount++;
    }
    if (outlineCount === 0) return;

    // Step 4: select the top N palette colors by frequency.
    const k = Math.min(colorCount, paletteRGB.length);
    const ranked = Array.from({ length: paletteRGB.length }, (_, i) => i)
        .filter(i => freq[i] > 0)
        .sort((a, b) => freq[b] - freq[a])
        .slice(0, k);
    if (ranked.length === 0) return;

    const allowedOklab = ranked.map(i => paletteOklab[i]);
    const allowedRGB   = ranked.map(i => paletteRGB[i]);

    // Step 5: snap each outline pixel to its nearest allowed color (OKLab).
    for (let i = 0; i < total; i++) {
        if (!isOutline[i]) continue;
        const o = i * 4;
        const pixOk = rgbToOklab({ r: data[o], g: data[o + 1], b: data[o + 2] });
        let best = 0, bestD = Infinity;
        for (let c = 0; c < allowedOklab.length; c++) {
            const ao = allowedOklab[c];
            const dL = pixOk.L - ao.L, da = pixOk.a - ao.a, db = pixOk.b - ao.b;
            const d = dL * dL + da * da + db * db;
            if (d < bestD) { bestD = d; best = c; }
        }
        const col = allowedRGB[best];
        data[o] = col.r; data[o + 1] = col.g; data[o + 2] = col.b;
    }
}

// --- Cluster Cleanup (post-quantization) ---

/**
 * Finds connected same-color regions smaller than minSize pixels and
 * repaints them with the dominant neighboring color.
 * Runs on the already-quantized (palette-reduced) image.
 */
function applyClusterCleanup(imageData: ImageData, minSize: number): void {
    if (minSize <= 1) return;
    const w = imageData.width;
    const h = imageData.height;
    const data = imageData.data;
    const total = w * h;

    // Pack RGB into int32 (-1 = transparent)
    const packed = new Int32Array(total);
    for (let i = 0; i < total; i++) {
        const o = i * 4;
        packed[i] = data[o + 3] < 128 ? -1 : (data[o] << 16) | (data[o + 1] << 8) | data[o + 2];
    }

    const labels = new Int32Array(total).fill(-1);
    const compColor: number[] = [];
    const compPixels: number[][] = [];
    let nextLabel = 0;

    // BFS flood-fill to label connected regions
    const queue: number[] = [];
    for (let start = 0; start < total; start++) {
        if (packed[start] < 0 || labels[start] >= 0) continue;
        const color = packed[start];
        const label = nextLabel++;
        compColor.push(color);
        const pixels: number[] = [];
        queue.length = 0;
        queue.push(start);
        labels[start] = label;
        let qi = 0;
        while (qi < queue.length) {
            const p = queue[qi++];
            pixels.push(p);
            const x = p % w;
            const y = (p - x) / w;
            if (x > 0     && labels[p - 1] < 0 && packed[p - 1] === color) { labels[p - 1] = label; queue.push(p - 1); }
            if (x < w - 1 && labels[p + 1] < 0 && packed[p + 1] === color) { labels[p + 1] = label; queue.push(p + 1); }
            if (y > 0     && labels[p - w] < 0 && packed[p - w] === color) { labels[p - w] = label; queue.push(p - w); }
            if (y < h - 1 && labels[p + w] < 0 && packed[p + w] === color) { labels[p + w] = label; queue.push(p + w); }
        }
        compPixels.push(pixels);
    }

    // Repaint small components with dominant neighbor color
    for (let l = 0; l < nextLabel; l++) {
        const pixels = compPixels[l];
        if (pixels.length >= minSize) continue;

        const neighborFreq = new Map<number, number>();
        for (const p of pixels) {
            const x = p % w;
            const y = (p - x) / w;
            const neighbors = [p - 1, p + 1, p - w, p + w];
            const inBounds  = [x > 0, x < w - 1, y > 0, y < h - 1];
            for (let n = 0; n < 4; n++) {
                if (!inBounds[n]) continue;
                const np = neighbors[n];
                if (labels[np] === l || packed[np] < 0) continue;
                neighborFreq.set(packed[np], (neighborFreq.get(packed[np]) ?? 0) + 1);
            }
        }
        if (neighborFreq.size === 0) continue;

        let bestColor = compColor[l], bestCount = 0;
        for (const [c, count] of neighborFreq) {
            if (count > bestCount) { bestCount = count; bestColor = c; }
        }

        for (const p of pixels) {
            const o = p * 4;
            data[o]   = (bestColor >> 16) & 0xff;
            data[o+1] = (bestColor >> 8)  & 0xff;
            data[o+2] =  bestColor         & 0xff;
        }
    }
}

// --- Main Handler ---

self.onmessage = async (e: MessageEvent) => {
    // ... [Keep Suggestion handling logic] ...
    const { type, imageData, settings } = e.data;
    
    if (type === 'suggest') {
        try {
            const { palette, numSuggestions, preferDistinct, samplingMask, samplingMaskWidth, samplingMaskHeight } = settings;
            const suggestions = await suggestMissingColors(imageData, palette, numSuggestions || 5, preferDistinct || false, samplingMask, samplingMaskWidth, samplingMaskHeight);
            self.postMessage({ type: 'suggestions', suggestions });
        } catch (error: any) {
            self.postMessage({ type: 'error', message: error.message });
        }
        return;
    }

    const { targetWidth, targetHeight, ditherMethod, ditherStrength, palette, resamplingMethod, useKmeans, kmeansColors, brightness, contrast, saturation, vibrance, preprocessBilateral, preprocessBilateralStrength, preprocessEdgeDetect, preprocessSharpening, preprocessSharpeningStrength, filterTrivialColors, trivialThreshold, trivialThresholdMode, colorMatchAlgorithm: rawAlgo, preserveDetailThreshold: rawPDT, pixeloeThickness, pixeloePatchSize, edgeDetectBlur, edgeDetectAlgorithm, samplingMask, samplingMaskWidth, samplingMaskHeight, serpentineDither, gammaCorrectDither, outlineConsistency, outlineColors, clusterCleanup, clusterMinSize } = settings;
    const colorMatchAlgorithm: ColorMatchAlgorithm = rawAlgo || 'oklab';
    const preserveDetailThreshold: number = rawPDT || 0;

    try {
        // Trivial color filtering is deferred until after resize (see step 1.5 below)
        let effectivePalette = palette;

        // 0. Apply Color Modifiers (Global Adjustments)
        let processedImageData = imageData;
        if ((brightness && brightness !== 0) || (contrast && contrast !== 0) || (saturation && saturation !== 0)) {
            processedImageData = applyColorModifiers(imageData, brightness || 0, contrast || 0, saturation || 0);
        }
        if (vibrance && vibrance !== 0) {
            processedImageData = applyVibrance(processedImageData, vibrance);
        }

        // 0.5. Apply Preprocessing Filters (multiple can be active)
        if (preprocessSharpening) {
            processedImageData = applySharpening(processedImageData, preprocessSharpeningStrength || 50);
        }
        if (preprocessBilateral) {
            processedImageData = applyBilateralFilter(processedImageData, preprocessBilateralStrength || 50);
        }
        if (preprocessEdgeDetect) {
            processedImageData = applyEdgeDetection(processedImageData, edgeDetectBlur || 0, 0, edgeDetectAlgorithm || 'sobel');
        }

        // ... [Rest of logic: Resize -> Kmeans -> Dither remains exactly the same] ...
        // 0.75. PixelOE Outline Expansion (pre-downscale step for PixelOE methods)
        const isPixelOE = resamplingMethod === 'pixeloe-nearest' || resamplingMethod === 'pixeloe-contrast' || resamplingMethod === 'pixeloe-k-centroid';
        if (isPixelOE) {
            const thickness = pixeloeThickness || 2;
            const pSize = pixeloePatchSize || 16;
            processedImageData = pixeloeOutlineExpansion(processedImageData, thickness, thickness, pSize);
        }

        // 1. Resize
        let resizedImageData: ImageData;
        if (resamplingMethod === 'pixeloe-contrast') {
            resizedImageData = pixeloeContrastDownscale(processedImageData, targetWidth, targetHeight);
        } else if (resamplingMethod === 'pixeloe-k-centroid') {
            resizedImageData = pixeloeKCentroidDownscale(processedImageData, targetWidth, targetHeight, 2);
        } else if (resamplingMethod === 'pixeloe-nearest') {
            resizedImageData = resampleNearest(processedImageData, targetWidth, targetHeight);
        } else if (resamplingMethod === 'lanczos') {
            resizedImageData = resampleLanczos(processedImageData, targetWidth, targetHeight);
        } else if (resamplingMethod === 'bilinear') {
            resizedImageData = resampleBilinear(processedImageData, targetWidth, targetHeight);
        } else {
            resizedImageData = resampleNearest(processedImageData, targetWidth, targetHeight);
        }

        // 1.5. Filter trivial colors based on fresh stats from the resized image
        if (filterTrivialColors && palette && palette.length > 0) {
            const threshold = typeof trivialThreshold === 'number' && trivialThreshold > 0 ? trivialThreshold : 0.1;
            const thresholdMode = trivialThresholdMode || 'percent';
            const paletteRGBFull = palette.map(hexToRgb);
            const paletteLabFull = paletteRGBFull.map(rgbToLab);
            const paletteOkFull = colorMatchAlgorithm === 'oklab' ? paletteRGBFull.map(rgbToOklab) : null;
            const matchCache = new Map<number, FindClosestResult>();

            // Count how many pixels map to each palette color
            const hitCounts = new Array(palette.length).fill(0);
            const resPixels = resizedImageData.data;
            let totalOpaque = 0;

            for (let i = 0; i < resPixels.length; i += 4) {
                if (resPixels[i + 3] > 128) {
                    totalOpaque++;
                    const pxColor = { r: resPixels[i], g: resPixels[i + 1], b: resPixels[i + 2] };
                    const { index } = findClosestColor(pxColor, paletteRGBFull, paletteLabFull, paletteOkFull, colorMatchAlgorithm, 0, matchCache);
                    hitCounts[index]++;
                }
            }

            if (totalOpaque > 0) {
                effectivePalette = palette.filter((_: string, idx: number) => {
                    if (thresholdMode === 'pixels') {
                        return hitCounts[idx] >= threshold;
                    }
                    const percent = (hitCounts[idx] / totalOpaque) * 100;
                    return percent >= threshold;
                });
                // If all colors would be filtered, keep the original palette
                if (effectivePalette.length === 0) {
                    effectivePalette = palette;
                }
            }
        }

        // 2. K-Means
        let generatedPalette: string[] | undefined;
        if (useKmeans && kmeansColors > 0) {
           const pixels = resizedImageData.data;
           const resW = resizedImageData.width;
           const resH = resizedImageData.height;
           const hasMask = samplingMask && samplingMask.length > 0 && samplingMaskWidth && samplingMaskHeight;
           
           // Collect pixels for K-Means (optionally filtered by sampling mask)
           const pixelArray: number[][] = [];
           for (let i = 0; i < pixels.length; i += 4) {
                if (pixels[i + 3] > 128) {
                    if (hasMask) {
                        const pixIdx = i / 4;
                        const px = pixIdx % resW;
                        const py = Math.floor(pixIdx / resW);
                        const mx = Math.floor(px * samplingMaskWidth / resW);
                        const my = Math.floor(py * samplingMaskHeight / resH);
                        const maskIdx = my * samplingMaskWidth + mx;
                        if (maskIdx < samplingMask.length && samplingMask[maskIdx] === 0) continue;
                    }
                    pixelArray.push([pixels[i], pixels[i + 1], pixels[i + 2]]);
                }
           }

            if (pixelArray.length > 0) {
                const kmeansResult = await kmeans(pixelArray, Math.min(kmeansColors, pixelArray.length));
                const paletteRGB = kmeansResult.centroids.map(c => ({
                    r: Math.round(c[0]),
                    g: Math.round(c[1]),
                    b: Math.round(c[2])
                }));
                
                generatedPalette = paletteRGB.map(c => 
                    "#" + ((1 << 24) + (c.r << 16) + (c.g << 8) + c.b).toString(16).slice(1).toUpperCase()
                );

                const paletteLab = paletteRGB.map(rgbToLab);
                const paletteOk = colorMatchAlgorithm === 'oklab' ? paletteRGB.map(rgbToOklab) : null;
                const kmeansCache = new Map<number, FindClosestResult>();

                for (let i = 0; i < pixels.length; i += 4) {
                    if (pixels[i + 3] > 128) {
                        const pixelColor = { r: pixels[i], g: pixels[i + 1], b: pixels[i + 2] };
                        const { color: closestColor } = findClosestColor(pixelColor, paletteRGB, paletteLab, paletteOk, colorMatchAlgorithm, 0, kmeansCache);
                        pixels[i] = closestColor.r;
                        pixels[i + 1] = closestColor.g;
                        pixels[i + 2] = closestColor.b;
                    }
                }
            }
        }

        // 3. Dither
        if (effectivePalette && effectivePalette.length > 0) {
            applyDithering(
                resizedImageData, effectivePalette, ditherMethod, ditherStrength,
                colorMatchAlgorithm, preserveDetailThreshold,
                serpentineDither !== false, // default true
                !!gammaCorrectDither,
            );
        }

        // 4. Outline color consistency
        if (
            outlineConsistency &&
            effectivePalette && effectivePalette.length > 0 &&
            outlineColors && outlineColors > 0
        ) {
            applyOutlineConsistency(resizedImageData, effectivePalette, outlineColors | 0);
        }

        // 5. Cluster Cleanup — remove small isolated color regions
        if (clusterCleanup && clusterMinSize && clusterMinSize > 1) {
            applyClusterCleanup(resizedImageData, clusterMinSize);
        }

        self.postMessage({ type: 'success', imageData: resizedImageData, generatedPalette });

    } catch (error: any) {
        self.postMessage({ type: 'error', message: error.message });
    }
};
