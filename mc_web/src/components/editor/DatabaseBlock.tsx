import React from 'react';
import {
  Table as TableIcon,
  AlertCircle,
  Plus,
  Columns,
  List,
  Type,
  Hash,
  Tag,
  CheckSquare,
  Calendar,
  Link,
  AlignLeft,
} from 'lucide-react';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { PropertyType } from '../../types/database';
import { cn } from '../../utils/cn';

interface DatabaseBlockProps {
  id: string;
  databaseId?: string;
  onUpdateProperties?: (properties: Record<string, any>) => void;
  onDelete?: () => void;
  onFocusPrevious?: () => void;
  onFocusNext?: () => void;
}

const PROPERTY_TYPE_ICONS: Record<PropertyType, React.FC<{ className?: string }>> = {
  title: Type,
  text: AlignLeft,
  number: Hash,
  select: Tag,
  multiSelect: Tag,
  checkbox: CheckSquare,
  date: Calendar,
  url: Link,
};

const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  title: '标题',
  text: '文本',
  number: '数字',
  select: '单选',
  multiSelect: '多选',
  checkbox: '复选框',
  date: '日期',
  url: '链接',
};

export const DatabaseBlock: React.FC<DatabaseBlockProps> = ({
  id: _blockId,
  databaseId,
  onUpdateProperties,
  onDelete: _onDelete,
}) => {
  const database = useWorkspaceStore((state) =>
    databaseId ? state.databases[databaseId] : undefined
  );
  const createDatabase = useWorkspaceStore((state) => state.createDatabase);
  const addDatabaseRow = useWorkspaceStore((state) => state.addDatabaseRow);
  const updateDatabase = useWorkspaceStore((state) => state.updateDatabase);

  // 1. 数据库未绑定或实体已丢失降级回退处理
  if (!database || !databaseId) {
    return (
      <div
        data-testid="database-block-fallback"
        className="my-3 p-4 rounded-xl border border-dashed border-amber-300 dark:border-amber-700/60 bg-amber-50/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 transition-all"
      >
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <span className="text-sm font-semibold">多维数据库未找到或已被移除</span>
        </div>
        <p className="text-xs text-amber-700 dark:text-amber-400 mb-3 font-mono">
          关联 ID: {databaseId || '未配置'}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="recreate-database-btn"
            onClick={() => {
              const newDbId = createDatabase('新建多维数据库');
              onUpdateProperties?.({ databaseId: newDbId });
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-sm transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            新建并关联新数据库
          </button>
        </div>
      </div>
    );
  }

  const columns = database.propertyOrder
    .map((pid) => database.properties[pid])
    .filter(Boolean);
  const rows = database.rowOrder
    .map((rid) => database.rows[rid])
    .filter(Boolean);

  const handleAddRow = () => {
    const titlePropId = columns.find((c) => c.type === 'title')?.id || database.propertyOrder[0];
    addDatabaseRow(database.id, {
      [titlePropId]: `记录 ${rows.length + 1}`,
    });
  };

  return (
    <div
      data-testid="database-block-container"
      data-database-id={database.id}
      className="my-3 w-full rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-[#1e1e20] shadow-sm overflow-hidden transition-all"
    >
      {/* 数据库头部 */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-border-light dark:border-border-dark bg-neutral-50/70 dark:bg-neutral-900/40">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xl select-none" role="img" aria-label="database icon">
            {database.icon || '📊'}
          </span>
          <input
            type="text"
            data-testid="database-title-input"
            value={database.title}
            onChange={(e) => updateDatabase(database.id, { title: e.target.value })}
            placeholder="无标题数据库"
            className="font-semibold text-sm text-text-primary-light dark:text-text-primary-dark bg-transparent border-none outline-none focus:ring-1 focus:ring-blue-500/50 rounded px-1.5 py-0.5"
          />
        </div>

        {/* 字段与记录数徽标 */}
        <div className="flex items-center gap-2 text-xs text-text-muted-light dark:text-text-muted-dark">
          <span
            data-testid="db-columns-count"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-medium"
          >
            <Columns className="w-3 h-3" />
            {columns.length} 字段
          </span>
          <span
            data-testid="db-rows-count"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-medium"
          >
            <List className="w-3 h-3" />
            {rows.length} 记录
          </span>
          <button
            type="button"
            data-testid="db-add-row-btn"
            onClick={handleAddRow}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors ml-1"
          >
            <Plus className="w-3.5 h-3.5" />
            添加行
          </button>
        </div>
      </div>

      {/* 列结构与数据简要预览 */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border-light dark:border-border-dark bg-neutral-100/40 dark:bg-neutral-900/60">
              {columns.map((col) => {
                const IconComponent = PROPERTY_TYPE_ICONS[col.type] || TableIcon;
                return (
                  <th
                    key={col.id}
                    data-property-id={col.id}
                    style={{ width: col.width ? `${col.width}px` : 'auto' }}
                    className="px-3 py-2 font-medium text-text-secondary-light dark:text-text-secondary-dark select-none"
                  >
                    <div className="flex items-center gap-1.5">
                      <IconComponent className="w-3.5 h-3.5 text-text-muted-light dark:text-text-muted-dark flex-shrink-0" />
                      <span className="truncate">{col.name}</span>
                      <span className="text-[10px] text-text-muted-light dark:text-text-muted-dark px-1 py-0.2 bg-neutral-200/60 dark:bg-neutral-800 rounded font-normal">
                        {PROPERTY_TYPE_LABELS[col.type]}
                      </span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length || 1}
                  className="px-4 py-6 text-center text-text-muted-light dark:text-text-muted-dark italic"
                >
                  暂无记录，点击上方「添加行」开始录入数据
                </td>
              </tr>
            ) : (
              rows.slice(0, 5).map((row) => (
                <tr
                  key={row.id}
                  data-row-id={row.id}
                  className="border-b border-border-light/60 dark:border-border-dark/60 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition-colors"
                >
                  {columns.map((col) => {
                    const rawVal = row.cells[col.id];
                    let displayVal: React.ReactNode = '-';
                    if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
                      if (typeof rawVal === 'boolean') {
                        displayVal = rawVal ? '☑ 是' : '☐ 否';
                      } else if (Array.isArray(rawVal)) {
                        displayVal = rawVal.join(', ');
                      } else {
                        displayVal = String(rawVal);
                      }
                    }
                    return (
                      <td
                        key={col.id}
                        className={cn(
                          'px-3 py-2 text-text-primary-light dark:text-text-primary-dark truncate max-w-[240px]',
                          col.type === 'title' && 'font-medium'
                        )}
                      >
                        {displayVal}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 底部信息栏 */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-neutral-50 dark:bg-neutral-900/30 border-t border-border-light/60 dark:border-border-dark/60 text-[11px] text-text-muted-light dark:text-text-muted-dark">
        <span>Day 8 核心 Schema 数据层已就绪</span>
        {rows.length > 5 && <span>仅预览前 5 条，共 {rows.length} 条</span>}
      </div>
    </div>
  );
};
