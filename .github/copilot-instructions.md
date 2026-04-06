# PixelConnect — Workspace Instructions

## What This App Is

PixelConnect is a **pixel-perfect image compositor** for pixel artists. It runs entirely client-side (no server), deployed to GitHub Pages from the `docs/` folder. Users compose multi-layer images with exact RGBA color preservation, export to PNG, and save/load `.pixcomp` project files.

## Tech Stack

- **React 18** + **TypeScript** (strict mode)
- **Zustand 4.4** for state management (single store, no Redux)
- **Vite 7.3** for builds → output to `docs/`
- **Tailwind CSS 3.3** for styling
- **HTML5 Canvas API** for rendering (pixel-perfect, no WebGL)
- **Web Workers** for background image processing (pixelator)
- **IndexedDB** for local project persistence (auto-save every 2s)
- **@imgly/background-removal** for AI bg removal (ONNX via CDN)

## Commands

| Action | Command |
|--------|---------|
| Dev server | `npm run dev` (port 5173) |
| Build | `npm run build` (outputs to `docs/`) |
| Lint | `npm run lint` |

## Architecture

```
src/
├── App.tsx                    # Root layout, wires components + hooks
├── store/compositorStore.ts   # Single Zustand store (ALL state)
├── types/compositor.types.ts  # All interfaces: Layer, CanvasConfig, AppState, etc.
├── components/
│   ├── Canvas/                # Main rendering surface + grid overlay
│   ├── LayerPanel/            # Layer list (visibility, lock, reorder)
│   ├── PropertyPanel/         # Per-layer properties, color analysis
│   ├── Toolbar/               # File ops, zoom, canvas settings
│   ├── Modals/                # Text, shape, pixelator, bg removal, etc.
│   └── Tutorial/              # Onboarding overlay
├── hooks/                     # useAutoSave, useKeyboardShortcuts, etc.
├── utils/                     # Rendering, image processing, serialization
└── workers/                   # pixelator.worker.ts (Web Worker)
```

## Critical Invariants

1. **Pixel-perfect rendering**: ALWAYS set `imageSmoothingEnabled = false` on every canvas context. This is the app's core promise. Never use CSS scaling for image display.
2. **Color preservation**: Load images via `new Image()` → draw to temp canvas → `getImageData()` → store as base64 data URI. Never re-encode through lossy paths.
3. **Viewport ≠ data**: Pan/zoom changes do NOT trigger history pushes or set `isDirty`. They are UI navigation only.
4. **Preview layers**: Text/shape editors create temporary layers with IDs `__text_canvas_preview__` and `__shape_canvas_preview__`. These MUST be filtered out before project save/export.
5. **Store-first mutations**: All state changes go through `useCompositorStore` methods. Never mutate state directly.
6. **Integer pixel positioning**: Use `Math.floor()` for layer x/y during rendering to prevent sub-pixel blurring.

## Zustand Store Structure

The store (`compositorStore.ts`) extends `AppState`:
- **`project: ProjectData`** — All serializable data (canvas config, viewport, grid, rulers, layers[], metadata)
- **`selectedLayerIds: string[]`** — Multi-select support (Ctrl+click, Shift+range)
- **`isDirty: boolean`** — Unsaved changes flag
- **`history: HistoryState`** — Undo/redo with max 50 steps, debounced 500ms
- **`ui: UIState`** — Transient UI state (tool, drag state, clipboard) — NOT persisted

## Layer Model

A `Layer` has universal fields (`id`, `name`, `imageData`, `x`, `y`, `zIndex`, `visible`, `locked`, `opacity`, `width`, `height`) plus optional metadata for re-editable text layers (`textContent`, `fontSize`, `fontFamily`, etc.) and shape layers (`shapeType`, `shapeSize`, `shapeColor`, etc.).

## Key Patterns

- **History**: `pushHistory()` snapshots `project` into `past[]`. Undo pops past, pushes current to future. Debounced to prevent flooding.
- **Auto-save**: `useAutoSave` hook saves to IndexedDB every 2 seconds via `projectStorage.ts`.
- **Keyboard shortcuts**: Arrow keys nudge (1px or 10px with Shift), Ctrl+Z/Y undo/redo, Delete removes, Ctrl+S saves, Ctrl+A selects all.
- **Export**: Composites visible layers onto an offscreen canvas, applies border if enabled, converts to PNG blob with scale multiplier (1x–8x).

## Existing Documentation

- `ai-logs/master_prompt.md` — Original feature specification
- `ai-logs/guides/` — Deep-dives on specific fixes (alpha channel, pixel degradation)
- `ai-logs/plans/` — Implementation plans for features
- `CHANGELOG.md` — Version history
- `docs/decisions/` — Architectural Decision Records (ADRs)

## Agent Workflow

### Before editing code
1. Read ALL `.github/instructions/*.instructions.md` files whose `applyTo` patterns match files you plan to change
2. Follow the rules in those instruction files (history patterns, pixel-perfect rendering, color preservation, etc.)

### After completing feature work
1. Invoke the **knowledge-keeper** skill — it will update instructions, CHANGELOG, and create ADRs as needed
2. For non-trivial bugs or architectural decisions, the skill will prompt you through ADR creation in `docs/decisions/`

## File Conventions

- Components: PascalCase folders with PascalCase `.tsx` files
- Utils: camelCase `.ts` files
- Types: centralized in `types/compositor.types.ts`
- No barrel exports — import directly from files
