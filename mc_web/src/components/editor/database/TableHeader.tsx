import React, { useRef, useState, useEffect } from 'react';
import {
  Type,
  AlignLeft,
  Hash,
  Tag,
  CheckSquare,
  Calendar,
  Link as LinkIcon,
  Table as TableIcon,
  Plus,
  ChevronDown,
  Clock,
} from 'lucide-react';
import { useWorkspaceStore } from '../../../store/useWorkspaceStore';
import { PropertyType } from '../../../types/database';
import { cn } from '../../../utils/cn';
import { ColumnConfigPopover } from './ColumnConfigPopover';

export const PROPERTY_TYPE_ICONS: Record<PropertyType, React.FC<{ className?: string }>> = {
  title: Type,
  text: AlignLeft,
  number: Hash,
  select: Tag,
  multiSelect: Tag,
  checkbox: CheckSquare,
  date: Calendar,
  url: LinkIcon,
  createdTime: Clock,
};

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  title: '标题',
  text: '文本',
  number: '数字',
  select: '单选',
  multiSelect: '多选',
  checkbox: '复选框',
  date: '日期',
  url: '链接',
  createdTime: '创建时间',
};

export const AVAILABLE_ADD_TYPES: PropertyType[] = [
  'text',
  'number',
  'select',
  'multiSelect',
  'checkbox',
  'date',
  'url',
  'createdTime',
];

import {
  MIN_COLUMN_WIDTH,
  MAX_COLUMN_WIDTH,
  DEFAULT_COLUMN_WIDTH,
} from '../../../types/database';

export {
  MIN_COLUMN_WIDTH,
  MAX_COLUMN_WIDTH,
  DEFAULT_COLUMN_WIDTH,
};

export interface TableHeaderProps {
  databaseId: string;
  propertyOrder: string[];
  resizingWidths?: Record<string, number>;
  onColumnResizing?: (propId: string, width: number | null) => void;
}

export const TableHeader: React.FC<TableHeaderProps> = ({
  databaseId,
  propertyOrder,
  resizingWidths = {},
  onColumnResizing,
}) => {
  const properties = useWorkspaceStore(
    (state) => state.databases[databaseId]?.properties || {}
  );
  const updateDatabaseProperty = useWorkspaceStore(
    (state) => state.updateDatabaseProperty
  );
  const addDatabaseProperty = useWorkspaceStore(
    (state) => state.addDatabaseProperty
  );

  const [configPropId, setConfigPropId] = useState<string | null>(null);

  const [activeResize, setActiveResize] = useState<{
    propId: string;
    startX: number;
    startWidth: number;
    currentWidth: number;
  } | null>(null);

  const activeResizeRef = useRef(activeResize);
  activeResizeRef.current = activeResize;

  // 组件卸载防护
  useEffect(() => {
    return () => {
      if (activeResizeRef.current && onColumnResizing) {
        onColumnResizing(activeResizeRef.current.propId, null);
      }
    };
  }, [onColumnResizing]);

  const handlePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    propId: string,
    initialWidth: number
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const target = e.currentTarget;
    if (typeof target.setPointerCapture === 'function') {
      try {
        target.setPointerCapture(e.pointerId);
      } catch {}
    }

    const startState = {
      propId,
      startX: e.clientX,
      startWidth: initialWidth,
      currentWidth: initialWidth,
    };
    activeResizeRef.current = startState;
    setActiveResize(startState);
    onColumnResizing?.(propId, initialWidth);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const current = activeResizeRef.current;
    if (!current) return;
    e.preventDefault();
    e.stopPropagation();

    const deltaX = e.clientX - current.startX;
    const nextWidth = Math.min(
      MAX_COLUMN_WIDTH,
      Math.max(MIN_COLUMN_WIDTH, Math.round(current.startWidth + deltaX))
    );

    const nextState = { ...current, currentWidth: nextWidth };
    activeResizeRef.current = nextState;
    setActiveResize(nextState);
    onColumnResizing?.(current.propId, nextWidth);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const current = activeResizeRef.current;
    if (!current) return;
    e.preventDefault();
    e.stopPropagation();

    try {
      if (
        typeof e.currentTarget.hasPointerCapture === 'function' &&
        e.currentTarget.hasPointerCapture(e.pointerId) &&
        typeof e.currentTarget.releasePointerCapture === 'function'
      ) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // 忽略部分浏览器或无 capture 时的释放异常
    }

    const finalWidth = current.currentWidth;
    const propId = current.propId;

    activeResizeRef.current = null;
    setActiveResize(null);
    onColumnResizing?.(propId, null);

    // 单次原子化提交 Store
    updateDatabaseProperty(databaseId, propId, { width: finalWidth });
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    const current = activeResizeRef.current;
    if (!current) return;
    e.preventDefault();
    e.stopPropagation();

    try {
      if (
        typeof e.currentTarget.hasPointerCapture === 'function' &&
        e.currentTarget.hasPointerCapture(e.pointerId) &&
        typeof e.currentTarget.releasePointerCapture === 'function'
      ) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // 忽略部分浏览器或无 capture 时的释放异常
    }

    const propId = current.propId;
    activeResizeRef.current = null;
    setActiveResize(null);
    onColumnResizing?.(propId, null);
    // 取消操作绝不提交 Store，保证列宽保持原值
  };

  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

  // 点击外部或按 Escape 关闭添加列菜单
  useEffect(() => {
    if (!isAddMenuOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setIsAddMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsAddMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAddMenuOpen]);

  const handleCreateColumn = (type: PropertyType) => {
    const newIndex = propertyOrder.length + 1;
    const label = PROPERTY_TYPE_LABELS[type] || '字段';
    addDatabaseProperty(databaseId, {
      name: `${label} ${newIndex}`,
      type,
      ...(type === 'select' || type === 'multiSelect' ? { options: [] } : {}),
    });
    setIsAddMenuOpen(false);
  };

  return (
    <thead className="sticky top-0 z-20 bg-neutral-100/90 dark:bg-[#1e1e20]/90 backdrop-blur-sm shadow-sm">
      <tr role="row" className="border-b border-border-light dark:border-border-dark">
        {propertyOrder.map((propId) => {
          const prop = properties[propId];
          if (!prop) return null;

          const IconComponent = PROPERTY_TYPE_ICONS[prop.type] || TableIcon;
          const displayWidth =
            resizingWidths[propId] ?? prop.width ?? DEFAULT_COLUMN_WIDTH;
          const isResizingThis = activeResize?.propId === propId;

          return (
            <th
              key={propId}
              role="columnheader"
              aria-sort="none"
              data-property-id={propId}
              data-testid={`db-header-${propId}`}
              style={{
                width: `${displayWidth}px`,
                minWidth: `${MIN_COLUMN_WIDTH}px`,
                maxWidth: `${MAX_COLUMN_WIDTH}px`,
              }}
              className="group relative px-3 py-2 text-left font-medium text-text-secondary-light dark:text-text-secondary-dark text-xs border-r border-border-light/60 dark:border-border-dark/60 select-none transition-[width] duration-75"
            >
              <div
                role="button"
                tabIndex={0}
                aria-haspopup="dialog"
                aria-expanded={configPropId === propId}
                aria-label={`配置列 ${prop.name}`}
                data-testid={`db-header-trigger-${propId}`}
                onClick={() => setConfigPropId(configPropId === propId ? null : propId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setConfigPropId(configPropId === propId ? null : propId);
                  }
                }}
                className="flex items-center gap-1.5 pr-2 cursor-pointer hover:text-text-primary-light dark:hover:text-text-primary-dark outline-none focus-visible:ring-1 focus-visible:ring-blue-500 rounded"
              >
                <IconComponent className="w-3.5 h-3.5 text-text-muted-light dark:text-text-muted-dark flex-shrink-0" />
                <span className="truncate font-medium">{prop.name}</span>
                <span className="text-[10px] text-text-muted-light dark:text-text-muted-dark px-1 py-0.2 bg-neutral-200/60 dark:bg-neutral-800 rounded font-normal ml-auto flex-shrink-0">
                  {PROPERTY_TYPE_LABELS[prop.type]}
                </span>
                <button
                  type="button"
                  data-testid={`db-header-menu-${propId}`}
                  className="p-0.5 opacity-0 group-hover:opacity-100 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfigPropId(configPropId === propId ? null : propId);
                  }}
                  title="配置字段"
                >
                  <ChevronDown className="w-3 h-3 text-text-muted-light dark:text-text-muted-dark" />
                </button>
              </div>

              {/* 列配置弹层 */}
              {configPropId === propId && (
                <ColumnConfigPopover
                  databaseId={databaseId}
                  propertyId={propId}
                  onClose={() => {
                    setConfigPropId(null);
                    const trigger = document.querySelector(
                      `[data-testid="db-header-trigger-${propId}"]`
                    ) as HTMLElement | null;
                    trigger?.focus();
                  }}
                />
              )}

              {/* 列宽调整手柄 */}
              <div
                role="separator"
                aria-orientation="vertical"
                data-testid={`column-resize-handle-${propId}`}
                data-resize-handle="true"
                onPointerDown={(e) => handlePointerDown(e, propId, displayWidth)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
                className={cn(
                  'absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize transition-colors z-30',
                  isResizingThis
                    ? 'bg-blue-500 w-1.5'
                    : 'hover:bg-blue-400/80 group-hover:bg-neutral-300 dark:group-hover:bg-neutral-700'
                )}
              />
            </th>
          );
        })}

        {/* 表头最右侧新增列按钮与类型菜单 */}
        <th
          role="presentation"
          data-testid="db-header-add-column"
          className="relative min-w-[50px] px-1 py-1.5 text-center text-text-muted-light dark:text-text-muted-dark border-r border-border-light/60 dark:border-border-dark/60 font-normal"
        >
          <div className="flex items-center justify-center gap-0.5">
            <button
              type="button"
              data-testid="table-add-column-btn"
              onClick={() => handleCreateColumn('text')}
              className="p-1 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 rounded transition-colors inline-flex items-center justify-center text-text-muted-light hover:text-text-primary-light dark:hover:text-text-primary-dark"
              title="添加列"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              data-testid="table-add-column-menu-trigger"
              aria-haspopup="menu"
              aria-expanded={isAddMenuOpen}
              onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
              className="p-1 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 rounded transition-colors inline-flex items-center justify-center text-text-muted-light hover:text-text-primary-light dark:hover:text-text-primary-dark"
              title="选择字段类型"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>

          {isAddMenuOpen && (
            <div
              ref={addMenuRef}
              role="menu"
              aria-label="选择字段类型"
              data-testid="add-column-type-menu"
              className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-[#252528] border border-border-light dark:border-border-dark rounded-lg shadow-lg z-50 py-1 text-left select-none"
            >
              <div className="px-2.5 py-1 text-[11px] font-medium text-text-muted-light dark:text-text-muted-dark border-b border-border-light/60 dark:border-border-dark/60 mb-1">
                选择字段类型
              </div>
              {AVAILABLE_ADD_TYPES.map((type) => {
                const Icon = PROPERTY_TYPE_ICONS[type] || TableIcon;
                const label = PROPERTY_TYPE_LABELS[type];
                return (
                  <button
                    key={type}
                    role="menuitem"
                    type="button"
                    data-testid={`add-column-type-option-${type}`}
                    onClick={() => handleCreateColumn(type)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-text-primary-light dark:text-text-primary-dark hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-left"
                  >
                    <Icon className="w-3.5 h-3.5 text-text-muted-light dark:text-text-muted-dark flex-shrink-0" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </th>
      </tr>
    </thead>
  );
};
