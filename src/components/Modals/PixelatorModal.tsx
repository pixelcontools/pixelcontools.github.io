import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import DraggableModal from './DraggableModal';
import EyedropperModal from './EyedropperModal';
import { usePortraitMode } from '../../hooks/usePortraitMode';
import useCompositorStore from '../../store/compositorStore';
import { Layer } from '../../types/compositor.types';
import PixelatorWorker from '../../workers/pixelator.worker?worker';

interface PixelatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  layer: Layer;
}

const GEOPIXELS_PALETTE = [
  "#FFFFFF", "#F4F59F", "#FFCA3A", "#FF9F1C", "#FF595E", "#E71D36", "#F3BBC2", "#FF85A1", "#BD637D", "#CDB4DB", "#6A4C93", "#4D194D", "#A8D0DC", "#2EC4B6", "#1A535C", "#6D9DCD", "#1982C4", "#A1C181", "#8AC926", "#A0A0A0", "#6B4226", "#505050", "#CFD078", "#145A7A", "#8B1D24", "#C07F7A", "#C49A6C", "#5B7B1C", "#000000"
];

const WPLACE_PALETTE = [
  "#000000", "#3c3c3c", "#787878", "#aaaaaa", "#d2d2d2", "#ffffff", "#600018", "#a50e1e", "#ed1c24", "#fa8072", "#e45c1a", "#ff7f27", "#f6aa09", "#f9dd3b", "#fffabc", "#9c8431", "#c5ad31", "#e8d45f", "#4a6b3a", "#5a944a", "#84c573", "#0eb968", "#13e67b", "#87ff5e", "#0c816e", "#10aea6", "#13e1be", "#0f799f", "#60f7f2", "#bbfaf2", "#28509e", "#4093e4", "#7dc7ff", "#4d31b8", "#6b50f6", "#99b1fb", "#4a4284", "#7a71c4", "#b5aef1", "#780c99", "#aa38b9", "#e09ff9", "#cb007a", "#ec1f80", "#f38da9", "#9b5249", "#d18078", "#fab6a4", "#684634", "#95682a", "#dba463", "#7b6352", "#9c846b", "#d6b594", "#d18051", "#f8b277", "#ffc5a5", "#6d643f", "#948c6b", "#cdc59e", "#333941", "#6d758d", "#b3b9d1"
];

const WPLACE_FREE_PALETTE = [
  "#000000", "#3c3c3c", "#787878", "#d2d2d2", "#ffffff", "#600018", "#ed1c24", "#ff7f27", "#f6aa09", "#f9dd3b", "#fffabc", "#0eb968", "#13e67b", "#87ff5e", "#0c816e", "#10aea6", "#13e1be", "#60f7f2", "#28509e", "#4093e4", "#6b50f6", "#99b1fb", "#780c99", "#aa38b9", "#e09ff9", "#cb007a", "#ec1f80", "#f38da9", "#684634", "#95682a", "#f8b277"
];

const COLOR_MATCH_ALGORITHMS = [
  { value: 'oklab', label: 'OKLab (perceptual)', desc: 'Modern perceptual — best all-round accuracy' },
  { value: 'ciede2000', label: 'CIEDE2000', desc: 'Gold standard — great for skin tones and gradients' },
  { value: 'cie94', label: 'CIE94 (graphics)', desc: 'Industry standard — weights chroma/hue over lightness' },
  { value: 'cie76', label: 'CIE76 (euclidean)', desc: 'Simple Euclidean in Lab space — fast but less accurate' },
];

const DITHER_ALGORITHMS = [
  { value: 'none', label: 'None (Nearest Color)' },
  { value: 'floyd-steinberg', label: 'Floyd-Steinberg' },
  { value: 'burkes', label: 'Burkes' },
  { value: 'stucki', label: 'Stucki' },
  { value: 'sierra-2', label: 'Sierra-2' },
  { value: 'sierra-lite', label: 'Sierra Lite' },
  { value: 'bayer-4x4', label: 'Bayer 4x4' },
  { value: 'bayer-8x8', label: 'Bayer 8x8' },
  { value: 'halftone-dot', label: 'Halftone Dot' },
  { value: 'diagonal-line', label: 'Diagonal Line' },
  { value: 'cross-hatch', label: 'Cross Hatch' },
  { value: 'grid', label: 'Grid' },
];

const COMMON_HEIGHTS = [
  64, 100, 128, 150, 200, 250, 256, 300, 350, 400, 450, 500,
  512, 550, 600, 650, 700, 750, 800, 850, 900, 950, 1000
];

const PixelatorModal: React.FC<PixelatorModalProps> = ({ isOpen, onClose, layer }) => {
  const updateLayer = useCompositorStore((state) => state.updateLayer);
  const isPortrait = usePortraitMode();

  // State
  const [targetHeight, setTargetHeight] = useState<number>(128);
  const [originalHeight, setOriginalHeight] = useState<number>(128);
  const [resamplingMethod, setResamplingMethod] = useState<'nearest' | 'bilinear' | 'lanczos'>('bilinear');
  const [ditherMethod, setDitherMethod] = useState<string>('none');
  const [ditherStrength, setDitherStrength] = useState<number>(100);
  const [preprocessingMethod, setPreprocessingMethod] = useState<'none' | 'bilateral' | 'kuwahara' | 'median'>('none');
  const [preprocessingStrength, setPreprocessingStrength] = useState<number>(50);
  const [paletteMode, setPaletteMode] = useState<'geopixels' | 'wplace' | 'wplace-free' | 'custom' | 'geopixels+custom' | 'none'>('geopixels');
  const [customPaletteInput, setCustomPaletteInput] = useState<string>('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [resultDimensions, setResultDimensions] = useState<{ width: number; height: number } | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [zoom, setZoom] = useState<number>(1);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [displayHeight, setDisplayHeight] = useState(String(targetHeight));
  const [isPaletteVisualizationOpen, setIsPaletteVisualizationOpen] = useState(true);
  const [useKmeans, setUseKmeans] = useState<boolean>(false);
  const [kmeansColors, setKmeansColors] = useState<number>(16);
  const [suggestedColors, setSuggestedColors] = useState<string[]>([]);
  const [suggestCount, setSuggestCount] = useState<number>(8);
  const [isSuggesting, setIsSuggesting] = useState<boolean>(false);
  const [preferDistinctColors, setPreferDistinctColors] = useState<boolean>(true);
  const [hasSemiTransparent, setHasSemiTransparent] = useState<boolean>(false);
  const [autoUpdate, setAutoUpdate] = useState<boolean>(true);
  const [colorStats, setColorStats] = useState<Map<string, { count: number, percent: number }>>(new Map());
  const [hoveredColor, setHoveredColor] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number, y: number } | null>(null);
  const [generatedPalette, setGeneratedPalette] = useState<string[]>([]);
  const [hasInitialFit, setHasInitialFit] = useState<boolean>(false);
  const [pinFitToScreen, setPinFitToScreen] = useState<boolean>(true);
  const [filterTrivialColors, setFilterTrivialColors] = useState<boolean>(false);

  // Extra Features State
  const [isExtraFeaturesOpen, setIsExtraFeaturesOpen] = useState<boolean>(false);
  const [brightness, setBrightness] = useState<number>(0);
  const [contrast, setContrast] = useState<number>(0);
  const [saturation, setSaturation] = useState<number>(0);
  const [colorMatchAlgorithm, setColorMatchAlgorithm] = useState<string>('oklab');
  const [preserveDetailThreshold, setPreserveDetailThreshold] = useState<number>(0);

  // Eyedropper modal state
  const [isEyedropperOpen, setIsEyedropperOpen] = useState<boolean>(false);

  const workerRef = useRef<Worker | null>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Track previous state to restore K-Means when switching back to 'none'
  const wasKmeansEnabledRef = useRef<boolean>(false);
  const prevPaletteModeRef = useRef<string>(paletteMode);
  const debounceTimeRef = useRef<number>(750);

  const analyzePreviewColors = (imageData: ImageData) => {
    const data = imageData.data;
    const stats = new Map<string, number>();
    let totalPixels = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (a === 0) continue; // Skip transparent

      // Convert to hex
      const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
      stats.set(hex, (stats.get(hex) || 0) + 1);
      totalPixels++;
    }

    const result = new Map<string, { count: number, percent: number }>();
    stats.forEach((count, hex) => {
      result.set(hex, {
        count,
        percent: totalPixels > 0 ? (count / totalPixels) * 100 : 0
      });
    });

    setColorStats(result);
  };

  // Initialize Worker
  useEffect(() => {
    workerRef.current = new PixelatorWorker();
    if (workerRef.current) {
      workerRef.current.onmessage = (e) => {
        const { type, imageData, message, suggestions, generatedPalette } = e.data;
        if (type === 'success') {
          // Convert ImageData back to Data URL for display
          const canvas = document.createElement('canvas');
          canvas.width = imageData.width;
          canvas.height = imageData.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.putImageData(imageData, 0, 0);

            // Update dimensions immediately to avoid flash
            setImageDimensions({ width: imageData.width, height: imageData.height });
            setResultDimensions({ width: imageData.width, height: imageData.height });

            // Calculate zoom immediately if pinned
            if (pinFitToScreen) {
              const newZoom = calculateFitZoom(imageData.width, imageData.height);
              setZoom(newZoom);
            }

            setPreviewImage(canvas.toDataURL());
            analyzePreviewColors(imageData);

            if (generatedPalette) {
              setGeneratedPalette(generatedPalette);
            } else {
              setGeneratedPalette([]);
            }
          }
        } else if (type === 'suggestions') {
          setSuggestedColors(suggestions);
          setIsSuggesting(false);
        } else {
          console.error('Pixelator Worker Error:', message);
          setIsSuggesting(false);
        }
        setIsProcessing(false);
      };
    }

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  // Sync display height when targetHeight changes
  useEffect(() => {
    setDisplayHeight(String(targetHeight));
  }, [targetHeight]);

  // Load cached custom palette on mount
  useEffect(() => {
    const cached = localStorage.getItem('pixelator_custom_palette');
    if (cached) {
      setCustomPaletteInput(cached);
    }
  }, []);

  // Initialize original height from layer dimensions
  useEffect(() => {
    if (isOpen && layer.imageData) {
      const img = new Image();
      img.onload = () => {
        setOriginalHeight(img.height);
        setTargetHeight(128);
      };
      img.src = layer.imageData;
    }
  }, [isOpen, layer.imageData]);

  // Save custom palette to localStorage on change
  useEffect(() => {
    if (customPaletteInput.trim()) {
      localStorage.setItem('pixelator_custom_palette', customPaletteInput);
    }
  }, [customPaletteInput]);

  // Helper to parse custom palette
  const getPalette = useCallback(() => {
    if (paletteMode === 'none') return [];
    if (paletteMode === 'geopixels') return GEOPIXELS_PALETTE;
    if (paletteMode === 'wplace') return WPLACE_PALETTE;
    if (paletteMode === 'wplace-free') return WPLACE_FREE_PALETTE;

    // Parse custom input
    const rawInput = customPaletteInput.trim();
    let customColors: string[] = [];

    if (rawInput) {
      // Split by comma, space, or newline to handle various formats
      const parts = rawInput.split(/[\s,]+/).filter(s => s.trim() !== '');

      customColors = parts.map(s => {
        const trimmed = s.trim();

        // Check if it's a decimal integer (e.g. "16777215")
        if (/^\d+$/.test(trimmed)) {
          const decimal = parseInt(trimmed, 10);
          // Ensure it's a valid 24-bit color
          if (decimal >= 0 && decimal <= 16777215) {
            return '#' + decimal.toString(16).padStart(6, '0').toUpperCase();
          }
        }

        // Check if it's a hex code (e.g. "#FFFFFF" or "FFFFFF")
        if (/^#?[0-9A-F]{6}$/i.test(trimmed)) {
          return trimmed.startsWith('#') ? trimmed.toUpperCase() : '#' + trimmed.toUpperCase();
        }

        return null;
      }).filter((c): c is string => c !== null);
    }

    if (paletteMode === 'custom') return customColors;
    if (paletteMode === 'geopixels+custom') {
      // Merge geopixels base with custom, removing duplicates
      const merged = [...GEOPIXELS_PALETTE];
      for (const color of customColors) {
        if (!merged.includes(color.toUpperCase())) {
          merged.push(color.toUpperCase());
        }
      }
      return merged;
    }

    return [];
  }, [paletteMode, customPaletteInput]);

  // Handle K-Means state when palette mode changes
  useEffect(() => {
    // Leaving 'none' mode
    if (prevPaletteModeRef.current === 'none' && paletteMode !== 'none') {
      if (useKmeans) {
        wasKmeansEnabledRef.current = true;
        setUseKmeans(false);
      } else {
        wasKmeansEnabledRef.current = false;
      }
    }
    // Entering 'none' mode
    else if (prevPaletteModeRef.current !== 'none' && paletteMode === 'none') {
      if (wasKmeansEnabledRef.current) {
        setUseKmeans(true);
      }
    }
    // Ensure K-Means is off if not in 'none' mode (cleanup/safety)
    else if (paletteMode !== 'none' && useKmeans) {
      setUseKmeans(false);
    }

    prevPaletteModeRef.current = paletteMode;
  }, [paletteMode, useKmeans]);

  // Trigger Processing
  const processImage = useCallback(() => {
    if (!workerRef.current || !layer.imageData) return;

    setIsProcessing(true);

    // Load image to get ImageData
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);

      // Check for semi-transparent pixels
      setHasSemiTransparent(checkForSemiTransparentPixels(imageData));

      const palette = getPalette();

      // Calculate target width based on aspect ratio
      const aspectRatio = img.width / img.height;
      const targetWidth = Math.round(targetHeight * aspectRatio);

      workerRef.current?.postMessage({
        imageData,
        settings: {
          targetWidth,
          targetHeight,
          ditherMethod,
          ditherStrength,
          palette,
          resamplingMethod,
          useKmeans,
          kmeansColors,
          brightness,
          contrast,
          saturation,
          preprocessingMethod,
          preprocessingStrength,
          filterTrivialColors,
          colorMatchAlgorithm,
          preserveDetailThreshold,
          colorStats: filterTrivialColors ? Array.from(colorStats.entries()).map(([c, s]) => ({ color: c, percent: s.percent })) : []
        }
      });
    };
    img.src = layer.imageData;

  }, [layer.imageData, targetHeight, ditherMethod, ditherStrength, getPalette, resamplingMethod, useKmeans, kmeansColors, brightness, contrast, saturation, preprocessingMethod, preprocessingStrength, filterTrivialColors, colorMatchAlgorithm, preserveDetailThreshold]);

  // Debounced Effect
  useEffect(() => {
    if (!isOpen || !autoUpdate) return;

    const timer = setTimeout(() => {
      processImage();
      debounceTimeRef.current = 750; // Reset to default after execution
    }, debounceTimeRef.current);

    return () => clearTimeout(timer);
  }, [
    isOpen,
    autoUpdate,
    targetHeight,
    ditherMethod,
    ditherStrength,
    paletteMode,
    customPaletteInput,
    resamplingMethod,
    useKmeans,
    kmeansColors,
    brightness,
    contrast,
    saturation,
    preprocessingMethod,
    preprocessingStrength,
    filterTrivialColors,
    colorMatchAlgorithm,
    preserveDetailThreshold,
    processImage
  ]);

  const handleApply = () => {
    if (previewImage && resultDimensions) {
      updateLayer(layer.id, {
        imageData: previewImage,
        width: resultDimensions.width,
        height: resultDimensions.height
      });
      onClose();
    }
  };

  const calculateFitZoom = useCallback((width: number, height: number) => {
    if (!previewContainerRef.current) return 1;

    const containerWidth = previewContainerRef.current.clientWidth;
    const containerHeight = previewContainerRef.current.clientHeight;

    // Add some padding (e.g., 40px total)
    const availableWidth = containerWidth - 40;
    const availableHeight = containerHeight - 40;

    if (availableWidth <= 0 || availableHeight <= 0) return 1;

    const scaleX = availableWidth / width;
    const scaleY = availableHeight / height;

    // Use the smaller scale to ensure it fits entirely
    const newZoom = Math.min(scaleX, scaleY);

    return Math.max(0.1, newZoom);
  }, []);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.5, 20));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.5, 0.5));
  const handleZoomReset = () => setZoom(1);
  const handleFitToScreen = useCallback(() => {
    if (!imageDimensions) return;
    setZoom(calculateFitZoom(imageDimensions.width, imageDimensions.height));
  }, [imageDimensions, calculateFitZoom]);

  // Auto-fit on first load or when pinned
  useEffect(() => {
    if (imageDimensions && previewContainerRef.current) {
      if (!hasInitialFit) {
        // Small delay to ensure layout is stable
        setTimeout(() => {
          handleFitToScreen();
          setHasInitialFit(true);
        }, 50);
      }
    }
  }, [imageDimensions, hasInitialFit, handleFitToScreen]);

  const handleHeightReset = () => setTargetHeight(originalHeight);

  const checkForSemiTransparentPixels = (imageData: ImageData): boolean => {
    const data = imageData.data;
    for (let i = 3; i < data.length; i += 4) {
      const alpha = data[i];
      if (alpha > 0 && alpha < 255) {
        return true;
      }
    }
    return false;
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageDimensions({
      width: img.naturalWidth,
      height: img.naturalHeight,
    });
  };

  const handleSuggestColors = useCallback(() => {
    if (!workerRef.current || !layer.imageData) return;

    const palette = getPalette();
    if (palette.length === 0) {
      alert('Please select a palette first to find missing colors.');
      return;
    }

    setIsSuggesting(true);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);

      workerRef.current?.postMessage({
        type: 'suggest',
        imageData,
        settings: {
          palette: getPalette(),
          numSuggestions: suggestCount,
          preferDistinct: preferDistinctColors
        }
      });
    };
    img.src = layer.imageData;
  }, [layer.imageData, getPalette, suggestCount, preferDistinctColors]);

  const handleAddSuggestedToCustom = () => {
    const existingText = customPaletteInput.trim();
    const newColors = suggestedColors.join(', ');

    if (existingText === '') {
      setCustomPaletteInput(newColors);
    } else {
      setCustomPaletteInput(`${existingText}, ${newColors}`);
    }
  };

  const sortedPalette = useMemo(() => {
    let currentPalette = getPalette();

    // Use generated palette if available and we're in 'none' mode with K-Means
    if (paletteMode === 'none' && useKmeans && generatedPalette.length > 0) {
      currentPalette = generatedPalette;
    }

    if (colorStats.size === 0) return currentPalette;

    return [...currentPalette].sort((a, b) => {
      const countA = colorStats.get(a)?.count || 0;
      const countB = colorStats.get(b)?.count || 0;

      // Sort by count descending
      if (countA !== countB) {
        return countB - countA;
      }

      // If counts are equal, keep original order (stable sort)
      return 0;
    });
  }, [getPalette, colorStats, generatedPalette, paletteMode, useKmeans]);

  const handleCopyPalette = () => {
    if (sortedPalette.length > 0) {
      navigator.clipboard.writeText(sortedPalette.join(', '));
    }
  };

  // Eyedropper: add picked colors to custom palette text field
  const handleEyedropperColors = (colors: string[]) => {
    if (colors.length === 0) return;
    const newColors = colors.join(', ');
    const existing = customPaletteInput.trim();
    if (existing === '') {
      setCustomPaletteInput(newColors);
    } else {
      setCustomPaletteInput(`${existing}, ${newColors}`);
    }
    // Auto-switch to custom or geopixels+custom if not already
    if (paletteMode !== 'custom' && paletteMode !== 'geopixels+custom') {
      debounceTimeRef.current = 100;
      setPaletteMode('geopixels+custom');
    }
  };

  // K-Means: Send generated palette colors to Geopixels+Custom text field
  const handleSendKmeansToCustom = () => {
    if (generatedPalette.length === 0) return;
    const newColors = generatedPalette.join(', ');
    const existing = customPaletteInput.trim();
    if (existing === '') {
      setCustomPaletteInput(newColors);
    } else {
      setCustomPaletteInput(`${existing}, ${newColors}`);
    }
    // Switch to Geopixels + Custom mode
    debounceTimeRef.current = 100;
    setPaletteMode('geopixels+custom');
  };

  return (
    <DraggableModal isOpen={isOpen} title="Pixelator" onClose={onClose} noPadding={true} modalId="modal-pixelator" children={() => (
      <div className={`${isPortrait ? 'flex flex-col-reverse' : 'flex'} text-gray-200 h-full w-full overflow-hidden`}>
        {/* Controls */}
        <div className={`${isPortrait ? 'border-t max-h-[45vh]' : 'w-72 border-r'} border-gray-700 flex-shrink-0 flex flex-col overflow-hidden`}>
          {/* Scrollable content area */}
          <div className="overflow-y-auto flex-1 p-4 space-y-6 text-gray-200">

            {/* Dimensions */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase">Dimensions</label>
              <div className="space-y-2">
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500">Height (px)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={displayHeight}
                      onChange={(e) => {
                        // Update display value
                        setDisplayHeight(e.target.value);
                        // Only update state if it's a valid number
                        if (e.target.value !== '' && e.target.value !== '-') {
                          const value = Number(e.target.value);
                          if (!isNaN(value) && value > 0) {
                            setTargetHeight(value);
                          }
                        }
                      }}
                      className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
                    />
                  </div>
                  <select
                    className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-gray-400"
                    onChange={(e) => {
                      if (e.target.value) {
                        debounceTimeRef.current = 100; // Fast update for dropdown
                        setTargetHeight(Number(e.target.value));
                      }
                    }}
                    value={COMMON_HEIGHTS.includes(targetHeight) ? targetHeight : ""}
                  >
                    <option value="" disabled>common sizes</option>
                    {COMMON_HEIGHTS.map(h => (
                      <option key={h} value={h}>{h}px</option>
                    ))}
                  </select>
                  <button
                    onClick={handleHeightReset}
                    className="text-xs px-2 py-1 text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 rounded transition-colors whitespace-nowrap flex-shrink-0"
                    title="Reset height to default"
                  >
                    Reset
                  </button>
                </div>

                {resultDimensions && (
                  <div className="text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded whitespace-nowrap">
                    {resultDimensions.width} × {resultDimensions.height} <span className="text-gray-600 mx-1">|</span> {(resultDimensions.width * resultDimensions.height).toLocaleString()} px
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-500">Resampling</label>
                <select
                  value={resamplingMethod}
                  onChange={(e) => setResamplingMethod(e.target.value as any)}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
                >
                  <option value="nearest">Nearest Neighbor (Sharp)</option>
                  <option value="bilinear">Bilinear (Smooth)</option>
                  <option value="lanczos">Lanczos (High Quality)</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">Color Matching</label>
                <select
                  value={colorMatchAlgorithm}
                  onChange={(e) => { debounceTimeRef.current = 100; setColorMatchAlgorithm(e.target.value); }}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
                  title={COLOR_MATCH_ALGORITHMS.find(a => a.value === colorMatchAlgorithm)?.desc}
                >
                  {COLOR_MATCH_ALGORITHMS.map(a => (
                    <option key={a.value} value={a.value}>{a.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Semi-Transparent Warning */}
            {hasSemiTransparent && (
              <div className="bg-yellow-900/30 border border-yellow-700 rounded p-3 flex gap-3">
                <div className="text-yellow-500 text-xl flex-shrink-0">⚠️</div>
                <div className="text-xs text-yellow-300">
                  <p className="font-semibold mb-1">Semi-transparent pixels detected</p>
                  <p>Apply a transparency mask first for better results</p>
                </div>
              </div>
            )}

            {/* Palette */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-400 uppercase">Palette</label>
                {paletteMode === 'geopixels+custom' && (
                  <div className="group relative">
                    <span className="cursor-help text-xs text-blue-400">Fun Fact?</span>
                    <div className="absolute bottom-full right-0 mb-2 w-64 p-2 bg-gray-900 border border-gray-600 rounded shadow-xl text-xs text-gray-300 hidden group-hover:block z-50">
                      If you play on Geopixels, you can export your palette by typing <code className="text-yellow-400">userData.colors</code> in the browser console. Paste the result here!
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col space-y-1">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="palette"
                    checked={paletteMode === 'geopixels'}
                    onChange={() => { debounceTimeRef.current = 100; setPaletteMode('geopixels'); }}
                  />
                  <span className="text-sm">Geopixels Base</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="palette"
                    checked={paletteMode === 'wplace-free'}
                    onChange={() => { debounceTimeRef.current = 100; setPaletteMode('wplace-free'); }}
                  />
                  <span className="text-sm">WPlace Free <span className="text-gray-500 text-xs">(31 colors)</span></span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="palette"
                    checked={paletteMode === 'wplace'}
                    onChange={() => { debounceTimeRef.current = 100; setPaletteMode('wplace'); }}
                  />
                  <span className="text-sm">WPlace All <span className="text-gray-500 text-xs">(63 colors)</span></span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="palette"
                    checked={paletteMode === 'custom'}
                    onChange={() => { debounceTimeRef.current = 100; setPaletteMode('custom'); }}
                  />
                  <span className="text-sm">Custom</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="palette"
                    checked={paletteMode === 'geopixels+custom'}
                    onChange={() => { debounceTimeRef.current = 100; setPaletteMode('geopixels+custom'); }}
                  />
                  <span className="text-sm">Geopixels Base + Custom</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="palette"
                    checked={paletteMode === 'none'}
                    onChange={() => { debounceTimeRef.current = 100; setPaletteMode('none'); }}
                  />
                  <span className="text-sm">No Recoloring (Resize Only)</span>
                </label>
              </div>

              {(paletteMode === 'custom' || paletteMode === 'geopixels+custom') && (
                <div className="space-y-2">
                  <textarea
                    value={customPaletteInput}
                    onChange={(e) => setCustomPaletteInput(e.target.value)}
                    placeholder="#FFFFFF, #000000 or 16777215, 0"
                    className="w-full h-24 bg-gray-800 border border-gray-600 rounded p-2 text-xs font-mono"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsEyedropperOpen(true)}
                      className="flex-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium rounded transition-colors"
                    >
                      Eyedropper
                    </button>
                    <div className="group relative">
                      <span className="cursor-help text-xs text-blue-400">?</span>
                      <div className="absolute bottom-full right-0 mb-2 w-52 p-2 bg-gray-900 border border-gray-600 rounded shadow-xl text-xs text-gray-300 hidden group-hover:block z-50">
                        Select colors to use from template image
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Palette Visualization */}
              <div className="border-t border-gray-700 pt-2">
                <div className="flex items-center justify-between mb-2">
                  <button
                    onClick={() => setIsPaletteVisualizationOpen(!isPaletteVisualizationOpen)}
                    className="flex items-center text-xs text-gray-400 hover:text-gray-300"
                  >
                    <span>Palette Preview</span>
                    <span className="ml-1">{isPaletteVisualizationOpen ? '▼' : '▶'}</span>
                  </button>
                  <button
                    onClick={handleCopyPalette}
                    className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700"
                    title="Copy palette to clipboard"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m2 4h3a2 2 0 012 2v3m-3-3V5a2 2 0 012-2h3.071a2 2 0 011.414.586l1.414 1.414A2 2 0 0118 6.414V9m-3-3h3" />
                    </svg>
                  </button>
                </div>

                {isPaletteVisualizationOpen && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-0 bg-gray-900 p-1 rounded border border-gray-700">
                      {sortedPalette.length > 0 ? (
                        sortedPalette.map((color, idx) => (
                          <div
                            key={idx}
                            className="w-4 h-4 cursor-crosshair hover:z-10 hover:scale-125 transition-transform duration-75 border border-transparent hover:border-white"
                            style={{ backgroundColor: color }}
                            onMouseEnter={(e) => {
                              setHoveredColor(color);
                              setHoverPos({ x: e.clientX, y: e.clientY });
                            }}
                            onMouseLeave={() => {
                              setHoveredColor(null);
                              setHoverPos(null);
                            }}
                            onMouseMove={(e) => {
                              setHoverPos({ x: e.clientX, y: e.clientY });
                            }}
                          />
                        ))
                      ) : (
                        <div className="text-xs text-gray-500 p-2">No palette selected</div>
                      )}
                    </div>

                    {/* Hover Tooltip */}
                    {hoveredColor && hoverPos && (
                      <div
                        style={{
                          position: 'fixed',
                          left: hoverPos.x + 15,
                          top: hoverPos.y + 15,
                          zIndex: 9999,
                          pointerEvents: 'none'
                        }}
                        className="bg-gray-900 border border-gray-600 rounded p-2 shadow-xl text-xs min-w-[120px]"
                      >
                        <div className="flex items-center gap-2 mb-1 pb-1 border-b border-gray-700">
                          <div
                            className="w-3 h-3 border border-gray-500"
                            style={{ backgroundColor: hoveredColor }}
                          />
                          <span className="font-mono font-bold text-white">{hoveredColor}</span>
                        </div>
                        {colorStats.has(hoveredColor) ? (
                          <div className="text-gray-300 space-y-0.5">
                            <div className="flex justify-between gap-4">
                              <span>Count:</span>
                              <span className="text-white font-mono">{colorStats.get(hoveredColor)?.count.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span>Usage:</span>
                              <span className="text-white font-mono">{colorStats.get(hoveredColor)?.percent.toFixed(2)}%</span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-gray-500 italic">Not used in preview</div>
                        )}
                      </div>
                    )}

                    {(paletteMode === 'custom' || paletteMode === 'geopixels+custom') && (
                      <div className="space-y-2 border-t border-gray-700 pt-2">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={filterTrivialColors}
                            onChange={(e) => setFilterTrivialColors(e.target.checked)}
                            className="rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-800"
                            title="Ignore colors below 0.1% usage during processing"
                          />
                          <span className="text-xs text-gray-400">Filter trivial colors (&lt;0.1%)</span>
                        </label>
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-xs font-semibold text-gray-400 uppercase whitespace-nowrap">Suggest Colors</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="1"
                              max="32"
                              value={suggestCount}
                              onChange={(e) => setSuggestCount(Math.max(1, Math.min(32, Number(e.target.value))))}
                              className="w-12 bg-gray-800 border border-gray-600 rounded px-1 py-0.5 text-xs text-center"
                              title="Number of colors to suggest"
                            />
                            <button
                              onClick={handleSuggestColors}
                              disabled={isSuggesting}
                              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-xs rounded transition-colors"
                            >
                              {isSuggesting ? '...' : 'Go'}
                            </button>
                          </div>
                        </div>
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={preferDistinctColors}
                            onChange={(e) => setPreferDistinctColors(e.target.checked)}
                            className="rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-800"
                            title="Prioritize colors that are distinct from each other"
                          />
                          <span className="text-xs text-gray-400">Prefer distinct color suggestions</span>
                        </label>

                        {suggestedColors.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-1 bg-gray-900 p-2 rounded border border-gray-700">
                              {suggestedColors.map((color, idx) => (
                                <div
                                  key={idx}
                                  className="w-8 h-8 rounded border border-gray-500 cursor-pointer hover:border-white"
                                  style={{ backgroundColor: color }}
                                  title={`${color} - Click to copy`}
                                  onClick={() => {
                                    navigator.clipboard.writeText(color);
                                  }}
                                />
                              ))}
                            </div>
                            <button
                              onClick={handleAddSuggestedToCustom}
                              className="w-full px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded transition-colors"
                            >
                              Add to Custom Palette
                            </button>
                          </div>
                        )}

                        <p className="text-xs text-gray-500">Analyzes the image to find dominant colors missing from your palette.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Dithering */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase">Dithering</label>
              <select
                value={ditherMethod}
                onChange={(e) => { debounceTimeRef.current = 100; setDitherMethod(e.target.value); }}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
              >
                {DITHER_ALGORITHMS.map(algo => (
                  <option key={algo.value} value={algo.value}>{algo.label}</option>
                ))}
              </select>

              {ditherMethod !== 'none' && (
                <div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Strength</span>
                    <span>{ditherStrength}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={ditherStrength}
                    onChange={(e) => setDitherStrength(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
              )}
            </div>

            {/* K-Means Clustering */}
            <div className="space-y-2">
              <div className="group relative inline-block w-full">
                <label className={`flex items-center space-x-2 ${paletteMode !== 'none' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                  <input
                    type="checkbox"
                    checked={useKmeans}
                    onChange={(e) => setUseKmeans(e.target.checked)}
                    disabled={paletteMode !== 'none'}
                  />
                  <span className="text-xs font-semibold text-gray-400 uppercase">K-Means Color Reduction</span>
                </label>
                {paletteMode !== 'none' && (
                  <div className="absolute bottom-full left-0 mb-2 w-64 p-2 bg-gray-900 border border-gray-600 rounded shadow-xl text-xs text-gray-300 hidden group-hover:block z-50">
                    K-Means is only available when "No Recoloring" is selected. It's used to reduce the color space when you're not providing a specific palette.
                  </div>
                )}
              </div>

              {useKmeans && (
                <div>
                  <label className="text-xs text-gray-500">Number of Colors</label>
                  <input
                    type="number"
                    min="2"
                    max="256"
                    value={kmeansColors}
                    onChange={(e) => setKmeansColors(Number(e.target.value))}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">Reduces image to N dominant colors before applying palette/dithering.</p>

                  {generatedPalette.length > 0 && (
                    <button
                      onClick={handleSendKmeansToCustom}
                      className="w-full mt-2 px-3 py-1.5 bg-teal-700 hover:bg-teal-600 text-white text-xs font-medium rounded transition-colors"
                      title="Send K-Means palette to Geopixels Base + Custom"
                    >
                      Send Colors to Geopixels Custom Palette
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Extra Features */}
            <div className="space-y-2 border-t border-gray-700 pt-2">
              <button
                onClick={() => setIsExtraFeaturesOpen(!isExtraFeaturesOpen)}
                className="flex items-center justify-between w-full text-xs font-semibold text-gray-400 hover:text-gray-300 uppercase"
              >
                <span>Extra Features</span>
                <span>{isExtraFeaturesOpen ? '▼' : '▶'}</span>
              </button>

              {isExtraFeaturesOpen && (
                <div className="space-y-3 pt-2">
                  <div className="border-b border-gray-700 pb-3">
                    <label className="text-xs font-semibold text-gray-400 uppercase mb-2 block">Pre-processing (Experimental)</label>
                    <select
                      value={preprocessingMethod}
                      onChange={(e) => { debounceTimeRef.current = 100; setPreprocessingMethod(e.target.value as any); }}
                      className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm mb-2"
                      title="Apply filters before pixelation to improve results (may impact performance)"
                    >
                      <option value="none">None</option>
                      <option value="kuwahara">Kuwahara (Oil Paint / Flatten)</option>
                      <option value="median">Median (De-noise / Smooth)</option>
                      <option value="bilateral">Bilateral (Soft Blur)</option>
                    </select>

                    {preprocessingMethod !== 'none' && (
                      <div>
                        <div className="flex justify-between text-xs text-gray-500 mb-2">
                          <span>Intensity</span>
                          <span>{preprocessingStrength}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={preprocessingStrength}
                          onChange={(e) => { debounceTimeRef.current = 100; setPreprocessingStrength(Number(e.target.value)); }}
                          className="w-full"
                        />
                        <p className="text-xs text-gray-500 mt-2">
                          {preprocessingMethod === 'bilateral' && 'Smooths surfaces while keeping edges. Good for photographs.'}
                          {preprocessingMethod === 'kuwahara' && 'Best for Pixel Art. Creates flat, "painted" clusters of color.'}
                          {preprocessingMethod === 'median' && 'Removes noise and small details. Great for cleaning up JPEGs before pixelating.'}
                        </p>
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Brightness</span>
                      <div className="flex items-center gap-2">
                        <span>{brightness}</span>
                        <button
                          onClick={() => setBrightness(0)}
                          className="text-gray-500 hover:text-white disabled:opacity-0 transition-opacity"
                          title="Reset Brightness"
                          disabled={brightness === 0}
                        >
                          ↺
                        </button>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      value={brightness}
                      onChange={(e) => setBrightness(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Contrast</span>
                      <div className="flex items-center gap-2">
                        <span>{contrast}</span>
                        <button
                          onClick={() => setContrast(0)}
                          className="text-gray-500 hover:text-white disabled:opacity-0 transition-opacity"
                          title="Reset Contrast"
                          disabled={contrast === 0}
                        >
                          ↺
                        </button>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      value={contrast}
                      onChange={(e) => setContrast(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Saturation</span>
                      <div className="flex items-center gap-2">
                        <span>{saturation}</span>
                        <button
                          onClick={() => setSaturation(0)}
                          className="text-gray-500 hover:text-white disabled:opacity-0 transition-opacity"
                          title="Reset Saturation"
                          disabled={saturation === 0}
                        >
                          ↺
                        </button>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      value={saturation}
                      onChange={(e) => setSaturation(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                  <div className="border-t border-gray-700 pt-3">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Preserve Detail</span>
                      <div className="flex items-center gap-2">
                        <span>ΔE≤{preserveDetailThreshold.toFixed(1)}</span>
                        <button
                          onClick={() => setPreserveDetailThreshold(0)}
                          className="text-gray-500 hover:text-white disabled:opacity-0 transition-opacity"
                          title="Reset Preserve Detail"
                          disabled={preserveDetailThreshold === 0}
                        >
                          ↺
                        </button>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="5"
                      step="0.1"
                      value={preserveDetailThreshold}
                      onChange={(e) => { debounceTimeRef.current = 100; setPreserveDetailThreshold(Number(e.target.value)); }}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Pixels within this ΔE threshold keep their original color instead of snapping to palette. Higher = more detail preserved.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Execute button - sticky footer */}
          {!autoUpdate && (
            <div className="p-4 border-t border-gray-700 bg-gray-800/30 flex-shrink-0">
              <button
                onClick={processImage}
                className="w-full bg-green-600 hover:bg-green-500 text-white py-2 rounded font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <span>▶</span>
                <span>Execute</span>
              </button>
            </div>
          )}

        </div>

        {/* Right: Preview */}
        <div className="flex-1 bg-gray-900 relative overflow-hidden flex flex-col">
          {/* Zoom Controls */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-800/50 border-b border-gray-700 flex-shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">Preview</span>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoUpdate}
                  onChange={(e) => setAutoUpdate(e.target.checked)}
                  className="rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-800"
                />
                <span className="text-xs text-gray-400 select-none">Auto-update</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer" title="Always fit preview to screen">
                <input
                  type="checkbox"
                  checked={pinFitToScreen}
                  onChange={(e) => setPinFitToScreen(e.target.checked)}
                  className="rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-800"
                />
                <span className="text-xs text-gray-400 select-none">Pin Fit</span>
              </label>
            </div>
            <div className="flex space-x-2 items-center">
              <button onClick={handleZoomOut} className="bg-gray-700 p-1 rounded hover:bg-gray-600 text-sm font-bold" title="Zoom out">−</button>
              <span className="bg-gray-700 px-2 py-1 rounded text-sm font-mono min-w-[50px] text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={handleZoomIn} className="bg-gray-700 p-1 rounded hover:bg-gray-600 text-sm font-bold" title="Zoom in">+</button>
              <button onClick={handleFitToScreen} className="bg-gray-700 px-2 py-1 rounded hover:bg-gray-600 text-xs" title="Fit to screen">Fit</button>
              <button onClick={handleZoomReset} className="bg-gray-700 px-2 py-1 rounded hover:bg-gray-600 text-xs" title="Reset zoom">Reset</button>
            </div>
          </div>

          {isProcessing && (
            <div className="absolute top-14 right-4 z-20 pointer-events-none">
              <div className="bg-gray-900/90 border border-gray-700 text-gray-200 text-xs px-3 py-1.5 rounded shadow-lg flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                Generating...
              </div>
            </div>
          )}

          <div
            ref={previewContainerRef}
            className="flex-1 overflow-auto bg-gray-900"
          >
            {previewImage ? (
              <div
                style={{
                  display: 'inline-block',
                  padding: '20px',
                }}
              >
                <img
                  ref={imgRef}
                  src={previewImage}
                  alt="Preview"
                  onLoad={handleImageLoad}
                  style={{
                    width: imageDimensions ? `${imageDimensions.width * zoom}px` : 'auto',
                    height: imageDimensions ? `${imageDimensions.height * zoom}px` : 'auto',
                    maxWidth: 'none',
                    imageRendering: 'pixelated',
                  }}
                />
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                Click Execute to generate preview
              </div>
            )}
          </div>

          {/* Apply Button - Bottom Right */}
          <div className="px-4 py-3 bg-gray-800/50 border-t border-gray-700 flex-shrink-0">
            <button
              onClick={handleApply}
              disabled={!previewImage}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2 rounded font-semibold transition-colors"
            >
              Apply Pixelation
            </button>
          </div>
        </div>

        {/* Eyedropper Modal */}
        <EyedropperModal
          isOpen={isEyedropperOpen}
          onClose={() => setIsEyedropperOpen(false)}
          imageDataUrl={layer.imageData}
          onAddColors={handleEyedropperColors}
        />
      </div>
    )} />
  );
};

export default PixelatorModal;
