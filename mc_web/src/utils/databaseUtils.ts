import {
  VALID_PROPERTY_TYPES,
  type DatabaseSchema,
  type DatabaseProperty,
  type DatabaseRow,
  type CellValue,
  type PropertyType,
  type SelectOption,
} from '../types/database.ts';

export const DEFAULT_TITLE_PROPERTY_ID = 'prop-title';

/**
 * 校验单元格值形态是否符合属性类型契约
 */
export function validateCellValue(val: unknown, type: PropertyType): boolean {
  if (val === null || val === undefined) return true;
  switch (type) {
    case 'title':
    case 'text':
    case 'date':
    case 'url':
      return typeof val === 'string';
    case 'number':
      return typeof val === 'number' && Number.isFinite(val);
    case 'checkbox':
      return typeof val === 'boolean';
    case 'select':
      return typeof val === 'string';
    case 'multiSelect':
      return Array.isArray(val) && val.every((item) => typeof item === 'string');
    default:
      return false;
  }
}

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
  const usedIds = new Set<string>();

  let hasTitle = false;
  if (initialProperties && initialProperties.length > 0) {
    for (const prop of initialProperties) {
      // 保证 ID 唯一，杜绝重复 ID 破坏字典或排序
      let propId = prop.id;
      if (!propId || usedIds.has(propId)) {
        propId = `prop-${now}-${Math.random().toString(36).substring(2, 6)}`;
      }
      usedIds.add(propId);

      if (prop.type === 'title') {
        if (!hasTitle) {
          properties[propId] = { ...prop, id: propId, width: prop.width ?? 220 };
          propertyOrder.push(propId);
          hasTitle = true;
        } else {
          // 已经有 title，后续 title 降级为 text，维持唯一 title 列不变量
          properties[propId] = { ...prop, id: propId, type: 'text', width: prop.width ?? 180 };
          propertyOrder.push(propId);
        }
      } else {
        properties[propId] = { ...prop, id: propId, width: prop.width ?? 180 };
        propertyOrder.push(propId);
      }
    }
  }

  // 保证数据库必须拥有一个标题列
  if (!hasTitle) {
    let titlePropId = DEFAULT_TITLE_PROPERTY_ID;
    if (usedIds.has(titlePropId)) {
      titlePropId = `prop-title-${Math.random().toString(36).substring(2, 6)}`;
    }
    const titleProp: DatabaseProperty = {
      id: titlePropId,
      name: '名称',
      type: 'title',
      width: 220,
    };
    properties[titlePropId] = titleProp;
    propertyOrder.unshift(titlePropId);
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
 * 1. 结构与必要属性健全，时间戳有限；
 * 2. 必须包含且仅包含 1 个 title 类型的属性列；
 * 3. 属性类型必须为合法的 PropertyType 白名单枚举，宽度与选项结构合法；
 * 4. propertyOrder 与 rowOrder 必须与对应字典中的键严格 1:1 对应无重复、无遗漏、无悬空；
 * 5. 行内 cells 禁止包含未在 properties 中声明的悬空属性，且值形态必须符合类型契约。
 */
export function validateDatabaseSchema(data: unknown): data is DatabaseSchema {
  if (!data || typeof data !== 'object') return false;
  const db = data as Partial<DatabaseSchema>;

  if (typeof db.id !== 'string' || !db.id) return false;
  if (typeof db.title !== 'string') return false;
  if (
    typeof db.createdAt !== 'number' ||
    !Number.isFinite(db.createdAt) ||
    typeof db.updatedAt !== 'number' ||
    !Number.isFinite(db.updatedAt)
  ) {
    return false;
  }

  // 校验 properties 与 propertyOrder
  if (!db.properties || typeof db.properties !== 'object') return false;
  if (!Array.isArray(db.propertyOrder)) return false;

  const propKeys = Object.keys(db.properties);
  if (propKeys.length === 0) return false;
  if (db.propertyOrder.length !== propKeys.length) return false;

  const propSet = new Set(db.propertyOrder);
  if (propSet.size !== db.propertyOrder.length) return false; // 重复检测

  const validTypesSet = new Set<string>(VALID_PROPERTY_TYPES);
  let titleCount = 0;
  for (const [propId, prop] of Object.entries(db.properties)) {
    if (!prop || typeof prop !== 'object') return false;
    if (
      prop.id !== propId ||
      typeof prop.name !== 'string' ||
      typeof prop.type !== 'string' ||
      !validTypesSet.has(prop.type)
    ) {
      return false;
    }
    if (!propSet.has(propId)) return false;
    if (prop.type === 'title') {
      titleCount++;
    }

    // 校验 width（若指定则必须为有限正数）
    if (prop.width !== undefined) {
      if (typeof prop.width !== 'number' || !Number.isFinite(prop.width) || prop.width <= 0) {
        return false;
      }
    }

    // 校验 options（若指定则必须为合法 SelectOption 数组）
    if (prop.options !== undefined) {
      if (!Array.isArray(prop.options)) return false;
      for (const opt of prop.options) {
        if (!opt || typeof opt !== 'object') return false;
        if (typeof opt.id !== 'string' || typeof opt.name !== 'string') return false;
        if (opt.color !== undefined && typeof opt.color !== 'string') return false;
      }
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
    if (
      typeof row.createdAt !== 'number' ||
      !Number.isFinite(row.createdAt) ||
      typeof row.updatedAt !== 'number' ||
      !Number.isFinite(row.updatedAt)
    ) {
      return false;
    }
    if (!row.cells || typeof row.cells !== 'object') return false;
    if (!rowSet.has(rowId)) return false;

    // 校验 cells：禁止包含未在 properties 中声明的悬空属性，且值形态必须符合类型契约
    for (const [cellPropId, cellValue] of Object.entries(row.cells)) {
      if (!propSet.has(cellPropId)) return false; // 悬空属性直接拦截
      const propDef = db.properties[cellPropId];
      if (!validateCellValue(cellValue, propDef.type)) {
        return false; // 非法单元格值形态拦截
      }
    }
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

  const now = Date.now();
  const dbCreatedAt =
    typeof database.createdAt === 'number' && Number.isFinite(database.createdAt)
      ? database.createdAt
      : now;
  const dbUpdatedAt =
    typeof database.updatedAt === 'number' && Number.isFinite(database.updatedAt)
      ? database.updatedAt
      : now;

  const validTypesSet = new Set<string>(VALID_PROPERTY_TYPES);
  const rawProps = database.properties && typeof database.properties === 'object' ? database.properties : {};
  const properties: Record<string, DatabaseProperty> = {};

  for (const [id, prop] of Object.entries(rawProps)) {
    if (!prop || typeof prop !== 'object') continue;
    const safeType: PropertyType =
      typeof prop.type === 'string' && validTypesSet.has(prop.type)
        ? (prop.type as PropertyType)
        : 'text';
    const safeWidth =
      typeof prop.width === 'number' && Number.isFinite(prop.width) && prop.width > 0
        ? prop.width
        : 180;
    const safeOptions = Array.isArray(prop.options)
      ? prop.options.filter(
          (opt): opt is SelectOption =>
            !!opt &&
            typeof opt === 'object' &&
            typeof opt.id === 'string' &&
            typeof opt.name === 'string'
        )
      : undefined;

    properties[id] = {
      ...prop,
      id,
      name: typeof prop.name === 'string' && prop.name ? prop.name : '未命名列',
      type: safeType,
      width: safeWidth,
      ...(safeOptions ? { options: safeOptions } : {}),
    };
  }

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

  // 3. rows 与 rowOrder 自愈，清理悬空 cells 与补充缺失时间戳
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
          const propDef = properties[cellPropId];
          let normalizedVal = val;

          // 兼容历史数据：若 select / multiSelect 的单元格值为标签名称，自愈规整为稳定 option ID
          if (propDef?.type === 'select' && typeof val === 'string') {
            const matchedOpt = propDef.options?.find((o) => o.name === val || o.id === val);
            if (matchedOpt) {
              normalizedVal = matchedOpt.id;
            }
          } else if (propDef?.type === 'multiSelect') {
            const arr = Array.isArray(val) ? val : [String(val)];
            normalizedVal = arr.map((item) => {
              const matchedOpt = propDef.options?.find((o) => o.name === item || o.id === item);
              return matchedOpt ? matchedOpt.id : String(item);
            });
          }

          if (validateCellValue(normalizedVal, propDef?.type || 'text')) {
            cleanCells[cellPropId] = normalizedVal;
          }
        }
      }
    }
    const rowCreatedAt =
      typeof row.createdAt === 'number' && Number.isFinite(row.createdAt)
        ? row.createdAt
        : dbCreatedAt;
    const rowUpdatedAt =
      typeof row.updatedAt === 'number' && Number.isFinite(row.updatedAt)
        ? row.updatedAt
        : dbUpdatedAt;

    rows[rowId] = {
      ...row,
      id: rowId,
      databaseId: database.id,
      cells: cleanCells,
      createdAt: rowCreatedAt,
      updatedAt: rowUpdatedAt,
    };
  }

  return {
    ...database,
    createdAt: dbCreatedAt,
    updatedAt: dbUpdatedAt,
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
  // 严格防御：若显式传入的 ID 已在 properties 中存在，拒绝冲突以防破坏不变量
  if (property.id && db.properties[property.id]) {
    throw new Error(`Property with id "${property.id}" already exists`);
  }

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
  const newSet = new Set(newOrder);
  if (
    newOrder.length !== db.propertyOrder.length ||
    newSet.size !== newOrder.length ||
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

  // 过滤仅保留有效属性列对应且值形态合法的值
  const validCells: Record<string, CellValue> = {};
  for (const [propId, val] of Object.entries(initialCells)) {
    const propDef = db.properties[propId];
    if (propDef && validateCellValue(val, propDef.type)) {
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
 * 不可变更新行元信息与单元格（严格清洗 updates.cells 防止悬空属性或非法形态注入）
 */
export function updateRow(
  db: DatabaseSchema,
  rowId: string,
  updates: Partial<DatabaseRow>
): DatabaseSchema {
  const existing = db.rows[rowId];
  if (!existing) return db;

  let nextCells = existing.cells;
  if (updates.cells && typeof updates.cells === 'object') {
    const sanitizedCells: Record<string, CellValue> = {};
    for (const [propId, val] of Object.entries(updates.cells)) {
      const propDef = db.properties[propId];
      if (propDef && validateCellValue(val, propDef.type)) {
        sanitizedCells[propId] = val;
      }
    }
    nextCells = sanitizedCells;
  }

  const updatedRow: DatabaseRow = {
    ...existing,
    ...updates,
    id: rowId,
    databaseId: db.id,
    cells: nextCells,
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
  const propDef = db.properties[propertyId];
  if (!propDef) return db; // 属性不存在则忽略
  if (!validateCellValue(value, propDef.type)) return db; // 值形态非法则忽略

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
  const newSet = new Set(newOrder);
  if (
    newOrder.length !== db.rowOrder.length ||
    newSet.size !== newOrder.length ||
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

/**
 * 字段类型切换时的单元格数据安全迁移纯函数
 * 确保类型转换后单元格值严格满足目标类型的合法形态，杜绝 NaN、非法格式与悬空引用
 */
export function migrateCellForTypeChange(
  val: CellValue,
  oldType: PropertyType,
  newType: PropertyType,
  options?: SelectOption[]
): CellValue {
  if (val === null || val === undefined || val === '') {
    if (newType === 'checkbox') return false;
    if (newType === 'multiSelect') return [];
    return null;
  }

  if (oldType === newType) {
    if (newType === 'checkbox') return Boolean(val);
    if (newType === 'multiSelect') return Array.isArray(val) ? val : [String(val)];
    return val;
  }

  switch (newType) {
    case 'text': {
      if (oldType === 'select') {
        const opt = options?.find((o) => o.id === val || o.name === val);
        return opt ? opt.name : String(val);
      }
      if (oldType === 'multiSelect') {
        const arr = Array.isArray(val) ? val : [val];
        const names = arr
          .map((id) => options?.find((o) => o.id === id || o.name === id)?.name || String(id))
          .filter(Boolean);
        return names.join(', ');
      }
      if (oldType === 'checkbox') {
        return val ? 'true' : 'false';
      }
      return String(val);
    }

    case 'number': {
      if (oldType === 'checkbox') {
        return val ? 1 : 0;
      }
      const n = typeof val === 'number' ? val : parseFloat(String(val).trim());
      return Number.isFinite(n) ? n : null;
    }

    case 'checkbox': {
      if (typeof val === 'boolean') return val;
      if (typeof val === 'number') return val !== 0 && !Number.isNaN(val);
      const str = String(val).toLowerCase().trim();
      return str === 'true' || str === '1' || str === 'yes';
    }

    case 'select': {
      if (oldType === 'multiSelect' && Array.isArray(val)) {
        return val.length > 0 ? val[0] : null;
      }
      const str = String(val).trim();
      if (!str) return null;
      const matched = options?.find((o) => o.id === str || o.name === str);
      return matched ? matched.id : str;
    }

    case 'multiSelect': {
      if (oldType === 'select') {
        const str = String(val).trim();
        if (!str) return [];
        const matched = options?.find((o) => o.id === str || o.name === str);
        return [matched ? matched.id : str];
      }
      if (Array.isArray(val)) {
        return val.map(String).filter(Boolean);
      }
      const str = String(val).trim();
      return str ? [str] : [];
    }

    case 'date':
    case 'url':
    case 'title':
    default:
      return String(val);
  }
}

/**
 * 原子化修改属性列类型，并自动迁移所有行中该列单元格的数据
 */
export function changePropertyType(
  db: DatabaseSchema,
  propertyId: string,
  newType: PropertyType
): DatabaseSchema {
  const existing = db.properties[propertyId];
  if (!existing) return db;

  // 标题列不可更改类型
  if (existing.type === 'title' || newType === 'title') {
    throw new Error('Cannot change the type of or to the primary title column');
  }

  if (existing.type === newType) return db;

  const updatedProp: DatabaseProperty = {
    ...existing,
    type: newType,
    ...(newType === 'select' || newType === 'multiSelect'
      ? { options: existing.options || [] }
      : {}),
  };

  const nextRows: Record<string, DatabaseRow> = {};
  for (const [rowId, row] of Object.entries(db.rows)) {
    const oldVal = row.cells[propertyId];
    const migratedVal = migrateCellForTypeChange(
      oldVal,
      existing.type,
      newType,
      updatedProp.options
    );
    const nextCells = { ...row.cells };
    if (migratedVal === null || migratedVal === undefined) {
      delete nextCells[propertyId];
    } else {
      nextCells[propertyId] = migratedVal;
    }

    nextRows[rowId] = {
      ...row,
      cells: nextCells,
      updatedAt: Date.now(),
    };
  }

  return {
    ...db,
    properties: {
      ...db.properties,
      [propertyId]: updatedProp,
    },
    rows: nextRows,
    updatedAt: Date.now(),
  };
}

/**
 * 为 select/multiSelect 属性列添加新选项
 */
export function addSelectOption(
  db: DatabaseSchema,
  propertyId: string,
  option: Omit<SelectOption, 'id'> & { id?: string }
): DatabaseSchema {
  const prop = db.properties[propertyId];
  if (!prop || (prop.type !== 'select' && prop.type !== 'multiSelect')) {
    throw new Error(`Property "${propertyId}" is not a select or multiSelect property`);
  }

  const existingOptions = prop.options || [];
  const optId = option.id || `opt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  if (existingOptions.some((o) => o.id === optId)) {
    throw new Error(`Option with id "${optId}" already exists`);
  }

  const newOption: SelectOption = {
    id: optId,
    name: option.name.trim() || '新选项',
    color: option.color || 'blue',
  };

  const updatedProp: DatabaseProperty = {
    ...prop,
    options: [...existingOptions, newOption],
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
 * 更新 select/multiSelect 属性列的选项（重命名、修改颜色）
 */
export function updateSelectOption(
  db: DatabaseSchema,
  propertyId: string,
  optionId: string,
  updates: Partial<SelectOption>
): DatabaseSchema {
  const prop = db.properties[propertyId];
  if (!prop || (prop.type !== 'select' && prop.type !== 'multiSelect')) {
    return db;
  }

  const existingOptions = prop.options || [];
  const updatedOptions = existingOptions.map((opt) =>
    opt.id === optionId ? { ...opt, ...updates, id: optionId } : opt
  );

  return {
    ...db,
    properties: {
      ...db.properties,
      [propertyId]: {
        ...prop,
        options: updatedOptions,
      },
    },
    updatedAt: Date.now(),
  };
}

/**
 * 删除 select/multiSelect 属性列的选项，并级联清理所有行中的该选项引用
 */
export function deleteSelectOption(
  db: DatabaseSchema,
  propertyId: string,
  optionId: string
): DatabaseSchema {
  const prop = db.properties[propertyId];
  if (!prop || (prop.type !== 'select' && prop.type !== 'multiSelect')) {
    return db;
  }

  const nextOptions = (prop.options || []).filter((opt) => opt.id !== optionId);
  const updatedProp: DatabaseProperty = {
    ...prop,
    options: nextOptions,
  };

  const nextRows: Record<string, DatabaseRow> = {};
  for (const [rowId, row] of Object.entries(db.rows)) {
    const val = row.cells[propertyId];
    let nextVal = val;

    if (prop.type === 'select') {
      if (val === optionId) {
        nextVal = null;
      }
    } else if (prop.type === 'multiSelect' && Array.isArray(val)) {
      nextVal = val.filter((id) => id !== optionId);
    }

    const nextCells = { ...row.cells };
    if (nextVal === null || nextVal === undefined || (Array.isArray(nextVal) && nextVal.length === 0)) {
      delete nextCells[propertyId];
    } else {
      nextCells[propertyId] = nextVal;
    }

    nextRows[rowId] = {
      ...row,
      cells: nextCells,
      updatedAt: Date.now(),
    };
  }

  return {
    ...db,
    properties: {
      ...db.properties,
      [propertyId]: updatedProp,
    },
    rows: nextRows,
    updatedAt: Date.now(),
  };
}

