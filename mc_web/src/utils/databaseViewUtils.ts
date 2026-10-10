import type { DatabaseSchema, DatabaseViewConfig, DatabaseViewConfigUpdates } from '../types/database.ts';

type ViewSchema = Pick<DatabaseSchema, 'properties' | 'propertyOrder'>;
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

/** Additive v2 settings; stale field references are removed deterministically. */
export function normalizeViewConfig(database: ViewSchema, value: unknown): DatabaseViewConfig {
  const input = object(value);
  const gallery = object(input.gallery);
  const selectable = database.propertyOrder.filter(id => database.properties[id]?.type === 'select');
  const displayable = database.propertyOrder.filter(id => database.properties[id]?.type !== 'title');
  const requested = Array.isArray(gallery.visiblePropertyIds) ? gallery.visiblePropertyIds : displayable.slice(0, 3);
  return {
    activeView: input.activeView === 'board' || input.activeView === 'gallery' ? input.activeView : 'table',
    boardGroupPropertyId: typeof input.boardGroupPropertyId === 'string' && selectable.includes(input.boardGroupPropertyId)
      ? input.boardGroupPropertyId : selectable[0] ?? null,
    gallery: {
      coverPropertyId: typeof gallery.coverPropertyId === 'string' && database.properties[gallery.coverPropertyId]?.type === 'url'
        ? gallery.coverPropertyId : null,
      visiblePropertyIds: [...new Set(requested.filter((id): id is string => typeof id === 'string' && displayable.includes(id)))],
    },
  };
}

export function validateViewConfig(database: ViewSchema, value: unknown): boolean {
  const input = object(value);
  const gallery = object(input.gallery);
  const normalized = normalizeViewConfig(database, value);
  return input.activeView === normalized.activeView && input.boardGroupPropertyId === normalized.boardGroupPropertyId
    && gallery.coverPropertyId === normalized.gallery.coverPropertyId
    && Array.isArray(gallery.visiblePropertyIds)
    && gallery.visiblePropertyIds.length === normalized.gallery.visiblePropertyIds.length
    && gallery.visiblePropertyIds.every((id, index) => id === normalized.gallery.visiblePropertyIds[index]);
}

export function updateViewConfig(database: DatabaseSchema, updates: DatabaseViewConfigUpdates): DatabaseSchema {
  const current = normalizeViewConfig(database, database.viewConfig);
  const viewConfig = normalizeViewConfig(database, {
    ...current, ...updates, gallery: { ...current.gallery, ...updates.gallery },
  });
  if (JSON.stringify(database.viewConfig) === JSON.stringify(viewConfig)) return database;
  return { ...database, viewConfig, updatedAt: Date.now() };
}

/** Remote covers only use HTTP(S); mailto and executable schemes are never images. */
export function safeCoverUrl(value: unknown): string | null {
  if (typeof value !== 'string' || /[\u0000-\u0020\u007f]/.test(value)) return null;
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
