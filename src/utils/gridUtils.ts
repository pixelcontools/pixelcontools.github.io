/**
 * Grid utilities
 * Handles snap-to-grid calculations
 */

/**
 * Snap a value to the nearest grid position
 */
export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Optionally snap coordinates to grid
 */
export function applyGridSnap(
  x: number,
  y: number,
  gridSize: number,
  enabled: boolean
): [number, number] {
  if (!enabled) {
    return [Math.floor(x), Math.floor(y)];
  }

  return [
    Math.floor(snapToGrid(x, gridSize)),
    Math.floor(snapToGrid(y, gridSize)),
  ];
}
