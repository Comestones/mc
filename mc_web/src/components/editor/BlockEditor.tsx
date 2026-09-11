import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BlockNode, BlockType } from '../../types/document';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { BlockItem } from './BlockItem';

interface BlockEditorProps {
  documentId: string;
  initialBlocks?: BlockNode[];
}

function generateBlockId(): string {
  return `b-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

function createDefaultParagraph(id?: string, content = ''): BlockNode {
  return {
    id: id || generateBlockId(),
    type: 'paragraph',
    content,
  };
}

function isListType(type: BlockType): boolean {
  return type === 'bulletList' || type === 'numberedList' || type === 'todo';
}

function getBlockLevel(block: BlockNode): number {
  const lvl = block.properties?.level;
  if (typeof lvl === 'number' && Number.isFinite(lvl) && lvl >= 0) {
    return Math.floor(lvl);
  }
  return 0;
}

function getNumberedListOrder(blocks: BlockNode[], index: number): number {
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

export const BlockEditor: React.FC<BlockEditorProps> = ({
  documentId,
  initialBlocks,
}) => {
  const updateDocumentBlocks = useWorkspaceStore(
    (state) => state.updateDocumentBlocks
  );

  // 确保文档至少有一个可编辑块
  const getInitialBlocks = useCallback((): BlockNode[] => {
    if (initialBlocks && initialBlocks.length > 0) {
      return initialBlocks;
    }
    return [createDefaultParagraph()];
  }, [initialBlocks]);

  const [blocks, setBlocks] = useState<BlockNode[]>(getInitialBlocks);
  const blocksRef = useRef<BlockNode[]>(blocks);
  blocksRef.current = blocks;

  const [cursorFocus, setCursorFocus] = useState<{
    blockId: string;
    offset: number | 'start' | 'end';
  } | null>(null);

  // 撤销/重做历史栈
  const historyRef = useRef<BlockNode[][]>([getInitialBlocks()]);
  const historyIndexRef = useRef(0);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 记录历史快照
  const pushHistory = useCallback((newBlocks: BlockNode[]) => {
    const current = historyRef.current.slice(0, historyIndexRef.current + 1);
    current.push(newBlocks);
    if (current.length > 50) current.shift();
    historyRef.current = current;
    historyIndexRef.current = current.length - 1;
  }, []);

  // 统一的状态提交函数：计算在外部完成，Zustand 与历史记录作为确定的副作用在此执行
  const commitBlocks = useCallback(
    (
      newBlocks: BlockNode[],
      options?: {
        recordHistoryNow?: boolean;
        focus?: { blockId: string; offset: number | 'start' | 'end' } | null;
      }
    ) => {
      const safeBlocks =
        newBlocks.length === 0 ? [createDefaultParagraph()] : newBlocks;
      blocksRef.current = safeBlocks;
      setBlocks(safeBlocks);
      updateDocumentBlocks(documentId, safeBlocks);

      if (options?.focus !== undefined) {
        setCursorFocus(options.focus);
      }

      if (options?.recordHistoryNow) {
        if (typingTimerRef.current) {
          clearTimeout(typingTimerRef.current);
          typingTimerRef.current = null;
        }
        pushHistory(safeBlocks);
      } else {
        if (typingTimerRef.current) {
          clearTimeout(typingTimerRef.current);
        }
        typingTimerRef.current = setTimeout(() => {
          pushHistory(blocksRef.current);
          typingTimerRef.current = null;
        }, 500);
      }
    },
    [documentId, updateDocumentBlocks, pushHistory]
  );

  // 当 documentId 变化时重置，并在卸载或切页时坚决清理定时器
  useEffect(() => {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }

    const freshBlocks = getInitialBlocks();
    blocksRef.current = freshBlocks;
    setBlocks(freshBlocks);
    historyRef.current = [freshBlocks];
    historyIndexRef.current = 0;

    // 如果是唯一一个空段落的新页面，自动聚焦光标
    if (
      freshBlocks.length === 1 &&
      freshBlocks[0].type === 'paragraph' &&
      !freshBlocks[0].content
    ) {
      setCursorFocus({ blockId: freshBlocks[0].id, offset: 0 });
    } else {
      setCursorFocus(null);
    }

    return () => {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
    };
  }, [documentId, getInitialBlocks]);

  // 撤销 (Undo)
  const handleUndo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
      historyIndexRef.current -= 1;
      const target = historyRef.current[historyIndexRef.current];
      blocksRef.current = target;
      setBlocks(target);
      updateDocumentBlocks(documentId, target);
    }
  }, [documentId, updateDocumentBlocks]);

  // 重做 (Redo)
  const handleRedo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
      historyIndexRef.current += 1;
      const target = historyRef.current[historyIndexRef.current];
      blocksRef.current = target;
      setBlocks(target);
      updateDocumentBlocks(documentId, target);
    }
  }, [documentId, updateDocumentBlocks]);

  // 更新某一块的内容
  const handleChangeContent = useCallback(
    (index: number, newContent: string) => {
      const current = blocksRef.current;
      const target = current[index];
      if (!target || target.content === newContent) return;

      const next = [...current];
      next[index] = { ...target, content: newContent };
      commitBlocks(next, { recordHistoryNow: false });
    },
    [commitBlocks]
  );

  // 切换块类型
  const handleChangeType = useCallback(
    (index: number, newType: BlockType) => {
      const current = blocksRef.current;
      const cur = current[index];
      if (!cur) return;

      const next = [...current];
      let focus: { blockId: string; offset: number | 'start' | 'end' } | null = null;

      if (newType === 'divider') {
        next[index] = { ...cur, type: 'divider', content: '', properties: undefined };
        // 如果是最后一个块，自动在其后追加一个段落
        if (index === next.length - 1) {
          const extra = createDefaultParagraph();
          next.push(extra);
          focus = { blockId: extra.id, offset: 0 };
        }
      } else if (isListType(newType)) {
        const level = getBlockLevel(cur);
        const checked = newType === 'todo' ? (cur.properties?.checked ?? false) : undefined;
        next[index] = {
          ...cur,
          type: newType,
          content: cur.type === 'divider' ? '' : cur.content,
          properties: {
            ...cur.properties,
            level,
            ...(newType === 'todo' ? { checked } : {}),
          },
        };
        focus = { blockId: cur.id, offset: 'end' };
      } else {
        next[index] = {
          ...cur,
          type: newType,
          content: cur.type === 'divider' ? '' : cur.content,
          properties: cur.properties ? { ...cur.properties, checked: undefined } : undefined,
        };
        focus = { blockId: cur.id, offset: 'end' };
      }

      commitBlocks(next, { recordHistoryNow: true, focus });
    },
    [commitBlocks]
  );

  // Enter 在光标处拆分块
  const handleSplit = useCallback(
    (index: number, offset: number) => {
      const current = blocksRef.current;
      const cur = current[index];
      if (!cur) return;

      const next = [...current];

      // 列表类特殊处理 (bulletList, numberedList, todo)
      if (isListType(cur.type)) {
        const isEmptyItem = cur.content.trim() === '' && !cur.properties?.checked;

        // 空列表项或未勾选空待办按 Enter：退出或降级
        if (isEmptyItem) {
          const curLevel = getBlockLevel(cur);
          if (curLevel > 0) {
            // level > 0：缩退一级
            next[index] = {
              ...cur,
              properties: { ...cur.properties, level: curLevel - 1 },
            };
            commitBlocks(next, {
              recordHistoryNow: true,
              focus: { blockId: cur.id, offset: 0 },
            });
            return;
          }

          // level === 0：退出为普通段落
          next[index] = {
            ...cur,
            type: 'paragraph',
            properties: undefined,
          };
          commitBlocks(next, {
            recordHistoryNow: true,
            focus: { blockId: cur.id, offset: 0 },
          });
          return;
        }

        // 非空列表项拆分
        const curLevel = getBlockLevel(cur);
        if (offset === 0 && cur.content.length > 0) {
          // 块首回车：在上方插入同类型同级空块，当前块保持原样下移
          const emptyBlock: BlockNode = {
            id: generateBlockId(),
            type: cur.type,
            content: '',
            properties: {
              level: curLevel,
              ...(cur.type === 'todo' ? { checked: false } : {}),
            },
          };
          next.splice(index, 0, emptyBlock);
          commitBlocks(next, {
            recordHistoryNow: true,
            focus: { blockId: cur.id, offset: 0 },
          });
          return;
        }

        // 中间或末尾回车：新块保持相同列表类型与相同 level，todo 时重置 checked: false
        const leftContent = cur.content.slice(0, offset);
        const rightContent = cur.content.slice(offset);

        const newBlock: BlockNode = {
          id: generateBlockId(),
          type: cur.type,
          content: rightContent,
          properties: {
            level: curLevel,
            ...(cur.type === 'todo' ? { checked: false } : {}),
          },
        };

        next[index] = { ...cur, content: leftContent };
        next.splice(index + 1, 0, newBlock);

        commitBlocks(next, {
          recordHistoryNow: true,
          focus: { blockId: newBlock.id, offset: 0 },
        });
        return;
      }

      // 普通段落与标题拆分
      if (offset === 0 && cur.content.length > 0) {
        const emptyBlock = createDefaultParagraph();
        next.splice(index, 0, emptyBlock);
        commitBlocks(next, {
          recordHistoryNow: true,
          focus: { blockId: cur.id, offset: 0 },
        });
        return;
      }

      const leftContent = cur.content.slice(0, offset);
      const rightContent = cur.content.slice(offset);

      const newBlock = createDefaultParagraph(undefined, rightContent);

      next[index] = { ...cur, content: leftContent };
      next.splice(index + 1, 0, newBlock);

      commitBlocks(next, {
        recordHistoryNow: true,
        focus: { blockId: newBlock.id, offset: 0 },
      });
    },
    [commitBlocks]
  );

  // Backspace 在块首与上一块合并或降级
  const handleMergeUp = useCallback(
    (index: number) => {
      const current = blocksRef.current;
      const cur = current[index];
      if (!cur) return;

      const next = [...current];

      // 列表类块首退格处理
      if (isListType(cur.type)) {
        const curLevel = getBlockLevel(cur);
        if (curLevel > 0) {
          // level > 0: 缩退一级
          next[index] = {
            ...cur,
            properties: { ...cur.properties, level: curLevel - 1 },
          };
          commitBlocks(next, {
            recordHistoryNow: true,
            focus: { blockId: cur.id, offset: 0 },
          });
          return;
        }

        // curLevel === 0:
        if (index === 0) {
          // 首块前项不存在，降级为普通段落（保留内容）
          next[index] = {
            ...cur,
            type: 'paragraph',
            properties: undefined,
          };
          commitBlocks(next, {
            recordHistoryNow: true,
            focus: { blockId: cur.id, offset: 0 },
          });
          return;
        }

        const prevBlock = next[index - 1];
        if (!prevBlock) return;

        if (prevBlock.type === 'divider') {
          // 前项为分割线，删除分割线
          next.splice(index - 1, 1);
          commitBlocks(next, {
            recordHistoryNow: true,
            focus: { blockId: cur.id, offset: 0 },
          });
          return;
        }

        // 与兼容前项合并内容
        const joinOffset = prevBlock.content.length;
        const mergedContent = prevBlock.content + cur.content;

        next[index - 1] = {
          ...prevBlock,
          content: mergedContent,
        };
        next.splice(index, 1);

        commitBlocks(next, {
          recordHistoryNow: true,
          focus: { blockId: prevBlock.id, offset: joinOffset },
        });
        return;
      }

      // 标题类退格处理
      if (
        cur.type === 'heading1' ||
        cur.type === 'heading2' ||
        cur.type === 'heading3'
      ) {
        next[index] = { ...cur, type: 'paragraph' };
        commitBlocks(next, {
          recordHistoryNow: true,
          focus: { blockId: cur.id, offset: 0 },
        });
        return;
      }

      // 首块普通段落：禁止越界删除，保持至少一个段落
      if (index === 0) {
        return;
      }

      const prevBlock = next[index - 1];
      if (!prevBlock) return;

      // 如果上一块是分割线，删除分割线，当前块光标保留在 0
      if (prevBlock.type === 'divider') {
        next.splice(index - 1, 1);
        commitBlocks(next, {
          recordHistoryNow: true,
          focus: { blockId: cur.id, offset: 0 },
        });
        return;
      }

      // 如果上一块是文本类块，合并内容到上一块末尾
      const joinOffset = prevBlock.content.length;
      const mergedContent = prevBlock.content + cur.content;

      next[index - 1] = {
        ...prevBlock,
        content: mergedContent,
      };
      next.splice(index, 1);

      commitBlocks(next, {
        recordHistoryNow: true,
        focus: { blockId: prevBlock.id, offset: joinOffset },
      });
    },
    [commitBlocks]
  );

  // Tab 缩进（仅当前相邻前块属于同列表家族时允许缩进，防跳级）
  const handleIndent = useCallback(
    (index: number) => {
      const current = blocksRef.current;
      const cur = current[index];
      if (!cur || !isListType(cur.type)) return;

      if (index === 0) return;
      const prevBlock = current[index - 1];
      if (!prevBlock || prevBlock.type !== cur.type) return;

      const prevLevel = getBlockLevel(prevBlock);
      const curLevel = getBlockLevel(cur);

      // 禁止跳级：当前项的最大合法 level 只能是 prevLevel + 1
      if (curLevel < prevLevel + 1) {
        const next = [...current];
        next[index] = {
          ...cur,
          properties: { ...cur.properties, level: curLevel + 1 },
        };
        commitBlocks(next, {
          recordHistoryNow: true,
          focus: { blockId: cur.id, offset: 'end' },
        });
      }
    },
    [commitBlocks]
  );

  // Shift+Tab 缩退（减一至 0，根级保持不变）
  const handleOutdent = useCallback(
    (index: number) => {
      const current = blocksRef.current;
      const cur = current[index];
      if (!cur || !isListType(cur.type)) return;

      const curLevel = getBlockLevel(cur);
      if (curLevel > 0) {
        const next = [...current];
        next[index] = {
          ...cur,
          properties: { ...cur.properties, level: curLevel - 1 },
        };
        commitBlocks(next, {
          recordHistoryNow: true,
          focus: { blockId: cur.id, offset: 'end' },
        });
      }
    },
    [commitBlocks]
  );

  // 删除指定块
  const handleDeleteBlock = useCallback(
    (index: number) => {
      const current = blocksRef.current;
      if (current.length <= 1) {
        // 唯一一块被删除时重置为空段落
        const fallback = [createDefaultParagraph()];
        commitBlocks(fallback, {
          recordHistoryNow: true,
          focus: { blockId: fallback[0].id, offset: 0 },
        });
        return;
      }

      const next = [...current];
      next.splice(index, 1);
      const focusIndex = Math.max(0, index - 1);
      const focus = next[focusIndex]
        ? { blockId: next[focusIndex].id, offset: 'end' as const }
        : null;

      commitBlocks(next, { recordHistoryNow: true, focus });
    },
    [commitBlocks]
  );

  // 在指定位置下方插入新块
  const handleInsertBelow = useCallback(
    (index: number, type: BlockType = 'paragraph') => {
      const current = blocksRef.current;
      const next = [...current];
      const newBlock: BlockNode = {
        id: generateBlockId(),
        type,
        content: '',
      };

      next.splice(index + 1, 0, newBlock);

      let focus: { blockId: string; offset: number | 'start' | 'end' } | null = null;
      // 如果插入的是分割线且位于末尾，在其后再加一个段落
      if (type === 'divider' && index + 1 === next.length - 1) {
        const extra = createDefaultParagraph();
        next.push(extra);
        focus = { blockId: extra.id, offset: 0 };
      } else {
        focus = { blockId: newBlock.id, offset: 0 };
      }

      commitBlocks(next, { recordHistoryNow: true, focus });
    },
    [commitBlocks]
  );

  // 粘贴处理（支持多行粘贴自动拆解为多个块，列表块自动继承类型与同级 level）
  const handlePaste = useCallback(
    (index: number, text: string, offset: number) => {
      const current = blocksRef.current;
      const cur = current[index];
      if (!cur) return;

      const lines = text.split(/\r?\n/);
      if (lines.length <= 1) {
        // 单行插入
        const next = [...current];
        const left = cur.content.slice(0, offset);
        const right = cur.content.slice(offset);
        const newContent = left + text + right;
        next[index] = { ...cur, content: newContent };
        commitBlocks(next, {
          recordHistoryNow: true,
          focus: { blockId: cur.id, offset: offset + text.length },
        });
        return;
      }

      // 多行粘贴
      const next = [...current];
      const left = cur.content.slice(0, offset);
      const right = cur.content.slice(offset);

      // 第一行更新到当前块
      next[index] = { ...cur, content: left + lines[0] };

      // 中间行与最后一行创建新块
      const newBlocks: BlockNode[] = [];
      const curLevel = isListType(cur.type) ? getBlockLevel(cur) : 0;
      const isList = isListType(cur.type);

      for (let i = 1; i < lines.length - 1; i++) {
        if (isList) {
          newBlocks.push({
            id: generateBlockId(),
            type: cur.type,
            content: lines[i],
            properties: {
              level: curLevel,
              ...(cur.type === 'todo' ? { checked: false } : {}),
            },
          });
        } else {
          newBlocks.push(createDefaultParagraph(undefined, lines[i]));
        }
      }

      const lastLineContent = lines[lines.length - 1] + right;
      let lastBlock: BlockNode;
      if (isList) {
        lastBlock = {
          id: generateBlockId(),
          type: cur.type,
          content: lastLineContent,
          properties: {
            level: curLevel,
            ...(cur.type === 'todo' ? { checked: false } : {}),
          },
        };
      } else {
        lastBlock = createDefaultParagraph(undefined, lastLineContent);
      }
      newBlocks.push(lastBlock);

      next.splice(index + 1, 0, ...newBlocks);

      commitBlocks(next, {
        recordHistoryNow: true,
        focus: {
          blockId: lastBlock.id,
          offset: lines[lines.length - 1].length,
        },
      });
    },
    [commitBlocks]
  );

  // 切换待办状态
  const handleToggleTodo = useCallback(
    (index: number) => {
      const current = blocksRef.current;
      const cur = current[index];
      if (!cur || cur.type !== 'todo') return;
      const next = [...current];
      const checked = !cur.properties?.checked;
      next[index] = {
        ...cur,
        properties: { ...cur.properties, checked },
      };
      commitBlocks(next, { recordHistoryNow: true });
    },
    [commitBlocks]
  );

  // 聚焦上一块
  const handleFocusPrevious = useCallback(
    (index: number) => {
      const current = blocksRef.current;
      if (index > 0 && current[index - 1]) {
        setCursorFocus({ blockId: current[index - 1].id, offset: 'end' });
      }
    },
    []
  );

  // 聚焦下一块
  const handleFocusNext = useCallback(
    (index: number) => {
      const current = blocksRef.current;
      if (index < current.length - 1 && current[index + 1]) {
        setCursorFocus({ blockId: current[index + 1].id, offset: 'start' });
      }
    },
    []
  );

  // 点击空白底部：聚焦最后一个块或追加新段落
  const handleBottomClick = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    const current = blocksRef.current;
    const lastBlock = current[current.length - 1];
    if (!lastBlock) {
      const fallback = [createDefaultParagraph()];
      commitBlocks(fallback, {
        recordHistoryNow: true,
        focus: { blockId: fallback[0].id, offset: 0 },
      });
    } else if (lastBlock.type === 'divider') {
      const newBlock = createDefaultParagraph();
      const next = [...current, newBlock];
      commitBlocks(next, {
        recordHistoryNow: true,
        focus: { blockId: newBlock.id, offset: 0 },
      });
    } else {
      setCursorFocus({ blockId: lastBlock.id, offset: 'end' });
    }
  };

  return (
    <div
      className="space-y-1 mt-4 min-h-[300px] cursor-text pb-24"
      onClick={handleBottomClick}
    >
      {blocks.map((block, idx) => (
        <BlockItem
          key={block.id}
          block={block}
          index={idx}
          totalCount={blocks.length}
          orderNumber={
            block.type === 'numberedList'
              ? getNumberedListOrder(blocks, idx)
              : undefined
          }
          cursorFocus={cursorFocus?.blockId === block.id ? cursorFocus : null}
          onChangeContent={(content) => handleChangeContent(idx, content)}
          onChangeType={(newType) => handleChangeType(idx, newType)}
          onSplit={(offset) => handleSplit(idx, offset)}
          onMergeUp={() => handleMergeUp(idx)}
          onIndent={() => handleIndent(idx)}
          onOutdent={() => handleOutdent(idx)}
          onFocusPrevious={() => handleFocusPrevious(idx)}
          onFocusNext={() => handleFocusNext(idx)}
          onPaste={(text, offset) => handlePaste(idx, text, offset)}
          onDelete={() => handleDeleteBlock(idx)}
          onInsertBelow={() => handleInsertBelow(idx)}
          onToggleTodo={() => handleToggleTodo(idx)}
          onUndo={handleUndo}
          onRedo={handleRedo}
        />
      ))}
    </div>
  );
};
