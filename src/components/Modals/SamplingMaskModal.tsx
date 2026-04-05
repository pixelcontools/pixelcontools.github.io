import React, { useEffect, useRef, useState, useCallback } from 'react';
import DraggableModal from './DraggableModal';

type MaskTool = 'brush' | 'lasso' | 'rect' | 'circle';

interface SamplingMaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageData: string; // base64 data URI of the source image
  existingMask: Uint8Array | null; // existing mask to resume editing
  onApply: (mask: Uint8Array, width: number, height: number) => void;
}

const SamplingMaskModal: React.FC<SamplingMaskModalProps> = ({ isOpen, onClose, imageData, existingMask, onApply }) => {
  const [tool, setTool] = useState<MaskTool>('brush');
  const [brushSize, setBrushSize] = useState(24);
  const [maskMode, setMaskMode] = useState<'add' | 'remove'>('add');
  const [imgDim, setImgDim] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const maskRef = useRef<Uint8Array | null>(null);
  const origImageDataRef = useRef<ImageData | null>(null);
  const hasInitialFitRef = useRef(false);

  // Brush state
  const [isBrushing, setIsBrushing] = useState(false);
  const lastBrushPosRef = useRef<{ x: number; y: number } | null>(null);

  // Lasso state
  const [isLassoing, setIsLassoing] = useState(false);
  const lassoPointsRef = useRef<{ x: number; y: number }[]>([]);

  // Rect/Circle drag state
  const [isShapeDragging, setIsShapeDragging] = useState(false);
  const shapeStartRef = useRef<{ x: number; y: number } | null>(null);
  const shapeEndRef = useRef<{ x: number; y: number } | null>(null);

  // Undo stack
  const undoStackRef = useRef<Uint8Array[]>([]);
  const [canUndo, setCanUndo] = useState(false);

  // Stable ref to always call latest drawPreview
  const drawPreviewRef = useRef<() => void>(() => {});

  const pushUndo = useCallback(() => {
    if (maskRef.current) {
      undoStackRef.current.push(new Uint8Array(maskRef.current));
      setCanUndo(true);
    }
  }, []);

  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    const prev = undoStackRef.current.pop()!;
    maskRef.current = prev;
    setCanUndo(undoStackRef.current.length > 0);
    drawPreviewRef.current();
  }, []);

  // Initialize when modal opens
  useEffect(() => {
    if (!isOpen || !imageData) return;
    hasInitialFitRef.current = false;
    undoStackRef.current = [];
    setCanUndo(false);

    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      setImgDim({ w, h });

      // Cache original pixel data
      const cvs = document.createElement('canvas');
      cvs.width = w;
      cvs.height = h;
      const ctx = cvs.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      origImageDataRef.current = ctx.getImageData(0, 0, w, h);

      // Init mask
      if (existingMask && existingMask.length === w * h) {
        maskRef.current = new Uint8Array(existingMask);
      } else {
        // Default: all zeros (nothing selected)
        maskRef.current = new Uint8Array(w * h);
      }
    };
    img.src = imageData;
  }, [isOpen, imageData, existingMask]);

  // Draw preview
  const drawPreview = useCallback(() => {
    const cvs = canvasRef.current;
    const origData = origImageDataRef.current;
    const mask = maskRef.current;
    if (!cvs || !origData || !mask || !imgDim) return;

    const { w, h } = imgDim;
    cvs.width = w;
    cvs.height = h;
    const ctx = cvs.getContext('2d')!;

    // Draw original image dimmed, highlight masked area
    const display = ctx.createImageData(w, h);
    const src = origData.data;
    const dst = display.data;

    for (let i = 0; i < w * h; i++) {
      const si = i * 4;
      if (mask[i] > 0) {
        // Selected area: full brightness
        dst[si] = src[si];
        dst[si + 1] = src[si + 1];
        dst[si + 2] = src[si + 2];
        dst[si + 3] = src[si + 3];
      } else {
        // Unselected: dimmed + red tint
        dst[si] = Math.min(255, Math.floor(src[si] * 0.3) + 40);
        dst[si + 1] = Math.floor(src[si + 1] * 0.3);
        dst[si + 2] = Math.floor(src[si + 2] * 0.3);
        dst[si + 3] = src[si + 3] === 0 ? 0 : 255;
      }
    }

    ctx.putImageData(display, 0, 0);
  }, [imgDim]);

  // Keep ref in sync so handleUndo always calls the latest drawPreview
  useEffect(() => { drawPreviewRef.current = drawPreview; }, [drawPreview]);

  useEffect(() => { drawPreview(); }, [drawPreview, imgDim]);

  // Fit zoom on initial open
  useEffect(() => {
    if (imgDim && containerRef.current && !hasInitialFitRef.current) {
      const cw = containerRef.current.clientWidth;
      const ch = containerRef.current.clientHeight;
      if (cw > 0 && ch > 0) {
        const fit = Math.max(0.05, Math.min(cw / imgDim.w, ch / imgDim.h) * 0.9);
        setZoom(fit);
        setPan({
          x: (cw - imgDim.w * fit) / 2,
          y: (ch - imgDim.h * fit) / 2,
        });
        hasInitialFitRef.current = true;
      }
    }
  }, [imgDim]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        e.stopPropagation();
        handleUndo();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [isOpen, handleUndo]);

  // Get image coordinates from mouse event
  const getImageCoords = useCallback((e: React.MouseEvent) => {
    const cvs = canvasRef.current;
    if (!cvs) return null;
    const rect = cvs.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (cvs.width / rect.width),
      y: (e.clientY - rect.top) * (cvs.height / rect.height),
    };
  }, []);

  // ─── Brush ────────────────────────────────────────────────────────────
  const paintBrush = useCallback((x: number, y: number) => {
    const mask = maskRef.current;
    if (!mask || !imgDim) return;
    const { w, h } = imgDim;
    const radius = brushSize / 2;
    const rSq = radius * radius;
    const val = maskMode === 'add' ? 255 : 0;
    const x0 = Math.max(0, Math.floor(x - radius));
    const y0 = Math.max(0, Math.floor(y - radius));
    const x1 = Math.min(w - 1, Math.ceil(x + radius));
    const y1 = Math.min(h - 1, Math.ceil(y + radius));
    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const dx = px - x, dy = py - y;
        if (dx * dx + dy * dy <= rSq) {
          mask[py * w + px] = val;
        }
      }
    }
  }, [brushSize, maskMode, imgDim]);

  const interpolateBrush = useCallback((from: { x: number; y: number }, to: { x: number; y: number }) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const step = Math.max(1, brushSize / 4);
    const steps = Math.ceil(dist / step);
    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      paintBrush(from.x + dx * t, from.y + dy * t);
    }
  }, [paintBrush, brushSize]);

  // ─── Apply lasso/rect/circle to mask ─────────────────────────────────
  const applyPolygonToMask = useCallback((points: { x: number; y: number }[]) => {
    const mask = maskRef.current;
    if (!mask || !imgDim || points.length < 3) return;
    const { w, h } = imgDim;
    const val = maskMode === 'add' ? 255 : 0;

    // Rasterize polygon via offscreen canvas
    const cvs = document.createElement('canvas');
    cvs.width = w;
    cvs.height = h;
    const ctx = cvs.getContext('2d')!;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.fill();
    const polyData = ctx.getImageData(0, 0, w, h).data;

    for (let i = 0; i < w * h; i++) {
      if (polyData[i * 4 + 3] > 128) {
        mask[i] = val;
      }
    }
  }, [maskMode, imgDim]);

  const applyRectToMask = useCallback((start: { x: number; y: number }, end: { x: number; y: number }) => {
    const mask = maskRef.current;
    if (!mask || !imgDim) return;
    const { w, h } = imgDim;
    const val = maskMode === 'add' ? 255 : 0;
    const x0 = Math.max(0, Math.min(Math.floor(start.x), Math.floor(end.x)));
    const y0 = Math.max(0, Math.min(Math.floor(start.y), Math.floor(end.y)));
    const x1 = Math.min(w - 1, Math.max(Math.floor(start.x), Math.floor(end.x)));
    const y1 = Math.min(h - 1, Math.max(Math.floor(start.y), Math.floor(end.y)));
    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        mask[py * w + px] = val;
      }
    }
  }, [maskMode, imgDim]);

  const applyCircleToMask = useCallback((start: { x: number; y: number }, end: { x: number; y: number }) => {
    const mask = maskRef.current;
    if (!mask || !imgDim) return;
    const { w, h } = imgDim;
    const val = maskMode === 'add' ? 255 : 0;
    const cx = (start.x + end.x) / 2;
    const cy = (start.y + end.y) / 2;
    const rx = Math.abs(end.x - start.x) / 2;
    const ry = Math.abs(end.y - start.y) / 2;
    if (rx < 1 || ry < 1) return;
    const x0 = Math.max(0, Math.floor(cx - rx));
    const y0 = Math.max(0, Math.floor(cy - ry));
    const x1 = Math.min(w - 1, Math.ceil(cx + rx));
    const y1 = Math.min(h - 1, Math.ceil(cy + ry));
    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const dx = (px - cx) / rx;
        const dy = (py - cy) / ry;
        if (dx * dx + dy * dy <= 1) {
          mask[py * w + px] = val;
        }
      }
    }
  }, [maskMode, imgDim]);

  // ─── Draw overlay (lasso path / shape preview) ───────────────────────
  const drawOverlay = useCallback(() => {
    const overlay = overlayRef.current;
    const cvs = canvasRef.current;
    if (!overlay || !cvs) return;
    overlay.width = cvs.width;
    overlay.height = cvs.height;
    const ctx = overlay.getContext('2d')!;
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    const color = maskMode === 'add' ? 'rgba(0, 255, 0, 0.3)' : 'rgba(255, 0, 0, 0.3)';
    const strokeColor = maskMode === 'add' ? 'rgba(80, 255, 80, 0.9)' : 'rgba(255, 80, 80, 0.9)';

    if (tool === 'lasso' && lassoPointsRef.current.length > 1) {
      const pts = lassoPointsRef.current;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.lineTo(pts[0].x, pts[0].y);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
    }

    if ((tool === 'rect' || tool === 'circle') && shapeStartRef.current && shapeEndRef.current) {
      const s = shapeStartRef.current;
      const e = shapeEndRef.current;
      ctx.fillStyle = color;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);

      if (tool === 'rect') {
        const x = Math.min(s.x, e.x);
        const y = Math.min(s.y, e.y);
        const w = Math.abs(e.x - s.x);
        const h = Math.abs(e.y - s.y);
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);
      } else {
        const cx = (s.x + e.x) / 2;
        const cy = (s.y + e.y) / 2;
        const rx = Math.abs(e.x - s.x) / 2;
        const ry = Math.abs(e.y - s.y) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  }, [tool, maskMode]);

  // ─── Mouse handlers ──────────────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      // Middle-click or alt+click: pan
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      return;
    }
    if (e.button !== 0) return;
    const pos = getImageCoords(e);
    if (!pos) return;

    pushUndo();

    if (tool === 'brush') {
      setIsBrushing(true);
      lastBrushPosRef.current = pos;
      paintBrush(pos.x, pos.y);
      drawPreview();
    } else if (tool === 'lasso') {
      setIsLassoing(true);
      lassoPointsRef.current = [pos];
    } else if (tool === 'rect' || tool === 'circle') {
      setIsShapeDragging(true);
      shapeStartRef.current = pos;
      shapeEndRef.current = pos;
    }
  }, [tool, pan, getImageCoords, pushUndo, paintBrush, drawPreview]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      setPan({
        x: panStartRef.current.panX + (e.clientX - panStartRef.current.x),
        y: panStartRef.current.panY + (e.clientY - panStartRef.current.y),
      });
      return;
    }

    const pos = getImageCoords(e);
    if (!pos) return;

    if (tool === 'brush' && isBrushing) {
      if (lastBrushPosRef.current) {
        interpolateBrush(lastBrushPosRef.current, pos);
      }
      lastBrushPosRef.current = pos;
      drawPreview();
    } else if (tool === 'lasso' && isLassoing) {
      lassoPointsRef.current.push(pos);
      drawOverlay();
    } else if ((tool === 'rect' || tool === 'circle') && isShapeDragging) {
      shapeEndRef.current = pos;
      drawOverlay();
    }
  }, [tool, isBrushing, isLassoing, isShapeDragging, isPanning, getImageCoords, interpolateBrush, drawPreview, drawOverlay]);

  const handleMouseUp = useCallback(() => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (tool === 'brush') {
      setIsBrushing(false);
      lastBrushPosRef.current = null;
    } else if (tool === 'lasso') {
      if (isLassoing && lassoPointsRef.current.length >= 3) {
        applyPolygonToMask(lassoPointsRef.current);
        drawPreview();
      }
      setIsLassoing(false);
      lassoPointsRef.current = [];
      // Clear overlay
      const overlay = overlayRef.current;
      if (overlay) {
        const ctx = overlay.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, overlay.width, overlay.height);
      }
    } else if (tool === 'rect' || tool === 'circle') {
      if (isShapeDragging && shapeStartRef.current && shapeEndRef.current) {
        if (tool === 'rect') {
          applyRectToMask(shapeStartRef.current, shapeEndRef.current);
        } else {
          applyCircleToMask(shapeStartRef.current, shapeEndRef.current);
        }
        drawPreview();
      }
      setIsShapeDragging(false);
      shapeStartRef.current = null;
      shapeEndRef.current = null;
      // Clear overlay
      const overlay = overlayRef.current;
      if (overlay) {
        const ctx = overlay.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, overlay.width, overlay.height);
      }
    }
  }, [tool, isPanning, isLassoing, isShapeDragging, applyPolygonToMask, applyRectToMask, applyCircleToMask, drawPreview]);

  // Scroll wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(prev => Math.max(0.05, Math.min(20, prev * (e.deltaY < 0 ? 1.15 : 0.87))));
  }, []);

  const handleClear = useCallback(() => {
    if (!maskRef.current) return;
    pushUndo();
    maskRef.current.fill(0);
    drawPreview();
  }, [pushUndo, drawPreview]);

  const handleSelectAll = useCallback(() => {
    if (!maskRef.current) return;
    pushUndo();
    maskRef.current.fill(255);
    drawPreview();
  }, [pushUndo, drawPreview]);

  const handleInvert = useCallback(() => {
    if (!maskRef.current) return;
    pushUndo();
    for (let i = 0; i < maskRef.current.length; i++) {
      maskRef.current[i] = maskRef.current[i] > 0 ? 0 : 255;
    }
    drawPreview();
  }, [pushUndo, drawPreview]);

  const handleApply = useCallback(() => {
    if (maskRef.current && imgDim) {
      onApply(new Uint8Array(maskRef.current), imgDim.w, imgDim.h);
    }
    onClose();
  }, [imgDim, onApply, onClose]);

  // Count selected pixels
  const selectedCount = maskRef.current ? maskRef.current.reduce((s, v) => s + (v > 0 ? 1 : 0), 0) : 0;
  const totalCount = imgDim ? imgDim.w * imgDim.h : 0;
  const selectedPercent = totalCount > 0 ? ((selectedCount / totalCount) * 100).toFixed(1) : '0';

  if (!isOpen) return null;

  return (
    <DraggableModal isOpen={isOpen} title="Configure Sampling Mask" onClose={onClose} noPadding={true} modalId="modal-sampling-mask" children={() => (
      <div className="flex text-gray-200 h-full w-full overflow-hidden">
        {/* Tools sidebar */}
        <div className="w-56 border-r border-gray-700 flex-shrink-0 flex flex-col overflow-hidden">
          <div className="overflow-y-auto flex-1 p-3 space-y-4">
            {/* Tool selection */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-400 uppercase">Tool</label>
              <div className="grid grid-cols-2 gap-1">
                {([
                  { id: 'brush' as MaskTool, label: '🖌 Brush' },
                  { id: 'lasso' as MaskTool, label: '✂ Lasso' },
                  { id: 'rect' as MaskTool, label: '▭ Rect' },
                  { id: 'circle' as MaskTool, label: '⬭ Circle' },
                ]).map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTool(t.id)}
                    className={`px-2 py-1.5 text-xs rounded transition-colors ${tool === t.id ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Mode */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-400 uppercase">Mode</label>
              <div className="flex gap-1">
                <button
                  onClick={() => setMaskMode('add')}
                  className={`flex-1 px-2 py-1.5 text-xs rounded transition-colors ${maskMode === 'add' ? 'bg-green-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                >
                  + Add
                </button>
                <button
                  onClick={() => setMaskMode('remove')}
                  className={`flex-1 px-2 py-1.5 text-xs rounded transition-colors ${maskMode === 'remove' ? 'bg-red-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                >
                  − Remove
                </button>
              </div>
            </div>

            {/* Brush size */}
            {tool === 'brush' && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Brush Size</span>
                  <span>{brushSize}px</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="200"
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            )}

            {/* Quick actions */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-400 uppercase">Actions</label>
              <div className="flex flex-col gap-1">
                <button onClick={handleSelectAll} className="w-full px-2 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors">
                  Select All
                </button>
                <button onClick={handleInvert} className="w-full px-2 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors">
                  Invert
                </button>
                <button onClick={handleClear} className="w-full px-2 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors">
                  Clear
                </button>
                <button onClick={handleUndo} disabled={!canUndo} className="w-full px-2 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors disabled:opacity-30">
                  Undo (Ctrl+Z)
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="text-xs text-gray-500 bg-gray-800 rounded p-2">
              Selected: {selectedPercent}% ({selectedCount.toLocaleString()} px)
            </div>

            <div className="text-xs text-gray-500">
              <p className="mb-1"><strong>Tip:</strong> Only colors within the highlighted region will be used for K-Means / color suggestions.</p>
              <p>Alt+click or middle-click to pan. Scroll to zoom.</p>
            </div>
          </div>

          {/* Bottom buttons */}
          <div className="border-t border-gray-700 p-3 flex gap-2">
            <button
              onClick={handleApply}
              className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded transition-colors"
            >
              Apply Mask
            </button>
            <button
              onClick={onClose}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Canvas area */}
        <div
          ref={containerRef}
          className="flex-1 overflow-hidden relative bg-gray-900 cursor-crosshair"
          onWheel={handleWheel}
        >
          <div
            style={{
              position: 'absolute',
              left: pan.x,
              top: pan.y,
              transform: `scale(${zoom})`,
              transformOrigin: '0 0',
              imageRendering: 'pixelated',
            }}
          >
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{ display: 'block', imageRendering: 'pixelated' }}
            />
            <canvas
              ref={overlayRef}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                pointerEvents: 'none',
                imageRendering: 'pixelated',
              }}
            />
          </div>
        </div>
      </div>
    )} />
  );
};

export default SamplingMaskModal;
