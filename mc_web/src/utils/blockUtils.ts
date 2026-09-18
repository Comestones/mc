import type { BlockNode, BlockType } from '../types/document.ts';

/**
 * 代码块支持的常用编程语言列表与元信息
 */
export const SUPPORTED_CODE_LANGUAGES = [
  { value: 'plaintext', label: 'Plain Text' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'json', label: 'JSON' },
  { value: 'python', label: 'Python' },
  { value: 'bash', label: 'Bash / Shell' },
  { value: 'sql', label: 'SQL' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'rust', label: 'Rust' },
  { value: 'go', label: 'Go' },
  { value: 'cpp', label: 'C++' },
  { value: 'java', label: 'Java' },
] as const;

export type CodeLanguage = typeof SUPPORTED_CODE_LANGUAGES[number]['value'];

/**
 * 提示块支持的 5 种色彩基调 (Tone)
 */
export const CALLOUT_TONES = [
  'neutral',
  'info',
  'success',
  'warning',
  'danger',
] as const;

export type CalloutTone = typeof CALLOUT_TONES[number];

/**
 * 可向上合并文本内容的块类型白名单：
 * 普通文本、标题、列表项与引用块均支持文字无缝合并；
 * Code 独立代码容器、Divider 分割线、Callout 独立提示框与 Database 隔离容器均不属于直接文本合并项。
 */
export const TEXT_MERGEABLE_BLOCK_TYPES: BlockType[] = [
  'paragraph',
  'heading1',
  'heading2',
  'heading3',
  'bulletList',
  'numberedList',
  'todo',
  'quote',
];

export function isTextMergeable(type: BlockType): boolean {
  return TEXT_MERGEABLE_BLOCK_TYPES.includes(type);
}

/**
 * 规范化代码块语言（未知或非法字符串安全降级为 plaintext）
 */
export function normalizeCodeLanguage(lang: unknown): string {
  if (typeof lang === 'string') {
    const lower = lang.toLowerCase().trim();
    if (lower === 'js') return 'javascript';
    if (lower === 'ts') return 'typescript';
    if (lower === 'py') return 'python';
    if (lower === 'sh' || lower === 'shell') return 'bash';
    if (lower === 'c++') return 'cpp';
    if (lower === 'md') return 'markdown';
    const match = SUPPORTED_CODE_LANGUAGES.find((l) => l.value === lower);
    if (match) return match.value;
  }
  return 'plaintext';
}

/**
 * 规范化代码块折行开关（严格布尔，缺省 false 为横向滚动）
 */
export function normalizeCodeWrap(wrap: unknown): boolean {
  return wrap === true;
}

/**
 * 规范化提示块色调（非法值安全回退 neutral）
 */
export function normalizeCalloutTone(tone: unknown): CalloutTone {
  if (typeof tone === 'string') {
    const lower = tone.toLowerCase().trim();
    if ((CALLOUT_TONES as readonly string[]).includes(lower)) {
      return lower as CalloutTone;
    }
  }
  return 'neutral';
}

/**
 * 规范化提示块图标（缺省 💡）
 */
export function normalizeCalloutIcon(icon: unknown): string {
  if (typeof icon === 'string' && icon.trim().length > 0) {
    return icon.trim();
  }
  return '💡';
}

/**
 * 规范化列表层级：
 * 必须为有限的非负数字，且向下取整为非负整数；
 * 任何负数、非数字类型（如字符串、布尔）、NaN、Infinity、null/undefined 均严格归一化为 0。
 */
export function normalizeLevel(level: unknown): number {
  if (typeof level === 'number' && Number.isFinite(level) && level >= 0) {
    return Math.floor(level);
  }
  return 0;
}

/**
 * 规范化待办勾选状态：
 * 严格只接受布尔值 true / false；
 * 任何非布尔值（如 truthy 字符串、数字 1、对象等）均严格归一化为 false。
 */
export function normalizeChecked(checked: unknown): boolean {
  return typeof checked === 'boolean' ? checked : false;
}

/**
 * 判断指定块类型是否属于列表族（无序列表、有序列表、待办项）
 */
export function isListType(type: BlockType): boolean {
  return type === 'bulletList' || type === 'numberedList' || type === 'todo';
}

/**
 * 获取块节点的规范化列表层级
 */
export function getBlockLevel(block: BlockNode): number {
  return normalizeLevel(block?.properties?.level);
}

/**
 * 针对有序列表 (numberedList) 动态向上扫描计算当前序号：
 * 遇到子级跳过、同级累加、浅层父级或非有序列表即时中断重置。
 */
export function getNumberedListOrder(blocks: BlockNode[], index: number): number {
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

/**
 * 清除块 properties 中属于列表特有的 level 与 checked 属性，
 * 若清除后 properties 为空对象，则返回 undefined。
 */
export function cleanNonListProperties(
  properties?: Record<string, any>
): Record<string, any> | undefined {
  if (!properties) return undefined;
  const rest = { ...properties };
  delete rest.level;
  delete rest.checked;
  return Object.keys(rest).length > 0 ? rest : undefined;
}

/**
 * 针对特定块类型清洗并仅保留合法专属属性，防止跨块类型转换时属性污染
 */
export function cleanBlockProperties(
  type: BlockType,
  properties?: Record<string, any>
): Record<string, any> | undefined {
  if (!properties) return undefined;
  const rest = { ...properties };

  // 全局清理列表、代码、提示块、数据库属性
  delete rest.level;
  delete rest.checked;
  delete rest.language;
  delete rest.wrap;
  delete rest.icon;
  delete rest.tone;
  delete rest.databaseId;

  if (type === 'bulletList' || type === 'numberedList') {
    return {
      ...rest,
      level: normalizeLevel(properties.level),
    };
  }

  if (type === 'todo') {
    return {
      ...rest,
      level: normalizeLevel(properties.level),
      checked: normalizeChecked(properties.checked),
    };
  }

  if (type === 'code') {
    return {
      ...rest,
      language: normalizeCodeLanguage(properties.language),
      wrap: normalizeCodeWrap(properties.wrap),
    };
  }

  if (type === 'callout') {
    return {
      ...rest,
      icon: normalizeCalloutIcon(properties.icon),
      tone: normalizeCalloutTone(properties.tone),
    };
  }

  if (type === 'database') {
    if (typeof properties.databaseId === 'string' && properties.databaseId.trim()) {
      return {
        databaseId: properties.databaseId.trim(),
      };
    }
    return undefined;
  }

  // paragraph, heading1-3, quote, divider
  if (type === 'divider') {
    return undefined;
  }

  return Object.keys(rest).length > 0 ? rest : undefined;
}

/**
 * 对任意块节点执行数据契约归一化处理：
 * 保证列表块具有合法 level / checked、代码块具有合法 language / wrap、提示块具有合法 icon / tone，
 * 数据库块保留合法 databaseId，普通文本与引用块绝不残留无关属性。
 */
export function normalizeBlock(block: BlockNode): BlockNode {
  if (!block) return block;

  if (block.type === 'bulletList' || block.type === 'numberedList') {
    const level = normalizeLevel(block.properties?.level);
    const props = cleanBlockProperties('bulletList', block.properties) || {};
    props.level = level;
    delete props.checked;
    return {
      ...block,
      properties: props,
    };
  }

  if (block.type === 'todo') {
    const level = normalizeLevel(block.properties?.level);
    const checked = normalizeChecked(block.properties?.checked);
    const props = cleanBlockProperties('todo', block.properties) || {};
    props.level = level;
    props.checked = checked;
    return {
      ...block,
      properties: props,
    };
  }

  if (block.type === 'code') {
    const language = normalizeCodeLanguage(block.properties?.language);
    const wrap = normalizeCodeWrap(block.properties?.wrap);
    const props = cleanBlockProperties('code', block.properties) || {};
    props.language = language;
    props.wrap = wrap;
    return {
      ...block,
      properties: props,
    };
  }

  if (block.type === 'callout') {
    const icon = normalizeCalloutIcon(block.properties?.icon);
    const tone = normalizeCalloutTone(block.properties?.tone);
    const props = cleanBlockProperties('callout', block.properties) || {};
    props.icon = icon;
    props.tone = tone;
    return {
      ...block,
      properties: props,
    };
  }

  if (block.type === 'database') {
    const databaseId =
      typeof block.properties?.databaseId === 'string' ? block.properties.databaseId.trim() : '';
    return {
      ...block,
      properties: databaseId ? { databaseId } : undefined,
    };
  }

  // 非专属属性块 (paragraph, headings, quote, divider 等)
  const cleanedProps = cleanBlockProperties(block.type, block.properties);
  return {
    ...block,
    properties: cleanedProps,
  };
}

/**
 * 生成唯一的 Block ID
 */
export function generateBlockId(): string {
  return `b-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * 创建一个保底默认的空白段落块
 */
export function createDefaultParagraph(id?: string, content = ''): BlockNode {
  return {
    id: id || generateBlockId(),
    type: 'paragraph',
    content,
  };
}

/**
 * 块级拖拽重排纯函数算法：
 * 支持单个块或多个选中块整体拖拽重排，严格保持多块之间的原始相对次序。
 *
 * @param blocks 当前文档所有块节点列表
 * @param draggingIds 正在拖拽的块 ID 集合（支持单块或多块批量）
 * @param targetId 放置目标块 ID
 * @param position 放置位置：'top' 插入到目标块上方，'bottom' 插入到目标块下方
 * @returns 排序后的新块数组（若目标在拖拽集合内或不存在，则安全返回原数组）
 */
export function reorderBlocks(
  blocks: BlockNode[],
  draggingIds: string[],
  targetId: string,
  position: 'top' | 'bottom'
): BlockNode[] {
  if (!blocks || blocks.length === 0 || !draggingIds || draggingIds.length === 0 || !targetId) {
    return blocks;
  }

  // 放置目标本身若处于被拖拽集合内，属于自拖拽无操作，直接原样返回
  if (draggingIds.includes(targetId)) {
    return blocks;
  }

  // 提取需要移动的块，并保持它们在原始文档中的相对次序
  const draggingIdSet = new Set(draggingIds);
  const draggedBlocks = blocks.filter((b) => draggingIdSet.has(b.id));
  if (draggedBlocks.length === 0) {
    return blocks;
  }

  // 剔除正在移动的块得到剩余块列表
  const remainingBlocks = blocks.filter((b) => !draggingIdSet.has(b.id));

  // 查找目标块在剩余列表中的位置
  const targetIndex = remainingBlocks.findIndex((b) => b.id === targetId);
  if (targetIndex === -1) {
    return blocks;
  }

  // 计算插入点
  const insertIndex = position === 'top' ? targetIndex : targetIndex + 1;

  // 拼接新块列表
  return [
    ...remainingBlocks.slice(0, insertIndex),
    ...draggedBlocks,
    ...remainingBlocks.slice(insertIndex),
  ];
}

/**
 * 范围多选块 ID 提取算法：
 * 用于支持 Shift + Click 连续选区选择，计算从 startId 到 endId 之间的所有块 ID。
 */
export function getBlocksRange(
  blocks: BlockNode[],
  startId: string,
  endId: string
): string[] {
  if (!blocks || blocks.length === 0) return [];
  const startIndex = blocks.findIndex((b) => b.id === startId);
  const endIndex = blocks.findIndex((b) => b.id === endId);

  if (startIndex === -1 && endIndex === -1) return [];
  if (startIndex === -1) return [endId];
  if (endIndex === -1) return [startId];

  const minIndex = Math.min(startIndex, endIndex);
  const maxIndex = Math.max(startIndex, endIndex);

  return blocks.slice(minIndex, maxIndex + 1).map((b) => b.id);
}

/**
 * 批量块节点序列化为 Markdown / 纯文本：
 * 用于支持多块选中时的一键 Ctrl+C 复制或数据导出。
 */
export function serializeBlocksToMarkdown(blocks: BlockNode[]): string {
  if (!blocks || blocks.length === 0) return '';

  return blocks
    .map((block) => {
      const content = block.content || '';
      const level = normalizeLevel(block.properties?.level);
      const indent = '  '.repeat(level);

      switch (block.type) {
        case 'heading1':
          return `# ${content}`;
        case 'heading2':
          return `## ${content}`;
        case 'heading3':
          return `### ${content}`;
        case 'bulletList':
          return `${indent}- ${content}`;
        case 'numberedList':
          return `${indent}1. ${content}`;
        case 'todo': {
          const checked = normalizeChecked(block.properties?.checked);
          return `${indent}- [${checked ? 'x' : ' '}] ${content}`;
        }
        case 'code': {
          const lang = block.properties?.language || 'plaintext';
          return `\`\`\`${lang}\n${content}\n\`\`\``;
        }
        case 'quote':
          return `> ${content}`;
        case 'callout': {
          const tone = block.properties?.tone || 'neutral';
          const icon = block.properties?.icon || '💡';
          return `> [!${tone}] ${icon} ${content}`;
        }
        case 'divider':
          return '---';
        case 'paragraph':
        default:
          return content;
      }
    })
    .join('\n\n');
}

