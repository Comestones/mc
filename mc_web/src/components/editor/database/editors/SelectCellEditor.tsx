import React, { useState, useEffect, useRef } from 'react';
import { SelectOption } from '../../../../types/database';
import { Check, Plus, X } from 'lucide-react';

export interface SelectCellEditorProps {
  value: string | null | undefined;
  options: SelectOption[];
  onCommit: (val: string | null) => void;
  onCancel: () => void;
  onNavigate: (direction: 'up' | 'down' | 'left' | 'right' | 'next' | 'prev') => void;
  onCreateOption?: (name: string) => SelectOption | Promise<SelectOption>;
}

export const SelectCellEditor: React.FC<SelectCellEditorProps> = ({
  value,
  options,
  onCommit,
  onCancel,
  onNavigate,
  onCreateOption,
}) => {
  const [query, setQuery] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filteredOptions = options.filter((opt) =>
    opt.name.toLowerCase().includes(query.toLowerCase().trim())
  );

  const canCreate =
    query.trim().length > 0 &&
    !options.some((o) => o.name.toLowerCase() === query.trim().toLowerCase());

  // 项目总数：filteredOptions + (canCreate ? 1 : 0) + (value ? 1 : 0)
  const items: Array<{ type: 'option'; option: SelectOption } | { type: 'create'; name: string } | { type: 'clear' }> = [];
  if (value) {
    items.push({ type: 'clear' });
  }
  for (const opt of filteredOptions) {
    items.push({ type: 'option', option: opt });
  }
  if (canCreate) {
    items.push({ type: 'create', name: query.trim() });
  }

  useEffect(() => {
    setHighlightIndex(0);
  }, [query]);

  // 点击外部关闭
  useEffect(() => {
    const handlePointerDownOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onCancel();
      }
    };
    document.addEventListener('mousedown', handlePointerDownOutside);
    return () => {
      document.removeEventListener('mousedown', handlePointerDownOutside);
    };
  }, [onCancel]);

  const handleSelectOption = (optId: string | null) => {
    onCommit(optId);
  };

  const handleCreate = async (name: string) => {
    if (onCreateOption) {
      const created = await onCreateOption(name);
      onCommit(created.id);
    } else {
      onCommit(name);
    }
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    // 弹层开启时严格拦截上下方向键，隔离外部 Grid 导航
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      setHighlightIndex((prev) => (items.length > 0 ? (prev + 1) % items.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      setHighlightIndex((prev) => (items.length > 0 ? (prev - 1 + items.length) % items.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      const currentItem = items[highlightIndex];
      if (!currentItem) return;
      if (currentItem.type === 'option') {
        handleSelectOption(currentItem.option.id);
      } else if (currentItem.type === 'create') {
        await handleCreate(currentItem.name);
      } else if (currentItem.type === 'clear') {
        handleSelectOption(null);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
      onNavigate(e.shiftKey ? 'prev' : 'next');
    }
  };

  return (
    <div
      ref={containerRef}
      data-testid="select-cell-popover"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      className="absolute top-full left-0 z-50 mt-1 w-56 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-[#252528] shadow-lg overflow-hidden py-1 text-xs"
      style={{ minWidth: '180px' }}
    >
      <div className="px-2 py-1 border-b border-border-light/60 dark:border-border-dark/60">
        <input
          ref={inputRef}
          type="text"
          data-testid="select-search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="搜索或创建选项..."
          className="w-full px-2 py-1 text-xs bg-neutral-50 dark:bg-neutral-800/60 border border-border-light dark:border-border-dark rounded outline-none text-text-primary-light dark:text-text-primary-dark placeholder:text-text-muted-light dark:placeholder:text-text-muted-dark"
        />
      </div>

      <div
        role="listbox"
        data-testid="select-options-list"
        className="max-h-48 overflow-y-auto p-1 space-y-0.5"
      >
        {items.length === 0 ? (
          <div className="px-3 py-2 text-center text-text-muted-light dark:text-text-muted-dark italic">
            无匹配选项
          </div>
        ) : (
          items.map((item, idx) => {
            const isHighlighted = idx === highlightIndex;

            if (item.type === 'clear') {
              return (
                <div
                  key="clear-option"
                  role="option"
                  aria-selected={false}
                  data-testid="select-option-clear"
                  onClick={() => handleSelectOption(null)}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors text-text-muted-light dark:text-text-muted-dark hover:text-red-600 dark:hover:text-red-400 ${
                    isHighlighted ? 'bg-neutral-100 dark:bg-neutral-800' : ''
                  }`}
                >
                  <X className="w-3.5 h-3.5" />
                  <span>清除选项</span>
                </div>
              );
            }

            if (item.type === 'create') {
              return (
                <div
                  key="create-option"
                  role="option"
                  aria-selected={false}
                  data-testid="select-option-create"
                  onClick={() => handleCreate(item.name)}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors text-blue-600 dark:text-blue-400 font-medium ${
                    isHighlighted ? 'bg-blue-50 dark:bg-blue-950/40' : 'hover:bg-blue-50 dark:hover:bg-blue-950/30'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">创建 &ldquo;{item.name}&rdquo;</span>
                </div>
              );
            }

            const opt = item.option;
            const isSelected = opt.id === value || opt.name === value;
            const color = opt.color || '#3b82f6';

            return (
              <div
                key={opt.id}
                role="option"
                aria-selected={isSelected}
                data-testid={`select-option-${opt.id}`}
                onClick={() => handleSelectOption(opt.id)}
                className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer transition-colors ${
                  isHighlighted ? 'bg-neutral-100 dark:bg-neutral-800' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium truncate"
                    style={{
                      backgroundColor: `${color}20`,
                      color: color,
                    }}
                  >
                    {opt.name}
                  </span>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
