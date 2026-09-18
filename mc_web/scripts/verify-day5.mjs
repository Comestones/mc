// Day 5 Acceptance Verification Script: 斜杠指令 (Slash Command) 与浮动菜单 (Bubble Menu)
import assert from 'node:assert/strict';
import {
  BLOCK_PINYIN_MAP,
  matchPinyinOrEnglish,
} from '../src/utils/pinyinMatch.ts';
import {
  SLASH_COMMAND_ITEMS,
  filterSlashCommands,
  checkSlashTrigger,
  stripSlashCommand,
} from '../src/utils/slashCommandUtils.ts';
import { sanitizeHtml } from '../src/utils/sanitizeHtml.ts';

console.log('🧪 开始 Day 5: 斜杠指令 (Slash Command `/`) 与浮动菜单 (Bubble Menu) 核心逻辑自动化验收核查...\n');

// 测试用例 1: 拼音字典与模糊检索算法
console.log('▶ 测试 1: 拼音首字母/全拼/英文多模态模糊匹配引擎核查...');
{
  // 1a: 块类型拼音元数据完整性
  assert.ok(Object.keys(BLOCK_PINYIN_MAP).length >= 11, '必须包含基础 11+ 种块类型的拼音元数据');
  assert.ok(BLOCK_PINYIN_MAP.code.initials.includes('dm'), '代码块必须包含首字母 dm');
  assert.ok(BLOCK_PINYIN_MAP.code.full.includes('daima'), '代码块必须包含全拼 daima');
  assert.ok(BLOCK_PINYIN_MAP.heading1.initials.includes('bt1') || BLOCK_PINYIN_MAP.heading1.initials.includes('yjbt'), '标题必须包含拼音缩写');
  assert.ok(BLOCK_PINYIN_MAP.todo.initials.includes('db'), '待办必须包含首字母 db');
  assert.ok(BLOCK_PINYIN_MAP.quote.initials.includes('yy') || BLOCK_PINYIN_MAP.quote.initials.includes('yyk'), '引用必须包含首字母 yy');
  assert.ok(BLOCK_PINYIN_MAP.callout.initials.includes('ts'), '提示块必须包含首字母 ts');

  // 1b: 拼音首字母匹配
  assert.equal(
    matchPinyinOrEnglish('dm', '代码块', '语法高亮代码', ['code'], BLOCK_PINYIN_MAP.code),
    true,
    '输入 dm 必须精准匹配代码块'
  );
  assert.equal(
    matchPinyinOrEnglish('db', '待办清单', '任务清单', ['todo'], BLOCK_PINYIN_MAP.todo),
    true,
    '输入 db 必须精准匹配待办清单'
  );
  assert.equal(
    matchPinyinOrEnglish('ts', '提示块', '多彩背景强调', ['callout'], BLOCK_PINYIN_MAP.callout),
    true,
    '输入 ts 必须精准匹配提示块'
  );

  // 1c: 全拼匹配
  assert.equal(
    matchPinyinOrEnglish('daima', '代码块', '语法高亮代码', ['code'], BLOCK_PINYIN_MAP.code),
    true,
    '输入 daima 必须匹配代码块'
  );
  assert.equal(
    matchPinyinOrEnglish('biaoti', '一级标题', '最大级别标题', ['h1'], BLOCK_PINYIN_MAP.heading1),
    true,
    '输入 biaoti 必须匹配标题'
  );

  // 1d: 英文指令匹配
  assert.equal(
    matchPinyinOrEnglish('code', '代码块', '语法高亮代码', ['code', 'js'], BLOCK_PINYIN_MAP.code),
    true,
    '输入英文 code 必须匹配代码块'
  );
  assert.equal(
    matchPinyinOrEnglish('h1', '一级标题', '最大级别标题', ['h1', 'heading1'], BLOCK_PINYIN_MAP.heading1),
    true,
    '输入英文 h1 必须匹配一级标题'
  );
  assert.equal(
    matchPinyinOrEnglish('todo', '待办清单', '任务清单', ['todo'], BLOCK_PINYIN_MAP.todo),
    true,
    '输入英文 todo 必须匹配待办清单'
  );

  // 1e: 无关字符不匹配
  assert.equal(
    matchPinyinOrEnglish('xyz', '代码块', '语法高亮代码', ['code'], BLOCK_PINYIN_MAP.code),
    false,
    '无关输入 xyz 不得误匹配代码块'
  );
  console.log('  ✔ 拼音模糊匹配引擎通过');
}

// 测试用例 2: 斜杠命令列表与过滤体系
console.log('\n▶ 测试 2: filterSlashCommands 指令过滤体系核查...');
{
  // 2a: 空输入返回全部候选指令
  const allCmds = filterSlashCommands('');
  assert.ok(allCmds.length >= 11, '空 query 必须返回全部 11+ 种候选指令');
  assert.ok(SLASH_COMMAND_ITEMS.length >= 11);

  // 2b: 搜索 'dm' 只命中代码块
  const dmCmds = filterSlashCommands('dm');
  assert.ok(dmCmds.some((c) => c.type === 'code'), '输入 dm 结果必须包含代码块');

  // 2c: 搜索 'h' 命中 h1, h2, h3
  const hCmds = filterSlashCommands('h');
  assert.ok(hCmds.some((c) => c.type === 'heading1'));
  assert.ok(hCmds.some((c) => c.type === 'heading2'));
  assert.ok(hCmds.some((c) => c.type === 'heading3'));

  // 2d: 搜索 '1' 命中一级标题与有序列表
  const numCmds = filterSlashCommands('1');
  assert.ok(numCmds.some((c) => c.type === 'heading1'));
  assert.ok(numCmds.some((c) => c.type === 'numberedList'));

  // 2e: 搜索不存在的指令
  const noneCmds = filterSlashCommands('nonexistent_command_123');
  assert.equal(noneCmds.length, 0, '非法指令必须返回空结果');
  console.log('  ✔ 指令过滤体系通过');
}

// 测试用例 3: 斜杠指令触发检测器 (checkSlashTrigger)
console.log('\n▶ 测试 3: checkSlashTrigger 触发条件与边界防御核查...');
{
  // 3a: 行首单个斜杠
  const t1 = checkSlashTrigger('/');
  assert.equal(t1.isTriggered, true);
  assert.equal(t1.query, '');
  assert.equal(t1.slashIndex, 0);

  // 3b: 行首带关键字的斜杠
  const t2 = checkSlashTrigger('/code');
  assert.equal(t2.isTriggered, true);
  assert.equal(t2.query, 'code');
  assert.equal(t2.slashIndex, 0);

  // 3c: 空格后的斜杠
  const t3 = checkSlashTrigger('今天推进 /dm');
  assert.equal(t3.isTriggered, true);
  assert.equal(t3.query, 'dm');
  assert.equal(t3.slashIndex, 5);

  // 3d: URL 协议斜杠不得触发
  const t4 = checkSlashTrigger('https://example.com/api');
  assert.equal(t4.isTriggered, false, 'URL 内部斜杠不得误触发斜杠菜单');

  // 3e: 斜杠后带有空格表示指令结束
  const t5 = checkSlashTrigger('/code ');
  assert.equal(t5.isTriggered, false, '斜杠输入带空格必须自动关闭菜单');

  // 3f: 无斜杠
  const t6 = checkSlashTrigger('普通文字内容');
  assert.equal(t6.isTriggered, false);

  // 3g: NBSP (\u00A0) 后触发斜杠 (P2-2 修复验证)
  const t7 = checkSlashTrigger('文字\u00a0/code');
  assert.equal(t7.isTriggered, true);
  assert.equal(t7.query, 'code');
  assert.equal(t7.slashIndex, 3);

  // 3h: 中文输入法顿号 (、) 触发 (P2-2 改进验证)
  const t8 = checkSlashTrigger('、dm');
  assert.equal(t8.isTriggered, true);
  assert.equal(t8.query, 'dm');
  assert.equal(t8.slashIndex, 0);

  const t9 = checkSlashTrigger('前置文本 、todo');
  assert.equal(t9.isTriggered, true);
  assert.equal(t9.query, 'todo');
  assert.equal(t9.slashIndex, 5);
  console.log('  ✔ 斜杠与中文顿号指令触发状态机（含 NBSP 容错）通过');
}

// 测试用例 4: 确认指令后正文文本清理 (stripSlashCommand)
console.log('\n▶ 测试 4: stripSlashCommand 触发字符清洗核查...');
{
  // 4a: 行首纯 / 清洗
  assert.equal(stripSlashCommand('/', 0, 0), '');

  // 4b: 行首 /code 清洗
  assert.equal(stripSlashCommand('/code', 0, 4), '');

  // 4c: 文本末尾 /dm 清洗
  assert.equal(stripSlashCommand('这是前置文本 /dm', 7, 2), '这是前置文本');

  // 4d: 文本中间 /todo 清洗
  assert.equal(stripSlashCommand('前置 /todo 后置', 3, 4), '前置 后置');

  // 4e: 富文本内容中的 /dm 清洗（避免破坏 HTML 结构）
  assert.equal(stripSlashCommand('<b>这是富文本</b> /dm', 14, 2), '<b>这是富文本</b>');

  // 4f: 中文顿号 、code 清洗
  assert.equal(stripSlashCommand('前置文本 、code', 5, 4), '前置文本');
  console.log('  ✔ 触发字符清洗（纯文本与 HTML）通过');
}

// 测试用例 5: 安全 HTML 清洗与 XSS 防护 (sanitizeHtml)
console.log('\n▶ 测试 5: sanitizeHtml 行内富文本安全白名单与 XSS 拦截核查...');
{
  // 5a: 合法行内格式保留
  const safeBold = '<strong>加粗文本</strong>';
  assert.ok(sanitizeHtml(safeBold).includes('加粗文本'));

  const safeItalic = '<em>斜体文本</em>';
  assert.ok(sanitizeHtml(safeItalic).includes('斜体文本'));

  const safeCode = '<code>console.log(42)</code>';
  assert.ok(sanitizeHtml(safeCode).includes('<code>console.log(42)</code>'));

  const safeUnderline = '<u>下划线文本</u>';
  assert.ok(sanitizeHtml(safeUnderline).includes('<u>下划线文本</u>'));

  const safeStrike = '<s>删除线文本</s>';
  assert.ok(sanitizeHtml(safeStrike).includes('<s>删除线文本</s>'));

  // 5b: 合法链接并自动追加 target="_blank" rel="noopener noreferrer"
  const safeLink = '<a href="https://example.com">访问链接</a>';
  const cleanedLink = sanitizeHtml(safeLink);
  assert.ok(cleanedLink.includes('href="https://example.com"'));
  assert.ok(cleanedLink.includes('target="_blank"'));
  assert.ok(cleanedLink.includes('rel="noopener noreferrer"'));

  // 5c: XSS 恶意脚本拦截
  const maliciousScript = '<script>alert("xss")</script>正文内容';
  const cleanedScript = sanitizeHtml(maliciousScript);
  assert.ok(!cleanedScript.includes('<script>'), '必须剥离 <script> 标签');
  assert.ok(cleanedScript.includes('正文内容'), '正常正文内容必须保留');

  // 5d: XSS 恶意事件属性拦截
  const maliciousAttr = '<b onclick="malicious()" onerror="hack()">加粗内容</b>';
  const cleanedAttr = sanitizeHtml(maliciousAttr);
  assert.ok(!cleanedAttr.includes('onclick'), '必须剥离 onclick 危险属性');
  assert.ok(!cleanedAttr.includes('onerror'), '必须剥离 onerror 危险属性');
  assert.ok(cleanedAttr.includes('加粗内容'));

  // 5e: javascript: 伪协议链接拦截
  const dangerousHref = '<a href="javascript:alert(1)">点我攻击</a>';
  const cleanedHref = sanitizeHtml(dangerousHref);
  assert.ok(!cleanedHref.includes('javascript:'), '必须剥离 javascript: 协议链接');

  // 5f: 深度嵌套非白名单标签不死循环 (P1-1 修复验证)
  const nestedBadTags = '<div><p><section><span>安全文本</span></section></p></div>';
  const cleanedNested = sanitizeHtml(nestedBadTags);
  assert.ok(cleanedNested.includes('安全文本'), '嵌套非白名单标签内的安全文本必须保留');
  assert.ok(!cleanedNested.includes('<script>'));

  // 5g: 特殊字符 URL 安全支持 (P2-3 修复验证)
  const queryUrl = '<a href="https://example.com?tags[0]=1&name=test">查询链接</a>';
  const cleanedQueryUrl = sanitizeHtml(queryUrl);
  assert.ok(cleanedQueryUrl.includes('https://example.com?tags[0]=1&name=test'));

  // 5h: 边界空值
  assert.equal(sanitizeHtml(''), '');
  assert.equal(sanitizeHtml(null), '');
  assert.equal(sanitizeHtml(undefined), '');
  console.log('  ✔ 行内富文本安全白名单与 XSS 拦截（含死循环防御与特殊 URL）通过');
}

console.log('\n======================================================');
console.log('🎉 Day 5 生产数据契约、拼音算法与安全清洗 5 项测试全部通过！');
console.log('======================================================\n');
