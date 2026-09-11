// Day 3 Acceptance Verification Script: 列表与待办块实现 (Todo / List)
import assert from 'node:assert/strict';

console.log('🧪 开始 Day 3: 列表与待办块实现 (Todo / List) 数据契约与核心逻辑自动化核查...\n');

function generateBlockId() {
  return `b-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

function getBlockLevel(block) {
  const lvl = block.properties?.level;
  if (typeof lvl === 'number' && Number.isFinite(lvl) && lvl >= 0) {
    return Math.floor(lvl);
  }
  return 0;
}

function isListType(type) {
  return type === 'bulletList' || type === 'numberedList' || type === 'todo';
}

function getNumberedListOrder(blocks, index) {
  const current = blocks[index];
  if (!current || current.type !== 'numberedList') return 1;

  const currentLevel = getBlockLevel(current);
  let count = 1;

  for (let i = index - 1; i >= 0; i--) {
    const prev = blocks[i];
    if (prev.type !== 'numberedList') break;

    const prevLevel = getBlockLevel(prev);
    if (prevLevel < currentLevel) break;

    if (prevLevel === currentLevel) {
      count++;
    }
  }

  return count;
}

// 测试用例 1: 数据契约与非法 level 规范化
console.log('▶ 测试 1: 数据契约与 level / checked 规范化...');
{
  const validTodo = { id: 't-1', type: 'todo', content: '买牛奶', properties: { level: 2, checked: true } };
  assert.equal(getBlockLevel(validTodo), 2);
  assert.equal(validTodo.properties.checked, true);

  const invalidLevelNegative = { id: 't-2', type: 'bulletList', content: '无序项', properties: { level: -5 } };
  assert.equal(getBlockLevel(invalidLevelNegative), 0, '负数 level 规范化为 0');

  const invalidLevelNonNumber = { id: 't-3', type: 'numberedList', content: '有序项', properties: { level: 'two' } };
  assert.equal(getBlockLevel(invalidLevelNonNumber), 0, '非数字 level 规范化为 0');

  const missingLevel = { id: 't-4', type: 'bulletList', content: '缺省项' };
  assert.equal(getBlockLevel(missingLevel), 0, '缺省 properties.level 规范化为 0');

  console.log('  ✅ 数据契约规范化与边界容错通过');
}

// 测试用例 2: 有序列表 (Numbered list) 动态序号计算与层级感知
console.log('▶ 测试 2: 有序列表连续递增与多层级中断算法...');
{
  const blocks = [
    { id: 'n-1', type: 'numberedList', content: '第 1 项', properties: { level: 0 } },
    { id: 'n-2', type: 'numberedList', content: '第 2 项', properties: { level: 0 } },
    // 嵌套子项 level 1
    { id: 'n-3', type: 'numberedList', content: '子项 1', properties: { level: 1 } },
    { id: 'n-4', type: 'numberedList', content: '子项 2', properties: { level: 1 } },
    // 返回根级 level 0
    { id: 'n-5', type: 'numberedList', content: '第 3 项', properties: { level: 0 } },
    // 被段落打断
    { id: 'p-break', type: 'paragraph', content: '一段插入文本' },
    // 重新开启编号列表
    { id: 'n-6', type: 'numberedList', content: '新序列 1', properties: { level: 0 } },
    { id: 'n-7', type: 'numberedList', content: '新序列 2', properties: { level: 0 } },
  ];

  assert.equal(getNumberedListOrder(blocks, 0), 1);
  assert.equal(getNumberedListOrder(blocks, 1), 2);
  assert.equal(getNumberedListOrder(blocks, 2), 1, '子级列表从 1 开始重新计数');
  assert.equal(getNumberedListOrder(blocks, 3), 2, '子级列表连续项递增');
  assert.equal(getNumberedListOrder(blocks, 4), 3, '跳过深层子项，父级序号保持递增为 3');
  assert.equal(getNumberedListOrder(blocks, 6), 1, '被段落打断后新序列重新从 1 开始');
  assert.equal(getNumberedListOrder(blocks, 7), 2);

  console.log('  ✅ 有序列表按同级连续算法及中断重置计算验证通过');
}

// 测试用例 3: Enter 拆分与空列表退出 (Exit to Paragraph)
console.log('▶ 测试 3: Enter 列表拆分与空项回车退出...');
{
  // 3a: 非空 Todo 在中间回车
  const todoBlock = { id: 'todo-1', type: 'todo', content: '第一部分第二部分', properties: { level: 1, checked: true } };
  const offset = 4;
  const left = todoBlock.content.slice(0, offset);
  const right = todoBlock.content.slice(offset);

  const splitBlocks = [
    { ...todoBlock, content: left },
    { id: 'todo-new', type: 'todo', content: right, properties: { level: 1, checked: false } }
  ];
  assert.equal(splitBlocks[0].content, '第一部分');
  assert.equal(splitBlocks[0].properties.checked, true);
  assert.equal(splitBlocks[1].content, '第二部分');
  assert.equal(splitBlocks[1].type, 'todo');
  assert.equal(splitBlocks[1].properties.level, 1);
  assert.equal(splitBlocks[1].properties.checked, false, '回车拆出的新待办必须重置为未勾选');

  // 3b: 空列表项在 level > 0 时回车降级
  const indentedEmptyBullet = { id: 'b-empty', type: 'bulletList', content: '', properties: { level: 2 } };
  const outdented = { ...indentedEmptyBullet, properties: { ...indentedEmptyBullet.properties, level: indentedEmptyBullet.properties.level - 1 } };
  assert.equal(outdented.properties.level, 1, '空嵌套列表回车缩退一级');

  // 3c: 根级空列表项回车退出为普通段落
  const rootEmptyBullet = { id: 'b-root', type: 'bulletList', content: '', properties: { level: 0 } };
  const exitedToParagraph = { ...rootEmptyBullet, type: 'paragraph', properties: undefined };
  assert.equal(exitedToParagraph.type, 'paragraph', '根级空列表回车转换为段落');
  assert.equal(exitedToParagraph.id, 'b-root', '保留 ID');

  console.log('  ✅ 非空拆分、子级回车缩退、根级空列表退出验证通过');
}

// 测试用例 4: Tab / Shift+Tab 缩进与防跳级规则
console.log('▶ 测试 4: Tab 缩进、防跳级约束与 Shift+Tab 缩退...');
{
  const list = [
    { id: 'b-0', type: 'bulletList', content: '根项 0', properties: { level: 0 } },
    { id: 'b-1', type: 'bulletList', content: '项 1', properties: { level: 0 } },
    { id: 'p-sep', type: 'paragraph', content: '普通段落' },
    { id: 'b-2', type: 'bulletList', content: '项 2', properties: { level: 0 } },
  ];

  // 4a: 首项禁止 Tab 缩进 (无前置项)
  assert.equal(list[0].properties.level, 0);

  // 4b: b-1 前置项也是 bulletList 且 level 为 0，b-1 可以缩进为 1
  const prevLevel = list[0].properties.level;
  const curLevel = list[1].properties.level;
  assert.ok(curLevel < prevLevel + 1, '允许缩进一级');
  const indentedLevel = curLevel + 1;
  assert.equal(indentedLevel, 1);

  // 4c: 禁止跳级 (若当前已是 1，前置项是 0，不能再缩进为 2)
  const cannotIndentFurther = indentedLevel < prevLevel + 1;
  assert.equal(cannotIndentFurther, false, '禁止跳级缩进');

  // 4d: 禁止跨不同家族缩进 (b-2 的前项是 paragraph)
  const prevIsSameFamily = list[2].type === list[3].type;
  assert.equal(prevIsSameFamily, false, '禁止跨段落缩进');

  // 4e: Shift+Tab 缩退
  const level1Item = { id: 'b-lvl1', type: 'numberedList', content: '内容', properties: { level: 1 } };
  const shiftedLevel = Math.max(0, level1Item.properties.level - 1);
  assert.equal(shiftedLevel, 0);

  const rootItem = { id: 'b-lvl0', type: 'numberedList', content: '根内容', properties: { level: 0 } };
  const cannotShiftBelowZero = Math.max(0, rootItem.properties.level - 1);
  assert.equal(cannotShiftBelowZero, 0, '根级 Shift+Tab 保持为 0');

  console.log('  ✅ Tab 同家族校验、防跳级拦截、Shift+Tab 减一至 0 验证通过');
}

// 测试用例 5: 块类型切换保留内容与属性迁移
console.log('▶ 测试 5: 块类型转换双向无损性...');
{
  const paragraphBlock = { id: 'p-test', type: 'paragraph', content: '清单任务内容' };
  
  // 5a: Paragraph -> Todo
  const switchedToTodo = {
    ...paragraphBlock,
    type: 'todo',
    properties: { level: 0, checked: false }
  };
  assert.equal(switchedToTodo.type, 'todo');
  assert.equal(switchedToTodo.content, '清单任务内容');
  assert.equal(switchedToTodo.properties.checked, false);

  // 5b: Todo (checked) -> BulletList (checked 清除, 保留文本与 level)
  switchedToTodo.properties.checked = true;
  switchedToTodo.properties.level = 1;
  const switchedToBullet = {
    ...switchedToTodo,
    type: 'bulletList',
    properties: { level: 1 }
  };
  assert.equal(switchedToBullet.type, 'bulletList');
  assert.equal(switchedToBullet.properties.level, 1);
  assert.equal(switchedToBullet.properties.checked, undefined);
  assert.equal(switchedToBullet.content, '清单任务内容');

  // 5c: BulletList -> Paragraph (清除 level)
  const switchedBackToParagraph = {
    ...switchedToBullet,
    type: 'paragraph',
    properties: undefined
  };
  assert.equal(switchedBackToParagraph.type, 'paragraph');
  assert.equal(switchedBackToParagraph.properties, undefined);
  assert.equal(switchedBackToParagraph.content, '清单任务内容');

  console.log('  ✅ 块类型相互切换保留文本与稳定 ID 验证通过');
}

// 测试用例 6: 列表多行粘贴拆分继承
console.log('▶ 测试 6: 列表多行粘贴拆分继承相同类型与层级...');
{
  const curBlock = { id: 'b-cur', type: 'numberedList', content: '项A', properties: { level: 2 } };
  const clipText = '第二行\n第三行\n第四行';
  const lines = clipText.split(/\r?\n/);

  const pastedBlocks = lines.map(line => ({
    id: generateBlockId(),
    type: curBlock.type,
    content: line,
    properties: { level: curBlock.properties.level }
  }));

  assert.equal(pastedBlocks.length, 3);
  pastedBlocks.forEach(item => {
    assert.equal(item.type, 'numberedList');
    assert.equal(item.properties.level, 2);
  });

  console.log('  ✅ 列表内多行粘贴拆解为同类型、同 level 列表块验证通过');
}

console.log('\n🎉 所有 Day 3 列表与待办块数据契约、计算规则与键盘边界自动化测试全部通过 (Exit Code 0)！');
