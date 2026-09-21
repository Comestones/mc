// Day 10 Acceptance Verification Script: 基础字段类型系统 (Property Types)
import assert from 'node:assert/strict';
import {
  createDatabase,
  validateDatabaseSchema,
  normalizeDatabaseSchema,
  getIncompatibleCellCount,
  addProperty,
  addRow,
  updateCell,
  deleteProperty,
  changePropertyType,
  migrateCellForTypeChange,
  addSelectOption,
  updateSelectOption,
  deleteSelectOption,
  DEFAULT_TITLE_PROPERTY_ID,
} from '../src/utils/databaseUtils.ts';
import {
  VALID_PROPERTY_TYPES,
  PRESET_OPTION_COLORS,
} from '../src/types/database.ts';

console.log('🧪 开始 Day 10: 基础字段类型系统 (Property Types) 自动化验收核查...\n');

// =================================================================
// 测试 1: 5 大基础字段类型契约与预设色彩常量
// =================================================================
console.log('▶ 测试 1: 5 大基础字段类型契约与 8 色预设色彩体系校验...');
{
  const expectedTypes = ['title', 'text', 'number', 'select', 'multiSelect', 'checkbox'];
  for (const t of expectedTypes) {
    assert.ok(VALID_PROPERTY_TYPES.includes(t), `字段类型必须包含 ${t}`);
  }

  // 8 色预设色彩体系
  assert.equal(PRESET_OPTION_COLORS.length, 8, '预设色彩必须包含 8 款精选对比色');
  const colorIds = PRESET_OPTION_COLORS.map((c) => c.id);
  const requiredColors = ['gray', 'blue', 'green', 'yellow', 'red', 'purple', 'pink', 'orange'];
  for (const c of requiredColors) {
    assert.ok(colorIds.includes(c), `预设色彩必须包含 ${c}`);
  }

  console.log('  ✔ 基础字段类型定义完整，8 色预设色彩体系契约通过');
}

// =================================================================
// 测试 2: 跨类型单元格迁移函数 migrateCellForTypeChange
// =================================================================
console.log('▶ 测试 2: 跨类型单元格原子迁移函数行为与边界用例校验...');
{
  const options = [
    { id: 'opt-dev', name: '开发' },
    { id: 'opt-design', name: '设计' },
  ];

  // 1. 任意类型 -> text
  assert.equal(migrateCellForTypeChange(123, 'number', 'text', options), '123');
  assert.equal(migrateCellForTypeChange(true, 'checkbox', 'text', options), 'true');
  assert.equal(migrateCellForTypeChange('opt-dev', 'select', 'text', options), '开发');
  assert.equal(migrateCellForTypeChange(['opt-dev', 'opt-design'], 'multiSelect', 'text', options), '开发, 设计');
  assert.equal(migrateCellForTypeChange(null, 'number', 'text', options), null);

  // 2. 任意类型 -> number
  assert.equal(migrateCellForTypeChange('42', 'text', 'number', options), 42);
  assert.equal(migrateCellForTypeChange('  100.5  ', 'text', 'number', options), 100.5);
  assert.equal(migrateCellForTypeChange('invalid-num', 'text', 'number', options), null);
  assert.equal(migrateCellForTypeChange(true, 'checkbox', 'number', options), 1);
  assert.equal(migrateCellForTypeChange(false, 'checkbox', 'number', options), 0);

  // 3. 任意类型 -> checkbox
  assert.equal(migrateCellForTypeChange('true', 'text', 'checkbox', options), true);
  assert.equal(migrateCellForTypeChange('1', 'text', 'checkbox', options), true);
  assert.equal(migrateCellForTypeChange('yes', 'text', 'checkbox', options), true);
  assert.equal(migrateCellForTypeChange('false', 'text', 'checkbox', options), false);
  assert.equal(migrateCellForTypeChange('', 'text', 'checkbox', options), false);
  assert.equal(migrateCellForTypeChange(1, 'number', 'checkbox', options), true);
  assert.equal(migrateCellForTypeChange(0, 'number', 'checkbox', options), false);

  // 4. select 与 multiSelect 互转
  assert.deepEqual(migrateCellForTypeChange('opt-dev', 'select', 'multiSelect', options), ['opt-dev']);
  assert.equal(migrateCellForTypeChange(['opt-dev', 'opt-design'], 'multiSelect', 'select', options), 'opt-dev');
  assert.equal(migrateCellForTypeChange([], 'multiSelect', 'select', options), null);

  console.log('  ✔ migrateCellForTypeChange 跨类型转换与容错机制校验通过');
}

// =================================================================
// 测试 3: 列类型切换 changePropertyType 与主标题列不变量守卫
// =================================================================
console.log('▶ 测试 3: changePropertyType 整列迁移与主标题列不变量保护...');
{
  let db = createDatabase('类型切换测试库');
  const titlePropId = DEFAULT_TITLE_PROPERTY_ID;

  // 1. 尝试更改主标题列类型，必须被严格拦截
  assert.throws(
    () => {
      changePropertyType(db, titlePropId, 'number');
    },
    /primary title column/,
    '主标题列严禁更改类型'
  );

  // 2. 添加普通文本列并填充数据
  db = addProperty(db, { name: '数据列', type: 'text' });
  const dataPropId = db.propertyOrder[1];
  db = addRow(db, { [titlePropId]: '行 1', [dataPropId]: '100' });
  db = addRow(db, { [titlePropId]: '行 2', [dataPropId]: '250.75' });
  db = addRow(db, { [titlePropId]: '行 3', [dataPropId]: '非数字' });

  const row1Id = db.rowOrder[0];
  const row2Id = db.rowOrder[1];
  const row3Id = db.rowOrder[2];

  // 3. 将 text 切换为 number
  db = changePropertyType(db, dataPropId, 'number');
  assert.equal(db.properties[dataPropId].type, 'number');
  assert.equal(db.rows[row1Id].cells[dataPropId], 100);
  assert.equal(db.rows[row2Id].cells[dataPropId], 250.75);
  // '非数字' 无法转换为 number，安全转换为 null/清除
  assert.equal(db.rows[row3Id].cells[dataPropId], undefined);

  // 4. 将 number 切换为 checkbox
  db = changePropertyType(db, dataPropId, 'checkbox');
  assert.equal(db.properties[dataPropId].type, 'checkbox');
  assert.equal(db.rows[row1Id].cells[dataPropId], true);
  assert.equal(db.rows[row2Id].cells[dataPropId], true);

  console.log('  ✔ 整列数据原子迁移与主标题列不可变守卫通过');
}

// =================================================================
// 测试 4: 选项管理生命周期与级联清理 (Cascade Delete)
// =================================================================
console.log('▶ 测试 4: 标签选项增删改与行数据级联清理 (Cascade Delete)...');
{
  let db = createDatabase('选项管理测试库');
  const titlePropId = DEFAULT_TITLE_PROPERTY_ID;

  db = addProperty(db, { name: '标签', type: 'multiSelect' });
  const tagPropId = db.propertyOrder[1];

  // 1. 添加选项
  db = addSelectOption(db, tagPropId, { id: 'opt-frontend', name: '前端', color: '#3b82f6' });
  db = addSelectOption(db, tagPropId, { id: 'opt-backend', name: '后端', color: '#10b981' });
  db = addSelectOption(db, tagPropId, { id: 'opt-design', name: '设计', color: '#ec4899' });

  assert.equal(db.properties[tagPropId].options.length, 3);

  // 2. 插入行数据，引用这些选项
  db = addRow(db, {
    [titlePropId]: '页面组件',
    [tagPropId]: ['opt-frontend', 'opt-design'],
  });
  db = addRow(db, {
    [titlePropId]: '服务接口',
    [tagPropId]: ['opt-backend'],
  });
  db = addRow(db, {
    [titlePropId]: 'UI规范',
    [tagPropId]: ['opt-design'],
  });

  const row1Id = db.rowOrder[0];
  const row2Id = db.rowOrder[1];
  const row3Id = db.rowOrder[2];

  // 3. 修改选项名称与颜色
  db = updateSelectOption(db, tagPropId, 'opt-design', {
    name: 'UI/UX设计',
    color: '#8b5cf6',
  });
  const updatedOpt = db.properties[tagPropId].options.find((o) => o.id === 'opt-design');
  assert.equal(updatedOpt.name, 'UI/UX设计');
  assert.equal(updatedOpt.color, '#8b5cf6');

  // 4. 删除 'opt-design' 选项 -> 级联清理所有行中对它的引用
  db = deleteSelectOption(db, tagPropId, 'opt-design');

  // 属性中已不包含该选项
  assert.equal(db.properties[tagPropId].options.length, 2);
  assert.ok(!db.properties[tagPropId].options.some((o) => o.id === 'opt-design'));

  // 行 1 之前是 ['opt-frontend', 'opt-design']，现在仅剩 ['opt-frontend']
  assert.deepEqual(db.rows[row1Id].cells[tagPropId], ['opt-frontend']);

  // 行 2 未引用 opt-design，保持 ['opt-backend']
  assert.deepEqual(db.rows[row2Id].cells[tagPropId], ['opt-backend']);

  // 行 3 仅引用了 opt-design，删除后该单元格变为空并安全清理
  assert.equal(db.rows[row3Id].cells[tagPropId], undefined);

  // 5. 单选列的级联删除验证
  db = addProperty(db, { name: '单选状态', type: 'select' });
  const statusPropId = db.propertyOrder[2];
  db = addSelectOption(db, statusPropId, { id: 'status-done', name: '已完成' });
  db = updateCell(db, row1Id, statusPropId, 'status-done');
  assert.equal(db.rows[row1Id].cells[statusPropId], 'status-done');

  db = deleteSelectOption(db, statusPropId, 'status-done');
  assert.equal(db.rows[row1Id].cells[statusPropId], undefined, '单选被删选项单元格应安全清空');

  console.log('  ✔ 选项新增、更新、删除及全量数据行级联清理通过');
}

// =================================================================
// 测试 5: 200 行 5 种字段大数据量装载与原子类型迁移性能基准
// =================================================================
console.log('▶ 测试 5: 200 行 5 大字段全量装载与列类型迁移基准耗时性能...');
{
  let db = createDatabase('全字段性能基准测试库');
  const titlePropId = DEFAULT_TITLE_PROPERTY_ID;

  db = addProperty(db, { name: '数量', type: 'number' });
  const numPropId = db.propertyOrder[1];

  db = addProperty(db, { name: '已完成', type: 'checkbox' });
  const chkPropId = db.propertyOrder[2];

  db = addProperty(db, {
    name: '阶段',
    type: 'select',
    options: [
      { id: 'opt-p1', name: '阶段1', color: '#3b82f6' },
      { id: 'opt-p2', name: '阶段2', color: '#10b981' },
    ],
  });
  const selPropId = db.propertyOrder[3];

  db = addProperty(db, {
    name: '标签组',
    type: 'multiSelect',
    options: [
      { id: 'opt-t1', name: 'Alpha', color: '#f59e0b' },
      { id: 'opt-t2', name: 'Beta', color: '#ec4899' },
    ],
  });
  const multiPropId = db.propertyOrder[4];

  const startTime = performance.now();

  // 批量构造 200 行复杂数据
  for (let i = 0; i < 200; i++) {
    db = addRow(db, {
      [titlePropId]: `多字段记录项 #${i + 1}`,
      [numPropId]: (i + 1) * 10,
      [chkPropId]: i % 2 === 0,
      [selPropId]: i % 2 === 0 ? 'opt-p1' : 'opt-p2',
      [multiPropId]: ['opt-t1', 'opt-t2'],
    });
  }

  const insertDuration = performance.now() - startTime;
  assert.equal(db.rowOrder.length, 200);
  console.log(`  ⚡ 200 行全字段数据插入耗时: ${insertDuration.toFixed(2)}ms`);
  assert.ok(insertDuration < 250, '200 行全字段创建耗时应在 250ms 以内');

  // 压力测试：将 200 行的 number 列迁移为 text 列
  const migrateStart = performance.now();
  db = changePropertyType(db, numPropId, 'text');
  const migrateDuration = performance.now() - migrateStart;
  console.log(`  ⚡ 200 行整列原子类型迁移耗时: ${migrateDuration.toFixed(2)}ms`);
  assert.ok(migrateDuration < 100, '200 行整列类型转换耗时应在 100ms 以内');

  // 验证最后一行迁移结果无误
  const lastRowId = db.rowOrder[199];
  assert.equal(db.rows[lastRowId].cells[numPropId], '2000');
  assert.equal(db.properties[numPropId].type, 'text');

  console.log('  ✔ 200 行多字段数据装载与整列原子类型迁移性能达标');
}

// =================================================================
// 测试 6: 数据库 Schema 严格契约反例拦截、损坏数据自愈与类型切换预检查
// =================================================================
console.log('▶ 测试 6: 数据库 Schema 严格契约反例拦截、损坏数据自愈与类型切换预检查...');
{
  const validDb = createDatabase('契约测试库');
  const titlePropId = DEFAULT_TITLE_PROPERTY_ID;

  // 1. 反例验证：非 select / multiSelect 字段携带 options 必须被拦截
  const corruptDb1 = {
    ...validDb,
    properties: {
      ...validDb.properties,
      'prop-text-bad': {
        id: 'prop-text-bad',
        name: '非法带选项文本列',
        type: 'text',
        options: [{ id: 'opt-x', name: 'X' }],
      },
    },
    propertyOrder: [...validDb.propertyOrder, 'prop-text-bad'],
  };
  assert.equal(validateDatabaseSchema(corruptDb1), false, '普通 text 字段携带 options 必须返回 false');

  // 自愈后 options 必须被清除
  const healedDb1 = normalizeDatabaseSchema(corruptDb1);
  assert.equal(validateDatabaseSchema(healedDb1), true, '自愈后必须符合合法 Schema');
  assert.equal(healedDb1.properties['prop-text-bad'].options, undefined, 'text 字段上的 options 必须被清理');

  // 2. 反例验证：select 选项包含空 ID、重复 ID 或空 Name 必须被拦截
  const corruptDb2 = {
    ...validDb,
    properties: {
      ...validDb.properties,
      'prop-sel-bad': {
        id: 'prop-sel-bad',
        name: '坏单选列',
        type: 'select',
        options: [
          { id: '', name: '空ID项' },
          { id: 'dup', name: '重复1' },
          { id: 'dup', name: '重复2' },
          { id: 'opt-valid', name: '  ' }, // 空白名称
        ],
      },
    },
    propertyOrder: [...validDb.propertyOrder, 'prop-sel-bad'],
  };
  assert.equal(validateDatabaseSchema(corruptDb2), false, '空ID、重复ID或空名称选项必须返回 false');

  const healedDb2 = normalizeDatabaseSchema(corruptDb2);
  assert.equal(validateDatabaseSchema(healedDb2), true, '自愈后坏选项必须被清洗并满足 Schema');
  const cleanOpts = healedDb2.properties['prop-sel-bad'].options;
  assert.equal(cleanOpts.length, 1, '去重与去空后仅保留 1 个合法选项');
  assert.equal(cleanOpts[0].id, 'dup');

  // 3. 反例验证：单元格包含悬空 option ID 或 multiSelect 重复项必须被拦截
  let db3 = createDatabase('悬空引用测试库');
  db3 = addProperty(db3, {
    id: 'prop-sel',
    name: '状态',
    type: 'select',
    options: [{ id: 'opt-1', name: '进行中' }],
  });
  db3 = addProperty(db3, {
    id: 'prop-multi',
    name: '标签',
    type: 'multiSelect',
    options: [
      { id: 'opt-tag1', name: '标签1' },
      { id: 'opt-tag2', name: '标签2' },
    ],
  });

  // 构造悬空单元格数据与重复标签
  const corruptDb3 = {
    ...db3,
    rows: {
      'row-bad': {
        id: 'row-bad',
        databaseId: db3.id,
        cells: {
          [titlePropId]: '坏数据行',
          'prop-sel': 'opt-ghost-dangling', // 悬空选项引用
          'prop-multi': ['opt-tag1', 'opt-tag1', 'opt-ghost'], // 重复与悬空
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    },
    rowOrder: ['row-bad'],
  };
  assert.equal(validateDatabaseSchema(corruptDb3), false, '包含悬空 option 引用的数据库必须校验失败');

  // 自愈：清理悬空 select 单元格，去重并过滤悬空 multiSelect 项
  const healedDb3 = normalizeDatabaseSchema(corruptDb3);
  assert.equal(validateDatabaseSchema(healedDb3), true, '自愈后单元格悬空引用必须被清洗');
  assert.equal(healedDb3.rows['row-bad'].cells['prop-sel'], undefined, '悬空单选单元格应被清除');
  assert.deepEqual(healedDb3.rows['row-bad'].cells['prop-multi'], ['opt-tag1'], '多选单元格应去重并剔除悬空项');

  // 4. 历史标签名称自愈：唯一命中迁移为 ID，歧义（同名）或未匹配清空
  let db4 = createDatabase('标签名迁移测试库');
  db4 = addProperty(db4, {
    id: 'prop-status',
    name: '进度',
    type: 'select',
    options: [
      { id: 'opt-done', name: '已完成' },
      { id: 'opt-ambig-1', name: '待审' },
      { id: 'opt-ambig-2', name: '待审' }, // 歧义同名项
    ],
  });
  const corruptDb4 = {
    ...db4,
    rows: {
      'row-1': {
        id: 'row-1',
        databaseId: db4.id,
        cells: { [titlePropId]: '行1', 'prop-status': '已完成' }, // 唯一命中
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      'row-2': {
        id: 'row-2',
        databaseId: db4.id,
        cells: { [titlePropId]: '行2', 'prop-status': '待审' }, // 歧义命中
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      'row-3': {
        id: 'row-3',
        databaseId: db4.id,
        cells: { [titlePropId]: '行3', 'prop-status': '无匹配状态' }, // 未匹配
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    },
    rowOrder: ['row-1', 'row-2', 'row-3'],
  };
  const healedDb4 = normalizeDatabaseSchema(corruptDb4);
  assert.equal(healedDb4.rows['row-1'].cells['prop-status'], 'opt-done', '唯一命中标签名应自愈迁移为稳定 ID');
  assert.equal(healedDb4.rows['row-2'].cells['prop-status'], undefined, '同名歧义标签应安全清空');
  assert.equal(healedDb4.rows['row-3'].cells['prop-status'], undefined, '未匹配标签应安全清空');

  // 5. getIncompatibleCellCount 破坏性类型切换预检查
  let db5 = createDatabase('预检查测试库');
  db5 = addProperty(db5, { id: 'col-text', name: '混合数据', type: 'text' });
  db5 = addRow(db5, { [titlePropId]: 'A', 'col-text': '123' });
  db5 = addRow(db5, { [titlePropId]: 'B', 'col-text': 'abc' });
  db5 = addRow(db5, { [titlePropId]: 'C', 'col-text': '' });

  // 切换为 number：行 B 无法转换将丢失数据 -> count === 1
  assert.equal(getIncompatibleCellCount(db5, 'col-text', 'number'), 1);

  // 切换为 select（无 options）：行 A、B 均无法匹配 -> count === 2
  assert.equal(getIncompatibleCellCount(db5, 'col-text', 'select'), 2);

  // 纯全数字列切换为 number：count === 0
  let db6 = createDatabase('安全转换库');
  db6 = addProperty(db6, { id: 'col-num-text', name: '纯数字文本', type: 'text' });
  db6 = addRow(db6, { [titlePropId]: 'A', 'col-num-text': '100' });
  db6 = addRow(db6, { [titlePropId]: 'B', 'col-num-text': '200' });
  assert.equal(getIncompatibleCellCount(db6, 'col-num-text', 'number'), 0);

  console.log('  ✔ 数据库 Schema 严格契约反例拦截、损坏数据自愈与类型切换预检查全部通过');
}

console.log('\n🎉 Day 10: 基础字段类型系统 (Property Types) 6 大模块全部验收通过！');
