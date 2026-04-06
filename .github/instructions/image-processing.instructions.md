---
description: "Use when working on image processing, color manipulation, transparency masking, background removal, pixelation, or PNG export. Covers color preservation pipeline and worker communication."
applyTo: "src/utils/imageProcessing.ts, src/utils/textRasterizer.ts, src/utils/shapeRasterizer.ts, src/utils/projectSerializer.ts, src/workers/**, src/components/Modals/PixelatorModal.tsx, src/components/Modals/BgRemovalModal.tsx, src/components/Modals/TransparencyMaskModal.tsx"
---

# Image Processing Rules

## Color Preservation Pipeline (Critical)

The app's core promise is zero color loss. Follow this exact pipeline:

1. **Load**: `new Image()` with `crossOrigin = 'anonymous'`
2. **Capture**: Draw to temp canvas → `getImageData()` to get raw RGBA pixels
3. **Store**: Convert to base64 data URI (`canvas.toDataURL('image/png')`) for the `Layer.imageData` field
4. **Render**: Load stored data URI back as `Image`, draw with `imageSmoothingEnabled = false`

**Never** resize images using CSS transforms for display. **Never** re-encode through JPEG or lossy formats. **Never** use `drawImage()` with scaling params for the stored image data.

## Text Rasterization (`textRasterizer.ts`)

- Renders at **4x DPI** then scales down for sharpness
- Supports Google Fonts (loaded dynamically) and system fonts
- Handles word wrapping, line height, letter spacing
- Returns a base64 data URI matching the text bounding box exactly
- `disableTransparency` option uses solid background instead of alpha

## Shape Rasterization (`shapeRasterizer.ts`)

- Supports: rectangle, circle, triangle, hexagon, octagon, star
- `shapeStretchX/Y` scales the shape on each axis (0.1–20.0)
- Returns a base64 data URI at the exact shape dimensions
- Fill only — no stroke support currently

## Pixelator Worker (`pixelator.worker.ts`)

Runs in a Web Worker for non-blocking processing:
- Receives `ImageData` + target dimensions + algorithm choice
- Color-matching algorithms: Euclidean, OKLab, CIEDE2000, Manhattan, Weighted Euclidean
- Posts back processed `ImageData`
- Communication via `postMessage()` / `onmessage`

## Export Pipeline

1. Create offscreen canvas at `canvasWidth × canvasHeight × scaleMultiplier`
2. Set `imageSmoothingEnabled = false`
3. Composite visible layers (sorted by zIndex, filter out preview layers)
4. Apply export border if `exportBorderEnabled` (width from `exportBorderWidth`, color from `exportBorderColor`)
5. `canvas.toBlob('image/png')` → download

## Background Removal

- Uses `@imgly/background-removal` (ONNX model loaded from CDN)
- Process: Load image → pass to library → receive mask → apply to layer
- Heavy operation — show progress UI, handle errors gracefully
- Model files are ~40MB, loaded on first use

## Key Functions in `imageProcessing.ts`

- `blobToDataUrl()` / `dataUrlToBlob()` — Format conversion
- `compositeLayersToBlob()` — Full export pipeline
- `applyTransparencyMask()` — Applies mask to layer alpha channel
- `extractColorPalette()` — Gets unique colors from image data
