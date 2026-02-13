import { useRef } from 'react';
import useCompositorStore from '../../store/compositorStore';
import CanvasRenderer from './CanvasRenderer';
import { deserializeProject } from '../../utils/projectSerializer';
import { blobToDataUrl } from '../../utils/imageProcessing';
import { rasterizeText } from '../../utils/textRasterizer';

/**
 * Canvas container component
 * Handles image uploads and manages canvas rendering
 */
function Canvas() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addLayer = useCompositorStore((state) => state.addLayer);
  const loadProject = useCompositorStore((state) => state.loadProject);
  const markClean = useCompositorStore((state) => state.markClean);

  /**
   * Handle image file upload
   * Converts images to base64 data URIs
   */
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.currentTarget.files;
    if (!files) {
      console.warn('[DEBUG] No files selected');
      return;
    }

    // console.log(`[DEBUG] Processing ${files.length} image file(s)`);

    for (const file of Array.from(files)) {
      try {
        // Check for .pixcomp file
        if (file.name.toLowerCase().endsWith('.pixcomp')) {
          try {
            const text = await file.text();
            const projectData = await deserializeProject(text);
            loadProject(projectData);
            markClean();
            // Stop processing other files if a project is loaded
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
            return;
          } catch (error) {
            console.error('[DEBUG] Load project failed:', error);
            alert(`Error loading project: ${error instanceof Error ? error.message : 'Unknown error'}`);
            continue;
          }
        }

        // Validate file type
        if (!['image/png', 'image/gif', 'image/bmp', 'image/jpeg'].includes(file.type)) {
          console.warn(`[DEBUG] Unsupported file type: ${file.type}`);
          alert(`Unsupported file type: ${file.type}. Please use .pixcomp, PNG, GIF, BMP, or JPEG.`);
          continue;
        }

        // console.log(`[DEBUG] Loading image: ${file.name} (${file.size} bytes, ${file.type})`);

        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(file);
        });

        // Create a temporary image to get dimensions
        const img = new Image();
        img.src = dataUrl;

        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Failed to load image'));
        });

        const width = img.naturalWidth;
        const height = img.naturalHeight;

        // console.log(`[DEBUG] Image loaded: ${file.name} (${width}x${height})`);

        // Add layer to store
        addLayer({
          name: file.name,
          imageData: dataUrl,
          x: 0,
          y: 0,
          zIndex: useCompositorStore.getState().project.layers.length,
          visible: true,
          locked: false,
          opacity: 1.0,
          width,
          height,
        });

        // console.log(`[DEBUG] Layer added: ${file.name}`);
      } catch (error) {
        // console.error(`[DEBUG] Error loading image ${file.name}:`, error);
        alert(`Error loading image ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * Handle paste event for fallback clipboard support
   * Triggered when user pastes into the canvas area
   */
  const handlePaste = async (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    
    const items = event.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // Handle image paste
      if (item.type.startsWith('image/')) {
        try {
          const blob = item.getAsFile();
          if (!blob) continue;

          const dataUrl = await blobToDataUrl(blob);

          // Get image dimensions
          const img = new Image();
          img.src = dataUrl;

          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('Failed to load image'));
          });

          const maxZIndex = Math.max(
            ...useCompositorStore.getState().project.layers.map((l) => l.zIndex),
            0
          );

          addLayer({
            name: 'Pasted Image',
            imageData: dataUrl,
            x: 0,
            y: 0,
            zIndex: maxZIndex + 1,
            visible: true,
            locked: false,
            opacity: 1.0,
            width: img.naturalWidth,
            height: img.naturalHeight,
          });

          // Only handle the first image
          break;
        } catch (error) {
          console.error('Error pasting image:', error);
        }
      }
    }

    // Try to get text from clipboard if no image was found
    if (event.clipboardData?.types.includes('text/plain')) {
      try {
        const text = event.clipboardData.getData('text/plain');
        if (text.trim()) {
          const rasterized = await rasterizeText({
            text,
            fontSize: 16,
            fontFamily: 'Arial',
            color: '#000000',
            textAlign: 'left',
            lineHeight: 1.2,
          });

          const maxZIndex = Math.max(
            ...useCompositorStore.getState().project.layers.map((l) => l.zIndex),
            0
          );

          addLayer({
            id: `layer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: `Text: ${text.substring(0, 20)}${text.length > 20 ? '...' : ''}`,
            imageData: rasterized.dataUrl,
            x: 0,
            y: 0,
            zIndex: maxZIndex + 1,
            visible: true,
            locked: false,
            opacity: 1.0,
            width: rasterized.width,
            height: rasterized.height,
            textContent: text,
            fontSize: 16,
            fontFamily: 'Arial',
            fontColor: '#000000',
            textAlign: 'left',
            lineHeight: 1.2,
          });
        }
      } catch (error) {
        console.error('Error pasting text:', error);
      }
    }
  };

  return (
    <div id="canvas-container" className="w-full h-full flex flex-col relative" onPaste={handlePaste}>
      {/* Canvas Area */}
      <div className="flex-1 relative overflow-hidden" data-region="canvas">
        <CanvasRenderer />
      </div>

      {/* Upload Zone Overlay (shown when no layers) */}
      {useCompositorStore((state) => state.project.layers.length === 0) && (
        <div
          id="canvas-upload-zone"
          onClick={() => fileInputRef.current?.click()}
          className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 cursor-pointer hover:bg-opacity-40 transition-all z-10"
          role="button"
          aria-label="Upload images"
        >
          <div className="text-center">
            <div className="text-4xl mb-4">📁</div>
            <div className="text-lg font-semibold text-white mb-2">
              Click to upload images or drag & drop
            </div>
            <div className="text-sm text-gray-400">
              Supported: .pixcomp, PNG, GIF, BMP, JPEG
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        id="input-canvas-upload"
        type="file"
        multiple
        accept=".pixcomp,image/png,image/gif,image/bmp,image/jpeg"
        onChange={handleImageUpload}
        className="hidden"
        aria-label="Upload images"
      />
    </div>
  );
}

export default Canvas;
