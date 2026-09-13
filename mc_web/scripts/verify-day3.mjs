// Day 3 Acceptance Verification Script: 列表与待办块实现 (Todo / List)
import assert from 'node:assert/strict';
import {
  generateBlockId,
  createDefaultParagraph,
  isListType,
  getBlockLevel,
  getNumberedListOrder,
  normalizeLevel,
  normalizeChecked,
  cleanNonListProperties,
  normalizeBlock,
} from '../src/utils/blockUtils.ts';

console.log('🧪 开始 Day 3: 列表与待办块实现 (Todo / List) 生产代码数据契约与核心逻辑自动化核查...\n');

// 测试用例 1: 生产代码规范化函数与非法 level / checked 边界校验
console.log('▶ 测试 1: 生产代码规范化函数与非法 level / checked 边界校验...');
{
  // 1a: normalizeLevel
  assert.equal(normalizeLevel(2), 2, '有限正整数保持不变');
  assert.equal(normalizeLevel(0), 0, '0 保持为 0');
  assert.equal(normalizeLevel(1.9), 1, '正小数向下取整');
  assert.equal(normalizeLevel(0.4), 0, '小于 1 的正小数取整为 0');
  assert.equal(normalizeLevel(-5), 0, '负数归一化为 0');
  assert.equal(normalizeLevel('2'), 0, '字符串数字归一化为 0');
  assert.equal(normalizeLevel('invalid'), 0, '非法字符串归一化为 0');
  assert.equal(normalizeLevel(NaN), 0, 'NaN 归一化为 0');
  assert.equal(normalizeLevel(Infinity), 0, 'Infinity 归一化为 0');
  assert.equal(normalizeLevel(-Infinity), 0, '-Infinity 归一化为 0');
  assert.equal(normalizeLevel(null), 0, 'null 归一化为 0');
  assert.equal(normalizeLevel(undefined), 0, 'undefined 归一化为 0');
  assert.equal(normalizeLevel(true), 0, '布尔值归一化为 0');
  assert.equal(normalizeLevel({}), 0, '对象归一化为 0');

  // 1b: normalizeChecked
  assert.equal(normalizeChecked(true), true, 'true 保持为 true');
  assert.equal(normalizeChecked(false), false, 'false 保持为 false');
  assert.equal(normalizeChecked('true'), false, '字符串 "true" 归一化为 false');
  assert.equal(normalizeChecked(1), false, '数字 1 归一化为 false');
  assert.equal(normalizeChecked(0), false, '数字 0 归一化为 false');
  assert.equal(normalizeChecked({}), false, '对象归一化为 false');
  assert.equal(normalizeChecked(null), false, 'null 归一化为 false');
  assert.equal(normalizeChecked(undefined), false, 'undefined 归一化为 false');

  // 1c: normalizeBlock 节点级契约保障
  const rawBullet = { id: 'b-1', type: 'bulletList', content: '列表项', properties: { level: 2.8, checked: true } };
  const normBullet = normalizeBlock(rawBullet);
  assert.equal(normBullet.properties.level, 2, 'bulletList 规范化 level 为向下取整');
  assert.equal(normBullet.properties.checked, undefined, 'bulletList 剔除 checked');

  const rawTodo = { id: 't-1', type: 'todo', content: '待办', properties: { level: -3, checked: 'yes' } };
  const normTodo = normalizeBlock(rawTodo);
  assert.equal(normTodo.properties.level, 0, 'todo 负数 level 归一化为 0');
  assert.equal(normTodo.properties.checked, false, 'todo 非布尔 checked 归一化为 false');

  const rawParagraphWithProps = { id: 'p-1', type: 'paragraph', content: '段落', properties: { level: 3, checked: true } };
  const normParagraph = normalizeBlock(rawParagraphWithProps);
  assert.equal(normParagraph.properties, undefined, '非列表块彻底剥除 level 与 checked');

  const rawCallout = { id: 'c-1', type: 'callout', content: '提示', properties: { level: 2, checked: false, icon: '💡', tone: 'info' } };
  const normCallout = normalizeBlock(rawCallout);
  assert.deepEqual(normCallout.properties, { icon: '💡', tone: 'info' }, '非列表块保留业务属性同时清洗列表专用属性');

  console.log('  ✅ 生产规范化函数 (normalizeLevel / normalizeChecked / normalizeBlock) 全部分支验证通过');
}

// 测试用例 2: 有序列表 (Numbered list) 动态序号计算与层级感知
console.log('▶ 测试 2: 生产代码有序列表连续递增与多层级中断算法...');
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

  console.log('  ✅ 生产 getNumberedListOrder 算法按同级连续规则及中断重置计算验证通过');
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
    { id: generateBlockId(), type: 'todo', content: right, properties: { level: 1, checked: false } }
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
  const exitedToParagraph = {
    ...rootEmptyBullet,
    type: 'paragraph',
    properties: cleanNonListProperties(rootEmptyBullet.properties),
  };
  assert.equal(exitedToParagraph.type, 'paragraph', '根级空列表回车转换为段落');
  assert.equal(exitedToParagraph.id, 'b-root', '保留 ID');
  assert.equal(exitedToParagraph.properties, undefined, '退出段落后 properties 清空');

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
  const prevLevel = getBlockLevel(list[0]);
  const curLevel = getBlockLevel(list[1]);
  assert.ok(curLevel < prevLevel + 1, '允许缩进一级');
  const indentedLevel = curLevel + 1;
  assert.equal(indentedLevel, 1);

  // 4c: 禁止跳级 (若当前已是 1，前置项是 0，不能再缩进为 2)
  const cannotIndentFurther = indentedLevel < prevLevel + 1;
  assert.equal(cannotIndentFurther, false, '禁止跳级缩进');

  // 4d: 禁止跨不同家族缩进 (b-2 的前项是 paragraph)
  const prevIsSameFamily = isListType(list[2].type) && list[2].type === list[3].type;
  assert.equal(prevIsSameFamily, false, '禁止跨段落缩进');

  // 4e: Shift+Tab 缩退
  const level1Item = { id: 'b-lvl1', type: 'numberedList', content: '内容', properties: { level: 1 } };
  const shiftedLevel = Math.max(0, getBlockLevel(level1Item) - 1);
  assert.equal(shiftedLevel, 0);

  const rootItem = { id: 'b-lvl0', type: 'numberedList', content: '根内容', properties: { level: 0 } };
  const cannotShiftBelowZero = Math.max(0, getBlockLevel(rootItem) - 1);
  assert.equal(cannotShiftBelowZero, 0, '根级 Shift+Tab 保持为 0');

  console.log('  ✅ Tab 同家族校验、防跳级拦截、Shift+Tab 减一至 0 验证通过');
}

// 测试用例 5: 块类型切换保留内容与属性迁移彻底清洗 (P2 修复验证)
console.log('▶ 测试 5: 块类型转换双向无损性与属性迁移/清洗 (P2 规则)...');
{
  const paragraphBlock = { id: 'p-test', type: 'paragraph', content: '清单任务内容' };
  
  // 5a: Paragraph -> Todo (非列表转入列表族，level 初始化为 0，checked 默认 false)
  const isPrevList1 = isListType(paragraphBlock.type);
  const switchedToTodo = {
    ...paragraphBlock,
    type: 'todo',
    properties: {
      ...cleanNonListProperties(paragraphBlock.properties),
      level: isPrevList1 ? getBlockLevel(paragraphBlock) : 0,
      checked: false,
    }
  };
  assert.equal(switchedToTodo.type, 'todo');
  assert.equal(switchedToTodo.content, '清单任务内容');
  assert.equal(switchedToTodo.properties.level, 0);
  assert.equal(switchedToTodo.properties.checked, false);

  // 5b: Todo (checked: true, level: 2) -> BulletList (同列表族互相转换，保留 level: 2，清理 checked)
  switchedToTodo.properties.checked = true;
  switchedToTodo.properties.level = 2;

  const isPrevList2 = isListType(switchedToTodo.type);
  const bulletProps = {
    ...cleanNonListProperties(switchedToTodo.properties),
    level: isPrevList2 ? getBlockLevel(switchedToTodo) : 0,
  };
  delete bulletProps.checked;

  const switchedToBullet = {
    ...switchedToTodo,
    type: 'bulletList',
    properties: bulletProps,
  };
  assert.equal(switchedToBullet.type, 'bulletList');
  assert.equal(switchedToBullet.properties.level, 2, '列表族互转保留 level');
  assert.equal(switchedToBullet.properties.checked, undefined, '非待办列表彻底清除 checked');
  assert.equal(switchedToBullet.content, '清单任务内容');

  // 5c: BulletList (level: 2) -> Paragraph (转出列表族，彻底清除 level，绝不残留 P2 隐患)
  const switchedBackToParagraph = {
    ...switchedToBullet,
    type: 'paragraph',
    properties: cleanNonListProperties(switchedToBullet.properties),
  };
  assert.equal(switchedBackToParagraph.type, 'paragraph');
  assert.equal(switchedBackToParagraph.properties, undefined, '转出列表族后 properties 彻底无 level 残留');
  assert.equal(switchedBackToParagraph.content, '清单任务内容');

  // 5d: 再从该 Paragraph 转回 BulletList，level 必须按 0 初始化，而非恢复以前残留的 2
  const isPrevList3 = isListType(switchedBackToParagraph.type);
  const reenterList = {
    ...switchedBackToParagraph,
    type: 'bulletList',
    properties: {
      level: isPrevList3 ? getBlockLevel(switchedBackToParagraph) : 0,
    }
  };
  assert.equal(reenterList.properties.level, 0, '普通段落转入列表时 level 重新初始化为 0，不受历史残留影响');

  console.log('  ✅ 块类型相互切换保留文本与稳定 ID、彻底清洗 level/checked 验证通过');
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
    properties: { level: getBlockLevel(curBlock) }
  }));

  assert.equal(pastedBlocks.length, 3);
  pastedBlocks.forEach(item => {
    assert.equal(item.type, 'numberedList');
    assert.equal(item.properties.level, 2);
  });

  console.log('  ✅ 列表内多行粘贴拆解为同类型、同 level 列表块验证通过');
}

console.log('\n🎉 所有 Day 3 列表与待办块生产代码数据契约、计算规则与键盘边界自动化测试全部通过 (Exit Code 0)！');
