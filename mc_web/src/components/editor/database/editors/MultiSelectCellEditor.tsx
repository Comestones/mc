import React, { useState, useEffect, useRef } from 'react';
import { SelectOption } from '../../../../types/database';
import { Check, Plus, X } from 'lucide-react';

export interface MultiSelectCellEditorProps {
  value: string[] | null | undefined;
  options: SelectOption[];
  onCommit: (val: string[]) => void;
  onCancel: () => void;
  onNavigate: (direction: 'up' | 'down' | 'left' | 'right' | 'next' | 'prev') => void;
  onCreateOption?: (name: string) => SelectOption | Promise<SelectOption>;
}

export const MultiSelectCellEditor: React.FC<MultiSelectCellEditorProps> = ({
  value,
  options,
  onCommit,
  onCancel,
  onNavigate,
  onCreateOption,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    if (Array.isArray(value)) return [...value];
    if (typeof value === 'string' && value) return [value];
    return [];
  });
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

  // 项目列表：filteredOptions + (canCreate ? 1 : 0) + (selectedIds.length > 0 ? 1 : 0)
  const items: Array<
    | { type: 'option'; option: SelectOption }
    | { type: 'create'; name: string }
    | { type: 'clear_all' }
  > = [];

  if (selectedIds.length > 0) {
    items.push({ type: 'clear_all' });
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

  // 点击外部自动提交当前选中并关闭
  useEffect(() => {
    const handlePointerDownOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onCommit(selectedIds);
      }
    };
    document.addEventListener('mousedown', handlePointerDownOutside);
    return () => {
      document.removeEventListener('mousedown', handlePointerDownOutside);
    };
  }, [selectedIds, onCommit]);

  const handleToggleOption = (optId: string) => {
    const next = selectedIds.includes(optId)
      ? selectedIds.filter((id) => id !== optId)
      : [...selectedIds, optId];
    setSelectedIds(next);
  };

  const handleClearAll = () => {
    setSelectedIds([]);
  };

  const handleCreate = async (name: string) => {
    if (onCreateOption) {
      const created = await onCreateOption(name);
      setSelectedIds((prev) => [...prev, created.id]);
      setQuery('');
    } else {
      setSelectedIds((prev) => [...prev, name]);
      setQuery('');
    }
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    // 弹层开启时严格隔离外部 Grid 导航
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
      if (!currentItem) {
        onCommit(selectedIds);
        return;
      }
      if (currentItem.type === 'option') {
        handleToggleOption(currentItem.option.id);
      } else if (currentItem.type === 'create') {
        await handleCreate(currentItem.name);
      } else if (currentItem.type === 'clear_all') {
        handleClearAll();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      onCommit(selectedIds);
      onNavigate(e.shiftKey ? 'prev' : 'next');
    }
  };

  return (
    <div
      ref={containerRef}
      data-testid="multi-select-cell-popover"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      className="absolute top-full left-0 z-50 mt-1 w-64 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-[#252528] shadow-lg overflow-hidden py-1 text-xs"
      style={{ minWidth: '220px' }}
    >
      <div className="px-2 py-1 border-b border-border-light/60 dark:border-border-dark/60">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={true}
          aria-autocomplete="list"
          aria-controls="multi-select-options-listbox"
          aria-activedescendant={
            items[highlightIndex]
              ? `multi-select-opt-${items[highlightIndex].type === 'option' ? (items[highlightIndex] as any).option.id : items[highlightIndex].type}`
              : undefined
          }
          data-testid="multi-select-search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="搜索或创建标签..."
          className="w-full px-2 py-1 text-xs bg-neutral-50 dark:bg-neutral-800/60 border border-border-light dark:border-border-dark rounded outline-none text-text-primary-light dark:text-text-primary-dark placeholder:text-text-muted-light dark:placeholder:text-text-muted-dark"
        />
      </div>

      <div
        id="multi-select-options-listbox"
        role="listbox"
        aria-label="多选标签"
        data-testid="multi-select-options-list"
        className="max-h-52 overflow-y-auto p-1 space-y-0.5"
      >
        {items.length === 0 ? (
          <div className="px-3 py-2 text-center text-text-muted-light dark:text-text-muted-dark italic">
            无匹配标签
          </div>
        ) : (
          items.map((item, idx) => {
            const isHighlighted = idx === highlightIndex;

            if (item.type === 'clear_all') {
              return (
                <div
                  key="clear-all"
                  id="multi-select-opt-clear-all"
                  role="option"
                  aria-selected={false}
                  data-testid="multi-select-clear-all"
                  onClick={handleClearAll}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors text-text-muted-light dark:text-text-muted-dark hover:text-red-600 dark:hover:text-red-400 ${
                    isHighlighted ? 'bg-neutral-100 dark:bg-neutral-800' : ''
                  }`}
                >
                  <X className="w-3.5 h-3.5" />
                  <span>清除全部选中 ({selectedIds.length})</span>
                </div>
              );
            }

            if (item.type === 'create') {
              return (
                <div
                  key="create-option"
                  id="multi-select-opt-create"
                  role="option"
                  aria-selected={false}
                  data-testid="multi-select-option-create"
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
            const isSelected = selectedIds.includes(opt.id) || selectedIds.includes(opt.name);
            const color = opt.color || '#3b82f6';

            return (
              <div
                key={opt.id}
                id={`multi-select-opt-${opt.id}`}
                role="option"
                aria-selected={isSelected}
                data-testid={`multi-select-option-${opt.id}`}
                onClick={() => handleToggleOption(opt.id)}
                className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer transition-colors ${
                  isHighlighted ? 'bg-neutral-100 dark:bg-neutral-800' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${
                      isSelected
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-neutral-300 dark:border-neutral-600'
                    }`}
                  >
                    {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
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
              </div>
            );
          })
        )}
      </div>

      <div className="px-2 py-1.5 border-t border-border-light/60 dark:border-border-dark/60 flex items-center justify-between text-[11px] text-text-muted-light dark:text-text-muted-dark">
        <span>已选 {selectedIds.length} 项</span>
        <button
          type="button"
          onClick={() => onCommit(selectedIds)}
          className="px-2 py-0.5 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium text-xs"
        >
          完成
        </button>
      </div>
    </div>
  );
};
