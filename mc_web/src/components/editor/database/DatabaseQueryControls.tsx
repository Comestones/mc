import { useId, useState } from 'react';
import type { DatabaseFilter, DatabaseQuery, FilterOperator } from '../../../types/database';
import { useWorkspaceStore } from '../../../store/useWorkspaceStore';
import { filterOperators, isActiveFilter, normalizeQuery, OPERATOR_LABELS, queryRowIds, validQueryDate } from '../../../utils/databaseQueryUtils';

const controlClass = 'min-w-0 max-w-full rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2 py-1.5 text-xs';
export function DatabaseQueryControls({ databaseId }: { databaseId: string }) {
  const database = useWorkspaceStore(state => state.databases[databaseId]);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  if (!database) return null;
  const query = normalizeQuery(database, database.viewConfig?.query);
  const fields = database.propertyOrder.map(id => database.properties[id]);
  const change = (update: (current: DatabaseQuery) => DatabaseQuery) => {
    const state = useWorkspaceStore.getState(), latest = state.databases[databaseId];
    if (latest) state.updateDatabaseViewConfig(databaseId, { query: update(normalizeQuery(latest, latest.viewConfig?.query)) });
  };
  const patchFilter = (id: string, patch: Partial<DatabaseFilter>) => change(current => ({ ...current, filters: current.filters.map(rule => rule.id === id ? { ...rule, ...patch } : rule) }));
  const activeCount = query.filters.filter(isActiveFilter).length;
  return <section aria-label="筛选与排序" className="px-4 pb-3 space-y-3 text-xs">
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)} className={controlClass}>
        筛选与排序（{activeCount} / {query.sorts.length}）
      </button>
      <span role="status" aria-label="匹配记录数">匹配 {queryRowIds(database).length} / {database.rowOrder.length} 条记录</span>
      {(query.filters.length > 0 || query.sorts.length > 0) && <button type="button" onClick={() => change(() => ({ filters: [], sorts: [] }))} className="text-blue-600 px-2 py-1">清空筛选与排序</button>}
    </div>
    {open && <div id={panelId} className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-3 space-y-4">
      <fieldset className="space-y-2">
        <legend className="font-medium mb-2">筛选 · 全部满足</legend>
        <p className="text-neutral-500">未填写值的条件暂不生效；空值请用“为空”。未设置的复选框视为未勾选。</p>
        {query.filters.map((filter, index) => {
          const property = database.properties[filter.propertyId];
          const unary = filter.operator === 'isEmpty' || filter.operator === 'isNotEmpty';
          const inputLabel = `筛选值 ${index + 1}`;
          return <div key={filter.id} className="flex flex-wrap gap-2 items-center">
            <select aria-label={`筛选字段 ${index + 1}`} value={filter.propertyId} className={controlClass} onChange={event => {
              const next = database.properties[event.target.value];
              patchFilter(filter.id, { propertyId: next.id, propertyType: next.type, operator: filterOperators(next.type)[0], value: null });
            }}>{fields.map(field => <option key={field.id} value={field.id}>{field.name}</option>)}</select>
            <select aria-label={`筛选条件 ${index + 1}`} value={filter.operator} className={controlClass} onChange={event => {
              const operator = event.target.value as FilterOperator;
              patchFilter(filter.id, { operator, value: operator === 'isEmpty' || operator === 'isNotEmpty' ? null : filter.value });
            }}>{filterOperators(property.type).map(operator => <option key={operator} value={operator}>{OPERATOR_LABELS[operator]}</option>)}</select>
            {!unary && (property.type === 'select' || property.type === 'multiSelect' || property.type === 'checkbox' ?
              <select aria-label={inputLabel} className={controlClass} value={filter.value === null ? '' : String(filter.value)} onChange={event => patchFilter(filter.id, { value: event.target.value === '' ? null : property.type === 'checkbox' ? event.target.value === 'true' : event.target.value })}>
                <option value="">请选择值</option>
                {property.type === 'checkbox' ? <><option value="true">已勾选</option><option value="false">未勾选</option></> : property.options?.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
              </select> : <input aria-label={inputLabel} className={controlClass} type={property.type === 'number' ? 'number' : property.type === 'date' || property.type === 'createdTime' ? 'date' : 'text'} step="any" value={filter.value === null ? '' : String(filter.value)} onChange={event => {
                const raw = event.target.value;
                const value = !raw ? null : property.type === 'number' ? Number(raw) : raw;
                if ((property.type === 'date' || property.type === 'createdTime') && value !== null && !validQueryDate(value)) return;
                patchFilter(filter.id, { value });
              }} />)}
            <button type="button" aria-label={`删除筛选 ${index + 1}`} className="px-2 py-1 text-red-600" onClick={() => change(current => ({ ...current, filters: current.filters.filter(rule => rule.id !== filter.id) }))}>删除</button>
          </div>;
        })}
        <button type="button" className="text-blue-600 py-1" onClick={() => change(current => ({ ...current, filters: [...current.filters, { id: crypto.randomUUID(), propertyId: fields[0].id, propertyType: fields[0].type, operator: filterOperators(fields[0].type)[0], value: null }] }))}>+ 添加筛选</button>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="font-medium mb-2">排序 · 从上到下按优先级</legend>
        <p className="text-neutral-500">空值始终排在末尾；相同值保留原始顺序。标签按名称排序，创建时间按实际时间排序。</p>
        {query.sorts.map((sort, index) => <div key={sort.propertyId} className="flex flex-wrap items-center gap-2">
          <span>{index + 1}.</span>
          <select aria-label={`排序字段 ${index + 1}`} className={controlClass} value={sort.propertyId} onChange={event => change(current => ({ ...current, sorts: current.sorts.map(rule => rule.propertyId === sort.propertyId ? { ...rule, propertyId: event.target.value, propertyType: database.properties[event.target.value].type } : rule) }))}>
            {fields.filter(field => field.id === sort.propertyId || !query.sorts.some(rule => rule.propertyId === field.id)).map(field => <option key={field.id} value={field.id}>{field.name}</option>)}
          </select>
          <select aria-label={`排序方向 ${index + 1}`} className={controlClass} value={sort.direction} onChange={event => change(current => ({ ...current, sorts: current.sorts.map(rule => rule.propertyId === sort.propertyId ? { ...rule, direction: event.target.value as 'asc' | 'desc' } : rule) }))}>
            <option value="asc">升序</option><option value="desc">降序</option>
          </select>
          <button type="button" disabled={index === 0} aria-label={`提高排序优先级 ${index + 1}`} className="px-2 py-1 disabled:opacity-40" onClick={() => change(current => {
            const sorts = [...current.sorts];
            const position = sorts.findIndex(rule => rule.propertyId === sort.propertyId);
            if (position > 0) [sorts[position - 1], sorts[position]] = [sorts[position], sorts[position - 1]];
            return { ...current, sorts };
          })}>上移</button>
          <button type="button" aria-label={`删除排序 ${index + 1}`} className="px-2 py-1 text-red-600" onClick={() => change(current => ({ ...current, sorts: current.sorts.filter(rule => rule.propertyId !== sort.propertyId) }))}>删除</button>
        </div>)}
        <button type="button" disabled={query.sorts.length >= fields.length} className="text-blue-600 py-1 disabled:opacity-40" onClick={() => change(current => {
          const field = fields.find(field => !current.sorts.some(rule => rule.propertyId === field.id));
          return field ? { ...current, sorts: [...current.sorts, { propertyId: field.id, propertyType: field.type, direction: 'asc' }] } : current;
        })}>+ 添加排序</button>
      </fieldset>
      <p className="text-neutral-500">筛选与排序应用于三种视图并自动保存。新增记录若不满足筛选条件，会暂时隐藏；清空筛选即可查看。</p>
    </div>}
  </section>;
}
