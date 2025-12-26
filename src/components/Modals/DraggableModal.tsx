import React, { useState, useEffect, useRef } from 'react';

interface DraggableModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode | ((size: { width: number; height: number }) => React.ReactNode);
  initialPosition?: { x: number; y: number };
  noPadding?: boolean;
}

const DraggableModal: React.FC<DraggableModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  initialPosition = { x: 100, y: 100 },
  noPadding = false,
}) => {
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [size, setSize] = useState({ width: 1100, height: 900 });
  const [isResizing, setIsResizing] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const resizeStartRef = useRef<{ x: number; y: number, startWidth: number, startHeight: number } | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && dragStartRef.current) {
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        
        setPosition((prev) => ({
          x: prev.x + dx,
          y: prev.y + dy,
        }));
        
        dragStartRef.current = { x: e.clientX, y: e.clientY };
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startWidth: size.width,
      startHeight: size.height
    };
  };

  useEffect(() => {
    const handleResizeMouseMove = (e: MouseEvent) => {
      if (isResizing && resizeStartRef.current) {
        const dx = e.clientX - resizeStartRef.current.x;
        const dy = e.clientY - resizeStartRef.current.y;
        
        setSize({
          width: Math.max(600, resizeStartRef.current.startWidth + dx),
          height: Math.max(400, resizeStartRef.current.startHeight + dy)
        });
      }
    };

    const handleResizeMouseUp = () => {
      setIsResizing(false);
      resizeStartRef.current = null;
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleResizeMouseMove);
      window.addEventListener('mouseup', handleResizeMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleResizeMouseMove);
      window.removeEventListener('mouseup', handleResizeMouseUp);
    };
  }, [isResizing]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed flex flex-col bg-panel-bg border border-border rounded shadow-lg overflow-hidden"
      style={{
        left: position.x,
        top: position.y,
        zIndex: 50,
        width: `${size.width}px`,
        height: `${size.height}px`,
        position: 'absolute',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-canvas-bg border-b border-border cursor-move select-none"
        onMouseDown={(e) => {
          setIsDragging(true);
          dragStartRef.current = { x: e.clientX, y: e.clientY };
        }}
      >
        <h3 className="text-sm font-semibold text-gray-200">{title}</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white focus:outline-none p-1 rounded hover:bg-gray-700 transition-colors"
          aria-label="Close"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className={`${noPadding ? '' : 'p-4'} text-gray-300 ${noPadding ? 'overflow-hidden' : 'overflow-auto'} flex-1`}>
        {typeof children === 'function' ? children(size) : children}
      </div>

      {/* Resize Handle */}
      <div
        onMouseDown={handleResizeMouseDown}
        className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize bg-gray-600 hover:bg-gray-500 transition-colors"
        style={{
          clipPath: 'polygon(100% 0, 100% 100%, 0 100%)'
        }}
      />
    </div>
  );
};

export default DraggableModal;
