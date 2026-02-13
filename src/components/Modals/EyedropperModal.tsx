import React, { useRef, useState, useEffect, useCallback } from 'react';
import { usePortraitMode } from '../../hooks/usePortraitMode';

interface EyedropperModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageDataUrl: string;
  onAddColors: (colors: string[]) => void;
}

/**
 * Eyedropper modal for picking colors from the original image.
 * Supports zoom/pan. Hover shows color preview, click adds to a pick-list.
 */
const EyedropperModal: React.FC<EyedropperModalProps> = ({ isOpen, onClose, imageDataUrl, onAddColors }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const isPortrait = usePortraitMode();
  const [pickedColors, setPickedColors] = useState<string[]>([]);
  const [hoverColor, setHoverColor] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgSize, setImgSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  // Load image once
  useEffect(() => {
    if (!isOpen || !imageDataUrl) return;
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
      setImgLoaded(true);
      // Reset state
      setPickedColors([]);
      setZoom(1);
      setPan({ x: 0, y: 0 });
    };
    img.src = imageDataUrl;
  }, [isOpen, imageDataUrl]);

  // Auto-fit zoom on open
  useEffect(() => {
    if (!imgLoaded || !containerRef.current) return;
    const cw = containerRef.current.clientWidth - 40;
    const ch = containerRef.current.clientHeight - 40;
    if (cw <= 0 || ch <= 0 || imgSize.w <= 0 || imgSize.h <= 0) return;
    const fit = Math.min(cw / imgSize.w, ch / imgSize.h, 4);
    setZoom(fit);
  }, [imgLoaded, imgSize]);

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

    // Checkerboard background behind image
    const patternSize = 8;
    const pCanvas = document.createElement('canvas');
    pCanvas.width = patternSize * 2;
    pCanvas.height = patternSize * 2;
    const pCtx = pCanvas.getContext('2d')!;
    pCtx.fillStyle = '#3a3a3a';
    pCtx.fillRect(0, 0, patternSize * 2, patternSize * 2);
    pCtx.fillStyle = '#2a2a2a';
    pCtx.fillRect(0, 0, patternSize, patternSize);
    pCtx.fillRect(patternSize, patternSize, patternSize, patternSize);

    // Center the image
    const drawW = imgSize.w * zoom;
    const drawH = imgSize.h * zoom;
    const ox = (canvas.width - drawW) / 2 + pan.x;
    const oy = (canvas.height - drawH) / 2 + pan.y;

    // Draw checkerboard under image area
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

    // Draw image
    ctx.drawImage(img, ox, oy, drawW, drawH);
  }, [imgLoaded, imgSize, zoom, pan]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(container);
    return () => ro.disconnect();
  }, [draw]);

  // Cache the pixel data to avoid re-creating temp canvas on every mouse move
  const pixelDataRef = useRef<ImageData | null>(null);
  const pixelCanvasSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

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

  const getPixelColorFast = useCallback((clientX: number, clientY: number): string | null => {
    const canvas = canvasRef.current;
    if (!canvas || !imgLoaded || !pixelDataRef.current) return null;

    const rect = canvas.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;

    const drawW = imgSize.w * zoom;
    const drawH = imgSize.h * zoom;
    const ox = (canvas.width - drawW) / 2 + pan.x;
    const oy = (canvas.height - drawH) / 2 + pan.y;

    if (mx < ox || mx >= ox + drawW || my < oy || my >= oy + drawH) return null;

    const imgX = Math.floor((mx - ox) / zoom);
    const imgY = Math.floor((my - oy) / zoom);

    const pd = pixelDataRef.current;
    const w = pixelCanvasSizeRef.current.w;
    if (imgX < 0 || imgX >= w || imgY < 0 || imgY >= pixelCanvasSizeRef.current.h) return null;

    const idx = (imgY * w + imgX) * 4;
    const r = pd.data[idx];
    const g = pd.data[idx + 1];
    const b = pd.data[idx + 2];

    return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('').toUpperCase();
  }, [imgLoaded, imgSize, zoom, pan]);

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

    const color = getPixelColorFast(e.clientX, e.clientY);
    setHoverColor(color);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Middle click or right click to pan
    if (e.button === 1 || e.button === 2) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    // Left click to pick a color
    if (e.button === 0) {
      const color = getPixelColorFast(e.clientX, e.clientY);
      if (color && !pickedColors.includes(color)) {
        setPickedColors(prev => [...prev, color]);
      }
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -1 : 1;
    setZoom(prev => {
      const newZoom = delta > 0 ? prev * 1.2 : prev / 1.2;
      return Math.max(0.1, Math.min(50, newZoom));
    });
  };

  const handleRemoveColor = (color: string) => {
    setPickedColors(prev => prev.filter(c => c !== color));
  };

  const handleSubmit = () => {
    onAddColors(pickedColors);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80" />

      {/* Modal */}
      <div className="relative z-10 bg-gray-800 border border-gray-600 rounded-lg shadow-2xl flex flex-col overflow-hidden"
        style={{ width: '90vw', height: '85vh', maxWidth: '1400px' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-white">🎨 Eyedropper — Pick Colors from Image</span>
            <span className="text-xs text-gray-500">Click to pick • Scroll to zoom • Middle-drag to pan</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg px-2" aria-label="Close eyedropper">✕</button>
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
              onMouseLeave={() => { setIsPanning(false); setHoverColor(null); }}
              onWheel={handleWheel}
              onContextMenu={(e) => e.preventDefault()}
            />

            {/* Zoom indicator */}
            <div className="absolute top-3 left-3 bg-gray-900/80 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 pointer-events-none">
              {Math.round(zoom * 100)}%
            </div>

            {/* Hover tooltip */}
            {hoverColor && !isPanning && (
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

          {/* Picked colors sidebar */}
          <div className={`${isPortrait ? 'h-48 border-t w-full' : 'w-56 border-l'} border-gray-700 flex flex-col bg-gray-800 flex-shrink-0`}>
            <div className="px-3 py-2 border-b border-gray-700">
              <span className="text-xs font-semibold text-gray-400 uppercase">Picked Colors ({pickedColors.length})</span>
            </div>

            <div className={`flex-1 overflow-y-auto p-2 ${isPortrait ? 'flex flex-wrap gap-1' : 'space-y-1'}`}>
              {pickedColors.length === 0 ? (
                <div className="text-xs text-gray-500 text-center py-4 w-full">Click on the image to pick colors</div>
              ) : (
                pickedColors.map((color, idx) => (
                  <div key={idx} className={`flex items-center gap-2 bg-gray-900 rounded px-2 py-1.5 group ${isPortrait ? 'flex-shrink-0' : ''}`}>
                    <div
                      className="w-6 h-6 rounded border border-gray-600 flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="font-mono text-xs text-white flex-1">{color}</span>
                    <button
                      onClick={() => handleRemoveColor(color)}
                      className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-sm"
                      aria-label={`Remove ${color}`}
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className={`${isPortrait ? 'flex items-center gap-2 p-2' : 'p-3 space-y-2'} border-t border-gray-700 flex-shrink-0`}>
              <button
                onClick={handleSubmit}
                disabled={pickedColors.length === 0}
                className={`${isPortrait ? 'flex-1' : 'w-full'} px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-semibold rounded transition-colors`}
              >
                Add Colors to Palette
              </button>
              <button
                onClick={() => setPickedColors([])}
                disabled={pickedColors.length === 0}
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

export default EyedropperModal;
