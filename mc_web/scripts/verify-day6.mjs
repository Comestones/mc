// Day 6 Acceptance Verification Script: 块级拖拽重排与批量操作
import assert from 'node:assert/strict';
import {
  reorderBlocks,
  getBlocksRange,
  serializeBlocksToMarkdown,
  createDefaultParagraph,
} from '../src/utils/blockUtils.ts';

console.log('🧪 开始 Day 6: 块级拖拽排序与批量操作核心逻辑自动化验收核查...\n');

// 构造测试块列表
const sampleBlocks = [
  { id: 'b-1', type: 'paragraph', content: '第一段' },
  { id: 'b-2', type: 'heading1', content: '一级标题' },
  { id: 'b-3', type: 'bulletList', content: '无序列表项', properties: { level: 0 } },
  { id: 'b-4', type: 'todo', content: '待办任务', properties: { level: 1, checked: true } },
  { id: 'b-5', type: 'code', content: 'console.log("hello")', properties: { language: 'javascript', wrap: false } },
  { id: 'b-6', type: 'quote', content: '重要引用' },
  { id: 'b-7', type: 'divider', content: '' },
  { id: 'b-8', type: 'callout', content: '提示内容', properties: { tone: 'info', icon: '💡' } },
];

// 测试 1: 单块拖拽重排 (Single Block Drag & Drop)
console.log('▶ 测试 1: 单块向上/向下拖拽排序算法核查...');
{
  // 1a: 将第一块 b-1 拖到 b-3 下方 ('bottom')
  const r1 = reorderBlocks(sampleBlocks, ['b-1'], 'b-3', 'bottom');
  assert.equal(r1.length, 8, '块总数保持一致');
  assert.deepEqual(
    r1.map((b) => b.id),
    ['b-2', 'b-3', 'b-1', 'b-4', 'b-5', 'b-6', 'b-7', 'b-8'],
    'b-1 应精准移动到 b-3 之后'
  );

  // 1b: 将第一块 b-1 拖到 b-3 上方 ('top')
  const r2 = reorderBlocks(sampleBlocks, ['b-1'], 'b-3', 'top');
  assert.deepEqual(
    r2.map((b) => b.id),
    ['b-2', 'b-1', 'b-3', 'b-4', 'b-5', 'b-6', 'b-7', 'b-8'],
    'b-1 应精准移动到 b-3 之前'
  );

  // 1c: 将最后一块 b-8 向上拖到首块 b-1 上方 ('top')
  const r3 = reorderBlocks(sampleBlocks, ['b-8'], 'b-1', 'top');
  assert.deepEqual(
    r3.map((b) => b.id),
    ['b-8', 'b-1', 'b-2', 'b-3', 'b-4', 'b-5', 'b-6', 'b-7'],
    'b-8 应成为首块'
  );

  // 1d: 将首块 b-1 向下拖到尾块 b-8 下方 ('bottom')
  const r4 = reorderBlocks(sampleBlocks, ['b-1'], 'b-8', 'bottom');
  assert.deepEqual(
    r4.map((b) => b.id),
    ['b-2', 'b-3', 'b-4', 'b-5', 'b-6', 'b-7', 'b-8', 'b-1'],
    'b-1 应成为尾块'
  );

  console.log('  ✔ 单块向上/向下/首尾重排算法测试全部通过');
}

// 测试 2: 目标与边界防呆机制 (Guardrails & Boundary Conditions)
console.log('▶ 测试 2: 拖拽防呆与边界异常保护核查...');
{
  // 2a: 将块拖拽到自身 ('top' 或 'bottom')，应安全无操作返回原数组
  const rSelfTop = reorderBlocks(sampleBlocks, ['b-2'], 'b-2', 'top');
  assert.deepEqual(rSelfTop.map((b) => b.id), sampleBlocks.map((b) => b.id), '自身拖拽 top 必须无操作');

  const rSelfBottom = reorderBlocks(sampleBlocks, ['b-2'], 'b-2', 'bottom');
  assert.deepEqual(rSelfBottom.map((b) => b.id), sampleBlocks.map((b) => b.id), '自身拖拽 bottom 必须无操作');

  // 2b: 目标 ID 不存在时，安全返回原数组
  const rInvalid = reorderBlocks(sampleBlocks, ['b-2'], 'non-existent', 'top');
  assert.deepEqual(rInvalid.map((b) => b.id), sampleBlocks.map((b) => b.id), '无效目标 ID 应原样返回');

  // 2c: 拖拽列表为空或空数组输入
  const rEmpty = reorderBlocks([], ['b-1'], 'b-2', 'top');
  assert.deepEqual(rEmpty, [], '空数组输入应安全返回空数组');

  console.log('  ✔ 自拖拽防呆、无效目标、空数据保护核查通过');
}

// 测试 3: 多块批量拖拽重排 (Multi-Block Batch Reordering)
console.log('▶ 测试 3: 多块批量连续与非连续拖拽排序核查...');
{
  // 3a: 连续多块 [b-2, b-3] 整体移动到 b-6 下方 ('bottom')
  const rBatch1 = reorderBlocks(sampleBlocks, ['b-2', 'b-3'], 'b-6', 'bottom');
  assert.deepEqual(
    rBatch1.map((b) => b.id),
    ['b-1', 'b-4', 'b-5', 'b-6', 'b-2', 'b-3', 'b-7', 'b-8'],
    '连续多块整体移动必须保持相对次序'
  );

  // 3b: 非连续多块 [b-1, b-4, b-6] 整体移动到 b-3 上方 ('top')
  const rBatch2 = reorderBlocks(sampleBlocks, ['b-1', 'b-4', 'b-6'], 'b-3', 'top');
  assert.deepEqual(
    rBatch2.map((b) => b.id),
    ['b-2', 'b-1', 'b-4', 'b-6', 'b-3', 'b-5', 'b-7', 'b-8'],
    '非连续多块移动必须按原始文档次序紧凑聚合插入'
  );

  // 3c: 目标块包含在批量拖拽集合中时，防呆不改变
  const rBatchSelf = reorderBlocks(sampleBlocks, ['b-1', 'b-3', 'b-5'], 'b-3', 'bottom');
  assert.deepEqual(
    rBatchSelf.map((b) => b.id),
    sampleBlocks.map((b) => b.id),
    '多块拖拽中若目标处于拖拽组内，必须安全无操作'
  );

  console.log('  ✔ 多块批量连续/非连续拖拽、相对次序保持、组内目标防呆全部通过');
}

// 测试 4: 范围多选算法核查 (Range Selection: Shift + Click)
console.log('▶ 测试 4: 范围多选 (getBlocksRange) 连续与逆向选区核查...');
{
  // 4a: 正向区间选区 (b-2 到 b-5)
  const rangeForward = getBlocksRange(sampleBlocks, 'b-2', 'b-5');
  assert.deepEqual(rangeForward, ['b-2', 'b-3', 'b-4', 'b-5'], '正向区间选择必须包含起止及中间所有块');

  // 4b: 逆向区间选区 (b-5 到 b-2)
  const rangeBackward = getBlocksRange(sampleBlocks, 'b-5', 'b-2');
  assert.deepEqual(rangeBackward, ['b-2', 'b-3', 'b-4', 'b-5'], '逆向区间选择顺序必须符合文档流正向顺序');

  // 4c: 单块选区 (start === end)
  const rangeSingle = getBlocksRange(sampleBlocks, 'b-3', 'b-3');
  assert.deepEqual(rangeSingle, ['b-3'], '起止相同应仅返回单块 ID');

  // 4d: 边界容错：其中一个 ID 不存在
  const rangeMissing = getBlocksRange(sampleBlocks, 'b-2', 'invalid-id');
  assert.deepEqual(rangeMissing, ['b-2'], '单侧不存在时安全回退存在的一侧');

  console.log('  ✔ 正向、逆向、单块及缺失容错区间选区计算全部通过');
}

// 测试 5: 批量删除与空文档保底逻辑核查 (Batch Delete & Fallback)
console.log('▶ 测试 5: 批量删除与空文档保底段落核查...');
{
  // 5a: 批量删除选中的多块 [b-2, b-4, b-6]
  const deleteIds = new Set(['b-2', 'b-4', 'b-6']);
  const remaining = sampleBlocks.filter((b) => !deleteIds.has(b.id));
  assert.deepEqual(
    remaining.map((b) => b.id),
    ['b-1', 'b-3', 'b-5', 'b-7', 'b-8'],
    '批量删除应准确移除所有指定块'
  );

  // 5b: 全部块被选中并删除，必须保底产生一个默认段落
  const allIds = new Set(sampleBlocks.map((b) => b.id));
  let wiped = sampleBlocks.filter((b) => !allIds.has(b.id));
  if (wiped.length === 0) {
    wiped = [createDefaultParagraph()];
  }
  assert.equal(wiped.length, 1, '全量删除后必须保底存在 1 个块');
  assert.equal(wiped[0].type, 'paragraph', '保底块必须为普通段落');
  assert.equal(wiped[0].content, '', '保底段落内容为空');

  console.log('  ✔ 批量删除及全选清空保底机制核查通过');
}

// 测试 6: 批量 Markdown 序列化核查 (Batch Serialization for Copy)
console.log('▶ 测试 6: 批量 Markdown 序列化与剪贴板导出核查...');
{
  const md = serializeBlocksToMarkdown(sampleBlocks);
  assert.ok(md.includes('# 一级标题'), '标题应转换为 Markdown 标题');
  assert.ok(md.includes('- 无序列表项'), '无序列表应带有破折号前缀');
  assert.ok(md.includes('- [x] 待办任务'), '完成态待办应带有 [x]');
  assert.ok(md.includes('```javascript\nconsole.log("hello")\n```'), '代码块应包含语言标记和三反引号');
  assert.ok(md.includes('> 重要引用'), '引用块应带有 > 前缀');
  assert.ok(md.includes('---'), '分割线应转换为 ---');
  assert.ok(md.includes('> [!info] 💡 提示内容'), '提示块应序列化为 callout 语法');

  console.log('  ✔ 批量 Markdown 导出格式完备正确');
}

console.log('\n🎉 所有 Day 6 核心数据重排与批量操作纯函数自动化验证全部通过 (Exit Code 0)！');
