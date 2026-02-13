import React, { useState, useEffect, useRef } from 'react';
import DraggableModal from './DraggableModal';
import { usePortraitMode } from '../../hooks/usePortraitMode';
import useCompositorStore from '../../store/compositorStore';
import { Layer } from '../../types/compositor.types';
import { ALL_FONTS, SYSTEM_FONTS, detectLocalFonts, preloadAllGoogleFonts } from '../../utils/fonts';
import type { FontOption } from '../../utils/fonts';
import { rasterizeText } from '../../utils/textRasterizer';

interface TextLayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingLayer?: Layer; // If provided, we're editing an existing text layer
}

const CANVAS_PREVIEW_LAYER_ID = '__text_canvas_preview__';

const TextLayerModal: React.FC<TextLayerModalProps> = ({ isOpen, onClose, existingLayer }) => {
  const addLayer = useCompositorStore((state) => state.addLayer);
  const updateLayer = useCompositorStore((state) => state.updateLayer);
  const removeLayer = useCompositorStore((state) => state.removeLayer);
  const isPortrait = usePortraitMode();
  
  // State
  const [text, setText] = useState<string>('Enter your text here');
  const [fontSize, setFontSize] = useState<number>(48);
  const [fontFamily, setFontFamily] = useState<string>(SYSTEM_FONTS[0].value);
  const [color, setColor] = useState<string>('#FFCDD2');
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('left');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [fontSearch, setFontSearch] = useState<string>('');
  const [isFontDropdownOpen, setIsFontDropdownOpen] = useState<boolean>(false);
  const [previewOnCanvas, setPreviewOnCanvas] = useState<boolean>(false);
  const [disableTransparency, setDisableTransparency] = useState<boolean>(true);
  const [lineHeight, setLineHeight] = useState<number>(1.2);
  const [letterSpacing, setLetterSpacing] = useState<number>(0);
  const [fontWeight, setFontWeight] = useState<'normal' | 'bold' | 'lighter'>('normal');
  const [previewX, setPreviewX] = useState<number>(0);
  const [previewY, setPreviewY] = useState<number>(0);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const previewUpdateTimeoutRef = useRef<number | null>(null);
  const originalVisibilityRef = useRef<boolean>(true);
  const [localFonts, setLocalFonts] = useState<FontOption[]>([]);

  // Detect locally installed fonts and preload Google Fonts on mount
  useEffect(() => {
    detectLocalFonts().then(fonts => {
      if (fonts.length > 0) setLocalFonts(fonts);
    });
    preloadAllGoogleFonts();
  }, []);
  
  // Load existing layer data if editing
  useEffect(() => {
    if (existingLayer && existingLayer.textContent !== undefined) {
      setText(existingLayer.textContent);
      setFontSize(existingLayer.fontSize || 48);
      setFontFamily(existingLayer.fontFamily || SYSTEM_FONTS[0].value);
      setColor(existingLayer.fontColor || '#FFCDD2');
      setTextAlign(existingLayer.textAlign || 'left');
      setDisableTransparency(existingLayer.disableTransparency || false);
      setLineHeight((existingLayer as any).lineHeight || 1.2);
      setLetterSpacing((existingLayer as any).letterSpacing || 0);
      setFontWeight((existingLayer as any).fontWeight || 'normal');
      setPreviewX(existingLayer.x);
      setPreviewY(existingLayer.y);
      originalVisibilityRef.current = existingLayer.visible;
    }
  }, [existingLayer]);
  
  // Auto-generate preview when inputs change (only if modal is open)
  useEffect(() => {
    if (!isOpen || !text.trim()) {
      return;
    }
    generatePreview();
  }, [text, fontSize, fontFamily, color, textAlign, disableTransparency, lineHeight, letterSpacing, fontWeight, isOpen]);
  
  // Handle canvas preview
  useEffect(() => {
    if (previewOnCanvas && text.trim() && previewImage) {
      // Hide existing layer immediately to avoid duplicates
      if (existingLayer) {
        const currentLayers = useCompositorStore.getState().project.layers;
        const currentLayer = currentLayers.find(l => l.id === existingLayer.id);
        if (currentLayer && currentLayer.visible) {
          updateLayer(existingLayer.id, { visible: false });
        }
      }
      
      updateCanvasPreview();
    } else {
      removeCanvasPreview();
    }
  }, [previewOnCanvas, previewImage, text, previewX, previewY]);

  // Sync preview position from store (handles dragging on canvas)
  useEffect(() => {
    if (!previewOnCanvas) return;

    const unsubscribe = useCompositorStore.subscribe((state) => {
      const previewLayer = state.project.layers.find(l => l.id === CANVAS_PREVIEW_LAYER_ID);
      if (previewLayer) {
        // Only update if position changed significantly to avoid loops
        if (Math.abs(previewLayer.x - previewX) > 0.1 || Math.abs(previewLayer.y - previewY) > 0.1) {
          setPreviewX(previewLayer.x);
          setPreviewY(previewLayer.y);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [previewOnCanvas, previewX, previewY]);
  
  // Clean up canvas preview when modal closes
  useEffect(() => {
    if (!isOpen) {
      removeCanvasPreview();
    }
  }, [isOpen]);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsFontDropdownOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const generatePreview = async () => {
    if (!text.trim()) return;
    
    setIsProcessing(true);
    
    try {
      const result = await rasterizeText({
        text,
        fontSize,
        fontFamily,
        color,
        textAlign,
        lineHeight,
        disableTransparency,
        letterSpacing,
        fontWeight
      });
      
      setPreviewImage(result.dataUrl);
    } catch (error) {
      console.error('Failed to generate text preview:', error);
    } finally {
      setIsProcessing(false);
    }
  };
  
  const updateCanvasPreview = () => {
    if (!previewImage || !previewOnCanvas) return;
    
    // Cancel any pending preview update
    if (previewUpdateTimeoutRef.current !== null) {
      clearTimeout(previewUpdateTimeoutRef.current);
    }
    
    // Debounce the preview update to avoid race conditions
    previewUpdateTimeoutRef.current = window.setTimeout(() => {
      // Create temporary image to get dimensions
      const img = new Image();
      img.src = previewImage;
      img.onload = () => {
        // Double-check for existing preview after image loads
        const latestLayers = useCompositorStore.getState().project.layers;
        const stillExists = latestLayers.find(l => l.id === CANVAS_PREVIEW_LAYER_ID);
        
        if (stillExists) {
          // Update existing preview layer
          updateLayer(CANVAS_PREVIEW_LAYER_ID, {
            imageData: previewImage,
            width: img.naturalWidth,
            height: img.naturalHeight,
            opacity: 0.7, // Slightly transparent to indicate it's a preview
            x: previewX,
            y: previewY
          });
        } else if (previewOnCanvas) {
          // Only create new preview layer if preview is still enabled and doesn't exist
          const previewLayer: Layer = {
            id: CANVAS_PREVIEW_LAYER_ID,
            name: '🔍 Canvas Preview (Temporary)',
            imageData: previewImage,
            x: previewX,
            y: previewY,
            zIndex: Date.now() + 1000000, // Very high z-index to appear on top
            visible: true,
            locked: false, // Allow dragging for positioning
            opacity: 0.7,
            width: img.naturalWidth,
            height: img.naturalHeight
          };
          addLayer(previewLayer);
        }
      };
    }, 50); // Small debounce delay
  };
  
  const removeCanvasPreview = () => {
    // Cancel any pending preview update
    if (previewUpdateTimeoutRef.current !== null) {
      clearTimeout(previewUpdateTimeoutRef.current);
      previewUpdateTimeoutRef.current = null;
    }
    
    const currentLayers = useCompositorStore.getState().project.layers;
    const existingPreview = currentLayers.find(l => l.id === CANVAS_PREVIEW_LAYER_ID);
    if (existingPreview) {
      removeLayer(CANVAS_PREVIEW_LAYER_ID);
    }

    // Always restore existing layer visibility if we're editing a layer
    // (we may have hidden it to show the preview)
    if (existingLayer) {
      const currentLayer = currentLayers.find(l => l.id === existingLayer.id);
      if (currentLayer && !currentLayer.visible) {
        updateLayer(existingLayer.id, { visible: true });
      }
    }
  };
  
  const handleCreate = async () => {
    if (!text.trim()) {
      alert('Please enter some text');
      return;
    }
    
    setIsProcessing(true);
    
    try {
      const result = await rasterizeText({
        text,
        fontSize,
        fontFamily,
        color,
        textAlign,
        lineHeight,
        disableTransparency,
        letterSpacing,
        fontWeight
      } as any);
      
      // Use preview position if canvas preview is enabled, otherwise use 0,0
      const layerX = previewOnCanvas ? previewX : 0;
      const layerY = previewOnCanvas ? previewY : 0;
      
      if (existingLayer) {
        // Update existing layer
        updateLayer(existingLayer.id, {
          imageData: result.dataUrl,
          width: result.width,
          height: result.height,
          x: layerX,
          y: layerY,
          textContent: text,
          fontSize,
          fontFamily,
          fontColor: color,
          textAlign,
          disableTransparency,
          name: existingLayer.name, // Keep existing name
          ...(lineHeight !== 1.2 && { lineHeight }),
          ...(letterSpacing !== 0 && { letterSpacing }),
          ...(fontWeight !== 'normal' && { fontWeight })
        } as any);
      } else {
        // Create new layer
        const newLayer: Layer = {
          id: crypto.randomUUID(),
          name: `Text: ${text.substring(0, 20)}${text.length > 20 ? '...' : ''}`,
          imageData: result.dataUrl,
          x: layerX,
          y: layerY,
          zIndex: Date.now(),
          visible: true,
          locked: false,
          opacity: 1,
          width: result.width,
          height: result.height,
          textContent: text,
          fontSize,
          fontFamily,
          fontColor: color,
          textAlign,
          disableTransparency,
          ...(lineHeight !== 1.2 && { lineHeight }),
          ...(letterSpacing !== 0 && { letterSpacing }),
          ...(fontWeight !== 'normal' && { fontWeight })
        } as any;
        
        addLayer(newLayer);
      }
      
      // Remove canvas preview before closing
      removeCanvasPreview();
      onClose();
    } catch (error) {
      console.error('Failed to create text layer:', error);
      alert('Failed to create text layer. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Filter fonts based on search
  const allAvailableFonts = [...ALL_FONTS, ...localFonts];
  const filteredFonts = allAvailableFonts.filter(font =>
    font.name.toLowerCase().includes(fontSearch.toLowerCase())
  );
  
  // Group filtered fonts by category
  const filteredSystemFonts = filteredFonts.filter(f => f.category === 'system');
  const filteredLocalFonts = filteredFonts.filter(f => f.category === 'local');
  const filteredGoogleFonts = filteredFonts.filter(f => f.category === 'google');
  
  // Get selected font name for display
  const selectedFont = allAvailableFonts.find(f => f.value === fontFamily);
  
  return (
    <DraggableModal
      isOpen={isOpen}
      onClose={onClose}
      title={existingLayer ? 'Edit Text Layer' : 'Create Text Layer'}
      noPadding={true}
      modalId="modal-text-layer"
    >
      <div className={`${isPortrait ? 'flex flex-col-reverse' : 'flex'} text-gray-200 h-full w-full overflow-hidden`}>
        {/* Controls */}
        <div className={`${isPortrait ? 'border-t max-h-[45vh]' : 'w-80 border-r'} border-gray-700 flex-shrink-0 flex flex-col overflow-hidden bg-gray-800`}>
          <div className="overflow-y-auto flex-1 p-4 space-y-5">
            
            {/* Text Input */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-gray-400 uppercase">Content</label>
                <span className="text-xs text-gray-500">{text.length} chars</span>
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter text..."
                className="w-full h-20 px-3 py-2 bg-gray-900 border border-gray-600 rounded text-white text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={() => navigator.clipboard.writeText(text)}
                disabled={!text.trim()}
                className="w-full py-1 text-xs text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 rounded transition-colors"
              >
                Copy Text
              </button>
            </div>

            {/* Font Settings */}
            <div className="space-y-3 border-t border-gray-700 pt-3">
              <label className="text-xs font-semibold text-gray-400 uppercase">Typography</label>
              
              {/* Font Family */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsFontDropdownOpen(!isFontDropdownOpen)}
                  className="w-full px-3 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-sm text-left flex items-center justify-between hover:bg-gray-700"
                >
                  <span className="truncate">{selectedFont?.name || 'Arial'}</span>
                  <span className="text-gray-500 text-xs">▼</span>
                </button>
                
                {isFontDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded shadow-xl z-50 max-h-60 overflow-y-auto">
                    <div className="p-2 sticky top-0 bg-gray-800 border-b border-gray-700">
                      <input
                        type="text"
                        value={fontSearch}
                        onChange={(e) => setFontSearch(e.target.value)}
                        placeholder="Search..."
                        className="w-full px-2 py-1 bg-gray-900 border border-gray-600 rounded text-white text-xs focus:outline-none focus:border-blue-500"
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                      />
                    </div>
                    {filteredSystemFonts.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-[10px] font-bold text-gray-500 uppercase bg-gray-800/50">System</div>
                        {filteredSystemFonts.map(font => (
                          <button
                            key={font.value}
                            onClick={() => {
                              setFontFamily(font.value);
                              setIsFontDropdownOpen(false);
                              setFontSearch('');
                            }}
                            className={`w-full px-3 py-1.5 text-left text-sm hover:bg-blue-600 hover:text-white ${fontFamily === font.value ? 'bg-blue-600 text-white' : 'text-gray-300'}`}
                            style={{ fontFamily: font.value }}
                          >
                            {font.name}
                          </button>
                        ))}
                      </div>
                    )}
                    {filteredLocalFonts.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-[10px] font-bold text-gray-500 uppercase bg-gray-800/50 border-t border-gray-700">Local ({filteredLocalFonts.length})</div>
                        {filteredLocalFonts.map(font => (
                          <button
                            key={font.value}
                            onClick={() => {
                              setFontFamily(font.value);
                              setIsFontDropdownOpen(false);
                              setFontSearch('');
                            }}
                            className={`w-full px-3 py-1.5 text-left text-sm hover:bg-blue-600 hover:text-white ${fontFamily === font.value ? 'bg-blue-600 text-white' : 'text-gray-300'}`}
                            style={{ fontFamily: font.value }}
                          >
                            {font.name}
                          </button>
                        ))}
                      </div>
                    )}
                    {filteredGoogleFonts.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-[10px] font-bold text-gray-500 uppercase bg-gray-800/50 border-t border-gray-700">Google Fonts</div>
                        {filteredGoogleFonts.map(font => (
                          <button
                            key={font.value}
                            onClick={() => {
                              setFontFamily(font.value);
                              setIsFontDropdownOpen(false);
                              setFontSearch('');
                            }}
                            className={`w-full px-3 py-1.5 text-left text-sm hover:bg-blue-600 hover:text-white ${fontFamily === font.value ? 'bg-blue-600 text-white' : 'text-gray-300'}`}
                            style={{ fontFamily: font.value }}
                          >
                            {font.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Size & Weight */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-gray-500 mb-1 block">Size</label>
                  <input
                    type="number"
                    value={fontSize}
                    onChange={(e) => setFontSize(Math.max(1, Math.min(2000, parseInt(e.target.value) || 48)))}
                    className="w-full px-2 py-1 bg-gray-900 border border-gray-600 rounded text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 mb-1 block">Weight</label>
                  <select 
                    value={fontWeight}
                    onChange={(e) => setFontWeight(e.target.value as any)}
                    className="w-full px-2 py-1 bg-gray-900 border border-gray-600 rounded text-white text-sm"
                  >
                    <option value="lighter">Light</option>
                    <option value="normal">Normal</option>
                    <option value="bold">Bold</option>
                  </select>
                </div>
              </div>

              {/* Quick Sizes */}
              <div className="flex flex-wrap gap-1">
                {[16, 24, 32, 48, 64, 96].map(size => (
                  <button
                    key={size}
                    onClick={() => setFontSize(size)}
                    className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${
                      fontSize === size
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-gray-700 border-gray-600 text-gray-400 hover:bg-gray-600 hover:text-gray-200'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Appearance */}
            <div className="space-y-3 border-t border-gray-700 pt-3">
              <label className="text-xs font-semibold text-gray-400 uppercase">Appearance</label>
              
              {/* Color */}
              <div className="flex gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                />
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="flex-1 px-2 py-1 bg-gray-900 border border-gray-600 rounded text-white text-sm font-mono uppercase"
                />
              </div>
              
              {/* Color Presets */}
              <div className="space-y-1">
                {[
                  // Grayscale
                  ['#FFFFFF', '#E0E0E0', '#C0C0C0', '#A0A0A0', '#808080', '#606060', '#404040', '#202020', '#000000'],
                  // Reds
                  ['#FFCDD2', '#EF9A9A', '#E57373', '#EF5350', '#F44336', '#E53935', '#D32F2F', '#C62828', '#B71C1C'],
                  // Oranges
                  ['#FFE0B2', '#FFCC80', '#FFB74D', '#FFA726', '#FF9800', '#FB8C00', '#F57C00', '#EF6C00', '#E65100'],
                  // Yellows
                  ['#FFF9C4', '#FFF59D', '#FFF176', '#FFEE58', '#FFEB3B', '#FDD835', '#FBC02D', '#F9A825', '#F57F17'],
                  // Greens
                  ['#C8E6C9', '#A5D6A7', '#81C784', '#66BB6A', '#4CAF50', '#43A047', '#388E3C', '#2E7D32', '#1B5E20'],
                  // Cyans/Teals
                  ['#B2EBF2', '#80DEEA', '#4DD0E1', '#26C6DA', '#00BCD4', '#00ACC1', '#0097A7', '#00838F', '#006064'],
                  // Blues
                  ['#BBDEFB', '#90CAF9', '#64B5F6', '#42A5F5', '#2196F3', '#1E88E5', '#1976D2', '#1565C0', '#0D47A1'],
                  // Purples
                  ['#E1BEE7', '#CE93D8', '#BA68C8', '#AB47BC', '#9C27B0', '#8E24AA', '#7B1FA2', '#6A1B9A', '#4A148C'],
                  // Pinks
                  ['#F8BBD0', '#F48FB1', '#F06292', '#EC407A', '#E91E63', '#D81B60', '#C2185B', '#AD1457', '#880E4F'],
                ].map((row, i) => (
                  <div key={i} className="flex gap-1">
                    {row.map(preset => (
                      <button
                        key={preset}
                        onClick={() => setColor(preset)}
                        className={`flex-1 aspect-square rounded-sm border ${color === preset ? 'border-white scale-110 z-10' : 'border-gray-600 hover:border-gray-400'}`}
                        style={{ backgroundColor: preset }}
                        title={preset}
                      />
                    ))}
                  </div>
                ))}
              </div>

              {/* Alignment */}
              <div>
                <label className="text-[10px] text-gray-500 mb-1 block">Alignment</label>
                <div className="bg-gray-900 rounded border border-gray-600 p-0.5 flex">
                  {(['left', 'center', 'right'] as const).map(align => (
                    <button
                      key={align}
                      onClick={() => setTextAlign(align)}
                      className={`flex-1 py-1 rounded text-xs capitalize ${textAlign === align ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-400 hover:text-gray-300'}`}
                      title={`Align ${align}`}
                    >
                      {align}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Spacing */}
            <div className="space-y-3 border-t border-gray-700 pt-3">
              <label className="text-xs font-semibold text-gray-400 uppercase">Spacing</label>
              
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                    <span>Line Height</span>
                    <span>{lineHeight.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.8"
                    max="2.0"
                    step="0.1"
                    value={lineHeight}
                    onChange={(e) => setLineHeight(parseFloat(e.target.value))}
                    className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                    <span>Letter Spacing</span>
                    <span>{letterSpacing}px</span>
                  </div>
                  <input
                    type="range"
                    min="-5"
                    max="10"
                    step="0.5"
                    value={letterSpacing}
                    onChange={(e) => setLetterSpacing(parseFloat(e.target.value))}
                    className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Options */}
            <div className="pt-2">
              <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer hover:text-white select-none">
                <input
                  type="checkbox"
                  checked={disableTransparency}
                  onChange={(e) => setDisableTransparency(e.target.checked)}
                  className="rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-offset-gray-800"
                />
                <span>Pixel Perfect (No AA)</span>
              </label>
            </div>

          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-gray-700 bg-gray-800/50">
            <button
              onClick={handleCreate}
              disabled={isProcessing || !text.trim()}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded text-white font-semibold transition-colors text-sm"
            >
              {existingLayer ? 'Update Layer' : 'Create Layer'}
            </button>
          </div>
        </div>

        {/* Right: Preview */}
        <div className="flex-1 bg-gray-900 relative flex flex-col min-w-0">
          {/* Preview Header */}
          <div className="h-10 border-b border-gray-700 flex items-center justify-between px-4 bg-gray-800/30">
            <span className="text-xs font-semibold text-gray-400 uppercase">Preview</span>
            <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer hover:text-gray-200 select-none">
              <input
                type="checkbox"
                checked={previewOnCanvas}
                onChange={(e) => setPreviewOnCanvas(e.target.checked)}
                className="rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-offset-gray-800"
              />
              <span>Show on Canvas</span>
            </label>
          </div>

          {/* Preview Area */}
          <div className="flex-1 overflow-auto flex items-center justify-center p-8 bg-[url('/grid-pattern.png')] bg-repeat">
            {isProcessing ? (
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                Rendering...
              </div>
            ) : previewImage ? (
              <div className="relative">
                <img
                  src={previewImage}
                  alt="Text preview"
                  className="max-w-full max-h-full object-contain"
                  style={{ imageRendering: 'pixelated' }}
                />
              </div>
            ) : (
              <div className="text-gray-600 text-sm italic">
                Enter text to generate preview
              </div>
            )}
          </div>
        </div>
      </div>
    </DraggableModal>
  );
};

export default TextLayerModal;
