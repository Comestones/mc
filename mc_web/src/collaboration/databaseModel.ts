import * as Y from 'yjs';
import type { DatabaseProperty, DatabaseRow, DatabaseSchema, CellValue } from '../types/database.ts';
import { VALID_PROPERTY_TYPES } from '../types/database.ts';
import { normalizeDatabaseSchema, validateCellValue, validateDatabaseSchema } from '../utils/databaseUtils.ts';
import { same } from './pageModel.ts';
export const DATABASE_EDIT = Symbol('local-database-edit');
type MapType = Y.Map<unknown>;
type Spec = { type: DatabaseProperty['type']; version: string };
const copy = <T>(value: T): T => structuredClone(value);
const safeId = (value: string) => !!value && value.length <= 128 && !['__proto__', 'constructor', 'prototype'].includes(value);
const map = (value: unknown): MapType | null => value instanceof Y.Map ? value : null;
export function orderedIds(order: unknown, entries: MapType): string[] {
  const ids: unknown[] = order instanceof Y.Array ? order.toArray() : [];
  const keys = Array.from(entries.keys()).filter(safeId).sort();
  const chosen = ids.filter((id, index): id is string => typeof id === 'string' && safeId(id) && entries.has(id) && ids.lastIndexOf(id) === index);
  return [...chosen, ...keys.filter(id => !chosen.includes(id))];
}
export function sharedDatabase(value: DatabaseSchema | null) {
  if (!value) return null;
  const { viewConfig: _view, updatedAt: _timestamp, ...content } = value;
  return content;
}
export function readDatabase(doc: Y.Doc): DatabaseSchema | null {
  const root = doc.getMap('database');
  if (root.get('schema') !== 1 || root.get('deleted') === true) return null;
  const properties = map(root.get('properties')), rows = map(root.get('rows'));
  if (!properties || !rows || typeof root.get('id') !== 'string' || typeof root.get('title') !== 'string') return null;
  const props: DatabaseSchema['properties'] = {}, records: DatabaseSchema['rows'] = {};
  const versions = new Map<string, string>();
  for (const id of Array.from(properties.keys()).filter(safeId).sort()) {
    const property = map(properties.get(id)), spec = property?.get('spec') as Spec | undefined;
    if (!property || !spec || !VALID_PROPERTY_TYPES.includes(spec.type) || typeof spec.version !== 'string') continue;
    const options = map(property.get('options'));
    props[id] = { id, name: typeof property.get('name') === 'string' ? property.get('name') as string : '未命名列', type: spec.type,
      ...(typeof property.get('width') === 'number' ? { width: property.get('width') as number } : {}),
      ...(['select', 'multiSelect'].includes(spec.type) ? { options: options ? orderedIds(property.get('optionOrder'), options).flatMap(id => {
        const item = map(options.get(id));
        return item && typeof item.get('name') === 'string' ? [{ id, name: item.get('name') as string, ...(typeof item.get('color') === 'string' ? { color: item.get('color') as string } : {}) }] : [];
      }) : [] } : {}) };
    versions.set(id, spec.version);
  }
  for (const id of Array.from(rows.keys()).filter(safeId).sort()) {
    const row = map(rows.get(id)), cells = row && map(row.get('cells'));
    if (!row || !cells) continue;
    const values: Record<string, CellValue> = {};
    for (const [key, item] of cells) {
      const cell = item as { version?: string; value?: CellValue } | null, property = props[key];
      if (!cell || !property || property.type === 'createdTime' || cell?.version !== versions.get(key) || cell.value == null) continue;
      if (validateCellValue(cell.value, property.type, property.options)) values[key] = copy(cell.value);
      else if (property.type === 'multiSelect' && Array.isArray(cell.value)) values[key] = cell.value.filter(value => property.options?.some(option => option.id === value));
    }
    const timestamp = (key: string) => typeof row.get(key) === 'number' && Number.isFinite(row.get(key)) ? row.get(key) as number : 0;
    const blocks = row.get('blocks');
    records[id] = { id, databaseId: root.get('id') as string, cells: values, createdAt: timestamp('createdAt'), updatedAt: timestamp('updatedAt'),
      blocks: Array.isArray(blocks) && blocks.length ? copy(blocks) : [{ id: `empty-${id}`, type: 'paragraph', content: '' }] };
  }
  const result: DatabaseSchema = { id: root.get('id') as string, title: root.get('title') as string,
    ...(typeof root.get('icon') === 'string' ? { icon: root.get('icon') as string } : {}),
    ...(typeof root.get('description') === 'string' ? { description: root.get('description') as string } : {}),
    createdAt: typeof root.get('createdAt') === 'number' ? root.get('createdAt') as number : 0,
    updatedAt: typeof root.get('updatedAt') === 'number' ? root.get('updatedAt') as number : 0,
    properties: props, propertyOrder: orderedIds(root.get('propertyOrder'), properties).filter(id => !!props[id]),
    rows: records, rowOrder: orderedIds(root.get('rowOrder'), rows).filter(id => !!records[id]) };
  return validateDatabaseSchema(result) ? result : normalizeDatabaseSchema(result);
}
function patch(target: MapType, before: Record<string, unknown>, after: Record<string, unknown>, keys: string[]) {
  for (const key of keys) if (!same(before[key], after[key])) {
    if (after[key] === undefined) target.delete(key); else target.set(key, copy(after[key]));
  }
}
function arrange(order: Y.Array<string>, before: string[], after: string[], entries: MapType) {
  if (same(before, after)) return;
  for (let i = order.length - 1; i >= 0; i--) if (before.includes(order.get(i)) && !after.includes(order.get(i))) order.delete(i, 1);
  for (let index = 0; index < after.length; index++) {
    const id = after[index]; if (!entries.has(id)) continue;
    const current = order.toArray(), previous = after[index - 1];
    const target = previous ? current.lastIndexOf(previous) + 1 : 0;
    if (current.lastIndexOf(id) === target) continue;
    for (let i = order.length - 1; i >= 0; i--) if (order.get(i) === id) order.delete(i, 1);
    order.insert(previous ? Math.max(0, order.toArray().lastIndexOf(previous) + 1) : 0, [id]);
  }
}
export function writeDatabase(doc: Y.Doc, before: DatabaseSchema, after: DatabaseSchema | null) {
  const root = doc.getMap('database');
  if (root.get('schema') !== 1 || root.get('deleted') === true || !map(root.get('properties')) || !map(root.get('rows'))
    || !(root.get('propertyOrder') instanceof Y.Array) || !(root.get('rowOrder') instanceof Y.Array)) return;
  doc.transact(() => {
    if (!after) { root.set('deleted', true); return; }
    const properties = root.get('properties') as MapType, rows = root.get('rows') as MapType;
    patch(root, before as unknown as Record<string, unknown>, after as unknown as Record<string, unknown>, ['title', 'icon', 'description', 'updatedAt']);
    for (const id of Object.keys(before.properties)) if (!after.properties[id]) properties.delete(id);
    const changedTypes = new Set<string>();
    for (const [id, property] of Object.entries(after.properties)) {
      const previous = before.properties[id]; let shared = map(properties.get(id));
      if (!shared) {
        if (previous || !safeId(id)) continue; // A concurrent delete wins over a stale edit.
        shared = new Y.Map(); properties.set(id, shared);
        shared.set('options', new Y.Map()); shared.set('optionOrder', new Y.Array());
      }
      if (!previous || previous.type !== property.type) {
        shared.set('spec', { type: property.type, version: `${doc.clientID}-${crypto.randomUUID()}` }); changedTypes.add(id);
      }
      patch(shared, (previous ?? {}) as unknown as Record<string, unknown>, property as unknown as Record<string, unknown>, ['name', 'width']);
      const options = shared.get('options') as MapType, old = Object.fromEntries((previous?.options ?? []).map(option => [option.id, option]));
      for (const id of Object.keys(old)) if (!property.options?.some(option => option.id === id)) options.delete(id);
      for (const option of property.options ?? []) {
        let entry = map(options.get(option.id));
        if (!entry) { if (old[option.id] || !safeId(option.id)) continue; entry = new Y.Map(); options.set(option.id, entry); }
        patch(entry, (old[option.id] ?? {}) as unknown as Record<string, unknown>, option as unknown as Record<string, unknown>, ['name', 'color']);
      }
      arrange(shared.get('optionOrder') as Y.Array<string>, (previous?.options ?? []).map(option => option.id), (property.options ?? []).map(option => option.id), options);
    }
    for (const id of Object.keys(before.rows)) if (!after.rows[id]) rows.delete(id);
    for (const [id, row] of Object.entries(after.rows)) {
      const previous = before.rows[id]; let shared = map(rows.get(id));
      if (!shared) {
        if (previous || !safeId(id)) continue;
        shared = new Y.Map(); rows.set(id, shared); shared.set('cells', new Y.Map());
      }
      patch(shared, (previous ?? {}) as unknown as Record<string, unknown>, row as unknown as Record<string, unknown>, ['createdAt', 'updatedAt', 'blocks']);
      const cells = shared.get('cells') as MapType;
      for (const key of new Set([...Object.keys(previous?.cells ?? {}), ...Object.keys(row.cells), ...changedTypes])) {
        if (!changedTypes.has(key) && same(previous?.cells[key], row.cells[key])) continue;
        const spec = map(properties.get(key))?.get('spec') as Spec | undefined;
        if (!spec || spec.type !== after.properties[key]?.type || spec.type === 'createdTime') continue;
        const value = row.cells[key];
        if (value == null) cells.delete(key); else cells.set(key, { version: spec.version, value: copy(value) });
      }
    }
    arrange(root.get('propertyOrder') as Y.Array<string>, before.propertyOrder, after.propertyOrder, properties);
    arrange(root.get('rowOrder') as Y.Array<string>, before.rowOrder, after.rowOrder, rows);
  }, DATABASE_EDIT);
}
export type { DatabaseRow };
