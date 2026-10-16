import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkspaceStore } from '../../../store/useWorkspaceStore';
import { PRESET_OPTION_COLORS } from '../../../types/database';
import { normalizeViewConfig } from '../../../utils/databaseViewUtils';
import { groupBoardRows } from '../../../utils/boardUtils';
import { useDatabaseRowIds } from './useDatabaseRowIds';
import { DatabaseRowDetail } from './DatabaseRowDetail';

const DRAG_TYPE = 'application/x-mc-board-row';

export function DatabaseBoard({ databaseId }: { databaseId: string }) {
  const rowIds = useDatabaseRowIds(databaseId);
  const database = useWorkspaceStore(state => state.databases[databaseId]);
  const [detailRowId, setDetailRowId] = useState<string | null>(null);
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const restoreFocusRef = useRef(false);
  const dragRef = useRef<{ rowId: string; propertyId: string } | null>(null);
  const selectProperties = database?.propertyOrder.filter(id => database.properties[id]?.type === 'select') ?? [];
  const propertyId = database ? normalizeViewConfig(database, database.viewConfig).boardGroupPropertyId ?? '' : '';

  useEffect(() => {
    dragRef.current = null;
    setHoveredGroup(null);
  }, [databaseId, propertyId]);

  const closeDetail = useCallback(() => {
    restoreFocusRef.current = true;
    setDetailRowId(null);
  }, []);

  useEffect(() => {
    if (detailRowId && !database?.rows[detailRowId]) closeDetail();
  }, [database, detailRowId, closeDetail]);

  // Restore only after the dialog has unmounted and removed background inert.
  useEffect(() => {
    if (detailRowId || !restoreFocusRef.current) return;
    restoreFocusRef.current = false;
    if (triggerRef.current?.isConnected) triggerRef.current.focus();
    else boardRef.current?.querySelector<HTMLElement>('button, select')?.focus();
  }, [detailRowId]);

  // Resolve current state at commit time, including concurrent option/field removal.
  const moveRow = (rowId: string, targetId: string | null) => {
    const state = useWorkspaceStore.getState();
    const current = state.databases[databaseId];
    const property = current?.properties[propertyId];
    if (!current?.rows[rowId] || property?.type !== 'select') return;
    if (targetId !== null && !property.options?.some(option => option.id === targetId)) return;
    if ((current.rows[rowId].cells[propertyId] ?? null) === targetId) return;
    state.updateDatabaseCell(databaseId, rowId, propertyId, targetId);
  };

  if (!database) return null;
  const titleId = database.propertyOrder.find(id => database.properties[id]?.type === 'title')!;
  const groups = propertyId ? groupBoardRows(database, propertyId, rowIds) : [];

  return <>
    <div ref={boardRef} role="region" aria-label="数据库看板" data-testid="database-board-container" className="p-3 space-y-3">
      {propertyId ? <label className="flex gap-2 items-center text-xs">
        分组字段
        <select aria-label="看板分组字段" value={propertyId} onChange={event => {
          dragRef.current = null;
          useWorkspaceStore.getState().updateDatabaseViewConfig(databaseId, { boardGroupPropertyId: event.target.value });
        }} className="rounded border p-1 bg-white dark:bg-neutral-800">
          {selectProperties.map(id => <option key={id} value={id}>{database.properties[id].name}</option>)}
        </select>
      </label> : <div className="text-sm space-y-2">
        <p>添加单选状态字段后即可按状态分组。</p>
        <button type="button" className="text-blue-600" onClick={() => {
          useWorkspaceStore.getState().addDatabaseProperty(databaseId, {
            name: '状态', type: 'select', options: [
              { id: 'todo', name: '待办', color: 'gray' },
              { id: 'doing', name: '进行中', color: 'blue' },
              { id: 'done', name: '已完成', color: 'green' },
            ],
          });
        }}>添加状态字段</button>
      </div>}
      {database.rowOrder.length > 0 && rowIds.length === 0 && <p className="text-xs text-neutral-500">没有符合筛选条件的记录，可清空筛选后查看全部记录</p>}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {groups.map(group => {
          const groupKey = group.id === null ? 'ungrouped' : `option-${group.id}`;
          const color = PRESET_OPTION_COLORS.find(color => color.id === group.color || color.color === group.color);
          return <section key={groupKey} aria-label={`${group.name}列`} data-testid={`board-column-${groupKey}`}
            className={`w-64 shrink-0 rounded-lg p-2 bg-neutral-100 dark:bg-neutral-900 border ${hoveredGroup === groupKey ? 'border-blue-500' : 'border-transparent'}`}
            onDragOver={event => {
              if (!dragRef.current || !Array.from(event.dataTransfer.types).includes(DRAG_TYPE)) return;
              event.preventDefault(); event.stopPropagation();
              event.dataTransfer.dropEffect = 'move'; setHoveredGroup(groupKey);
            }}
            onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setHoveredGroup(null); }}
            onDrop={event => {
              event.preventDefault(); event.stopPropagation();
              const drag = dragRef.current;
              if (drag?.propertyId === propertyId && event.dataTransfer.getData(DRAG_TYPE) === drag.rowId) moveRow(drag.rowId, group.id);
              dragRef.current = null; setHoveredGroup(null);
            }}>
            <h3 className="text-sm font-medium mb-2 flex gap-2 items-center">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color?.color ?? '#6b7280' }} />
              {group.name}<span className="text-neutral-500">{group.rowIds.length}</span>
            </h3>
            <div className="space-y-2">
              {group.rowIds.map(rowId => {
                const title = String(database.rows[rowId].cells[titleId] || '无标题');
                return <article key={rowId} data-testid={`board-card-${rowId}`} className="rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-3 space-y-2">
                  <button type="button" draggable aria-label={`打开记录：${title}`} className="text-left w-full break-words cursor-grab text-sm"
                    onDragStart={event => {
                      event.stopPropagation();
                      dragRef.current = { rowId, propertyId };
                      event.dataTransfer.setData(DRAG_TYPE, rowId); event.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragEnd={event => { event.stopPropagation(); dragRef.current = null; setHoveredGroup(null); }}
                    onClick={event => { triggerRef.current = event.currentTarget; setDetailRowId(rowId); }}>{title}</button>
                  <select aria-label={`移动记录：${title}`} value={group.id ?? ''} className="text-xs w-full rounded border p-1 bg-white dark:bg-neutral-800"
                    onChange={event => moveRow(rowId, event.target.value || null)}>
                    <option value="">未分组</option>
                    {database.properties[propertyId].options?.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
                  </select>
                </article>;
              })}
              {group.rowIds.length === 0 && <p className="text-xs text-neutral-500 py-3">暂无记录，可拖入卡片</p>}
              <button type="button" className="text-xs text-blue-600 p-2" aria-label={`在${group.name}新增记录`} onClick={() => {
                useWorkspaceStore.getState().addDatabaseRow(databaseId, {
                  [titleId]: `记录 ${database.rowOrder.length + 1}`, [propertyId]: group.id,
                });
              }}>+ 新增记录</button>
            </div>
          </section>;
        })}
      </div>
    </div>
    {detailRowId && <DatabaseRowDetail databaseId={databaseId} rowId={detailRowId} onClose={closeDetail} />}
  </>;
}
