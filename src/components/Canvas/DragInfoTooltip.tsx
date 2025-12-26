import React from 'react';

interface DragInfoTooltipProps {
  offsetX: number;
  offsetY: number;
  mouseX: number;
  mouseY: number;
}

/**
 * Small tooltip that shows drag translation info
 * Follows the mouse cursor while dragging
 */
const DragInfoTooltip: React.FC<DragInfoTooltipProps> = ({
  offsetX,
  offsetY,
  mouseX,
  mouseY,
}) => {
  return (
    <div
      style={{
        position: 'fixed',
        left: `${mouseX + 10}px`,
        top: `${mouseY + 10}px`,
        pointerEvents: 'none',
        zIndex: 1000,
      }}
    >
      <div className="bg-panel-bg border border-border rounded px-2 py-1 text-xs text-gray-300 whitespace-nowrap shadow-lg">
        <div>X: {offsetX > 0 ? '+' : ''}{offsetX}</div>
        <div>Y: {offsetY > 0 ? '+' : ''}{offsetY}</div>
      </div>
    </div>
  );
};

export default DragInfoTooltip;
