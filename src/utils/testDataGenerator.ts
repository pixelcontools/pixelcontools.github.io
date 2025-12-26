/**
 * Generate test data for canvas
 */

/**
 * Create a solid color rectangle as base64 PNG
 */
export function createSolidColorRectangle(
  width: number,
  height: number,
  color: string
): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);

  return canvas.toDataURL('image/png');
}

/**
 * Generate test layers for demonstration
 */
export function generateTestLayers() {
  return [
    {
      name: 'Black Rectangle',
      imageData: createSolidColorRectangle(200, 100, '#000000'),
      x: 50,
      y: 50,
      width: 200,
      height: 100,
      opacity: 1,
      visible: true,
      locked: false,
    },
    {
      name: 'Green Rectangle',
      imageData: createSolidColorRectangle(100, 200, '#00ff00'),
      x: 150,
      y: 100,
      width: 100,
      height: 200,
      opacity: 1,
      visible: true,
      locked: false,
    },
  ];
}
