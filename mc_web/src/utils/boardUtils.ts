import type { DatabaseSchema } from '../types/database';

/** Preserve option and row order; missing or stale values remain visible. */
export function groupBoardRows(database: DatabaseSchema, propertyId: string) {
  const property = database.properties[propertyId];
  if (property?.type !== 'select') return [];
  const groups = (property.options ?? []).map(option => ({
    id: option.id as string | null, name: option.name, color: option.color, rowIds: [] as string[],
  }));
  const ungrouped = { id: null, name: '未分组', color: undefined, rowIds: [] as string[] };
  const byId = new Map(groups.map(group => [group.id, group]));
  for (const rowId of database.rowOrder) {
    const row = database.rows[rowId];
    if (!row) continue;
    const value = row.cells[propertyId];
    const group = typeof value === 'string' ? byId.get(value) : undefined;
    (group ?? ungrouped).rowIds.push(rowId);
  }
  return [...groups, ungrouped];
}
