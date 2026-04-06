---
description: "Use when modifying Zustand store, state management, undo/redo history, or layer operations. Covers store mutation patterns and history rules."
applyTo: "src/store/**, src/types/compositor.types.ts, src/components/PropertyPanel/**"
---

# Store & State Management Patterns

## Store Architecture

Single Zustand store (`compositorStore.ts`) with `devtools` middleware. No slices — flat method list on `CompositorStore` interface.

State shape:
```
AppState
├── project: ProjectData      ← serializable, saved to .pixcomp / IndexedDB
├── selectedLayerIds: string[] ← multi-select
├── isDirty: boolean           ← unsaved changes flag
├── history: HistoryState      ← undo/redo stacks
└── ui: UIState                ← transient, NOT persisted
```

## Mutation Rules

1. **All mutations go through store methods** — never `set()` from outside the store
2. **`useAutoHistory` hook auto-pushes history** — it watches `project` (excluding viewport), debounces 500ms, and calls `pushHistory()` automatically. Most mutations don't need manual `pushHistory()` calls.
3. **Call `pushHistory()` manually only for** batch/drag operations where you need precise undo boundaries (e.g., `stopDraggingLayer`)
4. **Do NOT call `pushHistory()` for**: viewport changes (pan/zoom), selection changes, UI state, grid/ruler toggles
5. **Set `isDirty: true`** after any project data mutation (but NOT for viewport/UI changes)

## History System

- `pushHistory()` clones `state.project` into `past[]`, clears `future[]`
- `undo()` pops from `past[]`, pushes current to `future[]`
- `redo()` pops from `future[]`, pushes current to `past[]`
- Max 50 history steps — oldest entries are dropped
- Debounced at 500ms via `_lastHistoryPushAt` timestamp to prevent flooding from rapid operations

## Layer Operations

- **`addLayer()`**: Assigns UUID, sets zIndex to max+1, selects new layer
- **`removeLayer()`**: Removes from layers array, deselects if selected
- **`updateLayer()`**: Partial update by layer ID — used for position, opacity, metadata changes
- **`moveLayer()` / `moveSelectedLayers()`**: Delta-based position changes (used by arrow keys and drag)
- **`reorderLayer()` / `reorderSelectedLayers()`**: Changes zIndex (visual stacking order)

## Multi-Select

- `selectLayer(id, multiSelect?)` — Ctrl+click toggles individual selection
- `selectLayerRange(fromId, toId)` — Shift+click range selection
- `selectAllLayers()` / `deselectAllLayers()`
- Operations like move, delete, copy/paste work on all `selectedLayerIds`

## Preview Layer Convention

Text and shape editors create temporary preview layers:
- Text preview ID: `__text_canvas_preview__`
- Shape preview ID: `__shape_canvas_preview__`

These MUST be filtered out before:
- Saving to `.pixcomp`
- Exporting to PNG
- Auto-saving to IndexedDB
- Pushing to history

## Type Conventions

All interfaces live in `types/compositor.types.ts`. When adding new layer metadata:
1. Add optional fields to the `Layer` interface
2. Use TypeScript optional (`?`) — layers without the metadata are standard image layers
3. Update serialization in `projectSerializer.ts` if needed
