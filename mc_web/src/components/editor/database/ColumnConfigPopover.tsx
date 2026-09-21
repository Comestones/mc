import React, { useState, useRef, useEffect } from 'react';
import { useWorkspaceStore } from '../../../store/useWorkspaceStore';
import { DatabaseProperty, PropertyType, SelectOption, PRESET_OPTION_COLORS } from '../../../types/database';
import { getIncompatibleCellCount } from '../../../utils/databaseUtils';
import { PROPERTY_TYPE_LABELS } from './TableHeader';
import { Trash2, Plus, X } from 'lucide-react';

export interface ColumnConfigPopoverProps {
  databaseId: string;
  propertyId: string;
  onClose: () => void;
}

const ALLOWED_TYPES: PropertyType[] = [
  'text',
  'number',
  'select',
  'multiSelect',
  'checkbox',
  'date',
  'url',
  'createdTime',
];

export const ColumnConfigPopover: React.FC<ColumnConfigPopoverProps> = ({
  databaseId,
  propertyId,
  onClose,
}) => {
  const database = useWorkspaceStore((state) => state.databases[databaseId]);
  const property = database?.properties[propertyId] as DatabaseProperty | undefined;

  const updateDatabaseProperty = useWorkspaceStore((state) => state.updateDatabaseProperty);
  const changeDatabasePropertyType = useWorkspaceStore((state) => state.changeDatabasePropertyType);
  const deleteDatabaseProperty = useWorkspaceStore((state) => state.deleteDatabaseProperty);
  const addDatabaseSelectOption = useWorkspaceStore((state) => state.addDatabaseSelectOption);
  const updateDatabaseSelectOption = useWorkspaceStore((state) => state.updateDatabaseSelectOption);
  const deleteDatabaseSelectOption = useWorkspaceStore((state) => state.deleteDatabaseSelectOption);

  const [name, setName] = useState(property?.name || '');
  const [newOptionName, setNewOptionName] = useState('');
  const [pendingTypeChange, setPendingTypeChange] = useState<{
    newType: PropertyType;
    affectedCount: number;
  } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const isTitle = property?.type === 'title';

  // 点击外部关闭
  useEffect(() => {
    const handlePointerDownOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handlePointerDownOutside);
    return () => {
      document.removeEventListener('mousedown', handlePointerDownOutside);
    };
  }, [onClose]);

  if (!property) return null;

  const handleNameBlur = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== property.name) {
      updateDatabaseProperty(databaseId, propertyId, { name: trimmed });
    } else {
      setName(property.name);
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      setName(property.name);
      onClose();
    }
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as PropertyType;
    if (isTitle || newType === property.type) return;

    if (database) {
      const affectedCount = getIncompatibleCellCount(database, propertyId, newType);
      if (affectedCount > 0) {
        setPendingTypeChange({ newType, affectedCount });
        return;
      }
    }

    setPendingTypeChange(null);
    changeDatabasePropertyType(databaseId, propertyId, newType);
  };

  const handleConfirmTypeChange = () => {
    if (pendingTypeChange) {
      changeDatabasePropertyType(databaseId, propertyId, pendingTypeChange.newType);
      setPendingTypeChange(null);
    }
  };

  const handleCancelTypeChange = () => {
    setPendingTypeChange(null);
  };

  const handleDeleteColumn = () => {
    if (isTitle) return;
    deleteDatabaseProperty(databaseId, propertyId);
    onClose();
  };

  const handleAddOption = () => {
    const trimmed = newOptionName.trim();
    if (!trimmed) return;
    addDatabaseSelectOption(databaseId, propertyId, { name: trimmed });
    setNewOptionName('');
  };

  const isSelectType = property.type === 'select' || property.type === 'multiSelect';

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="编辑列"
      aria-modal="false"
      data-testid="column-config-popover"
      className="absolute top-full left-0 z-50 mt-1 w-64 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-[#252528] shadow-xl p-3 text-xs text-text-primary-light dark:text-text-primary-dark select-none space-y-3"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      {/* 头部关闭 */}
      <div className="flex items-center justify-between pb-2 border-b border-border-light/60 dark:border-border-dark/60">
        <span className="font-semibold text-xs">编辑列</span>
        <button
          type="button"
          data-testid="column-config-close"
          onClick={onClose}
          className="text-text-muted-light dark:text-text-muted-dark hover:text-text-primary-light dark:hover:text-text-primary-dark p-0.5 rounded"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 列名称 */}
      <div className="space-y-1">
        <label className="text-[11px] font-medium text-text-muted-light dark:text-text-muted-dark">
          列名称
        </label>
        <input
          type="text"
          data-testid="column-name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleNameBlur}
          onKeyDown={handleNameKeyDown}
          className="w-full px-2 py-1 text-xs bg-neutral-50 dark:bg-neutral-800/60 border border-border-light dark:border-border-dark rounded outline-none focus:border-blue-500"
        />
      </div>

      {/* 列类型 */}
      <div className="space-y-1">
        <label className="text-[11px] font-medium text-text-muted-light dark:text-text-muted-dark">
          字段类型
        </label>
        {isTitle ? (
          <div
            data-testid="column-type-title-disabled"
            className="w-full px-2 py-1 text-xs bg-neutral-100 dark:bg-neutral-800 text-text-muted-light dark:text-text-muted-dark rounded border border-border-light/60 dark:border-border-dark/60 flex items-center justify-between"
          >
            <span>主标题 (不可更改)</span>
          </div>
        ) : (
          <select
            data-testid="column-type-select"
            value={pendingTypeChange ? pendingTypeChange.newType : property.type}
            onChange={handleTypeChange}
            className="w-full px-2 py-1 text-xs bg-neutral-50 dark:bg-neutral-800/60 border border-border-light dark:border-border-dark rounded outline-none focus:border-blue-500 cursor-pointer"
          >
            {ALLOWED_TYPES.map((t) => (
              <option key={t} value={t}>
                {PROPERTY_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        )}

        {/* 破坏性切换确认对话框 */}
        {pendingTypeChange && (
          <div
            data-testid="type-change-confirm-dialog"
            role="alertdialog"
            aria-labelledby="type-change-title"
            aria-describedby="type-change-desc"
            className="mt-2 p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded text-xs space-y-2"
          >
            <div id="type-change-title" className="font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-1">
              <span>⚠️ 转换可能导致数据丢失</span>
            </div>
            <div id="type-change-desc" className="text-amber-700 dark:text-amber-300 text-[11px] leading-relaxed">
              切换至 <strong>{PROPERTY_TYPE_LABELS[pendingTypeChange.newType]}</strong> 将导致{' '}
              <strong>{pendingTypeChange.affectedCount}</strong> 行无法转换的数据被清空。是否继续？
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                data-testid="cancel-type-change-btn"
                onClick={handleCancelTypeChange}
                className="px-2 py-1 bg-white dark:bg-neutral-800 border border-border-light dark:border-border-dark rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 text-text-primary-light dark:text-text-primary-dark font-medium text-[11px]"
              >
                取消
              </button>
              <button
                type="button"
                data-testid="confirm-type-change-btn"
                onClick={handleConfirmTypeChange}
                className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded font-medium text-[11px]"
              >
                确认清空并转换
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 选项管理 (Select / Multi-select) */}
      {isSelectType && (
        <div className="space-y-2 pt-1 border-t border-border-light/60 dark:border-border-dark/60">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-medium text-text-muted-light dark:text-text-muted-dark">
              选项管理 ({property.options?.length || 0})
            </label>
          </div>

          <div
            data-testid="column-options-list"
            className="max-h-36 overflow-y-auto space-y-1.5 pr-0.5"
          >
            {property.options?.map((opt: SelectOption) => (
              <div
                key={opt.id}
                data-testid={`column-option-row-${opt.id}`}
                className="flex items-center gap-1.5 p-1 rounded bg-neutral-50 dark:bg-neutral-800/50 border border-border-light/60 dark:border-border-dark/60"
              >
                {/* 颜色圆点下拉/切换 */}
                <div className="relative group/color flex-shrink-0">
                  <span
                    className="w-3.5 h-3.5 rounded-full inline-block cursor-pointer shadow-xs border border-black/10"
                    style={{ backgroundColor: opt.color || '#3b82f6' }}
                    title="选择颜色"
                  />
                  <div className="hidden group-hover/color:grid grid-cols-4 gap-1 p-1 absolute top-full left-0 z-50 bg-white dark:bg-neutral-900 border border-border-light dark:border-border-dark rounded shadow-lg">
                    {PRESET_OPTION_COLORS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        data-testid={`color-choice-${c.id}`}
                        onClick={() =>
                          updateDatabaseSelectOption(databaseId, propertyId, opt.id, {
                            color: c.color,
                          })
                        }
                        className="w-4 h-4 rounded-full border border-black/10 hover:scale-110 transition-transform"
                        style={{ backgroundColor: c.color }}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>

                {/* 选项重命名输入 */}
                <input
                  type="text"
                  data-testid={`option-name-input-${opt.id}`}
                  defaultValue={opt.name}
                  onBlur={(e) => {
                    const nextName = e.target.value.trim();
                    if (nextName && nextName !== opt.name) {
                      updateDatabaseSelectOption(databaseId, propertyId, opt.id, {
                        name: nextName,
                      });
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                  }}
                  className="flex-1 min-w-0 px-1 py-0.5 text-xs bg-transparent border-none outline-none text-text-primary-light dark:text-text-primary-dark font-medium"
                />

                {/* 删除选项按钮 */}
                <button
                  type="button"
                  data-testid={`delete-option-${opt.id}`}
                  onClick={() => deleteDatabaseSelectOption(databaseId, propertyId, opt.id)}
                  className="text-text-muted-light hover:text-red-600 dark:text-text-muted-dark dark:hover:text-red-400 p-0.5 rounded"
                  title="删除选项"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          {/* 新增选项输入 */}
          <div className="flex items-center gap-1 mt-1">
            <input
              type="text"
              data-testid="new-option-input"
              value={newOptionName}
              onChange={(e) => setNewOptionName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddOption();
                }
              }}
              placeholder="新增选项..."
              className="flex-1 px-2 py-1 text-xs bg-neutral-50 dark:bg-neutral-800/60 border border-border-light dark:border-border-dark rounded outline-none"
            />
            <button
              type="button"
              data-testid="add-option-btn"
              onClick={handleAddOption}
              className="px-2 py-1 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 rounded text-text-primary-light dark:text-text-primary-dark font-medium text-xs flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              <span>添加</span>
            </button>
          </div>
        </div>
      )}

      {/* 删除列 */}
      {!isTitle && (
        <div className="pt-2 border-t border-border-light/60 dark:border-border-dark/60">
          <button
            type="button"
            data-testid="delete-column-btn"
            onClick={handleDeleteColumn}
            className="w-full flex items-center justify-center gap-1.5 px-2 py-1 rounded text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors font-medium text-xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>删除此列</span>
          </button>
        </div>
      )}
    </div>
  );
};
