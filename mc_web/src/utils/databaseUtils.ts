import type {
  DatabaseSchema,
  DatabaseProperty,
  DatabaseRow,
  CellValue,
  PropertyType,
} from '../types/database.ts';

export const DEFAULT_TITLE_PROPERTY_ID = 'prop-title';

/**
 * 创建新多维数据库实体，默认包含唯一必需的标题列 (title)
 */
export function createDatabase(
  title = '未命名数据库',
  initialProperties?: DatabaseProperty[]
): DatabaseSchema {
  const now = Date.now();
  const dbId = `db-${now}-${Math.random().toString(36).substring(2, 6)}`;

  const properties: Record<string, DatabaseProperty> = {};
  const propertyOrder: string[] = [];

  let hasTitle = false;
  if (initialProperties && initialProperties.length > 0) {
    for (const prop of initialProperties) {
      if (prop.type === 'title') {
        if (!hasTitle) {
          properties[prop.id] = { ...prop, width: prop.width ?? 220 };
          propertyOrder.push(prop.id);
          hasTitle = true;
        }
      } else {
        properties[prop.id] = { ...prop, width: prop.width ?? 180 };
        propertyOrder.push(prop.id);
      }
    }
  }

  // 保证数据库必须拥有一个标题列
  if (!hasTitle) {
    const titleProp: DatabaseProperty = {
      id: DEFAULT_TITLE_PROPERTY_ID,
      name: '名称',
      type: 'title',
      width: 220,
    };
    properties[DEFAULT_TITLE_PROPERTY_ID] = titleProp;
    propertyOrder.unshift(DEFAULT_TITLE_PROPERTY_ID);
  }

  return {
    id: dbId,
    title,
    icon: '📊',
    description: '',
    properties,
    propertyOrder,
    rows: {},
    rowOrder: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * 严格校验数据库 Schema 契约与完整性不变量：
 * 1. 结构与必要属性健全；
 * 2. 必须包含且仅包含 1 个 title 类型的属性列；
 * 3. propertyOrder 与 rowOrder 必须与对应字典中的键严格 1:1 对应无重复、无遗漏、无悬空。
 */
export function validateDatabaseSchema(data: unknown): data is DatabaseSchema {
  if (!data || typeof data !== 'object') return false;
  const db = data as Partial<DatabaseSchema>;

  if (typeof db.id !== 'string' || !db.id) return false;
  if (typeof db.title !== 'string') return false;
  if (typeof db.createdAt !== 'number' || typeof db.updatedAt !== 'number') return false;

  // 校验 properties 与 propertyOrder
  if (!db.properties || typeof db.properties !== 'object') return false;
  if (!Array.isArray(db.propertyOrder)) return false;

  const propKeys = Object.keys(db.properties);
  if (propKeys.length === 0) return false;
  if (db.propertyOrder.length !== propKeys.length) return false;

  const propSet = new Set(db.propertyOrder);
  if (propSet.size !== db.propertyOrder.length) return false; // 重复检测

  let titleCount = 0;
  for (const [propId, prop] of Object.entries(db.properties)) {
    if (!prop || typeof prop !== 'object') return false;
    if (prop.id !== propId || typeof prop.name !== 'string' || typeof prop.type !== 'string') {
      return false;
    }
    if (!propSet.has(propId)) return false;
    if (prop.type === 'title') {
      titleCount++;
    }
  }

  // 不变量：必须且只能有 1 个 title 属性
  if (titleCount !== 1) return false;

  // 校验 rows 与 rowOrder
  if (!db.rows || typeof db.rows !== 'object') return false;
  if (!Array.isArray(db.rowOrder)) return false;

  const rowKeys = Object.keys(db.rows);
  if (db.rowOrder.length !== rowKeys.length) return false;

  const rowSet = new Set(db.rowOrder);
  if (rowSet.size !== db.rowOrder.length) return false; // 重复检测

  for (const [rowId, row] of Object.entries(db.rows)) {
    if (!row || typeof row !== 'object') return false;
    if (row.id !== rowId || row.databaseId !== db.id) return false;
    if (!row.cells || typeof row.cells !== 'object') return false;
    if (!rowSet.has(rowId)) return false;
  }

  return true;
}

/**
 * 规整并自愈数据库 Schema：
 * 1. 修复缺失或重复 title 属性列；
 * 2. 同步与清理 propertyOrder / rowOrder 中的无效或遗漏 ID；
 * 3. 清理 rows 中引用了不存在属性列的悬空 cells。
 */
export function normalizeDatabaseSchema(database: DatabaseSchema): DatabaseSchema {
  if (!database) return database;

  const properties: Record<string, DatabaseProperty> = { ...database.properties };
  let propertyOrder = Array.isArray(database.propertyOrder)
    ? [...database.propertyOrder]
    : [];

  // 1. 标题属性自愈
  const titleProps = Object.values(properties).filter((p) => p.type === 'title');
  if (titleProps.length === 0) {
    const fallbackTitle: DatabaseProperty = {
      id: DEFAULT_TITLE_PROPERTY_ID,
      name: '名称',
      type: 'title',
      width: 220,
    };
    properties[DEFAULT_TITLE_PROPERTY_ID] = fallbackTitle;
    propertyOrder.unshift(DEFAULT_TITLE_PROPERTY_ID);
  } else if (titleProps.length > 1) {
    // 保留第一个 title，其余降级为 text
    let keptFirst = false;
    for (const [id, prop] of Object.entries(properties)) {
      if (prop.type === 'title') {
        if (!keptFirst) {
          keptFirst = true;
        } else {
          properties[id] = { ...prop, type: 'text' };
        }
      }
    }
  }

  // 2. propertyOrder 去重与同步
  const validPropIds = new Set(Object.keys(properties));
  const seenProps = new Set<string>();
  const cleanPropOrder: string[] = [];

  for (const pid of propertyOrder) {
    if (validPropIds.has(pid) && !seenProps.has(pid)) {
      cleanPropOrder.push(pid);
      seenProps.add(pid);
    }
  }
  for (const pid of validPropIds) {
    if (!seenProps.has(pid)) {
      cleanPropOrder.push(pid);
      seenProps.add(pid);
    }
  }

  // 3. rows 与 rowOrder 自愈，清理悬空 cells
  const rows: Record<string, DatabaseRow> = {};
  const validRowIds = new Set(Object.keys(database.rows || {}));
  const rawRowOrder = Array.isArray(database.rowOrder) ? database.rowOrder : [];
  const seenRows = new Set<string>();
  const cleanRowOrder: string[] = [];

  for (const rid of rawRowOrder) {
    if (validRowIds.has(rid) && !seenRows.has(rid)) {
      cleanRowOrder.push(rid);
      seenRows.add(rid);
    }
  }
  for (const rid of validRowIds) {
    if (!seenRows.has(rid)) {
      cleanRowOrder.push(rid);
      seenRows.add(rid);
    }
  }

  for (const [rowId, row] of Object.entries(database.rows || {})) {
    const cleanCells: Record<string, CellValue> = {};
    if (row.cells && typeof row.cells === 'object') {
      for (const [cellPropId, val] of Object.entries(row.cells)) {
        if (validPropIds.has(cellPropId)) {
          cleanCells[cellPropId] = val;
        }
      }
    }
    rows[rowId] = {
      ...row,
      id: rowId,
      databaseId: database.id,
      cells: cleanCells,
    };
  }

  return {
    ...database,
    properties,
    propertyOrder: cleanPropOrder,
    rows,
    rowOrder: cleanRowOrder,
  };
}

/**
 * 不可变添加属性列
 */
export function addProperty(
  db: DatabaseSchema,
  property: Omit<DatabaseProperty, 'id'> & { id?: string }
): DatabaseSchema {
  const propId =
    property.id || `prop-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

  // 严格拦截重复添加 title 列
  let finalType: PropertyType = property.type;
  if (finalType === 'title') {
    const hasTitle = Object.values(db.properties).some((p) => p.type === 'title');
    if (hasTitle) {
      finalType = 'text'; // 自动降级为 text，维持唯一 title 不变量
    }
  }

  const newProp: DatabaseProperty = {
    ...property,
    id: propId,
    type: finalType,
    width: property.width ?? 180,
  };

  const nextProperties = { ...db.properties, [propId]: newProp };
  const nextPropertyOrder = [...db.propertyOrder, propId];

  return {
    ...db,
    properties: nextProperties,
    propertyOrder: nextPropertyOrder,
    updatedAt: Date.now(),
  };
}

/**
 * 不可变更新属性列
 */
export function updateProperty(
  db: DatabaseSchema,
  propertyId: string,
  updates: Partial<DatabaseProperty>
): DatabaseSchema {
  const existing = db.properties[propertyId];
  if (!existing) return db;

  // 不变量防御：若原列是 title，严禁将其类型更改为非 title
  if (existing.type === 'title' && updates.type && updates.type !== 'title') {
    throw new Error('Cannot change the type of the primary title column');
  }

  // 不变量防御：若原列非 title，严禁修改为 title（防止产生双 title）
  if (existing.type !== 'title' && updates.type === 'title') {
    throw new Error('Cannot add a second title column to the database');
  }

  const updatedProp: DatabaseProperty = {
    ...existing,
    ...updates,
    id: propertyId, // 保证 ID 不被篡改
  };

  return {
    ...db,
    properties: {
      ...db.properties,
      [propertyId]: updatedProp,
    },
    updatedAt: Date.now(),
  };
}

/**
 * 不可变删除属性列（禁止删除 title 列，原子化清理所有 row 对应的 cell）
 */
export function deleteProperty(
  db: DatabaseSchema,
  propertyId: string
): DatabaseSchema {
  const existing = db.properties[propertyId];
  if (!existing) return db;

  // 不变量防御：严禁删除标题列
  if (existing.type === 'title') {
    throw new Error('Cannot delete the primary title column of a database');
  }

  const nextProperties = { ...db.properties };
  delete nextProperties[propertyId];

  const nextPropertyOrder = db.propertyOrder.filter((id) => id !== propertyId);

  // 级联清理所有行中该属性的单元格
  const nextRows: Record<string, DatabaseRow> = {};
  for (const [rowId, row] of Object.entries(db.rows)) {
    const nextCells = { ...row.cells };
    delete nextCells[propertyId];
    nextRows[rowId] = {
      ...row,
      cells: nextCells,
      updatedAt: Date.now(),
    };
  }

  return {
    ...db,
    properties: nextProperties,
    propertyOrder: nextPropertyOrder,
    rows: nextRows,
    updatedAt: Date.now(),
  };
}

/**
 * 不可变重排属性列顺序
 */
export function reorderProperties(
  db: DatabaseSchema,
  newOrder: string[]
): DatabaseSchema {
  const currentSet = new Set(db.propertyOrder);
  if (
    newOrder.length !== db.propertyOrder.length ||
    newOrder.some((id) => !currentSet.has(id))
  ) {
    throw new Error('Invalid property order permutation');
  }

  return {
    ...db,
    propertyOrder: [...newOrder],
    updatedAt: Date.now(),
  };
}

/**
 * 不可变添加行记录
 */
export function addRow(
  db: DatabaseSchema,
  initialCells: Record<string, CellValue> = {},
  atIndex?: number
): DatabaseSchema {
  const now = Date.now();
  const rowId = `row-${now}-${Math.random().toString(36).substring(2, 6)}`;

  // 过滤仅保留有效属性列对应的值
  const validCells: Record<string, CellValue> = {};
  for (const [propId, val] of Object.entries(initialCells)) {
    if (db.properties[propId]) {
      validCells[propId] = val;
    }
  }

  const newRow: DatabaseRow = {
    id: rowId,
    databaseId: db.id,
    cells: validCells,
    createdAt: now,
    updatedAt: now,
  };

  const nextRows = { ...db.rows, [rowId]: newRow };
  const nextRowOrder = [...db.rowOrder];

  if (typeof atIndex === 'number' && atIndex >= 0 && atIndex <= nextRowOrder.length) {
    nextRowOrder.splice(atIndex, 0, rowId);
  } else {
    nextRowOrder.push(rowId);
  }

  return {
    ...db,
    rows: nextRows,
    rowOrder: nextRowOrder,
    updatedAt: now,
  };
}

/**
 * 不可变更新行元信息
 */
export function updateRow(
  db: DatabaseSchema,
  rowId: string,
  updates: Partial<DatabaseRow>
): DatabaseSchema {
  const existing = db.rows[rowId];
  if (!existing) return db;

  const updatedRow: DatabaseRow = {
    ...existing,
    ...updates,
    id: rowId,
    databaseId: db.id,
    updatedAt: Date.now(),
  };

  return {
    ...db,
    rows: {
      ...db.rows,
      [rowId]: updatedRow,
    },
    updatedAt: Date.now(),
  };
}

/**
 * 不可变更新单个单元格
 */
export function updateCell(
  db: DatabaseSchema,
  rowId: string,
  propertyId: string,
  value: CellValue
): DatabaseSchema {
  const row = db.rows[rowId];
  if (!row) return db;
  if (!db.properties[propertyId]) return db; // 属性不存在则忽略

  const now = Date.now();
  const nextCells = { ...row.cells, [propertyId]: value };

  const updatedRow: DatabaseRow = {
    ...row,
    cells: nextCells,
    updatedAt: now,
  };

  return {
    ...db,
    rows: {
      ...db.rows,
      [rowId]: updatedRow,
    },
    updatedAt: now,
  };
}

/**
 * 不可变删除行记录
 */
export function deleteRow(
  db: DatabaseSchema,
  rowId: string
): DatabaseSchema {
  if (!db.rows[rowId]) return db;

  const nextRows = { ...db.rows };
  delete nextRows[rowId];

  const nextRowOrder = db.rowOrder.filter((id) => id !== rowId);

  return {
    ...db,
    rows: nextRows,
    rowOrder: nextRowOrder,
    updatedAt: Date.now(),
  };
}

/**
 * 不可变重排行顺序
 */
export function reorderRows(
  db: DatabaseSchema,
  newOrder: string[]
): DatabaseSchema {
  const currentSet = new Set(db.rowOrder);
  if (
    newOrder.length !== db.rowOrder.length ||
    newOrder.some((id) => !currentSet.has(id))
  ) {
    throw new Error('Invalid row order permutation');
  }

  return {
    ...db,
    rowOrder: [...newOrder],
    updatedAt: Date.now(),
  };
}
