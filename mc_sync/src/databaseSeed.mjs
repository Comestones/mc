import * as Y from 'yjs';
const TYPES = new Set(['title','text','number','select','multiSelect','checkbox','date','url','createdTime']);
const BLOCKS = new Set(['paragraph','heading1','heading2','heading3','bulletList','numberedList','todo','code','quote','callout','divider','database']);
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const id = value => typeof value === 'string' && value.length > 0 && value.length <= 128 && !['__proto__','constructor','prototype'].includes(value) && !/[\u0000-\u001f\u007f]/.test(value);
const string = (value, max = 10000) => typeof value === 'string' && value.length <= max;
const order = (value, record) => Array.isArray(value) && value.length === Object.keys(record).length && new Set(value).size === value.length && value.every(key => id(key) && Object.hasOwn(record, key));
export function validDatabase(db) {
  if (!object(db) || !id(db.id) || !string(db.title) || !Number.isFinite(db.createdAt) || !Number.isFinite(db.updatedAt)
    || !object(db.properties) || !object(db.rows) || !order(db.propertyOrder, db.properties) || !order(db.rowOrder, db.rows)
    || db.propertyOrder.length > 128 || db.rowOrder.length > 5000) return false;
  if (['icon','description'].some(key => db[key] !== undefined && !string(db[key]))) return false;
  let titles = 0, blocks = 0;
  for (const [key, prop] of Object.entries(db.properties)) {
    if (!id(key) || !object(prop) || key !== prop.id || !string(prop.name) || !TYPES.has(prop.type)
      || (prop.width !== undefined && (!Number.isFinite(prop.width) || prop.width <= 0))) return false;
    if (prop.type === 'title') titles++;
    if (prop.options !== undefined && (!['select','multiSelect'].includes(prop.type) || !Array.isArray(prop.options))) return false;
    const seen = new Set();
    for (const option of prop.options ?? []) {
      if (seen.size >= 5000 || !object(option) || !id(option.id) || seen.has(option.id) || !string(option.name) || (option.color !== undefined && !string(option.color, 64))) return false;
      seen.add(option.id);
    }
  }
  if (titles !== 1) return false;
  function validBlocks(items, depth = 0, seen = new Set()) {
    return depth < 10 && Array.isArray(items) && items.every(block => {
      if (++blocks > 5000 || !object(block) || !id(block.id) || seen.has(block.id) || !BLOCKS.has(block.type) || !string(block.content, 500000)
        || (block.properties !== undefined && !object(block.properties))) return false;
      seen.add(block.id); return block.children === undefined || validBlocks(block.children, depth + 1, seen);
    });
  }
  for (const [key, row] of Object.entries(db.rows)) {
    if (!id(key) || !object(row) || key !== row.id || row.databaseId !== db.id || !Number.isFinite(row.createdAt) || !Number.isFinite(row.updatedAt)
      || !object(row.cells) || (row.blocks !== undefined && !validBlocks(row.blocks))) return false;
    for (const [propertyId, value] of Object.entries(row.cells)) {
      const prop = Object.hasOwn(db.properties, propertyId) && db.properties[propertyId];
      if (!prop || prop.type === 'createdTime') return false;
      if (value == null) continue;
      if (['title','text','date','url'].includes(prop.type) && !string(value, 500000)) return false;
      if (prop.type === 'number' && !Number.isFinite(value)) return false;
      if (prop.type === 'checkbox' && typeof value !== 'boolean') return false;
      if (prop.type === 'select' && (typeof value !== 'string' || !prop.options?.some(option => option.id === value))) return false;
      if (prop.type === 'multiSelect' && (!Array.isArray(value) || value.length > 5000 || value.some(item => !prop.options?.some(option => option.id === item)))) return false;
    }
  }
  return true;
}
export function seedDatabase(document, request, expectedId) {
  const root = document.getMap('database'), db = request?.database;
  if (root.has('schema') || request?.kind !== 'initialize-database' || !id(request.source) || !validDatabase(db) || db.id !== expectedId) return false;
  document.transact(() => {
    const properties = new Y.Map(), rows = new Y.Map(); root.set('properties', properties); root.set('rows', rows);
    root.set('propertyOrder', Y.Array.from(db.propertyOrder)); root.set('rowOrder', Y.Array.from(db.rowOrder));
    for (const key of ['id','title','icon','description','createdAt','updatedAt']) if (db[key] !== undefined) root.set(key, db[key]);
    for (const property of Object.values(db.properties)) {
      const map = new Y.Map(), options = new Y.Map(); properties.set(property.id, map);
      map.set('spec', { type: property.type, version: 'initial' }); map.set('options', options);
      map.set('optionOrder', Y.Array.from((property.options ?? []).map(option => option.id)));
      for (const key of ['name','width']) if (property[key] !== undefined) map.set(key, property[key]);
      for (const option of property.options ?? []) options.set(option.id, new Y.Map(Object.entries(option).filter(([key]) => key !== 'id')));
    }
    for (const row of Object.values(db.rows)) {
      const map = new Y.Map(), cells = new Y.Map(); rows.set(row.id, map); map.set('cells', cells);
      for (const key of ['createdAt','updatedAt','blocks']) if (row[key] !== undefined) map.set(key, structuredClone(row[key]));
      for (const [key, value] of Object.entries(row.cells)) if (value != null) cells.set(key, { version: 'initial', value: structuredClone(value) });
    }
    root.set('seedSource', request.source); root.set('schema', 1);
  }, 'server-initialize-database');
  return true;
}
