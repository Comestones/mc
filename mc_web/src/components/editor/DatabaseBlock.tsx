import React from 'react';
import {
  AlertCircle,
  Plus,
  Columns,
  List,
} from 'lucide-react';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { DatabaseTable } from './database/DatabaseTable';

interface DatabaseBlockProps {
  id: string;
  databaseId?: string;
  onUpdateProperties?: (properties: Record<string, any>) => void;
  onDelete?: () => void;
  onFocusPrevious?: () => void;
  onFocusNext?: () => void;
}

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

  const columnsCount = database.propertyOrder.length;
  const rowsCount = database.rowOrder.length;

  const handleAddRow = () => {
    const titlePropId =
      database.propertyOrder.find(
        (pid) => database.properties[pid]?.type === 'title'
      ) || database.propertyOrder[0];
    addDatabaseRow(database.id, {
      [titlePropId]: `记录 ${rowsCount + 1}`,
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
            {columnsCount} 字段
          </span>
          <span
            data-testid="db-rows-count"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-medium"
          >
            <List className="w-3 h-3" />
            {rowsCount} 记录
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

      {/* Day 9 表格视图核心交互组件 */}
      <DatabaseTable databaseId={database.id} />

      {/* 底部信息栏 */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-neutral-50 dark:bg-neutral-900/30 border-t border-border-light/60 dark:border-border-dark/60 text-[11px] text-text-muted-light dark:text-text-muted-dark">
        <span>Day 9 表格视图核心交互就绪</span>
        <span>共 {rowsCount} 条记录</span>
      </div>
    </div>
  );
};
