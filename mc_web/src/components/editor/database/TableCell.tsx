import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useWorkspaceStore } from '../../../store/useWorkspaceStore';
import { cn } from '../../../utils/cn';
import { Check, ExternalLink } from 'lucide-react';

export interface TableCellProps {
  databaseId: string;
  rowId: string;
  propertyId: string;
  rowIndex: number;
  colIndex: number;
  isFocused: boolean;
  isRovingTabStop?: boolean;
  isEditing: boolean;
  onFocusCell: (rowIndex: number, colIndex: number) => void;
  onStartEdit: (rowIndex: number, colIndex: number) => void;
  onStopEdit: () => void;
  onNavigate: (direction: 'up' | 'down' | 'left' | 'right' | 'next' | 'prev') => void;
}

export const TableCell: React.FC<TableCellProps> = ({
  databaseId,
  rowId,
  propertyId,
  rowIndex,
  colIndex,
  isFocused,
  isRovingTabStop,
  isEditing,
  onFocusCell,
  onStartEdit,
  onStopEdit,
  onNavigate,
}) => {
  const property = useWorkspaceStore(
    (state) => state.databases[databaseId]?.properties[propertyId]
  );
  const cellValue = useWorkspaceStore(
    (state) => state.databases[databaseId]?.rows[rowId]?.cells[propertyId]
  );
  const updateDatabaseCell = useWorkspaceStore((state) => state.updateDatabaseCell);

  const cellRef = useRef<HTMLTableCellElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isComposingRef = useRef(false);
  const committedRef = useRef(false);

  const [draftValue, setDraftValue] = useState<string>('');

  const isEditable = property?.type === 'title' || property?.type === 'text';

  // 当进入编辑状态时初始化草稿值
  useEffect(() => {
    if (isEditing) {
      setDraftValue(cellValue !== undefined && cellValue !== null ? String(cellValue) : '');
      committedRef.current = false;
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing, cellValue]);

  // 当聚焦但非编辑态时，确保单元格容器聚焦以支持键盘监听
  useEffect(() => {
    if (isFocused && !isEditing) {
      cellRef.current?.focus();
    }
  }, [isFocused, isEditing]);

  const handleCommit = useCallback(
    (val: string) => {
      if (committedRef.current) return;
      committedRef.current = true;
      const finalVal = val.trim();
      updateDatabaseCell(databaseId, rowId, propertyId, finalVal);
    },
    [databaseId, rowId, propertyId, updateDatabaseCell]
  );

  const handleInputBlur = () => {
    if (isEditing) {
      handleCommit(draftValue);
      onStopEdit();
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // 中文输入法合成中不拦截
    if (isComposingRef.current || e.nativeEvent.isComposing) {
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      handleCommit(draftValue);
      onStopEdit();
      onNavigate('down');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      handleCommit(draftValue);
      onStopEdit();
      onNavigate(e.shiftKey ? 'prev' : 'next');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      // 放弃修改，重置草稿
      setDraftValue(cellValue !== undefined && cellValue !== null ? String(cellValue) : '');
      committedRef.current = true; // 阻止 onBlur 再次提交草稿
      onStopEdit();
      // 回退焦点至单元格本身
      cellRef.current?.focus();
    }
  };

  const handleCellKeyDown = (e: React.KeyboardEvent<HTMLTableCellElement>) => {
    if (isEditing) return;

    if (e.key === 'Enter' || e.key === 'F2') {
      if (isEditable) {
        e.preventDefault();
        onStartEdit(rowIndex, colIndex);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      onNavigate('up');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      onNavigate('down');
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      onNavigate('left');
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      onNavigate('right');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      onNavigate(e.shiftKey ? 'prev' : 'next');
    }
  };

  const handleDoubleClick = () => {
    if (isEditable) {
      onStartEdit(rowIndex, colIndex);
    }
  };

  const handleClick = () => {
    onFocusCell(rowIndex, colIndex);
  };

  const handleFocus = (e: React.FocusEvent<HTMLTableCellElement>) => {
    if (e.target !== cellRef.current) return;
    if (!isFocused) {
      onFocusCell(rowIndex, colIndex);
    }
  };

  // 格式化只读/非编辑态下的展示内容
  const renderFormattedValue = () => {
    if (cellValue === undefined || cellValue === null || cellValue === '') {
      return <span className="text-neutral-300 dark:text-neutral-600 select-none">-</span>;
    }

    switch (property?.type) {
      case 'checkbox':
        return (
          <div className="flex items-center">
            <span
              className={cn(
                'w-4 h-4 rounded flex items-center justify-center border text-[10px] transition-colors',
                cellValue
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800'
              )}
            >
              {cellValue ? <Check className="w-3 h-3 stroke-[3]" /> : null}
            </span>
          </div>
        );

      case 'select': {
        const option = property.options?.find((opt) => opt.id === cellValue || opt.name === cellValue);
        const name = option?.name || String(cellValue);
        const color = option?.color || '#3b82f6';
        return (
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium max-w-full truncate"
            style={{
              backgroundColor: `${color}20`,
              color: color,
            }}
          >
            {name}
          </span>
        );
      }

      case 'multiSelect': {
        const values = Array.isArray(cellValue) ? cellValue : [String(cellValue)];
        return (
          <div className="flex flex-wrap items-center gap-1">
            {values.map((val, idx) => {
              const option = property.options?.find((opt) => opt.id === val || opt.name === val);
              const name = option?.name || String(val);
              const color = option?.color || '#3b82f6';
              return (
                <span
                  key={idx}
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium"
                  style={{
                    backgroundColor: `${color}20`,
                    color: color,
                  }}
                >
                  {name}
                </span>
              );
            })}
          </div>
        );
      }

      case 'url':
        return (
          <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline truncate">
            <span className="truncate">{String(cellValue)}</span>
            <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-70" />
          </span>
        );

      case 'number':
        return <span className="font-mono text-right">{String(cellValue)}</span>;

      case 'title':
        return <span className="font-semibold text-text-primary-light dark:text-text-primary-dark truncate">{String(cellValue)}</span>;

      case 'text':
      default:
        return <span className="text-text-primary-light dark:text-text-primary-dark truncate">{String(cellValue)}</span>;
    }
  };

  return (
    <td
      ref={cellRef}
      role="gridcell"
      tabIndex={isRovingTabStop !== undefined ? (isRovingTabStop ? 0 : -1) : (isFocused ? 0 : -1)}
      aria-selected={isFocused}
      aria-readonly={!isEditable}
      data-testid={`db-cell-${rowIndex}-${colIndex}`}
      data-row-index={rowIndex}
      data-col-index={colIndex}
      data-property-id={propertyId}
      onClick={handleClick}
      onFocus={handleFocus}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleCellKeyDown}
      className={cn(
        'px-3 py-2 text-xs border-r border-b border-border-light/60 dark:border-border-dark/60 outline-none transition-colors relative select-none',
        isFocused && 'ring-2 ring-blue-500 ring-inset z-10 bg-blue-50/20 dark:bg-blue-950/20',
        property?.type === 'title' && 'font-medium',
        !isEditing && 'hover:bg-neutral-50/70 dark:hover:bg-neutral-800/40 cursor-pointer'
      )}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          autoFocus
          type="text"
          data-testid="db-cell-input"
          value={draftValue}
          onChange={(e) => setDraftValue(e.target.value)}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          onCompositionStart={() => {
            isComposingRef.current = true;
          }}
          onCompositionEnd={() => {
            isComposingRef.current = false;
          }}
          className="w-full h-full p-0 m-0 bg-transparent border-none outline-none text-xs font-inherit text-text-primary-light dark:text-text-primary-dark select-text"
        />
      ) : (
        <div className="flex items-center min-h-[20px] w-full overflow-hidden">
          {renderFormattedValue()}
        </div>
      )}
    </td>
  );
};
