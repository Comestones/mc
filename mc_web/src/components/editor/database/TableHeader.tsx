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
} from 'lucide-react';
import { useWorkspaceStore } from '../../../store/useWorkspaceStore';
import { PropertyType } from '../../../types/database';
import { cn } from '../../../utils/cn';

export const PROPERTY_TYPE_ICONS: Record<PropertyType, React.FC<{ className?: string }>> = {
  title: Type,
  text: AlignLeft,
  number: Hash,
  select: Tag,
  multiSelect: Tag,
  checkbox: CheckSquare,
  date: Calendar,
  url: LinkIcon,
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
};

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
              <div className="flex items-center gap-1.5 pr-2">
                <IconComponent className="w-3.5 h-3.5 text-text-muted-light dark:text-text-muted-dark flex-shrink-0" />
                <span className="truncate font-medium">{prop.name}</span>
                <span className="text-[10px] text-text-muted-light dark:text-text-muted-dark px-1 py-0.2 bg-neutral-200/60 dark:bg-neutral-800 rounded font-normal ml-auto flex-shrink-0">
                  {PROPERTY_TYPE_LABELS[prop.type]}
                </span>
              </div>

              {/* 列宽调整手柄 */}
              <div
                role="separator"
                aria-orientation="vertical"
                data-testid={`column-resize-handle-${propId}`}
                data-resize-handle="true"
                onPointerDown={(e) => handlePointerDown(e, propId, displayWidth)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
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
      </tr>
    </thead>
  );
};
