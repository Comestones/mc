import React, { useRef, useEffect } from 'react';
import { Minus, X } from 'lucide-react';
import { cn } from '../../utils/cn';

interface DividerBlockProps {
  id: string;
  isFocused: boolean;
  onFocus: () => void;
  onDelete: () => void;
  onEnter: () => void;
  onFocusPrevious?: () => void;
  onFocusNext?: () => void;
}

export const DividerBlock: React.FC<DividerBlockProps> = ({
  id,
  isFocused,
  onFocus,
  onDelete,
  onEnter,
  onFocusPrevious,
  onFocusNext,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isFocused && containerRef.current) {
      containerRef.current.focus();
    }
  }, [isFocused]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      onDelete();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      onEnter();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      onFocusPrevious?.();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      onFocusNext?.();
    }
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      data-block-id={id}
      onClick={onFocus}
      onFocus={onFocus}
      onKeyDown={handleKeyDown}
      className={cn(
        'group relative py-3 px-2 my-1 rounded-lg cursor-pointer outline-none transition-all select-none',
        isFocused
          ? 'bg-blue-50/60 dark:bg-blue-950/30 ring-1 ring-blue-400 dark:ring-blue-600'
          : 'hover:bg-sidebar-hover-light/40 dark:hover:bg-sidebar-hover-dark/40'
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex-1 h-[2px] rounded-full transition-colors',
            isFocused
              ? 'bg-blue-500 dark:bg-blue-400'
              : 'bg-border-light dark:bg-border-dark group-hover:bg-border-light/80'
          )}
        />
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-[10px] text-text-muted-light dark:text-text-muted-dark flex items-center gap-0.5">
            <Minus className="w-3 h-3" /> 分割线
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="删除分割线"
            className="p-0.5 rounded text-text-muted-light hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
