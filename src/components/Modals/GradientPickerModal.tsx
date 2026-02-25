import React, { useRef, useState, useEffect, useCallback } from 'react';
import { usePortraitMode } from '../../hooks/usePortraitMode';

interface GradientPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageDataUrl: string;
  onAddColors: (colors: string[]) => void;
}

/**
 * Gradient picker modal. User drags from one pixel to another on the image,
 * all colors along that line are captured, then a slider lets them choose
 * how many equidistant samples to keep before adding to the palette.
 */
const GradientPickerModal: React.FC<GradientPickerModalProps> = ({ isOpen, onClose, imageDataUrl, onAddColors }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const isPortrait = usePortraitMode();
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgSize, setImgSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [hoverColor, setHoverColor] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartImg, setDragStartImg] = useState<{ x: number; y: number } | null>(null);
  const [dragEndImg, setDragEndImg] = useState<{ x: number; y: number } | null>(null);

  // Gradient results
  const [rawGradient, setRawGradient] = useState<string[]>([]);
  const [sampleCount, setSampleCount] = useState<number>(10);
  const [gradients, setGradients] = useState<{ raw: string[]; sampled: string[] }[]>([]);

  // Pixel data cache
  const pixelDataRef = useRef<ImageData | null>(null);
  const pixelCanvasSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  // Load image
  useEffect(() => {
    if (!isOpen || !imageDataUrl) return;
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
      setImgLoaded(true);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setRawGradient([]);
      setGradients([]);
      setDragStartImg(null);
      setDragEndImg(null);
    };
    img.src = imageDataUrl;
  }, [isOpen, imageDataUrl]);

  // Auto-fit zoom
  useEffect(() => {
    if (!imgLoaded || !containerRef.current) return;
    const cw = containerRef.current.clientWidth - 40;
    const ch = containerRef.current.clientHeight - 40;
    if (cw <= 0 || ch <= 0 || imgSize.w <= 0 || imgSize.h <= 0) return;
    const fit = Math.min(cw / imgSize.w, ch / imgSize.h, 4);
    setZoom(fit);
  }, [imgLoaded, imgSize]);

  // Cache pixel data
  useEffect(() => {
    if (!imgLoaded || !imgRef.current) return;
    const img = imgRef.current;
    const tc = document.createElement('canvas');
    tc.width = img.naturalWidth;
    tc.height = img.naturalHeight;
    const tctx = tc.getContext('2d')!;
    tctx.drawImage(img, 0, 0);
    pixelDataRef.current = tctx.getImageData(0, 0, tc.width, tc.height);
    pixelCanvasSizeRef.current = { w: tc.width, h: tc.height };
  }, [imgLoaded, imageDataUrl]);

  // Get canvas offset helpers
  const getCanvasOffset = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return { ox: 0, oy: 0, drawW: 0, drawH: 0 };
    const drawW = imgSize.w * zoom;
    const drawH = imgSize.h * zoom;
    const ox = (canvas.width - drawW) / 2 + pan.x;
    const oy = (canvas.height - drawH) / 2 + pan.y;
    return { ox, oy, drawW, drawH };
  }, [imgSize, zoom, pan]);

  // Client coords -> image pixel coords
  const clientToImgCoords = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas || !imgLoaded) return null;
    const rect = canvas.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    const { ox, oy, drawW, drawH } = getCanvasOffset();
    if (mx < ox || mx >= ox + drawW || my < oy || my >= oy + drawH) return null;
    return {
      x: Math.floor((mx - ox) / zoom),
      y: Math.floor((my - oy) / zoom),
    };
  }, [imgLoaded, zoom, getCanvasOffset]);

  // Get pixel color at image coords
  const getPixelAt = useCallback((imgX: number, imgY: number): string | null => {
    const pd = pixelDataRef.current;
    if (!pd) return null;
    const w = pixelCanvasSizeRef.current.w;
    const h = pixelCanvasSizeRef.current.h;
    if (imgX < 0 || imgX >= w || imgY < 0 || imgY >= h) return null;
    const idx = (imgY * w + imgX) * 4;
    const r = pd.data[idx];
    const g = pd.data[idx + 1];
    const b = pd.data[idx + 2];
    return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('').toUpperCase();
  }, []);

  // Fast color from client coords
  const getPixelColorFast = useCallback((clientX: number, clientY: number): string | null => {
    const coords = clientToImgCoords(clientX, clientY);
    if (!coords) return null;
    return getPixelAt(coords.x, coords.y);
  }, [clientToImgCoords, getPixelAt]);

  // Bresenham line: get all pixel coords between two image points
  const getLinePixels = useCallback((x0: number, y0: number, x1: number, y1: number): { x: number; y: number }[] => {
    const points: { x: number; y: number }[] = [];
    let dx = Math.abs(x1 - x0);
    let dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let cx = x0;
    let cy = y0;

    while (true) {
      points.push({ x: cx, y: cy });
      if (cx === x1 && cy === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; cx += sx; }
      if (e2 < dx) { err += dx; cy += sy; }
    }
    return points;
  }, []);

  // Build gradient from line pixels
  const buildGradient = useCallback((start: { x: number; y: number }, end: { x: number; y: number }): string[] => {
    const points = getLinePixels(start.x, start.y, end.x, end.y);
    const colors: string[] = [];
    for (const pt of points) {
      const c = getPixelAt(pt.x, pt.y);
      if (c) colors.push(c);
    }
    return colors;
  }, [getLinePixels, getPixelAt]);

  // Sample equidistant colors from array
  const sampleGradient = useCallback((colors: string[], count: number): string[] => {
    if (colors.length === 0) return [];
    if (count >= colors.length) return [...colors];
    if (count === 1) return [colors[0]];
    if (count === 2) return [colors[0], colors[colors.length - 1]];

    const result: string[] = [];
    for (let i = 0; i < count; i++) {
      const idx = Math.round((i / (count - 1)) * (colors.length - 1));
      result.push(colors[idx]);
    }
    return result;
  }, []);

  // Current sampled colors
  const currentSampled = rawGradient.length > 0 ? sampleGradient(rawGradient, sampleCount) : [];

  // Draw canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const img = imgRef.current;
    if (!canvas || !container || !img || !imgLoaded) return;

    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Checkerboard
    const pSize = 8;
    const pCanvas = document.createElement('canvas');
    pCanvas.width = pSize * 2;
    pCanvas.height = pSize * 2;
    const pCtx = pCanvas.getContext('2d')!;
    pCtx.fillStyle = '#3a3a3a';
    pCtx.fillRect(0, 0, pSize * 2, pSize * 2);
    pCtx.fillStyle = '#2a2a2a';
    pCtx.fillRect(0, 0, pSize, pSize);
    pCtx.fillRect(pSize, pSize, pSize, pSize);

    const { ox, oy, drawW, drawH } = getCanvasOffset();

    ctx.save();
    ctx.beginPath();
    ctx.rect(ox, oy, drawW, drawH);
    ctx.clip();
    const pattern = ctx.createPattern(pCanvas, 'repeat');
    if (pattern) {
      ctx.fillStyle = pattern;
      ctx.fillRect(ox, oy, drawW, drawH);
    }
    ctx.restore();

    ctx.drawImage(img, ox, oy, drawW, drawH);

    // Draw drag line
    if (dragStartImg && dragEndImg) {
      const sx = ox + (dragStartImg.x + 0.5) * zoom;
      const sy = oy + (dragStartImg.y + 0.5) * zoom;
      const ex = ox + (dragEndImg.x + 0.5) * zoom;
      const ey = oy + (dragEndImg.y + 0.5) * zoom;

      // Line shadow
      ctx.save();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      // Line
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.setLineDash([]);

      // Start dot
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(sx, sy, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();

      // End dot
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(ex, ey, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.restore();
    }
  }, [imgLoaded, imgSize, zoom, pan, getCanvasOffset, dragStartImg, dragEndImg]);

  useEffect(() => { draw(); }, [draw]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(container);
    return () => ro.disconnect();
  }, [draw]);

  // Mouse handlers
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setCursorPos({ x: e.clientX, y: e.clientY });

    if (isPanning) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setPanStart({ x: e.clientX, y: e.clientY });
      setHoverColor(null);
      return;
    }

    if (isDragging) {
      const coords = clientToImgCoords(e.clientX, e.clientY);
      if (coords) {
        setDragEndImg(coords);
      }
      return;
    }

    const color = getPixelColorFast(e.clientX, e.clientY);
    setHoverColor(color);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Middle/right click to pan
    if (e.button === 1 || e.button === 2) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    // Left click to start drag
    if (e.button === 0) {
      const coords = clientToImgCoords(e.clientX, e.clientY);
      if (coords) {
        setIsDragging(true);
        setDragStartImg(coords);
        setDragEndImg(coords);
        setRawGradient([]);
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (isDragging && dragStartImg) {
      setIsDragging(false);
      const coords = clientToImgCoords(e.clientX, e.clientY);
      if (coords) {
        setDragEndImg(coords);
        const gradient = buildGradient(dragStartImg, coords);
        setRawGradient(gradient);
      }
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -1 : 1;
    setZoom(prev => {
      const newZoom = delta > 0 ? prev * 1.2 : prev / 1.2;
      return Math.max(0.1, Math.min(50, newZoom));
    });
  };

  const handleAddGradient = () => {
    if (currentSampled.length === 0) return;
    setGradients(prev => [...prev, { raw: rawGradient, sampled: currentSampled }]);
    setRawGradient([]);
    setDragStartImg(null);
    setDragEndImg(null);
  };

  const handleRemoveGradient = (idx: number) => {
    setGradients(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = () => {
    // Collect all sampled colors from all saved gradients, plus current unsaved
    const allColors: string[] = [];
    for (const g of gradients) {
      for (const c of g.sampled) {
        if (!allColors.includes(c)) allColors.push(c);
      }
    }
    // Also include current unsaved gradient if present
    for (const c of currentSampled) {
      if (!allColors.includes(c)) allColors.push(c);
    }
    if (allColors.length > 0) {
      onAddColors(allColors);
    }
    onClose();
  };

  const handleClearCurrent = () => {
    setRawGradient([]);
    setDragStartImg(null);
    setDragEndImg(null);
  };

  if (!isOpen) return null;

  const effectiveMax = Math.max(2, rawGradient.length);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/80" />

      <div className="relative z-10 bg-gray-800 border border-gray-600 rounded-lg shadow-2xl flex flex-col overflow-hidden"
        style={{ width: '90vw', height: '85vh', maxWidth: '1400px' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-white">🌈 Gradient Picker — Drag across image to capture gradients</span>
            <span className="text-xs text-gray-500">Drag to sample • Scroll to zoom • Middle-drag to pan</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg px-2" aria-label="Close gradient picker">✕</button>
        </div>

        {/* Body */}
        <div className={`${isPortrait ? 'flex flex-col' : 'flex'} flex-1 overflow-hidden`}>
          {/* Canvas area */}
          <div ref={containerRef} className="flex-1 relative overflow-hidden bg-gray-950 cursor-crosshair">
            <canvas
              ref={canvasRef}
              className="absolute inset-0"
              onMouseMove={handleMouseMove}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onMouseLeave={() => { setIsPanning(false); setHoverColor(null); if (isDragging && dragStartImg) { setIsDragging(false); const gradient = buildGradient(dragStartImg, dragEndImg || dragStartImg); setRawGradient(gradient); } }}
              onWheel={handleWheel}
              onContextMenu={(e) => e.preventDefault()}
            />

            {/* Zoom indicator */}
            <div className="absolute top-3 left-3 bg-gray-900/80 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 pointer-events-none">
              {Math.round(zoom * 100)}%
            </div>

            {/* Drag hint */}
            {isDragging && rawGradient.length === 0 && (
              <div className="absolute top-3 right-3 bg-blue-900/80 border border-blue-600 rounded px-2 py-1 text-xs text-blue-200 pointer-events-none">
                Release to capture gradient...
              </div>
            )}

            {/* Hover tooltip */}
            {hoverColor && !isPanning && !isDragging && (
              <div
                style={{
                  position: 'fixed',
                  left: cursorPos.x + 20,
                  top: cursorPos.y + 20,
                  zIndex: 99999,
                  pointerEvents: 'none',
                }}
                className="bg-gray-900 border border-gray-600 rounded-lg p-2 shadow-xl flex items-center gap-3"
              >
                <div
                  className="w-8 h-8 rounded border border-gray-500 flex-shrink-0"
                  style={{ backgroundColor: hoverColor }}
                />
                <span className="font-mono text-sm text-white font-bold">{hoverColor}</span>
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className={`${isPortrait ? 'h-56 border-t w-full' : 'w-72 border-l'} border-gray-700 flex flex-col bg-gray-800 flex-shrink-0`}>
            <div className="px-3 py-2 border-b border-gray-700">
              <span className="text-xs font-semibold text-gray-400 uppercase">Gradient Builder</span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {/* Current gradient */}
              {rawGradient.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-xs text-gray-400">
                    Captured <span className="text-white font-mono">{rawGradient.length}</span> pixels along line
                  </div>

                  {/* Full gradient preview */}
                  <div className="h-4 rounded border border-gray-600 overflow-hidden flex">
                    {rawGradient.map((c, i) => (
                      <div key={i} className="flex-1 h-full" style={{ backgroundColor: c }} />
                    ))}
                  </div>

                  {/* Sample count slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Sample count</span>
                      <span className="text-white font-mono">{sampleCount}</span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max={effectiveMax}
                      value={Math.min(sampleCount, effectiveMax)}
                      onChange={(e) => setSampleCount(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>

                  {/* Sampled preview */}
                  <div className="space-y-1">
                    <div className="text-xs text-gray-500">Sampled colors ({currentSampled.length})</div>
                    <div className="flex flex-wrap gap-1 bg-gray-900 p-1.5 rounded border border-gray-700">
                      {currentSampled.map((c, i) => (
                        <div
                          key={i}
                          className="w-6 h-6 rounded border border-gray-500 cursor-pointer hover:border-white"
                          style={{ backgroundColor: c }}
                          title={c}
                          onClick={() => navigator.clipboard.writeText(c)}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleAddGradient}
                      className="flex-1 px-2 py-1.5 bg-green-700 hover:bg-green-600 text-white text-xs font-medium rounded transition-colors"
                    >
                      Save Gradient
                    </button>
                    <button
                      onClick={handleClearCurrent}
                      className="px-2 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-gray-500 text-center py-4">
                  Click and drag across the image to capture a gradient line.
                </div>
              )}

              {/* Saved gradients */}
              {gradients.length > 0 && (
                <div className="space-y-2 border-t border-gray-700 pt-2">
                  <div className="text-xs font-semibold text-gray-400 uppercase">Saved Gradients ({gradients.length})</div>
                  {gradients.map((g, gIdx) => (
                    <div key={gIdx} className="bg-gray-900 rounded p-2 space-y-1 group">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">#{gIdx + 1} — {g.sampled.length} colors</span>
                        <button
                          onClick={() => handleRemoveGradient(gIdx)}
                          className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-sm"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="h-3 rounded overflow-hidden flex">
                        {g.raw.map((c, i) => (
                          <div key={i} className="flex-1 h-full" style={{ backgroundColor: c }} />
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-0.5">
                        {g.sampled.map((c, i) => (
                          <div
                            key={i}
                            className="w-4 h-4 border border-gray-600 cursor-pointer hover:border-white"
                            style={{ backgroundColor: c }}
                            title={c}
                            onClick={() => navigator.clipboard.writeText(c)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className={`${isPortrait ? 'flex items-center gap-2 p-2' : 'p-3 space-y-2'} border-t border-gray-700 flex-shrink-0`}>
              <button
                onClick={handleSubmit}
                disabled={gradients.length === 0 && currentSampled.length === 0}
                className={`${isPortrait ? 'flex-1' : 'w-full'} px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-semibold rounded transition-colors`}
              >
                Add to Palette
              </button>
              <button
                onClick={() => { setGradients([]); handleClearCurrent(); }}
                disabled={gradients.length === 0 && rawGradient.length === 0}
                className={`${isPortrait ? 'flex-shrink-0' : 'w-full'} px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-gray-300 text-xs rounded transition-colors`}
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GradientPickerModal;
