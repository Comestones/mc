// Day 11 Acceptance Verification Script: 扩展字段类型与行详情弹窗 (Extended Property Types & Row as Page)
import assert from 'node:assert/strict';
import {
  createDatabase,
  validateDatabaseSchema,
  normalizeDatabaseSchema,
  validateCellValue,
  getIncompatibleCellCount,
  addProperty,
  addRow,
  updateRow,
  updateRowBlocks,
  updateCell,
  deleteRow,
  deleteProperty,
  changePropertyType,
  migrateCellForTypeChange,
  isValidDateString,
  isValidUrlString,
  normalizeUrlString,
  formatCreatedTime,
  DEFAULT_TITLE_PROPERTY_ID,
} from '../src/utils/databaseUtils.ts';
import { VALID_PROPERTY_TYPES } from '../src/types/database.ts';
import { createDefaultParagraph } from '../src/utils/blockUtils.ts';

console.log('🧪 开始 Day 11: 扩展字段类型与行详情弹窗 (Extended Property Types & Row as Page) 自动化验收核查...\n');

// =================================================================
// 测试 1: Date、URL 与 CreatedTime 契约与纯函数校验
// =================================================================
console.log('▶ 测试 1: 扩展字段类型契约 (Date, URL, CreatedTime) 与纯函数校验...');
{
  // 1. VALID_PROPERTY_TYPES 必须包含 8 类属性 + createdTime
  const expectedTypes = [
    'title',
    'text',
    'number',
    'select',
    'multiSelect',
    'checkbox',
    'date',
    'url',
    'createdTime',
  ];
  for (const t of expectedTypes) {
    assert.ok(VALID_PROPERTY_TYPES.includes(t), `VALID_PROPERTY_TYPES 必须包含 ${t}`);
  }

  // 2. isValidDateString 校验（本地 YYYY-MM-DD 字符串，防时区漂移与虚构日期）
  assert.equal(isValidDateString('2026-09-21'), true, '标准合法日期必须通过');
  assert.equal(isValidDateString('2024-02-29'), true, '闰年2月29日必须通过');
  assert.equal(isValidDateString('2023-02-29'), false, '平年2月29日必须拦截');
  assert.equal(isValidDateString('2026-02-30'), false, '虚构日期必须拦截');
  assert.equal(isValidDateString('2026-13-01'), false, '非法月份必须拦截');
  assert.equal(isValidDateString('2026/09/21'), false, '非破折号分隔符必须拦截');
  assert.equal(isValidDateString('2026-9-21'), false, '未补零格式必须拦截');
  assert.equal(isValidDateString('2026-09-21T00:00:00Z'), false, '携带时间或时区字符串必须拦截');
  assert.equal(isValidDateString(''), false, '空字符串必须拦截');
  assert.equal(isValidDateString(null), false, 'null 必须拦截');

  // 3. isValidUrlString 与 normalizeUrlString（安全协议限制与危险协议清洗）
  assert.equal(isValidUrlString('https://github.com/Comestones/mc'), true);
  assert.equal(isValidUrlString('http://localhost:3000/docs'), true);
  assert.equal(isValidUrlString('mailto:support@antigravity.google.com'), true);
  assert.equal(isValidUrlString('javascript:alert(1)'), false, '恶意 javascript 协议必须拦截');
  assert.equal(isValidUrlString('data:text/html,<script>alert(1)</script>'), false, 'data 协议必须拦截');
  assert.equal(isValidUrlString('vbscript:msgbox(1)'), false, 'vbscript 协议必须拦截');
  assert.equal(isValidUrlString('https://evil.com\x00payload'), false, '控制字符必须拦截');

  // normalizeUrlString 自动补全与清洗
  assert.equal(normalizeUrlString('github.com/Comestones/mc'), 'https://github.com/Comestones/mc');
  assert.equal(normalizeUrlString('https://example.com/page?id=1#anchor'), 'https://example.com/page?id=1#anchor');
  assert.equal(normalizeUrlString('javascript:void(0)'), null, '恶意协议规整必须返回 null');
  assert.equal(normalizeUrlString('data:text/plain;base64,AAA'), null, 'data 协议规整必须返回 null');
  assert.equal(normalizeUrlString('   '), null, '纯空格必须返回 null');
  assert.equal(normalizeUrlString(123), null, '非字符串必须返回 null');

  // 4. formatCreatedTime 稳定输出
  const ts = new Date(2026, 8, 21, 15, 30).getTime();
  const formatted = formatCreatedTime(ts);
  assert.ok(formatted.includes('2026-09-21'), '格式化时间必须包含 YYYY-MM-DD');
  assert.ok(formatted.includes('15:30'), '格式化时间必须包含 HH:mm');
  assert.equal(formatCreatedTime(0), '-', '非法或0时间戳返回 "-"');
  assert.equal(formatCreatedTime(NaN), '-', 'NaN 时间戳返回 "-"');

  console.log('  ✔ 扩展字段类型契约、日期校验、URL 清洗规范化与时间格式化校验通过');
}

// =================================================================
// 测试 2: CreatedTime 派生字段只读隔离与不变量防御
// =================================================================
console.log('▶ 测试 2: CreatedTime 只读元数据派生字段隔离与不变量守卫...');
{
  let db = createDatabase('只读时间测试库');
  db = addProperty(db, { name: '创建时间', type: 'createdTime' });
  const createdPropId = db.propertyOrder[1];

  // 1. validateCellValue 对 createdTime 的任何值必须返回 false（只读不可写）
  assert.equal(validateCellValue('2026-09-21', 'createdTime'), false);
  assert.equal(validateCellValue(Date.now(), 'createdTime'), false);

  // 2. addRow 尝试传入 createdTime cell，必须被静默过滤
  db = addRow(db, {
    [DEFAULT_TITLE_PROPERTY_ID]: '任务 1',
    [createdPropId]: '恶意伪造的时间戳',
  });
  const rowId = db.rowOrder[0];
  assert.equal(db.rows[rowId].cells[createdPropId], undefined, 'addRow 绝不可写入 createdTime 单元格');

  // 3. updateCell 尝试修改 createdTime，必须被守卫阻断
  const dbBeforeUpdate = db;
  db = updateCell(db, rowId, createdPropId, '新时间');
  assert.equal(db, dbBeforeUpdate, 'updateCell 针对 createdTime 必须返回原 db 引用');
  assert.equal(db.rows[rowId].cells[createdPropId], undefined);

  // 4. updateRow 尝试注入 createdTime cell，必须被严格清洗
  db = updateRow(db, rowId, {
    cells: {
      [DEFAULT_TITLE_PROPERTY_ID]: '任务 1 已更新',
      [createdPropId]: '非法注入',
    },
  });
  assert.equal(db.rows[rowId].cells[createdPropId], undefined);
  assert.equal(db.rows[rowId].cells[DEFAULT_TITLE_PROPERTY_ID], '任务 1 已更新');

  // 5. validateDatabaseSchema 拦截带有 createdTime cell 的损坏快照
  const corruptDb = {
    ...db,
    rows: {
      ...db.rows,
      [rowId]: {
        ...db.rows[rowId],
        cells: {
          ...db.rows[rowId].cells,
          [createdPropId]: '非法残存值',
        },
      },
    },
  };
  assert.equal(validateDatabaseSchema(corruptDb), false, '带有 createdTime cell 的数据库必须无法通过校验');

  // 6. normalizeDatabaseSchema 自动清洗并自愈剥除 createdTime cell
  const healedDb = normalizeDatabaseSchema(corruptDb);
  assert.equal(validateDatabaseSchema(healedDb), true, '自愈后数据库必须通过严格校验');
  assert.equal(healedDb.rows[rowId].cells[createdPropId], undefined, '自愈后 createdTime cell 必须被安全剥除');

  console.log('  ✔ CreatedTime 只读隔离、不可变派生与自愈写保护通过');
}

// =================================================================
// 测试 3: 跨类型单元格迁移矩阵覆盖 (Date / URL / CreatedTime)
// =================================================================
console.log('▶ 测试 3: 跨类型单元格迁移矩阵覆盖 (Date / URL / CreatedTime)...');
{
  // 1. text -> date
  assert.equal(migrateCellForTypeChange('2026-09-21', 'text', 'date'), '2026-09-21');
  assert.equal(migrateCellForTypeChange('not-a-date', 'text', 'date'), null);

  // 2. date -> text
  assert.equal(migrateCellForTypeChange('2026-09-21', 'date', 'text'), '2026-09-21');
  assert.equal(migrateCellForTypeChange(null, 'date', 'text'), null);

  // 3. text -> url
  assert.equal(migrateCellForTypeChange('https://google.com', 'text', 'url'), 'https://google.com/');
  assert.equal(migrateCellForTypeChange('google.com', 'text', 'url'), 'https://google.com/');
  assert.equal(migrateCellForTypeChange('javascript:alert(1)', 'text', 'url'), null);

  // 4. url -> text
  assert.equal(migrateCellForTypeChange('https://google.com', 'url', 'text'), 'https://google.com');

  // 5. 任意类型 -> createdTime 清空
  assert.equal(migrateCellForTypeChange('2026-09-21', 'date', 'createdTime'), null);
  assert.equal(migrateCellForTypeChange('https://google.com', 'url', 'createdTime'), null);
  assert.equal(migrateCellForTypeChange('任意文本', 'text', 'createdTime'), null);

  // 6. createdTime -> 任意类型 清空
  assert.equal(migrateCellForTypeChange('任意值', 'createdTime', 'text'), null);

  // 7. getIncompatibleCellCount 测试
  let db = createDatabase('类型兼容性测试库');
  db = addProperty(db, { name: '数据列', type: 'text' });
  const dataPropId = db.propertyOrder[1];
  db = addRow(db, { [DEFAULT_TITLE_PROPERTY_ID]: '行1', [dataPropId]: '2026-09-21' });
  db = addRow(db, { [DEFAULT_TITLE_PROPERTY_ID]: '行2', [dataPropId]: '非有效日期文本' });

  const incompCount = getIncompatibleCellCount(db, dataPropId, 'date');
  assert.equal(incompCount, 1, '只有行2的非有效日期文本无法转换为 date');

  // 执行切换
  db = changePropertyType(db, dataPropId, 'date');
  const row1Id = db.rowOrder[0];
  const row2Id = db.rowOrder[1];
  assert.equal(db.rows[row1Id].cells[dataPropId], '2026-09-21');
  assert.equal(db.rows[row2Id].cells[dataPropId], undefined);
  assert.equal(validateDatabaseSchema(db), true);

  console.log('  ✔ 跨类型单元格迁移矩阵与受影响行数预检查通过');
}

// =================================================================
// 测试 4: Row as Page 数据模型与正文 Block 契约与平滑自愈
// =================================================================
console.log('▶ 测试 4: Row as Page 数据模型、正文 Block 契约与平滑自愈...');
{
  let db = createDatabase('Row as Page 测试库');

  // 1. 新建行自动包含默认规范化段落块
  db = addRow(db, { [DEFAULT_TITLE_PROPERTY_ID]: '页面A' });
  const rowId = db.rowOrder[0];
  const row = db.rows[rowId];
  assert.ok(Array.isArray(row.blocks), '新行必须具备 blocks 数组');
  assert.equal(row.blocks.length, 1);
  assert.equal(row.blocks[0].type, 'paragraph');
  assert.equal(row.blocks[0].content, '');

  // 2. updateRowBlocks 不可变更新行正文块
  const customBlocks = [
    { id: 'b-p1', type: 'heading-1', content: '行内一级标题' },
    { id: 'b-p2', type: 'paragraph', content: '行内详细正文说明...' },
    { id: 'b-p3', type: 'code', content: 'console.log(42);', properties: { language: 'javascript' } },
  ];
  db = updateRowBlocks(db, rowId, customBlocks);
  const updatedRow = db.rows[rowId];
  assert.equal(updatedRow.blocks.length, 3);
  assert.equal(updatedRow.blocks[0].content, '行内一级标题');
  assert.equal(updatedRow.blocks[2].properties?.language, 'javascript');
  assert.equal(validateDatabaseSchema(db), true);

  // 3. 模拟旧快照无 blocks 字段，normalizeDatabaseSchema 平滑自愈
  const legacyDb = {
    ...db,
    rows: {
      ...db.rows,
      [rowId]: {
        ...db.rows[rowId],
        blocks: undefined,
      },
    },
  };
  const healedLegacy = normalizeDatabaseSchema(legacyDb);
  assert.equal(validateDatabaseSchema(healedLegacy), true);
  assert.ok(Array.isArray(healedLegacy.rows[rowId].blocks));
  assert.equal(healedLegacy.rows[rowId].blocks.length, 1);
  assert.equal(healedLegacy.rows[rowId].blocks[0].type, 'paragraph');

  // 4. 空 blocks 传入 updateRowBlocks 自动保底生成默认段落
  db = updateRowBlocks(db, rowId, []);
  assert.equal(db.rows[rowId].blocks.length, 1, '空块树必须保底默认段落');
  assert.equal(db.rows[rowId].blocks[0].type, 'paragraph');

  console.log('  ✔ Row as Page 数据模型、正文块契约与旧快照平滑自愈通过');
}

// =================================================================
// 测试 5: 行级联删除、整表删除与正文隔离性
// =================================================================
console.log('▶ 测试 5: 行级联删除、整表删除与正文块树隔离性...');
{
  let db = createDatabase('级联删除隔离测试库');
  db = addProperty(db, { name: '截止日期', type: 'date' });
  db = addProperty(db, { name: '参考链接', type: 'url' });
  const dateProp = db.propertyOrder[1];
  const urlProp = db.propertyOrder[2];

  db = addRow(db, {
    [DEFAULT_TITLE_PROPERTY_ID]: '待删行',
    [dateProp]: '2026-10-01',
    [urlProp]: 'https://antigravity.dev',
  });
  const rowId = db.rowOrder[0];
  db = updateRowBlocks(db, rowId, [
    { id: 'b-del1', type: 'paragraph', content: '行内私有数据' },
  ]);

  // 1. 删除属性列：单元格级联清理，但行正文 blocks 绝不受损
  db = deleteProperty(db, urlProp);
  assert.equal(db.rows[rowId].cells[urlProp], undefined);
  assert.equal(db.rows[rowId].cells[dateProp], '2026-10-01');
  assert.equal(db.rows[rowId].blocks[0].content, '行内私有数据');

  // 2. 删除行：行数据及内部 blocks 彻底清除
  db = deleteRow(db, rowId);
  assert.equal(db.rowOrder.includes(rowId), false);
  assert.equal(db.rows[rowId], undefined);
  assert.equal(Object.keys(db.rows).length, 0);
  assert.equal(validateDatabaseSchema(db), true);

  console.log('  ✔ 属性删除单元格级联、行级联删除与正文隔离性通过');
}

// =================================================================
// 测试 6: 200 行扩展字段与正文 Blocks 大数据量性能基准
// =================================================================
console.log('▶ 测试 6: 200 行包含扩展字段与正文 Blocks 的大数据量性能基准...');
{
  let db = createDatabase('200行性能基准库');
  db = addProperty(db, { name: '计划日期', type: 'date' });
  db = addProperty(db, { name: '文档链接', type: 'url' });
  db = addProperty(db, { name: '记录时间', type: 'createdTime' });
  const dateProp = db.propertyOrder[1];
  const urlProp = db.propertyOrder[2];

  const t0 = performance.now();
  for (let i = 0; i < 200; i++) {
    db = addRow(
      db,
      {
        [DEFAULT_TITLE_PROPERTY_ID]: `性能测试项目 #${i + 1}`,
        [dateProp]: '2026-09-21',
        [urlProp]: `https://workspace.dev/item/${i + 1}`,
      },
      undefined,
      [
        { id: `b-bm-${i}-1`, type: 'paragraph', content: `这是第 ${i + 1} 个页面的正文详细说明...` },
        { id: `b-bm-${i}-2`, type: 'todo', content: '跟进落地', properties: { checked: i % 2 === 0 } },
      ]
    );
  }
  const tInsert = performance.now() - t0;
  console.log(`  ⚡ 200 行（含扩展字段与 Blocks）插入耗时: ${tInsert.toFixed(2)}ms`);
  assert.ok(tInsert < 50, `200 行插入耗时应小于 50ms，实际 ${tInsert.toFixed(2)}ms`);

  // 批量更新 blocks
  const tUpdate0 = performance.now();
  const sampleRowId = db.rowOrder[50];
  db = updateRowBlocks(db, sampleRowId, [
    { id: 'b-updated', type: 'heading-2', content: '更新后的标题' },
  ]);
  const tUpdate = performance.now() - tUpdate0;
  console.log(`  ⚡ 单行 Blocks 更新耗时: ${tUpdate.toFixed(2)}ms`);
  assert.ok(tUpdate < 15, `单行更新耗时应小于 15ms，实际 ${tUpdate.toFixed(2)}ms`);

  // Schema 严格全量校验
  const tVal0 = performance.now();
  const isValid = validateDatabaseSchema(db);
  const tVal = performance.now() - tVal0;
  console.log(`  ⚡ 200 行全量 Schema 校验耗时: ${tVal.toFixed(2)}ms`);
  assert.equal(isValid, true, '200 行数据库全量 Schema 必须严格通过');
  assert.ok(tVal < 25, `200 行校验耗时应小于 25ms，实际 ${tVal.toFixed(2)}ms`);

  console.log('  ✔ 200 行扩展字段与正文 Blocks 大数据量基准耗时全部达标');
}

console.log('\n🎉 Day 11: 扩展字段类型与行详情弹窗 6 大模块全部验收通过！\n');
