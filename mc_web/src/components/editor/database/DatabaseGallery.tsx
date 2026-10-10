import { useCallback, useEffect, useRef, useState } from 'react';
import type { DatabaseProperty, DatabaseRow } from '../../../types/database';
import { useWorkspaceStore } from '../../../store/useWorkspaceStore';
import { normalizeViewConfig, safeCoverUrl } from '../../../utils/databaseViewUtils';
import { formatCreatedTime } from '../../../utils/databaseUtils';
import { DatabaseRowDetail } from './DatabaseRowDetail';

export function formatGalleryValue(property: DatabaseProperty, row: DatabaseRow): string {
  const value = row.cells[property.id];
  if (property.type === 'createdTime') return formatCreatedTime(row.createdAt);
  if (property.type === 'checkbox') return value === true ? '已勾选' : '未勾选';
  if (property.type === 'select') return property.options?.find(option => option.id === value)?.name ?? '—';
  if (property.type === 'multiSelect') return Array.isArray(value)
    ? value.map(id => property.options?.find(option => option.id === id)?.name).filter(Boolean).join('、') || '—' : '—';
  return value === null || value === undefined || value === '' ? '—' : String(value);
}

function GalleryCover({ url }: { url: string | null }) {
  const [failed, setFailed] = useState(false);
  return url && !failed ? <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer"
    draggable={false} onError={() => setFailed(true)} className="w-full h-36 object-cover" />
    : <div data-testid="gallery-cover-placeholder" className="h-36 flex items-center justify-center bg-neutral-100 dark:bg-neutral-900 text-xs text-neutral-500">暂无封面</div>;
}

export function DatabaseGallery({ databaseId }: { databaseId: string }) {
  const database = useWorkspaceStore(state => state.databases[databaseId]);
  const updateConfig = useWorkspaceStore(state => state.updateDatabaseViewConfig);
  const [detailRowId, setDetailRowId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const restoreFocusRef = useRef(false);
  const closeDetail = useCallback(() => {
    restoreFocusRef.current = true;
    setDetailRowId(null);
  }, []);
  useEffect(() => {
    if (detailRowId && !database?.rows[detailRowId]) closeDetail();
  }, [database, detailRowId, closeDetail]);
  useEffect(() => {
    if (detailRowId || !restoreFocusRef.current) return;
    restoreFocusRef.current = false;
    if (triggerRef.current?.isConnected) triggerRef.current.focus();
    else containerRef.current?.querySelector<HTMLElement>('button')?.focus();
  }, [detailRowId]);
  if (!database) return null;
  const config = normalizeViewConfig(database, database.viewConfig).gallery;
  const titleId = database.propertyOrder.find(id => database.properties[id]?.type === 'title')!;
  const properties = database.propertyOrder.map(id => database.properties[id]).filter(property => property.type !== 'title');
  const urls = properties.filter(property => property.type === 'url');
  const visible = properties.filter(property => config.visiblePropertyIds.includes(property.id));
  const addRow = () => useWorkspaceStore.getState().addDatabaseRow(databaseId, { [titleId]: `记录 ${database.rowOrder.length + 1}` });

  return <>
    <div ref={containerRef} role="region" aria-label="数据库画廊" data-testid="database-gallery-container" className="p-4 space-y-4">
      <button type="button" aria-expanded={showSettings} onClick={() => setShowSettings(value => !value)}
        className="rounded border px-3 py-1 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800">画廊设置</button>
      {showSettings && <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-3 space-y-3 text-xs">
        <label className="flex gap-2 items-center">封面来源
          <select aria-label="画廊封面来源" value={config.coverPropertyId ?? ''}
            onChange={event => updateConfig(databaseId, { gallery: { coverPropertyId: event.target.value || null } })}
            className="rounded border p-1 bg-white dark:bg-neutral-800">
            <option value="">不显示封面</option>
            {urls.map(property => <option key={property.id} value={property.id}>{property.name}</option>)}
          </select>
        </label>
        {urls.length === 0 && <p className="text-neutral-500">在表格中添加 URL 字段并填写图片链接，即可设置封面。</p>}
        <fieldset className="flex flex-wrap gap-3">
          <legend className="mb-2 font-medium">展示字段</legend>
          {properties.map(property => <label key={property.id} className="inline-flex items-center gap-1">
            <input type="checkbox" checked={config.visiblePropertyIds.includes(property.id)} onChange={event => {
              const latest = useWorkspaceStore.getState().databases[databaseId];
              if (!latest) return;
              const current = normalizeViewConfig(latest, latest.viewConfig).gallery.visiblePropertyIds;
              updateConfig(databaseId, { gallery: { visiblePropertyIds: event.target.checked ? [...current, property.id] : current.filter(id => id !== property.id) } });
            }} />{property.name}
          </label>)}
          {properties.length === 0 && <span className="text-neutral-500">暂无可展示字段，卡片始终显示标题。</span>}
        </fieldset>
      </div>}
      {database.rowOrder.length === 0 && <p className="text-sm text-neutral-500">暂无记录，添加第一张卡片开始。</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {database.rowOrder.map(rowId => {
          const row = database.rows[rowId];
          if (!row) return null;
          const title = String(row.cells[titleId] || '无标题');
          const cover = config.coverPropertyId ? safeCoverUrl(row.cells[config.coverPropertyId]) : null;
          return <article key={rowId} data-testid={`gallery-card-${rowId}`} className="min-w-0 rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-sm">
            <button type="button" aria-label={`打开记录：${title}`} className="w-full text-left hover:bg-neutral-50 dark:hover:bg-neutral-700/40 focus-visible:outline-blue-500"
              onClick={event => { triggerRef.current = event.currentTarget; setDetailRowId(rowId); }}>
              {config.coverPropertyId && <GalleryCover key={cover ?? ''} url={cover} />}
              <span className="block p-3 font-medium text-sm break-words">{title}</span>
            </button>
            {visible.length > 0 && <dl className="px-3 pb-3 space-y-2 text-xs">
              {visible.map(property => <div key={property.id} className="flex gap-2 min-w-0">
                <dt className="shrink-0 max-w-[40%] truncate text-neutral-500">{property.name}</dt>
                <dd className="min-w-0 break-words whitespace-pre-wrap">{formatGalleryValue(property, row)}</dd>
              </div>)}
            </dl>}
          </article>;
        })}
      </div>
      <button type="button" onClick={addRow} className="text-sm text-blue-600 rounded px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-950">+ 新增卡片</button>
    </div>
    {detailRowId && <DatabaseRowDetail databaseId={databaseId} rowId={detailRowId} onClose={closeDetail} />}
  </>;
}
