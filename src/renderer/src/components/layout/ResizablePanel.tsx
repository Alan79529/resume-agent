import React, { useRef, useState, useCallback } from 'react';

interface ResizablePanelProps {
  direction: 'horizontal' | 'vertical';
  defaultSize: number;
  minSize: number;
  maxSize: number;
  className?: string;
  children: React.ReactNode;
}

export const ResizablePanel: React.FC<ResizablePanelProps> = ({
  direction,
  defaultSize,
  minSize,
  maxSize,
  className = '',
  children
}) => {
  const [size, setSize] = useState(defaultSize);
  const [isResizing, setIsResizing] = useState(false);
  const startPosRef = useRef(0);
  const startSizeRef = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
    startPosRef.current = direction === 'horizontal' ? e.clientX : e.clientY;
    startSizeRef.current = size;
    e.preventDefault();
  }, [direction, size]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    
    const currentPos = direction === 'horizontal' ? e.clientX : e.clientY;
    const delta = currentPos - startPosRef.current;
    const newSize = Math.max(minSize, Math.min(maxSize, startSizeRef.current + delta));
    
    setSize(newSize);
  }, [isResizing, direction, minSize, maxSize]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  React.useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  const isHorizontal = direction === 'horizontal';

  return (
    <div
      className={`relative flex ${isHorizontal ? 'flex-row' : 'flex-col'} ${className}`}
      style={{ [isHorizontal ? 'width' : 'height']: size }}
    >
      {children}
      
      {/* Resize handle */}
      <div
        className={`
          absolute bg-transparent hover:bg-primary/20 transition-colors z-50
          ${isHorizontal 
            ? 'right-0 top-0 bottom-0 w-1 cursor-col-resize' 
            : 'bottom-0 left-0 right-0 h-1 cursor-row-resize'
          }
          ${isResizing ? 'bg-primary/40' : ''}
        `}
        onMouseDown={handleMouseDown}
      >
        <div 
          className={`
            absolute bg-gray-300 hover:bg-primary rounded-full
            ${isHorizontal 
              ? 'right-0 top-1/2 -translate-y-1/2 w-1 h-12' 
              : 'bottom-0 left-1/2 -translate-x-1/2 w-12 h-1'
            }
          `}
        />
      </div>
    </div>
  );
};
