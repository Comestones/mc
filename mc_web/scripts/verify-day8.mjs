// Day 8 Acceptance Verification Script: 多维数据库 Schema 与底层数据层
import assert from 'node:assert/strict';
import {
  createDatabase,
  validateDatabaseSchema,
  normalizeDatabaseSchema,
  addProperty,
  updateProperty,
  deleteProperty,
  reorderProperties,
  addRow,
  updateRow,
  updateCell,
  deleteRow,
  reorderRows,
  DEFAULT_TITLE_PROPERTY_ID,
} from '../src/utils/databaseUtils.ts';
import {
  validateWorkspaceSnapshot,
  normalizeSnapshot,
  migrateSnapshotToV2,
  MemoryStorage,
  SNAPSHOT_SCHEMA_VERSION,
} from '../src/utils/workspaceStorage.ts';
import {
  cleanBlockProperties,
  normalizeBlock,
} from '../src/utils/blockUtils.ts';
import {
  filterSlashCommands,
} from '../src/utils/slashCommandUtils.ts';

console.log('🧪 开始 Day 8: 多维数据库 Schema 与底层数据层自动化验收核查...\n');

// =================================================================
// 测试 1: 数据库 Schema 契约与严格不变量校验 (validateDatabaseSchema)
// =================================================================
console.log('▶ 测试 1: 数据库 Schema 基础结构与不变量契约校验...');
{
  const db = createDatabase('项目管理表');
  assert.equal(typeof db.id, 'string', '数据库应生成合法 ID');
  assert.equal(db.title, '项目管理表');
  assert.equal(db.propertyOrder.length, 1);
  assert.equal(db.properties[DEFAULT_TITLE_PROPERTY_ID]?.type, 'title', '默认应包含 title 列');
  assert.equal(validateDatabaseSchema(db), true, '标准初始化数据库应通过校验');

  // 不变量防御 1: 缺失 title 属性列
  const noTitleDb = {
    ...db,
    properties: {
      'p-text': { id: 'p-text', name: '描述', type: 'text' },
    },
    propertyOrder: ['p-text'],
  };
  assert.equal(validateDatabaseSchema(noTitleDb), false, '缺少 title 属性列应拦截');

  // 不变量防御 2: 存在多个 title 属性列
  const multiTitleDb = {
    ...db,
    properties: {
      ...db.properties,
      'p-title-2': { id: 'p-title-2', name: '副标题', type: 'title' },
    },
    propertyOrder: [...db.propertyOrder, 'p-title-2'],
  };
  assert.equal(validateDatabaseSchema(multiTitleDb), false, '多个 title 属性列应拦截');

  // 不变量防御 3: propertyOrder 与 properties 键集合不一致或存在重复
  const orderMismatchDb = {
    ...db,
    propertyOrder: [DEFAULT_TITLE_PROPERTY_ID, 'non-existent-prop'],
  };
  assert.equal(validateDatabaseSchema(orderMismatchDb), false, '列顺序包含不存在属性时应拦截');

  const duplicateOrderDb = {
    ...db,
    propertyOrder: [DEFAULT_TITLE_PROPERTY_ID, DEFAULT_TITLE_PROPERTY_ID],
  };
  assert.equal(validateDatabaseSchema(duplicateOrderDb), false, '列顺序存在重复 ID 时应拦截');

  // 不变量防御 4: rowOrder 与 rows 键集合不一致或 databaseId 不匹配
  const badRowDb = {
    ...db,
    rows: {
      'r-1': { id: 'r-1', databaseId: 'other-db-id', cells: {}, createdAt: 1, updatedAt: 1 },
    },
    rowOrder: ['r-1'],
  };
  assert.equal(validateDatabaseSchema(badRowDb), false, 'row databaseId 不匹配应拦截');

  // P2 校验防御 5: 未知属性类型 (type: 'made-up') 必须拦截
  const unknownTypeDb = {
    ...db,
    properties: {
      ...db.properties,
      'p-bad': { id: 'p-bad', name: '非法列', type: 'made-up' },
    },
    propertyOrder: [...db.propertyOrder, 'p-bad'],
  };
  assert.equal(validateDatabaseSchema(unknownTypeDb), false, '未知属性类型应拦截');

  // P2 校验防御 6: 行内包含未在 properties 中声明的悬空 cell 必须拦截
  const ghostCellDb = {
    ...db,
    rows: {
      'r-ghost': {
        id: 'r-ghost',
        databaseId: db.id,
        cells: {
          [DEFAULT_TITLE_PROPERTY_ID]: '合法标题',
          'ghost-cell-id': '悬空垃圾数据',
        },
        createdAt: 1,
        updatedAt: 1,
      },
    },
    rowOrder: ['r-ghost'],
  };
  assert.equal(validateDatabaseSchema(ghostCellDb), false, '悬空属性单元格应拦截');

  // P2 校验防御 7: 单元格值形态与属性类型不匹配必须拦截
  const badValueDb = {
    ...db,
    properties: {
      ...db.properties,
      'p-num': { id: 'p-num', name: '数字', type: 'number' },
      'p-check': { id: 'p-check', name: '勾选', type: 'checkbox' },
    },
    propertyOrder: [...db.propertyOrder, 'p-num', 'p-check'],
    rows: {
      'r-bad-val': {
        id: 'r-bad-val',
        databaseId: db.id,
        cells: {
          [DEFAULT_TITLE_PROPERTY_ID]: '标题',
          'p-num': '不是数字', // 应该为 number
          'p-check': true,
        },
        createdAt: 1,
        updatedAt: 1,
      },
    },
    rowOrder: ['r-bad-val'],
  };
  assert.equal(validateDatabaseSchema(badValueDb), false, '非法单元格值类型应拦截');

  // P2 校验防御 8: 非法宽度或选项结构必须拦截
  const badWidthDb = {
    ...db,
    properties: {
      ...db.properties,
      'p-w': { id: 'p-w', name: '宽度异常', type: 'text', width: -100 },
    },
    propertyOrder: [...db.propertyOrder, 'p-w'],
  };
  assert.equal(validateDatabaseSchema(badWidthDb), false, '负数或非有限列宽应拦截');

  console.log('  ✔ 唯一标题列保护、属性顺序/行记录 1:1 键校验、非法类型与悬空单元格校验通过');
}

// =================================================================
// 测试 2: 纯函数不可变列操作与级联清理 (Property Operations)
// =================================================================
console.log('▶ 测试 2: 纯函数不可变列操作与级联清理防御...');
{
  let db = createDatabase('研发任务');
  const originalTimestamp = db.updatedAt;

  // 添加单选列
  db = addProperty(db, {
    name: '状态',
    type: 'select',
    options: [
      { id: 'opt-1', name: '未开始', color: 'gray' },
      { id: 'opt-2', name: '进行中', color: 'blue' },
    ],
  });
  const statusPropId = db.propertyOrder[1];
  assert.equal(db.propertyOrder.length, 2);
  assert.equal(db.properties[statusPropId].name, '状态');
  assert.equal(db.properties[statusPropId].type, 'select');

  // 尝试重复添加 title 列：应自动降级为 text，维持唯一 title 不变量
  const beforeCount = Object.values(db.properties).filter((p) => p.type === 'title').length;
  db = addProperty(db, { name: '额外标题', type: 'title' });
  const newPropId = db.propertyOrder[2];
  assert.equal(db.properties[newPropId].type, 'text', '多余 title 应自动降级为 text');
  const afterCount = Object.values(db.properties).filter((p) => p.type === 'title').length;
  assert.equal(beforeCount, afterCount, '系统依然严格保持唯一 title 列');

  // 添加一行数据
  db = addRow(db, {
    [DEFAULT_TITLE_PROPERTY_ID]: '任务 A',
    [statusPropId]: 'opt-1',
    [newPropId]: '备注信息',
  });
  const rowId = db.rowOrder[0];
  assert.equal(db.rows[rowId].cells[statusPropId], 'opt-1');

  // 修改属性列名称
  db = updateProperty(db, statusPropId, { name: '任务进度' });
  assert.equal(db.properties[statusPropId].name, '任务进度');

  // 不变量防御：严禁修改 title 列类型
  assert.throws(
    () => updateProperty(db, DEFAULT_TITLE_PROPERTY_ID, { type: 'text' }),
    /Cannot change the type of the primary title column/,
    '修改主标题列类型应抛出异常'
  );

  // 不变量防御：严禁将其他列修改为 title
  assert.throws(
    () => updateProperty(db, statusPropId, { type: 'title' }),
    /Cannot add a second title column to the database/,
    '将普通列修改为 title 应抛出异常'
  );

  // 不变量防御：严禁删除主标题列
  assert.throws(
    () => deleteProperty(db, DEFAULT_TITLE_PROPERTY_ID),
    /Cannot delete the primary title column of a database/,
    '删除主标题列应抛出异常'
  );

  // 删除普通列：级联清理所有行中的对应 cell
  db = deleteProperty(db, statusPropId);
  assert.equal(db.properties[statusPropId], undefined, '列定义已被移除');
  assert.equal(db.propertyOrder.includes(statusPropId), false, '列顺序已被同步移除');
  assert.equal(db.rows[rowId].cells[statusPropId], undefined, '所有行中该列单元格被原子化级联移除');

  // 列重排
  const reversedOrder = [...db.propertyOrder].reverse();
  db = reorderProperties(db, reversedOrder);
  assert.deepEqual(db.propertyOrder, reversedOrder, '属性列应支持确定性重排');

  // P1 防御：添加重复 ID 应被拒绝
  assert.throws(
    () => addProperty(db, { id: DEFAULT_TITLE_PROPERTY_ID, name: '冲突ID列', type: 'text' }),
    /already exists/,
    '添加重复属性 ID 必须抛出异常'
  );

  // P1 防御：列重排包含重复项应被拒绝
  assert.throws(
    () => reorderProperties(db, [DEFAULT_TITLE_PROPERTY_ID, DEFAULT_TITLE_PROPERTY_ID]),
    /Invalid property order permutation/,
    '列重排包含重复 ID 必须抛出异常'
  );

  console.log('  ✔ 不可变属性增删改、标题列类型/删除保护、单元格级联清理与重排去重校验通过');
}

// =================================================================
// 测试 3: 行记录与单元格不可变操作 (Row & Cell Operations)
// =================================================================
console.log('▶ 测试 3: 行记录与单元格不可变操作...');
{
  let db = createDatabase('缺陷跟踪');
  db = addProperty(db, { name: '严重程度', type: 'number' });
  const numPropId = db.propertyOrder[1];

  // 添加首行
  db = addRow(db, {
    [DEFAULT_TITLE_PROPERTY_ID]: '严重 Bug 1',
    [numPropId]: 1,
    'ghost-prop': 'should-be-filtered', // 悬空无效属性应被自动过滤
  });
  const row1Id = db.rowOrder[0];
  assert.equal(db.rows[row1Id].cells['ghost-prop'], undefined, '无效属性单元格应在入库时被滤除');
  assert.equal(db.rows[row1Id].cells[numPropId], 1);

  // 在头部插入第二行 (atIndex = 0)
  db = addRow(
    db,
    {
      [DEFAULT_TITLE_PROPERTY_ID]: '置顶 Bug 0',
      [numPropId]: 0,
    },
    0
  );
  const row0Id = db.rowOrder[0];
  assert.equal(db.rows[row0Id].cells[DEFAULT_TITLE_PROPERTY_ID], '置顶 Bug 0');
  assert.equal(db.rowOrder[1], row1Id);

  // 更新单元格
  db = updateCell(db, row1Id, numPropId, 2);
  assert.equal(db.rows[row1Id].cells[numPropId], 2);

  // 更新不存在属性的单元格：静默安全忽略
  db = updateCell(db, row1Id, 'non-existent', 999);
  assert.equal(db.rows[row1Id].cells['non-existent'], undefined);

  // 更新非法值形态：静默安全忽略
  db = updateCell(db, row1Id, numPropId, 'not-a-number');
  assert.equal(db.rows[row1Id].cells[numPropId], 2, '类型不符的值更新应被忽略');

  // P1: updateRow 传入包含悬空 cell 的更新对象，应自动清洗
  db = updateRow(db, row1Id, {
    cells: {
      [DEFAULT_TITLE_PROPERTY_ID]: '已更新Bug',
      'ghost-prop': 'should-be-stripped',
    },
  });
  assert.equal(db.rows[row1Id].cells['ghost-prop'], undefined, 'updateRow 中悬空属性必须被清洗');
  assert.equal(db.rows[row1Id].cells[DEFAULT_TITLE_PROPERTY_ID], '已更新Bug');

  // 行记录重排
  db = reorderRows(db, [row1Id, row0Id]);
  assert.deepEqual(db.rowOrder, [row1Id, row0Id]);

  // P1: 行重排包含重复项应被拒绝
  assert.throws(
    () => reorderRows(db, [row1Id, row1Id]),
    /Invalid row order permutation/,
    '行重排包含重复行 ID 必须抛出异常'
  );

  // 删除行记录
  db = deleteRow(db, row0Id);
  assert.equal(db.rows[row0Id], undefined);
  assert.equal(db.rowOrder.includes(row0Id), false);
  assert.equal(db.rowOrder.length, 1);

  console.log('  ✔ 行记录增删改、索引指定插入、悬空属性隔离、行重排去重校验通过');
}

// =================================================================
// 测试 4: Schema 规范化与异常数据自愈 (normalizeDatabaseSchema)
// =================================================================
console.log('▶ 测试 4: Schema 容错规整与脏数据自愈 (normalizeDatabaseSchema)...');
{
  const corruptDb = {
    id: 'db-corrupt',
    title: '受损数据库',
    createdAt: 100,
    updatedAt: 100,
    properties: {
      // 缺少 title 列，且有两个普通列
      'p-text-1': { id: 'p-text-1', name: '文本 1', type: 'text' },
      'p-text-2': { id: 'p-text-2', name: '文本 2', type: 'text' },
    },
    // propertyOrder 包含未声明属性和重复项
    propertyOrder: ['ghost-prop', 'p-text-1', 'p-text-1'],
    rows: {
      'r-1': {
        id: 'r-1',
        databaseId: 'different-id', // 不匹配的 dbId
        cells: {
          'p-text-1': '正常内容',
          'ghost-prop': '残留垃圾数据',
        },
      },
    },
    rowOrder: ['ghost-row', 'r-1', 'r-1'],
  };

  const healed = normalizeDatabaseSchema(corruptDb);

  // 1. 自动补齐缺失的 title 列
  const titleProps = Object.values(healed.properties).filter((p) => p.type === 'title');
  assert.equal(titleProps.length, 1, '自愈后必须且仅有 1 个 title 属性');

  // 2. propertyOrder 消除重复与不存在 ID，补齐所有合法列
  assert.equal(healed.propertyOrder.length, Object.keys(healed.properties).length);
  const propOrderSet = new Set(healed.propertyOrder);
  assert.equal(propOrderSet.size, healed.propertyOrder.length);
  assert.equal(propOrderSet.has('ghost-prop'), false);

  // 3. row 的 databaseId 修复，悬空垃圾 cell 被清理
  assert.equal(healed.rows['r-1'].databaseId, healed.id);
  assert.equal(healed.rows['r-1'].cells['ghost-prop'], undefined);
  assert.equal(healed.rows['r-1'].cells['p-text-1'], '正常内容');

  // 4. rowOrder 消除重复与不存在行 ID
  assert.deepEqual(healed.rowOrder, ['r-1']);

  // 5. 校验规整后的对象是否符合严格 Schema 规范
  assert.equal(validateDatabaseSchema(healed), true, '修复后的数据库应完全符合规范');

  // P1: createDatabase 传入包含重复 ID 和多 title 的 initialProperties
  const multiTitleInitDb = createDatabase('多Title初建库', [
    { id: 'dup-id', name: '标题 1', type: 'title' },
    { id: 'dup-id', name: '重复ID列', type: 'text' },
    { id: 'p-title-2', name: '标题 2', type: 'title' },
  ]);
  assert.equal(validateDatabaseSchema(multiTitleInitDb), true, '初始属性含重复 ID 与多 title 必须生成合法数据库');
  assert.equal(multiTitleInitDb.propertyOrder.length, 3);
  assert.equal(Object.values(multiTitleInitDb.properties).filter((p) => p.type === 'title').length, 1);

  console.log('  ✔ 缺失标题自动补齐、非法列/行ID剔除、悬空垃圾单元格自愈通过');
}

// =================================================================
// 测试 5: 快照 v1 -> v2 迁移与持久化兼容性
// =================================================================
console.log('▶ 测试 5: 快照 v1 -> v2 平滑迁移与数据持久化...');
{
  assert.equal(SNAPSHOT_SCHEMA_VERSION, 2, '当前 Schema 版本必须为 2');

  const v1Snapshot = {
    version: 1,
    timestamp: 1000,
    workspace: { id: 'ws-1', name: '旧版工作区', icon: '📝', description: '', memberCount: 1 },
    documents: {
      'p-1': {
        id: 'p-1',
        title: '旧页面',
        parentId: null,
        createdAt: 1000,
        updatedAt: 1000,
        blocks: [{ id: 'b-1', type: 'paragraph', content: '旧内容' }],
      },
    },
    activePageId: 'p-1',
    isSidebarCollapsed: false,
    theme: 'light',
  };

  // 校验 v1 快照应合法
  assert.equal(validateWorkspaceSnapshot(v1Snapshot), true, 'v1 快照在校验器中应被向后兼容接受');

  // 执行 v1 -> v2 迁移
  const migrated = migrateSnapshotToV2(v1Snapshot);
  assert.equal(migrated.version, 2, '版本应升级至 2');
  assert.deepEqual(migrated.databases, {}, 'v2 快照应自动初始化 databases 字典');

  // 通过 MemoryStorage 加载 v1 快照：应自动无缝迁移至 v2
  const storage = new MemoryStorage(v1Snapshot);
  const loaded = await storage.load();
  assert.ok(loaded);
  assert.equal(loaded.version, 2);
  assert.ok(loaded.databases !== undefined);

  // 拦截未来未知版本 (> 2)
  assert.equal(validateWorkspaceSnapshot({ ...v1Snapshot, version: 3 }), false, '未知高版本快照必须拦截');

  // P2: 快照中若包含损坏的数据库（如非法属性类型或悬空 cell），必须被拦截
  const corruptDbSnapshot = {
    ...v1Snapshot,
    version: 2,
    databases: {
      'bad-db': {
        ...createDatabase('坏库'),
        properties: {
          [DEFAULT_TITLE_PROPERTY_ID]: { id: DEFAULT_TITLE_PROPERTY_ID, name: '标题', type: 'made-up' },
        },
      },
    },
  };
  assert.equal(validateWorkspaceSnapshot(corruptDbSnapshot), false, '快照中包含损坏数据库必须被拦截');

  console.log('  ✔ v1 历史快照向后兼容、v2 平滑升级、未来高版本阻断与损坏库快照拦截通过');
}

// =================================================================
// 测试 6: Block 树集成与属性隔离 (cleanBlockProperties & normalizeBlock)
// =================================================================
console.log('▶ 测试 6: Block 节点属性边界隔离与斜杠指令匹配...');
{
  // 6a: database 块保留且仅保留 databaseId
  const dbBlock = {
    id: 'block-db',
    type: 'database',
    content: '',
    properties: {
      databaseId: 'db-12345',
      extraGarbage: 'strip-me',
      level: 2,
    },
  };
  const cleanedDbProps = cleanBlockProperties('database', dbBlock.properties);
  assert.deepEqual(cleanedDbProps, { databaseId: 'db-12345' });

  const normalizedDbBlock = normalizeBlock(dbBlock);
  assert.equal(normalizedDbBlock.properties?.databaseId, 'db-12345');
  assert.equal(normalizedDbBlock.properties?.extraGarbage, undefined);

  // 6b: 非 database 块切换时严格剔除 databaseId
  const paraProps = cleanBlockProperties('paragraph', { databaseId: 'db-12345' });
  assert.equal(paraProps, undefined, '非 database 块不应保留 databaseId');

  // 6c: 斜杠指令过滤与拼音检索
  const sjkMatch = filterSlashCommands('sjk');
  assert.ok(sjkMatch.some((cmd) => cmd.type === 'database'), '输入 /sjk 应匹配到多维数据库');

  const tableMatch = filterSlashCommands('table');
  assert.ok(tableMatch.some((cmd) => cmd.type === 'database'), '输入 /table 应匹配到多维数据库');

  const dbMatch = filterSlashCommands('db');
  assert.ok(dbMatch.some((cmd) => cmd.type === 'database'), '输入 /db 应匹配到多维数据库');

  console.log('  ✔ Block properties 纯净隔离与斜杠指令精准触达通过');
}

console.log('\n🎉 Day 8: 多维数据库 Schema 与底层数据层 6 大模块全部验收通过！');
