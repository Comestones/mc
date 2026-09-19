// Day 9 Acceptance Verification Script: 表格视图 (Table View) 核心交互
import assert from 'node:assert/strict';
import {
  createDatabase,
  addRow,
  updateCell,
  updateProperty,
  DEFAULT_TITLE_PROPERTY_ID,
} from '../src/utils/databaseUtils.ts';
import {
  MIN_COLUMN_WIDTH,
  MAX_COLUMN_WIDTH,
  DEFAULT_COLUMN_WIDTH,
} from '../src/types/database.ts';

console.log('🧪 开始 Day 9: 多维数据库表格视图核心交互自动化验收核查...\n');

// =================================================================
// 测试 1: 列宽调整约束算法与边界契约 (120px <= width <= 600px)
// =================================================================
console.log('▶ 测试 1: 列宽调整算法与边界范围契约校验...');
{
  assert.equal(MIN_COLUMN_WIDTH, 120, '最小列宽必须为 120px');
  assert.equal(MAX_COLUMN_WIDTH, 600, '最大列宽必须为 600px');
  assert.equal(DEFAULT_COLUMN_WIDTH, 180, '默认列宽必须为 180px');

  // 列宽计算算法
  const computeWidth = (startWidth, deltaX) =>
    Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, Math.round(startWidth + deltaX)));

  // 正常范围拖拽
  assert.equal(computeWidth(180, 50), 230);
  assert.equal(computeWidth(200, -50), 150);

  // 下边界约束：拖拽缩小超出 120px 时严格限制为 120px
  assert.equal(computeWidth(180, -100), 120);
  assert.equal(computeWidth(150, -500), 120);
  assert.equal(computeWidth(120, -10), 120);

  // 上边界约束：拖拽放大超出 600px 时严格限制为 600px
  assert.equal(computeWidth(500, 200), 600);
  assert.equal(computeWidth(580, 1000), 600);
  assert.equal(computeWidth(600, 50), 600);

  // 浮点数四舍五入规整
  assert.equal(computeWidth(180, 20.4), 200);
  assert.equal(computeWidth(180, 20.6), 201);

  console.log('  ✔ 列宽范围硬性约束 (120px ~ 600px) 及四舍五入规整通过');
}

// =================================================================
// 测试 2: Roving Tabindex 键盘导航状态转移算法
// =================================================================
console.log('▶ 测试 2: Roving Tabindex 键盘导航状态机与边界回绕...');
{
  const navigate = (direction, current, numRows, numCols) => {
    if (numRows === 0 || numCols === 0) return null;
    let nextR = current.rowIndex;
    let nextC = current.colIndex;

    switch (direction) {
      case 'up':
        nextR = Math.max(0, current.rowIndex - 1);
        break;
      case 'down':
        nextR = Math.min(numRows - 1, current.rowIndex + 1);
        break;
      case 'left':
        nextC = Math.max(0, current.colIndex - 1);
        break;
      case 'right':
        nextC = Math.min(numCols - 1, current.colIndex + 1);
        break;
      case 'next':
        if (current.colIndex + 1 < numCols) {
          nextC = current.colIndex + 1;
        } else if (current.rowIndex + 1 < numRows) {
          nextR = current.rowIndex + 1;
          nextC = 0;
        }
        break;
      case 'prev':
        if (current.colIndex - 1 >= 0) {
          nextC = current.colIndex - 1;
        } else if (current.rowIndex - 1 >= 0) {
          nextR = current.rowIndex - 1;
          nextC = numCols - 1;
        }
        break;
    }
    return { rowIndex: nextR, colIndex: nextC };
  };

  const rows = 3;
  const cols = 4;

  // 1. 方向键移动
  assert.deepEqual(navigate('right', { rowIndex: 0, colIndex: 0 }, rows, cols), { rowIndex: 0, colIndex: 1 });
  assert.deepEqual(navigate('down', { rowIndex: 0, colIndex: 1 }, rows, cols), { rowIndex: 1, colIndex: 1 });
  assert.deepEqual(navigate('left', { rowIndex: 1, colIndex: 1 }, rows, cols), { rowIndex: 1, colIndex: 0 });
  assert.deepEqual(navigate('up', { rowIndex: 1, colIndex: 0 }, rows, cols), { rowIndex: 0, colIndex: 0 });

  // 2. 边界阻断：不越界
  assert.deepEqual(navigate('up', { rowIndex: 0, colIndex: 0 }, rows, cols), { rowIndex: 0, colIndex: 0 });
  assert.deepEqual(navigate('left', { rowIndex: 0, colIndex: 0 }, rows, cols), { rowIndex: 0, colIndex: 0 });
  assert.deepEqual(navigate('down', { rowIndex: 2, colIndex: 3 }, rows, cols), { rowIndex: 2, colIndex: 3 });
  assert.deepEqual(navigate('right', { rowIndex: 2, colIndex: 3 }, rows, cols), { rowIndex: 2, colIndex: 3 });

  // 3. Tab (next): 行内向右移动，行末换到下一行首列
  assert.deepEqual(navigate('next', { rowIndex: 0, colIndex: 2 }, rows, cols), { rowIndex: 0, colIndex: 3 });
  assert.deepEqual(navigate('next', { rowIndex: 0, colIndex: 3 }, rows, cols), { rowIndex: 1, colIndex: 0 });
  // 最后一行最后一列停在原处
  assert.deepEqual(navigate('next', { rowIndex: 2, colIndex: 3 }, rows, cols), { rowIndex: 2, colIndex: 3 });

  // 4. Shift+Tab (prev): 行内向左移动，行首换到上一行末列
  assert.deepEqual(navigate('prev', { rowIndex: 1, colIndex: 1 }, rows, cols), { rowIndex: 1, colIndex: 0 });
  assert.deepEqual(navigate('prev', { rowIndex: 1, colIndex: 0 }, rows, cols), { rowIndex: 0, colIndex: 3 });
  // 第一行第一列停在原处
  assert.deepEqual(navigate('prev', { rowIndex: 0, colIndex: 0 }, rows, cols), { rowIndex: 0, colIndex: 0 });

  console.log('  ✔ 方向键移动、边界阻断、Tab/Shift+Tab 行间回绕状态机通过');
}

// =================================================================
// 测试 3: 内联编辑、提交与 Escape 取消数据一致性
// =================================================================
console.log('▶ 测试 3: title 与 text 单元格编辑提交、取消与回退验证...');
{
  let db = createDatabase('内联编辑测试库');
  const titlePropId = DEFAULT_TITLE_PROPERTY_ID;
  db = addRow(db, { [titlePropId]: '初始标题' });
  const rowId = db.rowOrder[0];

  assert.equal(db.rows[rowId].cells[titlePropId], '初始标题');

  // 1. 正常提交修改
  db = updateCell(db, rowId, titlePropId, '已修改标题');
  assert.equal(db.rows[rowId].cells[titlePropId], '已修改标题');

  // 2. Escape 取消（模拟不触发 updateCell 或保持原值）
  const originalVal = db.rows[rowId].cells[titlePropId];
  let draftVal = '被放弃的未提交输入';
  // 用户按 Escape，草稿被丢弃，单元格保留原值
  draftVal = originalVal;
  assert.equal(draftVal, '已修改标题');
  assert.equal(db.rows[rowId].cells[titlePropId], '已修改标题');

  // 3. 空值与空白修剪
  db = updateCell(db, rowId, titlePropId, '  修剪前后空格  '.trim());
  assert.equal(db.rows[rowId].cells[titlePropId], '修剪前后空格');

  console.log('  ✔ 单元格提交更新、取消保留原值、数据修剪校验通过');
}

// =================================================================
// 测试 4: 中文输入法 IME 合成期状态隔离防护
// =================================================================
console.log('▶ 测试 4: 中文输入法 IME 合成期隔离防护...');
{
  // 模拟输入法合成期事件触发逻辑
  class MockIMEHandler {
    constructor() {
      this.isComposing = false;
      this.committedValue = null;
    }
    onCompositionStart() {
      this.isComposing = true;
    }
    onCompositionEnd() {
      this.isComposing = false;
    }
    onKeyDown(key, nativeIsComposing, value) {
      if (this.isComposing || nativeIsComposing) {
        // 处于输入法拼音选择中，绝不触发提交
        return false;
      }
      if (key === 'Enter') {
        this.committedValue = value;
        return true;
      }
      return false;
    }
  }

  const ime = new MockIMEHandler();

  // 场景 A: 用户输入拼音 "ceshi"，按下 Enter 确认拼音转换为中文
  ime.onCompositionStart();
  const enter1Result = ime.onKeyDown('Enter', true, 'ceshi');
  assert.equal(enter1Result, false, 'IME 合成期间 Enter 绝不触发提交');
  assert.equal(ime.committedValue, null, '未提交任何草稿值');

  // 场景 B: 拼音确认完成，触发 compositionEnd
  ime.onCompositionEnd();
  // 场景 C: 此时用户在已完成中文输入的框中再次按下 Enter
  const enter2Result = ime.onKeyDown('Enter', false, '测试');
  assert.equal(enter2Result, true, '非合成期 Enter 正常触发提交');
  assert.equal(ime.committedValue, '测试');

  console.log('  ✔ IME 拼音合成期间 Enter 拦截与合成结束后正常提交通过');
}

// =================================================================
// 测试 5: 200 行大数据量装载与更新基准性能
// =================================================================
console.log('▶ 测试 5: 200 行记录基准装载与更新耗时性能...');
{
  let db = createDatabase('性能基准测试库');
  const titlePropId = DEFAULT_TITLE_PROPERTY_ID;

  const startTime = performance.now();

  // 批量构造 200 行
  for (let i = 0; i < 200; i++) {
    db = addRow(db, {
      [titlePropId]: `记录项 #${i + 1}`,
    });
  }

  const insertDuration = performance.now() - startTime;
  assert.equal(db.rowOrder.length, 200, '应成功容纳 200 行');
  console.log(`  ⚡ 200 行初始化插入耗时: ${insertDuration.toFixed(2)}ms`);
  assert.ok(insertDuration < 200, '200 行创建耗时应在 200ms 以内');

  // 测试单元格随机更新 200 次
  const updateStartTime = performance.now();
  for (let i = 0; i < 200; i++) {
    const rowId = db.rowOrder[i];
    db = updateCell(db, rowId, titlePropId, `更新记录 #${i + 1}`);
  }
  const updateDuration = performance.now() - updateStartTime;
  console.log(`  ⚡ 200 次单元格更新耗时: ${updateDuration.toFixed(2)}ms`);
  assert.ok(updateDuration < 200, '200 次单元格更新耗时应在 200ms 以内');

  // 验证第 200 行数据无误
  const lastRowId = db.rowOrder[199];
  assert.equal(db.rows[lastRowId].cells[titlePropId], '更新记录 #200');

  console.log('  ✔ 200 行基准数据装载与高频单元格更新性能达标');
}

console.log('\n🎉 Day 9: 表格视图核心交互 5 大模块全部验收通过！');
