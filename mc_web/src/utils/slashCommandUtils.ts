import type { BlockType } from '../types/document.ts';
import { BLOCK_PINYIN_MAP, matchPinyinOrEnglish } from './pinyinMatch.ts';

export interface SlashCommandItem {
  id: string;
  type: BlockType;
  label: string;
  description: string;
  keywords: string[];
}

export const SLASH_COMMAND_ITEMS: SlashCommandItem[] = [
  {
    id: 'cmd-paragraph',
    type: 'paragraph',
    label: '正文段落',
    description: '普通的正文内容文本',
    keywords: ['p', 'paragraph', 'text', 'normal', 'putong'],
  },
  {
    id: 'cmd-heading1',
    type: 'heading1',
    label: '一级标题',
    description: '最大级别的大段落标题',
    keywords: ['h1', 'heading1', 'title1', 'large', 'da'],
  },
  {
    id: 'cmd-heading2',
    type: 'heading2',
    label: '二级标题',
    description: '中等层级的小节标题',
    keywords: ['h2', 'heading2', 'title2', 'medium', 'zhong'],
  },
  {
    id: 'cmd-heading3',
    type: 'heading3',
    label: '三级标题',
    description: '最小级别的细分标题',
    keywords: ['h3', 'heading3', 'title3', 'small', 'xiao'],
  },
  {
    id: 'cmd-bullet-list',
    type: 'bulletList',
    label: '无序列表',
    description: '简单的项目符号列表',
    keywords: ['ul', 'bullet', 'list', 'dot', 'dian'],
  },
  {
    id: 'cmd-numbered-list',
    type: 'numberedList',
    label: '有序列表',
    description: '带连续自动序号的数字列表',
    keywords: ['ol', 'numbered', 'number', 'order', 'shuzi', '1', '1.'],
  },
  {
    id: 'cmd-todo',
    type: 'todo',
    label: '待办清单',
    description: '带复选框的任务清单项',
    keywords: ['todo', 'task', 'check', 'checkbox', 'daiban'],
  },
  {
    id: 'cmd-code',
    type: 'code',
    label: '代码块',
    description: '语法高亮代码与一键复制',
    keywords: ['code', 'codeblock', 'js', 'ts', 'program', 'snippet', 'daima'],
  },
  {
    id: 'cmd-quote',
    type: 'quote',
    label: '引用块',
    description: '左侧引用竖线与斜体文本',
    keywords: ['quote', 'blockquote', 'citation', 'yinyong'],
  },
  {
    id: 'cmd-callout',
    type: 'callout',
    label: '提示块',
    description: '多彩背景与 Emoji 强调提示',
    keywords: ['callout', 'alert', 'info', 'note', 'box', 'tishi'],
  },
  {
    id: 'cmd-database',
    type: 'database',
    label: '多维数据库',
    description: '结构化二维表与数据视图',
    keywords: ['database', 'table', 'db', 'biaoge', 'shujuku', 'sjk', 'grid'],
  },
  {
    id: 'cmd-divider',
    type: 'divider',
    label: '分割线',
    description: '视觉上分隔不同章节内容',
    keywords: ['divider', 'hr', 'line', 'separator', 'fengexian'],
  },
];

/**
 * 根据输入检索词对候选指令执行模糊搜索过滤
 */
export function filterSlashCommands(query: string): SlashCommandItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return SLASH_COMMAND_ITEMS;

  return SLASH_COMMAND_ITEMS.filter((item) =>
    matchPinyinOrEnglish(
      q,
      item.label,
      item.description,
      item.keywords,
      BLOCK_PINYIN_MAP[item.type]
    )
  );
}

/**
 * 检查当前光标前文本是否触发斜杠指令
 * 支持形式：
 * 1. 块首 `/` 或 `、`：如 `/` 或 `/code` 或 `/dm` 或 `、dm`
 * 2. 空格/换行/NBSP 后 `/` 或 `、`：如 `文字 /code`、`文字\u00A0/code`
 */
export function checkSlashTrigger(textBeforeCaret: string): {
  isTriggered: boolean;
  query: string;
  slashIndex: number;
} {
  // 查找光标前最后一个 '/' 或 '、' (中文输入法下的顿号)
  const slashPos = textBeforeCaret.lastIndexOf('/');
  const pausePos = textBeforeCaret.lastIndexOf('、');
  const lastSlash = Math.max(slashPos, pausePos);

  if (lastSlash === -1) {
    return { isTriggered: false, query: '', slashIndex: -1 };
  }

  // 触发符必须在块首或者前面是空白字符（空格/换行/制表符/NBSP）
  if (lastSlash > 0) {
    const prevChar = textBeforeCaret[lastSlash - 1];
    if (
      prevChar !== ' ' &&
      prevChar !== '\n' &&
      prevChar !== '\t' &&
      prevChar !== '\u00a0' &&
      !/\s/.test(prevChar)
    ) {
      return { isTriggered: false, query: '', slashIndex: -1 };
    }
  }

  const query = textBeforeCaret.substring(lastSlash + 1);
  // 如果 query 中包含空格、换行或 NBSP，则视为指令已终止
  if (
    query.includes(' ') ||
    query.includes('\n') ||
    query.includes('\t') ||
    query.includes('\u00a0')
  ) {
    return { isTriggered: false, query: '', slashIndex: -1 };
  }

  return {
    isTriggered: true,
    query,
    slashIndex: lastSlash,
  };
}

/**
 * 确认执行斜杠指令后，将正文中的 `/<query>` 或 `、<query>` 清除
 */
export function stripSlashCommand(content: string, slashIndex: number, queryLength: number): string {
  if (slashIndex < 0) return content;

  // 纯文本直接切片清理
  if (!/<[a-z][\s\S]*>/i.test(content)) {
    let before = content.substring(0, slashIndex);
    let after = content.substring(slashIndex + 1 + queryLength);
    if (before.endsWith(' ') && after.startsWith(' ')) {
      after = after.substring(1);
    }
    return (before + after).trim();
  }

  // 包含 HTML 标签时，在保留标签结构的同时安全剔除末尾指令
  const regex = /([/、][^\s<]*)(?![\s\S]*[/、])/;
  return content.replace(regex, '').trim();
}
