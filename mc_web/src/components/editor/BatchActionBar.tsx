import React, { useState, useRef, useEffect } from 'react';
import { Copy, Trash2, X, Check } from 'lucide-react';

interface BatchActionBarProps {
  selectedCount: number;
  onCopy: () => void;
  onDelete: () => void;
  onClear: () => void;
}

export const BatchActionBar: React.FC<BatchActionBarProps> = ({
  selectedCount,
  onCopy,
  onDelete,
  onClear,
}) => {
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  if (selectedCount <= 0) return null;

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    if (copyTimerRef.current) {
      clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = setTimeout(() => {
      setCopied(false);
      copyTimerRef.current = null;
    }, 2000);
  };

  return (
    <div
      role="toolbar"
      aria-label="批量块操作工具栏"
      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-2 rounded-2xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-150 backdrop-blur-md bg-opacity-95 dark:bg-opacity-95"
    >
      <div className="flex items-center gap-1.5 text-xs font-medium text-text-primary-light dark:text-text-primary-dark pr-2 border-r border-border-light dark:border-border-dark">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 text-white font-mono text-[11px] font-bold">
          {selectedCount}
        </span>
        <span>个块已选</span>
      </div>

      <button
        type="button"
        onClick={handleCopy}
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg text-text-primary-light dark:text-text-primary-dark hover:bg-sidebar-hover-light dark:hover:bg-sidebar-hover-dark transition-colors"
        title="复制所选块的 Markdown 文本 (Ctrl+C)"
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5 text-green-500" />
            <span className="text-green-600 dark:text-green-400 font-medium">已复制</span>
          </>
        ) : (
          <>
            <Copy className="w-3.5 h-3.5 text-text-muted-light dark:text-text-muted-dark" />
            <span>复制</span>
          </>
        )}
      </button>

      <button
        type="button"
        onClick={onDelete}
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
        title="删除所选块 (Delete / Backspace)"
      >
        <Trash2 className="w-3.5 h-3.5" />
        <span>删除</span>
      </button>

      <button
        type="button"
        onClick={onClear}
        className="p-1 rounded-lg text-text-muted-light dark:text-text-muted-dark hover:text-text-primary-light dark:hover:text-text-primary-dark hover:bg-sidebar-hover-light dark:hover:bg-sidebar-hover-dark transition-colors ml-1"
        title="取消选区 (Esc)"
        aria-label="取消选区"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
