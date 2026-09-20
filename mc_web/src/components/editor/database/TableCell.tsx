import React, { useEffect, useRef, useCallback } from 'react';
import { useWorkspaceStore } from '../../../store/useWorkspaceStore';
import { cn } from '../../../utils/cn';
import { Check, ExternalLink } from 'lucide-react';
import { TextCellEditor } from './editors/TextCellEditor';
import { NumberCellEditor } from './editors/NumberCellEditor';
import { SelectCellEditor } from './editors/SelectCellEditor';
import { MultiSelectCellEditor } from './editors/MultiSelectCellEditor';

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
  const addDatabaseSelectOption = useWorkspaceStore((state) => state.addDatabaseSelectOption);

  const cellRef = useRef<HTMLTableCellElement>(null);

  const isEditable =
    property?.type === 'title' ||
    property?.type === 'text' ||
    property?.type === 'number' ||
    property?.type === 'select' ||
    property?.type === 'multiSelect';

  // 当聚焦但非编辑态时，确保单元格容器聚焦以支持键盘监听
  useEffect(() => {
    if (isFocused && !isEditing) {
      cellRef.current?.focus();
    }
  }, [isFocused, isEditing]);

  const handleCommit = useCallback(
    (val: any) => {
      updateDatabaseCell(databaseId, rowId, propertyId, val);
      onStopEdit();
    },
    [databaseId, rowId, propertyId, updateDatabaseCell, onStopEdit]
  );

  const handleToggleCheckbox = useCallback(() => {
    const nextVal = !cellValue;
    updateDatabaseCell(databaseId, rowId, propertyId, nextVal);
  }, [databaseId, rowId, propertyId, cellValue, updateDatabaseCell]);

  const handleCreateOption = useCallback(
    async (name: string) => {
      const optId = `opt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newOpt = { id: optId, name: name.trim(), color: 'blue' };
      addDatabaseSelectOption(databaseId, propertyId, newOpt);
      return newOpt;
    },
    [databaseId, propertyId, addDatabaseSelectOption]
  );

  const handleCellKeyDown = (e: React.KeyboardEvent<HTMLTableCellElement>) => {
    if (isEditing) return;

    // Checkbox 特殊处理：空格键或回车直接切换
    if (property?.type === 'checkbox') {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        handleToggleCheckbox();
        return;
      }
    }

    if (e.key === 'Enter' || e.key === 'F2') {
      if (isEditable) {
        e.preventDefault();
        onStartEdit(rowIndex, colIndex);
      }
    } else if (e.key === ' ') {
      if (property?.type === 'select' || property?.type === 'multiSelect') {
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
    if (property?.type === 'checkbox') {
      handleToggleCheckbox();
    } else if (isEditable) {
      onStartEdit(rowIndex, colIndex);
    }
  };

  const handleClick = () => {
    if (isEditing) return;
    onFocusCell(rowIndex, colIndex);
    if (property?.type === 'checkbox') {
      // 点击 checkbox 单元格直接触发切换
      handleToggleCheckbox();
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLTableCellElement>) => {
    if (e.target !== cellRef.current) return;
    if (!isFocused) {
      onFocusCell(rowIndex, colIndex);
    }
  };

  // 格式化只读/非编辑态下的展示内容
  const renderFormattedValue = () => {
    if (property?.type === 'checkbox') {
      return (
        <div
          data-testid="db-checkbox-cell"
          className="flex items-center cursor-pointer"
        >
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
    }

    if (cellValue === undefined || cellValue === null || cellValue === '') {
      return <span className="text-neutral-300 dark:text-neutral-600 select-none">-</span>;
    }

    switch (property?.type) {
      case 'select': {
        const option = property.options?.find((opt) => opt.id === cellValue || opt.name === cellValue);
        const name = option?.name || String(cellValue);
        const color = option?.color || '#3b82f6';
        return (
          <span
            data-testid={`db-select-tag-${cellValue}`}
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
                  data-testid={`db-multiselect-tag-${val}`}
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
        return <span className="font-mono text-right w-full block">{String(cellValue)}</span>;

      case 'title':
        return <span className="font-semibold text-text-primary-light dark:text-text-primary-dark truncate">{String(cellValue)}</span>;

      case 'text':
      default:
        return <span className="text-text-primary-light dark:text-text-primary-dark truncate">{String(cellValue)}</span>;
    }
  };

  const renderEditor = () => {
    switch (property?.type) {
      case 'number':
        return (
          <NumberCellEditor
            value={typeof cellValue === 'number' ? cellValue : null}
            onCommit={(val) => handleCommit(val)}
            onCancel={onStopEdit}
            onNavigate={onNavigate}
          />
        );

      case 'select':
        return (
          <div className="relative w-full">
            <div className="flex items-center min-h-[20px] w-full">
              {renderFormattedValue()}
            </div>
            <SelectCellEditor
              value={cellValue as string | null}
              options={property.options || []}
              onCommit={(val) => handleCommit(val)}
              onCancel={onStopEdit}
              onNavigate={onNavigate}
              onCreateOption={handleCreateOption}
            />
          </div>
        );

      case 'multiSelect':
        return (
          <div className="relative w-full">
            <div className="flex items-center min-h-[20px] w-full">
              {renderFormattedValue()}
            </div>
            <MultiSelectCellEditor
              value={Array.isArray(cellValue) ? cellValue : []}
              options={property.options || []}
              onCommit={(val) => handleCommit(val)}
              onCancel={onStopEdit}
              onNavigate={onNavigate}
              onCreateOption={handleCreateOption}
            />
          </div>
        );

      case 'title':
      case 'text':
      default:
        return (
          <TextCellEditor
            value={cellValue !== undefined && cellValue !== null ? String(cellValue) : ''}
            onCommit={(val) => handleCommit(val)}
            onCancel={onStopEdit}
            onNavigate={onNavigate}
          />
        );
    }
  };

  return (
    <td
      ref={cellRef}
      role="gridcell"
      tabIndex={isRovingTabStop !== undefined ? (isRovingTabStop ? 0 : -1) : (isFocused ? 0 : -1)}
      aria-selected={isFocused}
      aria-readonly={!isEditable && property?.type !== 'checkbox'}
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
        property?.type === 'number' && 'text-right',
        !isEditing && 'hover:bg-neutral-50/70 dark:hover:bg-neutral-800/40 cursor-pointer'
      )}
    >
      {isEditing ? (
        renderEditor()
      ) : (
        <div className="flex items-center min-h-[20px] w-full overflow-hidden">
          {renderFormattedValue()}
        </div>
      )}
    </td>
  );
};
