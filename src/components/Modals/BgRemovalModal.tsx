import React, { useEffect, useRef, useState, useCallback } from 'react';
import DraggableModal from './DraggableModal';
import useCompositorStore from '../../store/compositorStore';
import { Layer } from '../../types/compositor.types';
import { removeBackground as legacyRemoveBackground } from '../../utils/imageProcessing';

type Mode = 'ai' | 'click' | 'brush' | 'lasso';

interface BgRemovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  layer: Layer;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Convert a data-url string to a Blob */
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, b64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'image/png';
  const bytes = atob(b64);
  const buf = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
  return new Blob([buf], { type: mime });
}

/** Load an HTMLImageElement from a data-url */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Canvas → data-url helper */
function canvasToDataUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png');
}

// ─── Checkerboard drawing helper ────────────────────────────────────────────
const CB_TILE = 8;
function drawCheckerboard(ctx: CanvasRenderingContext2D, w: number, h: number) {
  for (let y = 0; y < h; y += CB_TILE) {
    for (let x = 0; x < w; x += CB_TILE) {
      ctx.fillStyle = ((x / CB_TILE + y / CB_TILE) % 2 === 0) ? '#3a3a3a' : '#2a2a2a';
      ctx.fillRect(x, y, CB_TILE, CB_TILE);
    }
  }
}

// ─── Click-to-Remove (flood fill from clicked point) ────────────────────────

function floodFillRemove(
  imageData: string,
  clickX: number,
  clickY: number,
  tolerance: number,
): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      const img = await loadImage(imageData);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const imgD = ctx.getImageData(0, 0, w, h);
      const d = imgD.data;

      const sx = Math.round(clickX);
      const sy = Math.round(clickY);
      if (sx < 0 || sx >= w || sy < 0 || sy >= h) { resolve(imageData); return; }

      const baseIdx = (sy * w + sx) * 4;
      const baseR = d[baseIdx], baseG = d[baseIdx + 1], baseB = d[baseIdx + 2];

      const visited = new Uint8Array(w * h);
      const queue: number[] = [sx, sy]; // flat pairs

      const tolSq = tolerance * tolerance;

      while (queue.length > 0) {
        const qy = queue.pop()!;
        const qx = queue.pop()!;
        const idx = qy * w + qx;
        if (visited[idx]) continue;
        visited[idx] = 1;

        const pi = idx * 4;
        const dr = d[pi] - baseR;
        const dg = d[pi + 1] - baseG;
        const db = d[pi + 2] - baseB;
        if (dr * dr + dg * dg + db * db <= tolSq) {
          d[pi + 3] = 0; // make transparent
          if (qx > 0) queue.push(qx - 1, qy);
          if (qx < w - 1) queue.push(qx + 1, qy);
          if (qy > 0) queue.push(qx, qy - 1);
          if (qy < h - 1) queue.push(qx, qy + 1);
        }
      }

      ctx.putImageData(imgD, 0, 0);
      resolve(canvasToDataUrl(canvas));
    } catch (e) { reject(e); }
  });
}

// ─── Alpha mask helpers for brush mode ──────────────────────────────────────

/** 
 * Build an alpha mask from workingImage.
 * Returns Uint8Array of length w*h with alpha values.
 */
async function buildAlphaMask(src: string, w: number, h: number): Promise<Uint8Array> {
  const img = await loadImage(src);
  const cvs = document.createElement('canvas');
  cvs.width = w; cvs.height = h;
  const ctx = cvs.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h).data;
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4 + 3];
  return mask;
}

/** Render originalImage with an alpha mask to produce a data-url */
async function applyAlphaMask(originalSrc: string, alphaMask: Uint8Array, w: number, h: number): Promise<string> {
  const img = await loadImage(originalSrc);
  const cvs = document.createElement('canvas');
  cvs.width = w; cvs.height = h;
  const ctx = cvs.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < alphaMask.length; i++) {
    imgData.data[i * 4 + 3] = alphaMask[i];
  }
  ctx.putImageData(imgData, 0, 0);
  return canvasToDataUrl(cvs);
}

// ─── Component ──────────────────────────────────────────────────────────────

const BgRemovalModal: React.FC<BgRemovalModalProps> = ({ isOpen, onClose, layer }) => {
  const updateLayer = useCompositorStore((state) => state.updateLayer);

  // Mode & processing state
  const [mode, setMode] = useState<Mode>('click');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);

  // The working copy of the image (modified by each operation — clean, no checkerboard)
  const [workingImage, setWorkingImage] = useState<string | null>(null);
  // Original image for reset & brush-restore
  const [originalImage, setOriginalImage] = useState<string | null>(null);

  // Alpha mask for brush mode — tracks what's visible (255) or erased (0)
  const alphaMaskRef = useRef<Uint8Array | null>(null);

  // Undo / redo history
  const undoStackRef = useRef<string[]>([]);
  const redoStackRef = useRef<string[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  /** Push current workingImage onto the undo stack before a destructive change */
  const pushUndo = useCallback((currentImage: string) => {
    undoStackRef.current.push(currentImage);
    redoStackRef.current = []; // clear redo on new action
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length === 0 || !workingImage) return;
    redoStackRef.current.push(workingImage);
    const prev = undoStackRef.current.pop()!;
    setWorkingImage(prev);
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(true);
  }, [workingImage]);

  const handleRedo = useCallback(() => {
    if (redoStackRef.current.length === 0 || !workingImage) return;
    undoStackRef.current.push(workingImage);
    const next = redoStackRef.current.pop()!;
    setWorkingImage(next);
    setCanRedo(redoStackRef.current.length > 0);
    setCanUndo(true);
  }, [workingImage]);

  // Click-to-remove tolerance
  const [tolerance, setTolerance] = useState(30);
  // Legacy corner-flood heatmap
  const [makeHeatmap, setMakeHeatmap] = useState(false);

  // Brush settings
  const [brushSize, setBrushSize] = useState(16);
  const [brushMode, setBrushMode] = useState<'erase' | 'restore'>('erase');
  const [isBrushing, setIsBrushing] = useState(false);

  // Pan & zoom
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [imgDim, setImgDim] = useState<{ w: number; h: number } | null>(null);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const lastBrushPosRef = useRef<{ x: number; y: number } | null>(null);
  const hasInitialFitRef = useRef(false);
  const brushCursorRef = useRef<HTMLDivElement>(null);
  const origImageDataRef = useRef<ImageData | null>(null);

  // Lasso state
  const [isLassoing, setIsLassoing] = useState(false);
  const lassoPointsRef = useRef<{ x: number; y: number }[]>([]);
  const [lassoMode, setLassoMode] = useState<'erase' | 'restore'>('erase');

  // ─── Init when modal opens ────────────────────────────────────────────
  useEffect(() => {
    if (isOpen && layer?.imageData) {
      setWorkingImage(layer.imageData);
      setOriginalImage(layer.imageData);
      setErrorText(null);
      setStatusText(null);
      setDownloadProgress(null);
      setMakeHeatmap(false);
      setPan({ x: 0, y: 0 });
      alphaMaskRef.current = null;
      undoStackRef.current = [];
      redoStackRef.current = [];
      setCanUndo(false);
      setCanRedo(false);
      hasInitialFitRef.current = false;
    }
  }, [isOpen, layer?.imageData]);

  // ─── Keyboard shortcuts (scoped to modal) ─────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          handleUndo();
        } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
          e.preventDefault();
          e.stopPropagation();
          handleRedo();
        }
      }
    };
    window.addEventListener('keydown', handler, true); // capture phase
    return () => window.removeEventListener('keydown', handler, true);
  }, [isOpen, handleUndo, handleRedo]);

  // ─── Draw the working image onto the preview canvas ───────────────────
  const drawPreview = useCallback(async () => {
    const cvs = canvasRef.current;
    if (!cvs || !workingImage) return;
    try {
      const img = await loadImage(workingImage);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      cvs.width = w;
      cvs.height = h;
      setImgDim({ w, h });
      const ctx = cvs.getContext('2d')!;
      drawCheckerboard(ctx, w, h);
      ctx.drawImage(img, 0, 0);
    } catch { /* ignore */ }
  }, [workingImage]);

  useEffect(() => { drawPreview(); }, [drawPreview]);

  // Rebuild alpha mask when workingImage changes
  useEffect(() => {
    if (workingImage && imgDim) {
      buildAlphaMask(workingImage, imgDim.w, imgDim.h).then(mask => {
        alphaMaskRef.current = mask;
      });
    }
  }, [workingImage, imgDim]);

  // Hide brush cursor when leaving brush mode
  useEffect(() => {
    if (mode !== 'brush' && brushCursorRef.current) {
      brushCursorRef.current.style.display = 'none';
    }
  }, [mode]);

  // Fit zoom only on initial open (not on every working image change)
  useEffect(() => {
    if (imgDim && containerRef.current && !hasInitialFitRef.current) {
      const cw = containerRef.current.clientWidth;
      const ch = containerRef.current.clientHeight;
      if (cw > 0 && ch > 0) {
        const fit = Math.min(cw / imgDim.w, ch / imgDim.h) * 0.9;
        setZoom(Math.max(0.05, fit));
        hasInitialFitRef.current = true;
      }
    }
  }, [imgDim]);

  // ─── AI Auto-Remove ───────────────────────────────────────────────────
  const handleAiRemove = async () => {
    if (!workingImage) return;
    setIsProcessing(true);
    setErrorText(null);
    setStatusText('Loading AI model (first run downloads ~40 MB)...');
    setDownloadProgress(0);

    try {
      const { removeBackground: aiRemoveBackground } = await import('@imgly/background-removal');

      setStatusText('Processing image...');

      const blob = dataUrlToBlob(workingImage);
      pushUndo(workingImage);
      const resultBlob: Blob = await aiRemoveBackground(blob, {
        model: 'isnet_quint8',
        output: { format: 'image/png', quality: 1 },
        progress: (key: string, current: number, total: number) => {
          if (total > 0) {
            const pct = Math.round((current / total) * 100);
            setDownloadProgress(pct);
            if (key.includes('onnx') || key.includes('model')) {
              setStatusText(`Downloading model... ${pct}%`);
            } else {
              setStatusText(`Processing... ${pct}%`);
            }
          }
        },
      });

      const reader = new FileReader();
      reader.onload = () => {
        setWorkingImage(reader.result as string);
        setStatusText(null);
        setDownloadProgress(null);
        setIsProcessing(false);
      };
      reader.readAsDataURL(resultBlob);
    } catch (err: any) {
      console.error('AI BG removal failed:', err);
      setErrorText(`AI background removal failed to load: ${err?.message || 'Unknown error'}. Try the Click or Brush tools instead.`);
      setStatusText(null);
      setDownloadProgress(null);
      setIsProcessing(false);
    }
  };

  // ─── Legacy Corner Flood-Fill (kept as option under click mode) ───────
  const handleLegacyRemove = async () => {
    if (!workingImage) return;
    setIsProcessing(true);
    setErrorText(null);
    setStatusText('Processing...');
    try {
      pushUndo(workingImage);
      const result = await legacyRemoveBackground(workingImage, tolerance, makeHeatmap);
      setWorkingImage(result);
    } catch (err: any) {
      setErrorText(`Corner flood-fill failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
      setStatusText(null);
    }
  };

  // ─── Click-to-Remove handler ──────────────────────────────────────────
  const handleCanvasClick = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode !== 'click' || isProcessing || !workingImage || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;

    setIsProcessing(true);
    setStatusText('Removing region...');
    try {
      pushUndo(workingImage);
      const result = await floodFillRemove(workingImage, cx, cy, tolerance);
      setWorkingImage(result);
    } catch (err: any) {
      setErrorText(`Click removal failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
      setStatusText(null);
    }
  };

  // ─── Brush handlers ───────────────────────────────────────────────────
  const getImageCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const cvs = canvasRef.current;
    if (!cvs) return null;
    const rect = cvs.getBoundingClientRect();
    const scaleX = cvs.width / rect.width;
    const scaleY = cvs.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  /** Paint one brush dab onto the alpha mask (does NOT redraw canvas) */
  const paintBrushMask = (x: number, y: number, mask: Uint8Array, w: number, h: number, eraseVal: number): { x0: number; y0: number; x1: number; y1: number } => {
    const radius = brushSize / 2;
    const rSq = radius * radius;
    const x0 = Math.max(0, Math.floor(x - radius));
    const y0 = Math.max(0, Math.floor(y - radius));
    const x1 = Math.min(w - 1, Math.ceil(x + radius));
    const y1 = Math.min(h - 1, Math.ceil(y + radius));

    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const dx = px - x, dy = py - y;
        if (dx * dx + dy * dy <= rSq) {
          mask[py * w + px] = eraseVal;
        }
      }
    }
    return { x0, y0, x1, y1 };
  };

  /** Composite a dirty rect region onto the canvas from cached pixel data */
  const compositeRegion = (x0: number, y0: number, x1: number, y1: number) => {
    const cvs = canvasRef.current;
    const mask = alphaMaskRef.current;
    const origData = origImageDataRef.current;
    if (!cvs || !mask || !origData || !imgDim) return;
    const { w } = imgDim;
    const ctx = cvs.getContext('2d')!;
    const origPx = origData.data;

    const regionW = x1 - x0 + 1;
    const regionH = y1 - y0 + 1;
    const compData = ctx.getImageData(x0, y0, regionW, regionH);
    const cd = compData.data;

    for (let ry = 0; ry < regionH; ry++) {
      const globalY = y0 + ry;
      const rowOffset = globalY * w;
      for (let rx = 0; rx < regionW; rx++) {
        const globalX = x0 + rx;
        const alpha = mask[rowOffset + globalX];
        const pi = (ry * regionW + rx) * 4;

        if (alpha === 0) {
          const isLight = (Math.floor(globalX / CB_TILE) + Math.floor(globalY / CB_TILE)) % 2 === 0;
          const c = isLight ? 0x3a : 0x2a;
          cd[pi] = c; cd[pi + 1] = c; cd[pi + 2] = c; cd[pi + 3] = 255;
        } else {
          const oi = (globalY * w + globalX) * 4;
          cd[pi] = origPx[oi]; cd[pi + 1] = origPx[oi + 1]; cd[pi + 2] = origPx[oi + 2]; cd[pi + 3] = 255;
        }
      }
    }
    ctx.putImageData(compData, x0, y0);
  };

  /** Paint one brush dab onto the alpha mask and the canvas */
  const paintBrush = (x: number, y: number) => {
    const mask = alphaMaskRef.current;
    if (!mask || !imgDim) return;
    const { w, h } = imgDim;
    const eraseVal = brushMode === 'erase' ? 0 : 255;
    const { x0, y0, x1, y1 } = paintBrushMask(x, y, mask, w, h, eraseVal);
    compositeRegion(x0, y0, x1, y1);
  };

  const interpolateBrush = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const mask = alphaMaskRef.current;
    if (!mask || !imgDim) return;
    const { w, h } = imgDim;
    const eraseVal = brushMode === 'erase' ? 0 : 255;

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const step = Math.max(1, brushSize / 4);
    const steps = Math.ceil(dist / step);

    // Accumulate dirty rect across all dabs
    let dirtyX0 = Infinity, dirtyY0 = Infinity, dirtyX1 = -Infinity, dirtyY1 = -Infinity;
    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      const rect = paintBrushMask(from.x + dx * t, from.y + dy * t, mask, w, h, eraseVal);
      dirtyX0 = Math.min(dirtyX0, rect.x0);
      dirtyY0 = Math.min(dirtyY0, rect.y0);
      dirtyX1 = Math.max(dirtyX1, rect.x1);
      dirtyY1 = Math.max(dirtyY1, rect.y1);
    }
    // Single composite pass for the entire stroke segment
    if (dirtyX0 <= dirtyX1 && dirtyY0 <= dirtyY1) {
      compositeRegion(dirtyX0, dirtyY0, dirtyX1, dirtyY1);
    }
  };

  // Cache original image AND its pixel data for brush performance
  useEffect(() => {
    if (originalImage) {
      const img = new Image();
      img.onload = () => {
        (window as any).__bgRemovalOrigImg = img;
        // Pre-cache pixel data so paintBrush never creates temp canvases
        const cvs = document.createElement('canvas');
        cvs.width = img.naturalWidth;
        cvs.height = img.naturalHeight;
        const ctx = cvs.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        origImageDataRef.current = ctx.getImageData(0, 0, img.naturalWidth, img.naturalHeight);
      };
      img.src = originalImage;
    }
    return () => {
      delete (window as any).__bgRemovalOrigImg;
      origImageDataRef.current = null;
    };
  }, [originalImage]);

  const handleBrushDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode !== 'brush' || isProcessing) return;
    if (e.button !== 0) return; // left-click only
    e.preventDefault();
    const pos = getImageCoords(e);
    if (!pos) return;
    setIsBrushing(true);
    lastBrushPosRef.current = pos;
    paintBrush(pos.x, pos.y);
  };

  const handleBrushMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isBrushing || mode !== 'brush') return;
    const pos = getImageCoords(e);
    if (!pos) return;
    if (lastBrushPosRef.current) {
      interpolateBrush(lastBrushPosRef.current, pos);
    }
    lastBrushPosRef.current = pos;
  };

  const handleBrushUp = () => {
    if (isBrushing && mode === 'brush') {
      // Commit brush strokes: apply alpha mask to produce new workingImage
      commitBrushStrokes();
    }
    setIsBrushing(false);
    lastBrushPosRef.current = null;
  };

  const commitBrushStrokes = async () => {
    const mask = alphaMaskRef.current;
    if (!mask || !originalImage || !imgDim || !workingImage) return;
    pushUndo(workingImage);
    const result = await applyAlphaMask(originalImage, mask, imgDim.w, imgDim.h);
    setWorkingImage(result);
  };

  // ─── Lasso handlers ───────────────────────────────────────────────────
  const drawLassoOverlay = () => {
    const overlay = overlayCanvasRef.current;
    const cvs = canvasRef.current;
    if (!overlay || !cvs) return;
    overlay.width = cvs.width;
    overlay.height = cvs.height;
    const ctx = overlay.getContext('2d')!;
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    const pts = lassoPointsRef.current;
    if (pts.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    // Draw closing line back to start
    ctx.lineTo(pts[0].x, pts[0].y);
    // Fill with semi-transparent overlay
    ctx.fillStyle = lassoMode === 'erase' ? 'rgba(255, 0, 0, 0.15)' : 'rgba(0, 255, 0, 0.15)';
    ctx.fill();
    // Stroke the path
    ctx.strokeStyle = lassoMode === 'erase' ? 'rgba(255, 80, 80, 0.9)' : 'rgba(80, 255, 80, 0.9)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
  };

  const handleLassoDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode !== 'lasso' || isProcessing) return;
    if (e.button !== 0) return;
    e.preventDefault();
    const pos = getImageCoords(e);
    if (!pos) return;
    setIsLassoing(true);
    lassoPointsRef.current = [pos];
  };

  const handleLassoMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isLassoing || mode !== 'lasso') return;
    const pos = getImageCoords(e);
    if (!pos) return;
    lassoPointsRef.current.push(pos);
    drawLassoOverlay();
  };

  const handleLassoUp = async () => {
    if (!isLassoing || mode !== 'lasso') return;
    setIsLassoing(false);
    const pts = lassoPointsRef.current;
    if (pts.length < 3 || !imgDim || !workingImage || !originalImage) {
      lassoPointsRef.current = [];
      // Clear overlay
      const overlay = overlayCanvasRef.current;
      if (overlay) {
        const ctx = overlay.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, overlay.width, overlay.height);
      }
      return;
    }

    const { w, h } = imgDim;
    const mask = alphaMaskRef.current;
    if (!mask) return;

    // Build a filled polygon mask using an offscreen canvas
    const polyCvs = document.createElement('canvas');
    polyCvs.width = w;
    polyCvs.height = h;
    const polyCtx = polyCvs.getContext('2d')!;
    polyCtx.beginPath();
    polyCtx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      polyCtx.lineTo(pts[i].x, pts[i].y);
    }
    polyCtx.closePath();
    polyCtx.fillStyle = '#fff';
    polyCtx.fill();
    const polyData = polyCtx.getImageData(0, 0, w, h).data;

    // Apply to alpha mask
    const val = lassoMode === 'erase' ? 0 : 255;
    for (let i = 0; i < w * h; i++) {
      if (polyData[i * 4 + 3] > 0) {
        mask[i] = val;
      }
    }

    pushUndo(workingImage);
    const result = await applyAlphaMask(originalImage, mask, w, h);
    setWorkingImage(result);

    lassoPointsRef.current = [];
    // Clear overlay
    const overlay = overlayCanvasRef.current;
    if (overlay) {
      const ctx = overlay.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, overlay.width, overlay.height);
    }
  };

  // ─── Pan handlers (middle-click or right-click) ───────────────────────
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    // Mouse position relative to container
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(prevZoom => {
      const newZoom = Math.max(0.05, Math.min(10, prevZoom + delta));
      const scale = newZoom / prevZoom;
      // Adjust pan so the point under the cursor stays fixed
      setPan(prev => ({
        x: mx - scale * (mx - prev.x),
        y: my - scale * (my - prev.y),
      }));
      return newZoom;
    });
  };

  const handlePanStart = (e: React.MouseEvent) => {
    if (e.button === 1 || e.button === 2) {
      e.preventDefault();
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    }
  };

  const handlePanMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    setPan({ x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy });
  };

  const handlePanEnd = () => {
    setIsPanning(false);
  };

  // ─── Mouse handlers dispatch ──────────────────────────────────────────
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 1 || e.button === 2) {
      handlePanStart(e);
      return;
    }
    if (mode === 'brush') {
      handleBrushDown(e);
    }
    if (mode === 'lasso') {
      handleLassoDown(e);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      handlePanMove(e);
      return;
    }
    if (mode === 'brush' && isBrushing) {
      handleBrushMove(e);
    }
    if (mode === 'lasso' && isLassoing) {
      handleLassoMove(e);
    }
  };

  const handleCanvasMouseUp = () => {
    if (isPanning) {
      handlePanEnd();
      return;
    }
    if (mode === 'brush') {
      handleBrushUp();
    }
    if (mode === 'lasso') {
      handleLassoUp();
    }
  };

  // ─── Apply final result ───────────────────────────────────────────────
  const handleApply = () => {
    if (!workingImage || workingImage === originalImage) return;
    updateLayer(layer.id, { imageData: workingImage });
    onClose();
  };

  // ─── Reset to original ────────────────────────────────────────────────
  const handleReset = () => {
    if (originalImage && workingImage) {
      pushUndo(workingImage);
      setWorkingImage(originalImage);
      setErrorText(null);
      setStatusText(null);
      alphaMaskRef.current = null;
    }
  };

  // ─── Cursor style ─────────────────────────────────────────────────────
  const getCursorClass = () => {
    if (isPanning) return 'cursor-grabbing';
    if (mode === 'click') return 'cursor-crosshair';
    if (mode === 'brush') return 'cursor-none';
    if (mode === 'lasso') return 'cursor-crosshair';
    return 'cursor-default';
  };

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <DraggableModal isOpen={isOpen} title="Background Removal" onClose={onClose} modalId="modal-bg-removal">
      <div className="flex flex-col h-full text-gray-200">
        {/* Mode tabs */}
        <div className="flex border-b border-gray-700 bg-gray-800/50">
          {([
            { key: 'click' as Mode, label: 'Click Remove' },
            { key: 'lasso' as Mode, label: 'Lasso' },
            { key: 'brush' as Mode, label: 'Brush Refine' },
            { key: 'ai' as Mode, label: 'AI Auto' },
          ]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                mode === key
                  ? 'border-blue-500 text-blue-400 bg-gray-700/50'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-700/30'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Error banner */}
        {errorText && (
          <div className="px-4 py-2 bg-red-900/40 border-b border-red-700 text-xs text-red-300 flex items-start gap-2">
            <span className="font-bold text-red-400 mt-px">!</span>
            <span className="flex-1">{errorText}</span>
            <button onClick={() => setErrorText(null)} className="text-red-400 hover:text-red-200 shrink-0">✕</button>
          </div>
        )}

        {/* Preview area */}
        <div className="flex-1 min-h-0 relative">
          {/* Status overlay */}
          {(isProcessing || statusText) && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 gap-3">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-medium text-white">{statusText || 'Processing...'}</span>
              </div>
              {downloadProgress !== null && downloadProgress < 100 && (
                <div className="w-48 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${downloadProgress}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Preview container with pan & zoom */}
          <div
            ref={containerRef}
            className="w-full h-full overflow-hidden bg-gray-900 relative"
            onWheel={handleWheel}
            onMouseDown={handlePanStart}
            onMouseMove={(e) => {
              handlePanMove(e);
              // Update brush cursor via direct DOM manipulation (no React re-render)
              if (mode === 'brush' && containerRef.current && brushCursorRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const cx = e.clientX - rect.left;
                const cy = e.clientY - rect.top;
                const size = brushSize * zoom;
                const el = brushCursorRef.current;
                el.style.left = `${cx - size / 2}px`;
                el.style.top = `${cy - size / 2}px`;
                el.style.width = `${size}px`;
                el.style.height = `${size}px`;
                el.style.display = 'block';
              }
            }}
            onMouseUp={handlePanEnd}
            onMouseLeave={() => {
              handlePanEnd();
              if (brushCursorRef.current) brushCursorRef.current.style.display = 'none';
            }}
            onContextMenu={e => e.preventDefault()}
          >
            <div
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: '0 0',
                display: 'inline-block',
                position: 'relative',
              }}
            >
              <canvas
                ref={canvasRef}
                className={getCursorClass()}
                onClick={(mode === 'click' && !isProcessing) ? handleCanvasClick : undefined}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
                style={{ display: 'block', imageRendering: zoom > 2 ? 'pixelated' : 'auto' }}
              />
              {/* Lasso overlay canvas — sits on top of main canvas */}
              <canvas
                ref={overlayCanvasRef}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                  imageRendering: zoom > 2 ? 'pixelated' : 'auto',
                }}
              />
            </div>
            {/* Brush size cursor overlay — positioned via ref, no React re-renders */}
            <div
              ref={brushCursorRef}
              style={{
                position: 'absolute',
                display: 'none',
                border: '1.5px solid rgba(255, 255, 255, 0.8)',
                borderRadius: '50%',
                pointerEvents: 'none',
                zIndex: 10,
                boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.5)',
                willChange: 'left, top, width, height',
              }}
            />
          </div>
        </div>

        {/* Bottom controls */}
        <div className="border-t border-gray-700 px-4 py-3 space-y-3">
          {/* Zoom bar */}
          <div className="flex items-center gap-2 text-xs">
            <button onClick={() => setZoom(z => Math.max(0.05, z - 0.25))} className="px-1.5 py-0.5 text-gray-400 hover:text-white bg-gray-700 rounded">−</button>
            <span className="text-gray-400 min-w-[40px] text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(10, z + 0.25))} className="px-1.5 py-0.5 text-gray-400 hover:text-white bg-gray-700 rounded">+</button>
            <button
              onClick={() => {
                if (imgDim && containerRef.current) {
                  const fit = Math.min(containerRef.current.clientWidth / imgDim.w, containerRef.current.clientHeight / imgDim.h) * 0.9;
                  setZoom(Math.max(0.05, fit));
                  setPan({ x: 0, y: 0 });
                }
              }}
              className="text-gray-400 hover:text-white bg-gray-700 rounded px-2 py-0.5"
            >
              Fit
            </button>
            <span className="text-gray-500 ml-1">Middle-click to pan, scroll to zoom</span>
          </div>

          {/* Mode-specific controls */}
          {mode === 'ai' && (
            <div className="space-y-2">
              <p className="text-xs text-gray-400">
                Uses a neural network to automatically detect and remove the background. The model (~40 MB) downloads on first use and is cached by the browser.
              </p>
              <button
                onClick={handleAiRemove}
                disabled={isProcessing}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isProcessing ? 'Processing...' : 'Remove Background (AI)'}
              </button>
            </div>
          )}

          {mode === 'click' && (
            <div className="space-y-2">
              <p className="text-xs text-gray-400">
                Click on any region to flood-fill remove it. Adjust tolerance to control how aggressively similar colors are erased.
              </p>
              <div className="flex items-center gap-3">
                <label className="text-xs text-gray-400 whitespace-nowrap">Tolerance: {tolerance}</label>
                <input
                  type="range" min="1" max="255" value={tolerance}
                  onChange={e => setTolerance(Number(e.target.value))}
                  className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleLegacyRemove}
                  disabled={isProcessing}
                  className="px-3 py-1.5 text-xs font-medium text-gray-300 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-50 transition-colors"
                >
                  Auto-Remove from Corners
                </button>
                <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
                  <input
                    type="checkbox" checked={makeHeatmap}
                    onChange={e => setMakeHeatmap(e.target.checked)}
                    className="w-3.5 h-3.5 rounded bg-gray-700 border-gray-600 accent-blue-500"
                  />
                  Heatmap
                </label>
              </div>
            </div>
          )}

          {mode === 'lasso' && (
            <div className="space-y-2">
              <p className="text-xs text-gray-400">
                Draw a freehand selection around an area to erase or restore it. The region fills when you release the mouse.
              </p>
              <div className="flex items-center gap-3">
                <div className="flex rounded overflow-hidden border border-gray-600">
                  <button
                    onClick={() => setLassoMode('erase')}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      lassoMode === 'erase' ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    Erase
                  </button>
                  <button
                    onClick={() => setLassoMode('restore')}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      lassoMode === 'restore' ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    Restore
                  </button>
                </div>
                <span className="text-xs text-gray-500">Draw around an area, then release to apply</span>
              </div>
            </div>
          )}

          {mode === 'brush' && (
            <div className="space-y-2">
              <p className="text-xs text-gray-400">
                Paint over areas to erase or restore them. Use after AI or Click removal to refine edges.
              </p>
              <div className="flex items-center gap-3">
                <div className="flex rounded overflow-hidden border border-gray-600">
                  <button
                    onClick={() => setBrushMode('erase')}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      brushMode === 'erase' ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    Erase
                  </button>
                  <button
                    onClick={() => setBrushMode('restore')}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      brushMode === 'restore' ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    Restore
                  </button>
                </div>
                <label className="text-xs text-gray-400 whitespace-nowrap">Size: {brushSize}px</label>
                <input
                  type="range" min="1" max="100" value={brushSize}
                  onChange={e => setBrushSize(Number(e.target.value))}
                  className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                disabled={isProcessing || workingImage === originalImage}
                className="px-3 py-1.5 text-xs font-medium text-gray-300 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-30 transition-colors"
              >
                Reset
              </button>
              <button
                onClick={handleUndo}
                disabled={isProcessing || !canUndo}
                className="px-2.5 py-1.5 text-xs font-medium text-gray-300 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-30 transition-colors"
                title="Undo (Ctrl+Z)"
              >
                Undo
              </button>
              <button
                onClick={handleRedo}
                disabled={isProcessing || !canRedo}
                className="px-2.5 py-1.5 text-xs font-medium text-gray-300 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-30 transition-colors"
                title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
              >
                Redo
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 rounded hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                disabled={isProcessing || workingImage === originalImage}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      </div>
    </DraggableModal>
  );
};

export default BgRemovalModal;
