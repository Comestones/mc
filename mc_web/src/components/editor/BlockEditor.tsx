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

export const BlockEditor: React.FC<BlockEditorProps> = ({
  documentId,
  initialBlocks,
}) => {
  const updateDocumentBlocks = useWorkspaceStore(
    (state) => state.updateDocumentBlocks
  );

  // 确保文档至少有一个可编辑块
  const getInitialBlocks = (): BlockNode[] => {
    if (initialBlocks && initialBlocks.length > 0) {
      return initialBlocks;
    }
    return [createDefaultParagraph()];
  };

  const [blocks, setBlocks] = useState<BlockNode[]>(getInitialBlocks);
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

  // 同步更新到 Store 和本地 State
  const applyBlocksUpdate = useCallback(
    (newBlocks: BlockNode[], recordHistoryNow = false) => {
      // 保证至少有一个块
      const safeBlocks =
        newBlocks.length === 0 ? [createDefaultParagraph()] : newBlocks;
      setBlocks(safeBlocks);
      updateDocumentBlocks(documentId, safeBlocks);

      if (recordHistoryNow) {
        pushHistory(safeBlocks);
      } else {
        // 输入内容时防抖记录历史
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => {
          pushHistory(safeBlocks);
        }, 500);
      }
    },
    [documentId, updateDocumentBlocks, pushHistory]
  );

  // 当 documentId 变化时重置
  useEffect(() => {
    const freshBlocks = getInitialBlocks();
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
  }, [documentId]);

  // 撤销 (Undo)
  const handleUndo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current -= 1;
      const target = historyRef.current[historyIndexRef.current];
      setBlocks(target);
      updateDocumentBlocks(documentId, target);
    }
  }, [documentId, updateDocumentBlocks]);

  // 重做 (Redo)
  const handleRedo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current += 1;
      const target = historyRef.current[historyIndexRef.current];
      setBlocks(target);
      updateDocumentBlocks(documentId, target);
    }
  }, [documentId, updateDocumentBlocks]);

  // 更新某一块的内容
  const handleChangeContent = useCallback(
    (index: number, newContent: string) => {
      setBlocks((prev) => {
        const next = [...prev];
        const target = next[index];
        if (!target) return prev;
        next[index] = { ...target, content: newContent };
        updateDocumentBlocks(documentId, next);
        return next;
      });

      // 防抖记录历史
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        setBlocks((current) => {
          pushHistory(current);
          return current;
        });
      }, 500);
    },
    [documentId, updateDocumentBlocks, pushHistory]
  );

  // 切换块类型
  const handleChangeType = useCallback(
    (index: number, newType: BlockType) => {
      setBlocks((prev) => {
        const next = [...prev];
        const cur = next[index];
        if (!cur) return prev;

        if (newType === 'divider') {
          next[index] = { ...cur, type: 'divider', content: '' };
          // 如果是最后一个块，自动在其后追加一个段落
          if (index === next.length - 1) {
            const extra = createDefaultParagraph();
            next.push(extra);
            setCursorFocus({ blockId: extra.id, offset: 0 });
          }
        } else {
          next[index] = {
            ...cur,
            type: newType,
            // 如果原本是分割线，清空内容；否则保留现有文本
            content: cur.type === 'divider' ? '' : cur.content,
          };
          setCursorFocus({ blockId: cur.id, offset: 'end' });
        }

        applyBlocksUpdate(next, true);
        return next;
      });
    },
    [applyBlocksUpdate]
  );

  // Enter 在光标处拆分块
  const handleSplit = useCallback(
    (index: number, offset: number) => {
      setBlocks((prev) => {
        const next = [...prev];
        const cur = next[index];
        if (!cur) return prev;

        // 如果在块首 (offset === 0) 且当前块有文本内容：
        // 在上方插入一个空段落，当前块保持原样下移
        if (offset === 0 && cur.content.length > 0) {
          const emptyBlock = createDefaultParagraph();
          next.splice(index, 0, emptyBlock);
          setCursorFocus({ blockId: cur.id, offset: 0 });
          applyBlocksUpdate(next, true);
          return next;
        }

        const leftContent = cur.content.slice(0, offset);
        const rightContent = cur.content.slice(offset);

        // 无论当前是标题还是段落，在标题末尾回车后新块为段落
        const newBlockType: BlockType = 'paragraph';
        const newBlock: BlockNode = {
          id: generateBlockId(),
          type: newBlockType,
          content: rightContent,
        };

        next[index] = { ...cur, content: leftContent };
        next.splice(index + 1, 0, newBlock);

        setCursorFocus({ blockId: newBlock.id, offset: 0 });
        applyBlocksUpdate(next, true);
        return next;
      });
    },
    [applyBlocksUpdate]
  );

  // Backspace 在块首与上一块合并
  const handleMergeUp = useCallback(
    (index: number) => {
      setBlocks((prev) => {
        const next = [...prev];
        const cur = next[index];
        if (!cur) return prev;

        // 如果是首块
        if (index === 0) {
          // 如果首块是标题，按退格降级为段落（保留文本内容）
          if (
            cur.type === 'heading1' ||
            cur.type === 'heading2' ||
            cur.type === 'heading3'
          ) {
            next[index] = { ...cur, type: 'paragraph' };
            setCursorFocus({ blockId: cur.id, offset: 0 });
            applyBlocksUpdate(next, true);
            return next;
          }
          // 否则首块禁止越界删除，保持至少一个段落
          return prev;
        }

        // 如果当前块是标题（无论是否为空），在 offset 0 按退格先降级为普通段落
        if (
          cur.type === 'heading1' ||
          cur.type === 'heading2' ||
          cur.type === 'heading3'
        ) {
          next[index] = { ...cur, type: 'paragraph' };
          setCursorFocus({ blockId: cur.id, offset: 0 });
          applyBlocksUpdate(next, true);
          return next;
        }

        const prevBlock = next[index - 1];
        if (!prevBlock) return prev;

        // 如果上一块是分割线，删除分割线，当前块光标保留在 0
        if (prevBlock.type === 'divider') {
          next.splice(index - 1, 1);
          setCursorFocus({ blockId: cur.id, offset: 0 });
          applyBlocksUpdate(next, true);
          return next;
        }

        // 如果上一块是文本类块，合并内容到上一块末尾
        const joinOffset = prevBlock.content.length;
        const mergedContent = prevBlock.content + cur.content;

        next[index - 1] = {
          ...prevBlock,
          content: mergedContent,
        };
        // 删除当前块
        next.splice(index, 1);

        setCursorFocus({ blockId: prevBlock.id, offset: joinOffset });
        applyBlocksUpdate(next, true);
        return next;
      });
    },
    [applyBlocksUpdate]
  );

  // 删除指定块
  const handleDeleteBlock = useCallback(
    (index: number) => {
      setBlocks((prev) => {
        const next = [...prev];
        if (next.length <= 1) {
          // 唯一一块被删除时重置为空段落
          const fallback = [createDefaultParagraph()];
          setCursorFocus({ blockId: fallback[0].id, offset: 0 });
          applyBlocksUpdate(fallback, true);
          return fallback;
        }

        next.splice(index, 1);
        const focusIndex = Math.max(0, index - 1);
        if (next[focusIndex]) {
          setCursorFocus({ blockId: next[focusIndex].id, offset: 'end' });
        }

        applyBlocksUpdate(next, true);
        return next;
      });
    },
    [applyBlocksUpdate]
  );

  // 在指定位置下方插入新块
  const handleInsertBelow = useCallback(
    (index: number, type: BlockType = 'paragraph') => {
      setBlocks((prev) => {
        const next = [...prev];
        const newBlock: BlockNode = {
          id: generateBlockId(),
          type,
          content: '',
        };

        next.splice(index + 1, 0, newBlock);

        // 如果插入的是分割线且位于末尾，在其后再加一个段落
        if (type === 'divider' && index + 1 === next.length - 1) {
          const extra = createDefaultParagraph();
          next.push(extra);
          setCursorFocus({ blockId: extra.id, offset: 0 });
        } else {
          setCursorFocus({ blockId: newBlock.id, offset: 0 });
        }

        applyBlocksUpdate(next, true);
        return next;
      });
    },
    [applyBlocksUpdate]
  );

  // 粘贴处理（支持多行粘贴自动拆解为多个块）
  const handlePaste = useCallback(
    (index: number, text: string, offset: number) => {
      const lines = text.split(/\r?\n/);
      if (lines.length <= 1) {
        // 单行插入
        setBlocks((prev) => {
          const next = [...prev];
          const cur = next[index];
          if (!cur) return prev;
          const left = cur.content.slice(0, offset);
          const right = cur.content.slice(offset);
          const newContent = left + text + right;
          next[index] = { ...cur, content: newContent };
          setCursorFocus({ blockId: cur.id, offset: offset + text.length });
          applyBlocksUpdate(next, true);
          return next;
        });
        return;
      }

      // 多行粘贴
      setBlocks((prev) => {
        const next = [...prev];
        const cur = next[index];
        if (!cur) return prev;

        const left = cur.content.slice(0, offset);
        const right = cur.content.slice(offset);

        // 第一行更新到当前块
        next[index] = { ...cur, content: left + lines[0] };

        // 中间行与最后一行创建新块
        const newBlocks: BlockNode[] = [];
        for (let i = 1; i < lines.length - 1; i++) {
          newBlocks.push(createDefaultParagraph(undefined, lines[i]));
        }

        const lastLineContent = lines[lines.length - 1] + right;
        const lastBlock = createDefaultParagraph(undefined, lastLineContent);
        newBlocks.push(lastBlock);

        next.splice(index + 1, 0, ...newBlocks);

        setCursorFocus({
          blockId: lastBlock.id,
          offset: lines[lines.length - 1].length,
        });
        applyBlocksUpdate(next, true);
        return next;
      });
    },
    [applyBlocksUpdate]
  );

  // 切换待办状态
  const handleToggleTodo = useCallback(
    (index: number) => {
      setBlocks((prev) => {
        const next = [...prev];
        const cur = next[index];
        if (!cur || cur.type !== 'todo') return prev;
        const checked = !cur.properties?.checked;
        next[index] = {
          ...cur,
          properties: { ...cur.properties, checked },
        };
        applyBlocksUpdate(next, true);
        return next;
      });
    },
    [applyBlocksUpdate]
  );

  // 聚焦上一块
  const handleFocusPrevious = useCallback(
    (index: number) => {
      if (index > 0 && blocks[index - 1]) {
        setCursorFocus({ blockId: blocks[index - 1].id, offset: 'end' });
      }
    },
    [blocks]
  );

  // 聚焦下一块
  const handleFocusNext = useCallback(
    (index: number) => {
      if (index < blocks.length - 1 && blocks[index + 1]) {
        setCursorFocus({ blockId: blocks[index + 1].id, offset: 'start' });
      }
    },
    [blocks]
  );

  // 点击空白底部：聚焦最后一个块或追加新段落
  const handleBottomClick = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    const lastBlock = blocks[blocks.length - 1];
    if (!lastBlock) {
      const fallback = [createDefaultParagraph()];
      setBlocks(fallback);
      setCursorFocus({ blockId: fallback[0].id, offset: 0 });
      applyBlocksUpdate(fallback, true);
    } else if (lastBlock.type === 'divider') {
      const newBlock = createDefaultParagraph();
      const next = [...blocks, newBlock];
      setBlocks(next);
      setCursorFocus({ blockId: newBlock.id, offset: 0 });
      applyBlocksUpdate(next, true);
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
          cursorFocus={cursorFocus?.blockId === block.id ? cursorFocus : null}
          onClearCursorFocus={() => setCursorFocus(null)}
          onChangeContent={(content) => handleChangeContent(idx, content)}
          onChangeType={(newType) => handleChangeType(idx, newType)}
          onSplit={(offset) => handleSplit(idx, offset)}
          onMergeUp={() => handleMergeUp(idx)}
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
