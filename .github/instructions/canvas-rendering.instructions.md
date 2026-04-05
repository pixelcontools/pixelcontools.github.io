---
description: "Use when editing canvas rendering, viewport transforms, coordinate conversion, or grid overlay code. Covers pixel-perfect rendering rules and Canvas API patterns."
applyTo: "src/components/Canvas/**, src/utils/canvasRenderer.ts, src/utils/gridUtils.ts"
---

# Canvas Rendering Rules

## Pixel-Perfect Rendering (Non-Negotiable)

Every canvas context MUST have smoothing disabled before any draw call:

```ts
ctx.imageSmoothingEnabled = false;
(ctx as any).webkitImageSmoothingEnabled = false;
(ctx as any).mozImageSmoothingEnabled = false;
```

This applies to:
- The main display canvas (`CanvasRenderer.tsx`)
- Export canvases (`imageProcessing.ts`)
- Temporary compositing canvases
- Thumbnail/preview canvases

## Coordinate System

- **Canvas space**: Pixel coordinates on the logical canvas (0,0 is top-left of the project canvas)
- **Screen space**: Pixel coordinates on the browser viewport
- **Conversion**: `screenToCanvas(screenX, screenY, viewport)` divides by zoom and adds pan offset

```
canvasX = (screenX / zoom) + panX
canvasY = (screenY / zoom) + panY
```

## Viewport Transforms

Applied in `renderCanvasContent()`:
1. `ctx.save()`
2. `ctx.scale(zoom / 100, zoom / 100)`
3. `ctx.translate(-panX, -panY)`
4. Draw all layers
5. `ctx.restore()`

**Viewport changes (pan/zoom) must NEVER trigger `pushHistory()` or set `isDirty`.**

## Layer Rendering Order

Layers are sorted by `zIndex` ascending (lowest = back, highest = front). Each layer is drawn at `Math.floor(layer.x), Math.floor(layer.y)` — integer positioning prevents sub-pixel blurring.

## Grid Overlay

- Rendered AFTER layers, on top of the viewport
- Uses `gridUtils.ts` for calculation
- `density` controls how many grid lines to skip (1 = every pixel, 4 = every 4th pixel)
- Grid lines are drawn in screen space, not canvas space

## Component Responsibilities

- **Canvas.tsx**: Container, manages refs, mouse events for pan/zoom/drag
- **CanvasRenderer.tsx**: Actual rendering loop, image loading, layer compositing
- **GridOverlay.tsx**: Grid line rendering on a separate overlay canvas
- **DragInfoTooltip.tsx**: Shows x/y offset during layer drag
