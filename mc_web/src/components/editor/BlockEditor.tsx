import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BlockNode, BlockType } from '../../types/document';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { cn } from '../../utils/cn';
import { BlockItem } from './BlockItem';
import { SlashCommandMenu } from './SlashCommandMenu';
import { BubbleMenu, FormatStates } from './BubbleMenu';
import { BatchActionBar } from './BatchActionBar';
import {
  SlashCommandItem,
  filterSlashCommands,
  stripSlashCommand,
} from '../../utils/slashCommandUtils';
import { sanitizeHtml } from '../../utils/sanitizeHtml';
import {
  generateBlockId,
  createDefaultParagraph,
  isListType,
  getBlockLevel,
  getNumberedListOrder,
  cleanNonListProperties,
  cleanBlockProperties,
  normalizeBlock,
  normalizeChecked,
  isTextMergeable,
  reorderBlocks,
  getBlocksRange,
  serializeBlocksToMarkdown,
} from '../../utils/blockUtils';

export interface BlockEditorProps {
  documentId?: string;
  initialBlocks?: BlockNode[];
  blocks?: BlockNode[];
  onChange?: (blocks: BlockNode[]) => void;
  className?: string;
}

export const BlockEditor: React.FC<BlockEditorProps> = ({
  documentId,
  initialBlocks,
  blocks: controlledBlocks,
  onChange,
  className,
}) => {
  const updateDocumentBlocks = useWorkspaceStore(
    (state) => state.updateDocumentBlocks
  );

  // 确保文档至少有一个可编辑块，并执行统一数据归一化
  const getInitialBlocks = useCallback((): BlockNode[] => {
    const raw = controlledBlocks || initialBlocks;
    if (raw && raw.length > 0) {
      return raw.map(normalizeBlock);
    }
    return [createDefaultParagraph()];
  }, [controlledBlocks, initialBlocks]);

  const [blocks, setBlocks] = useState<BlockNode[]>(getInitialBlocks);
  const blocksRef = useRef<BlockNode[]>(blocks);
  blocksRef.current = blocks;

  const [cursorFocus, setCursorFocus] = useState<{
    blockId: string;
    offset: number | 'start' | 'end';
  } | null>(() => {
    const init = getInitialBlocks();
    if (init.length === 1 && init[0].type === 'paragraph' && !init[0].content) {
      return { blockId: init[0].id, offset: 0 };
    }
    return null;
  });

  // Day 6: 批量选区与拖拽重排状态
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);
  const lastSelectedBlockIdRef = useRef<string | null>(null);
  const [dragState, setDragState] = useState<{
    draggingIds: string[];
    targetId: string | null;
    position: 'top' | 'bottom' | null;
  } | null>(null);

  // 撤销/重做历史栈
  const historyRef = useRef<BlockNode[][]>([getInitialBlocks()]);
  const historyIndexRef = useRef(0);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 记录上次激活的 documentId，确保仅在切页时重置历史，避免因父组件 Zustand 响应式重渲染引发历史清空 (P1)
  const prevDocIdRef = useRef(documentId);

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
        newBlocks.length === 0
          ? [createDefaultParagraph()]
          : newBlocks.map(normalizeBlock);
      blocksRef.current = safeBlocks;
      setBlocks(safeBlocks);
      if (onChange) {
        onChange(safeBlocks);
      } else if (documentId) {
        updateDocumentBlocks(documentId, safeBlocks);
      }

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
    [documentId, onChange, updateDocumentBlocks, pushHistory]
  );

  // 组件卸载时严格清理未完成定时器
  useEffect(() => {
    return () => {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
    };
  }, []);

  // 仅当 documentId 真实发生切换时重置历史与内部状态（例如通过切换页面）
  useEffect(() => {
    if (prevDocIdRef.current !== documentId) {
      prevDocIdRef.current = documentId;
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }

      const freshBlocks = getInitialBlocks();
      blocksRef.current = freshBlocks;
      setBlocks(freshBlocks);
      historyRef.current = [freshBlocks];
      historyIndexRef.current = 0;
      setSelectedBlockIds([]);
      lastSelectedBlockIdRef.current = null;
      setDragState(null);

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
    }
  }, [documentId, getInitialBlocks]);

  // 当初始传入的数据存在未规整属性时（如负数、小数、非法 checked），自动完成规整并同步至 Store
  useEffect(() => {
    const raw = controlledBlocks || initialBlocks;
    const fresh = getInitialBlocks();
    const needsNormalize = raw?.some((b, i) => {
      const norm = fresh[i];
      return !norm || JSON.stringify(b) !== JSON.stringify(norm);
    });
    if (needsNormalize) {
      if (onChange) {
        onChange(fresh);
      } else if (documentId) {
        updateDocumentBlocks(documentId, fresh);
      }
    }
  }, [documentId, getInitialBlocks, initialBlocks, controlledBlocks, onChange, updateDocumentBlocks]);

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
      if (onChange) {
        onChange(target);
      } else if (documentId) {
        updateDocumentBlocks(documentId, target);
      }
    }
  }, [documentId, onChange, updateDocumentBlocks]);

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
      if (onChange) {
        onChange(target);
      } else if (documentId) {
        updateDocumentBlocks(documentId, target);
      }
    }
  }, [documentId, onChange, updateDocumentBlocks]);

  // Day 6: 选中指定块（支持普通点击、Shift 连续选区、Ctrl/Cmd 增量选区）
  const handleSelectBlock = useCallback(
    (e: React.MouseEvent, blockId: string) => {
      e.stopPropagation();
      if (e.shiftKey && lastSelectedBlockIdRef.current) {
        // Shift + Click 连续范围多选
        const range = getBlocksRange(
          blocksRef.current,
          lastSelectedBlockIdRef.current,
          blockId
        );
        setSelectedBlockIds(range);
      } else if (e.metaKey || e.ctrlKey) {
        // Ctrl/Cmd + Click 单项反选/增选
        setSelectedBlockIds((prev) =>
          prev.includes(blockId)
            ? prev.filter((id) => id !== blockId)
            : [...prev, blockId]
        );
        lastSelectedBlockIdRef.current = blockId;
      } else {
        // 普通点击手柄：若已选中且唯一则取消选中，否则单选
        setSelectedBlockIds((prev) =>
          prev.length === 1 && prev[0] === blockId ? [] : [blockId]
        );
        lastSelectedBlockIdRef.current = blockId;
      }
    },
    []
  );

  // Day 6: 批量删除选中的所有块
  const handleDeleteSelectedBlocks = useCallback(() => {
    if (selectedBlockIds.length === 0) return;
    const selectedSet = new Set(selectedBlockIds);
    let next = blocksRef.current.filter((b) => !selectedSet.has(b.id));
    if (next.length === 0) {
      next = [createDefaultParagraph()];
    }
    commitBlocks(next, {
      recordHistoryNow: true,
      focus: { blockId: next[0].id, offset: 0 },
    });
    setSelectedBlockIds([]);
    lastSelectedBlockIdRef.current = null;
  }, [selectedBlockIds, commitBlocks]);

  // Day 6: 批量复制选中的所有块为 Markdown 文本
  const handleCopySelectedBlocks = useCallback(() => {
    if (selectedBlockIds.length === 0) return;
    const selectedSet = new Set(selectedBlockIds);
    const targetBlocks = blocksRef.current.filter((b) => selectedSet.has(b.id));
    const md = serializeBlocksToMarkdown(targetBlocks);
    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === 'function'
    ) {
      navigator.clipboard.writeText(md).catch(() => {});
    }
  }, [selectedBlockIds]);

  // Day 6: 拖拽起始事件 (Drag Start)
  const handleDragStart = useCallback(
    (e: React.DragEvent, _index: number, blockId: string) => {
      let draggingIds = [blockId];
      if (selectedBlockIds.includes(blockId)) {
        draggingIds = selectedBlockIds;
      } else {
        setSelectedBlockIds([blockId]);
        lastSelectedBlockIdRef.current = blockId;
      }

      setDragState({
        draggingIds,
        targetId: null,
        position: null,
      });

      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', blockId);
        e.dataTransfer.setData(
          'application/json',
          JSON.stringify({ draggingIds })
        );
      }
    },
    [selectedBlockIds]
  );

  // Day 6: 拖拽经过事件 (Drag Over)
  const handleDragOver = useCallback(
    (e: React.DragEvent, _index: number, blockId: string) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move';
      }

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const relY = e.clientY - rect.top;
      const position: 'top' | 'bottom' =
        relY < rect.height / 2 ? 'top' : 'bottom';

      setDragState((prev) => {
        if (!prev) {
          return {
            draggingIds: [blockId],
            targetId: blockId,
            position,
          };
        }
        if (prev.targetId === blockId && prev.position === position) {
          return prev;
        }
        return { ...prev, targetId: blockId, position };
      });
    },
    []
  );

  // Day 6: 拖拽离开事件 (Drag Leave)
  const handleDragLeave = useCallback(
    (_e: React.DragEvent, _index: number, _blockId: string) => {
      // 避免子节点触发闪烁，不在此处清理
    },
    []
  );

  // Day 6: 拖拽放置事件 (Drop)
  const handleDrop = useCallback(
    (e: React.DragEvent, _index: number, targetId: string) => {
      e.preventDefault();
      e.stopPropagation();

      if (!dragState || !dragState.draggingIds.length || !dragState.position) {
        setDragState(null);
        return;
      }

      const { draggingIds, position } = dragState;
      const next = reorderBlocks(
        blocksRef.current,
        draggingIds,
        targetId,
        position
      );

      if (next !== blocksRef.current) {
        commitBlocks(next, { recordHistoryNow: true });
      }

      setDragState(null);
    },
    [dragState, commitBlocks]
  );

  // Day 6: 拖拽结束事件 (Drag End)
  const handleDragEnd = useCallback(() => {
    setDragState(null);
  }, []);

  // Day 6: 全局键盘监听：批量删除 (Backspace/Delete)、取消选择 (Escape)、批量复制 (Ctrl+C)
  useEffect(() => {
    if (selectedBlockIds.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) return;

      if (e.key === 'Escape') {
        setSelectedBlockIds([]);
        lastSelectedBlockIdRef.current = null;
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        const active = document.activeElement;
        const isEditingText =
          active &&
          (active.tagName === 'INPUT' ||
            active.tagName === 'TEXTAREA' ||
            active.getAttribute('contenteditable') === 'true');

        if (!isEditingText || selectedBlockIds.length > 1) {
          e.preventDefault();
          handleDeleteSelectedBlocks();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || selectedBlockIds.length > 1) {
          handleCopySelectedBlocks();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedBlockIds,
    handleDeleteSelectedBlocks,
    handleCopySelectedBlocks,
  ]);

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

  // 更新块的属性 (如 code.language, code.wrap, callout.tone, callout.icon 等)
  const handleUpdateProperties = useCallback(
    (index: number, properties: Record<string, any>) => {
      const current = blocksRef.current;
      const cur = current[index];
      if (!cur) return;

      const next = [...current];
      next[index] = {
        ...cur,
        properties: cleanBlockProperties(cur.type, properties) || properties,
      };
      commitBlocks(next, { recordHistoryNow: true });
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
        const isPrevList = isListType(cur.type);
        const level = isPrevList ? getBlockLevel(cur) : 0;
        const newProperties: Record<string, any> = cleanBlockProperties(newType, cur.properties) || {};
        newProperties.level = level;
        if (newType === 'todo') {
          newProperties.checked = normalizeChecked(cur.properties?.checked);
        } else {
          delete newProperties.checked;
        }

        next[index] = {
          ...cur,
          type: newType,
          content: cur.type === 'divider' ? '' : cur.content,
          properties: newProperties,
        };
        focus = { blockId: cur.id, offset: 'end' };
      } else if (newType === 'code') {
        next[index] = {
          ...cur,
          type: 'code',
          content: cur.type === 'divider' ? '' : cur.content,
          properties: cleanBlockProperties('code', cur.properties) || {
            language: 'javascript',
            wrap: false,
          },
        };
        focus = { blockId: cur.id, offset: 'end' };
      } else if (newType === 'callout') {
        next[index] = {
          ...cur,
          type: 'callout',
          content: cur.type === 'divider' ? '' : cur.content,
          properties: cleanBlockProperties('callout', cur.properties) || {
            icon: '💡',
            tone: 'neutral',
          },
        };
        focus = { blockId: cur.id, offset: 'end' };
      } else if (newType === 'database') {
        let dbId = cur.properties?.databaseId;
        if (!dbId || typeof dbId !== 'string') {
          const createDb = useWorkspaceStore.getState().createDatabase;
          dbId = createDb(cur.content.trim() || '未命名数据库');
        }
        next[index] = {
          ...cur,
          type: 'database',
          content: '',
          properties: {
            databaseId: dbId,
          },
        };
        focus = null;
      } else {
        // 非列表/代码/提示块类型 (paragraph, heading1/2/3, quote 等) 彻底剥除专属属性
        const cleanedProperties = cleanBlockProperties(newType, cur.properties);
        next[index] = {
          ...cur,
          type: newType,
          content: cur.type === 'divider' ? '' : cur.content,
          properties: cleanedProperties,
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
            properties: cleanNonListProperties(cur.properties),
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

      // 引用块 (quote) 回车拆分或退出
      if (cur.type === 'quote') {
        if (cur.content.trim() === '') {
          // 空引用块按回车：降级退出为普通段落
          next[index] = {
            ...cur,
            type: 'paragraph',
            properties: cleanBlockProperties('paragraph', cur.properties),
          };
          commitBlocks(next, {
            recordHistoryNow: true,
            focus: { blockId: cur.id, offset: 0 },
          });
          return;
        }

        if (offset === 0 && cur.content.length > 0) {
          const emptyBlock: BlockNode = {
            id: generateBlockId(),
            type: 'quote',
            content: '',
          };
          next.splice(index, 0, emptyBlock);
          commitBlocks(next, {
            recordHistoryNow: true,
            focus: { blockId: cur.id, offset: 0 },
          });
          return;
        }

        const leftContent = cur.content.slice(0, offset);
        const rightContent = cur.content.slice(offset);
        const newBlock: BlockNode = {
          id: generateBlockId(),
          type: 'quote',
          content: rightContent,
        };
        next[index] = { ...cur, content: leftContent };
        next.splice(index + 1, 0, newBlock);
        commitBlocks(next, {
          recordHistoryNow: true,
          focus: { blockId: newBlock.id, offset: 0 },
        });
        return;
      }

      // 提示块 (callout) 回车拆分或退出
      if (cur.type === 'callout') {
        if (cur.content.trim() === '') {
          // 空提示块按回车：降级退出为普通段落
          next[index] = {
            ...cur,
            type: 'paragraph',
            properties: cleanBlockProperties('paragraph', cur.properties),
          };
          commitBlocks(next, {
            recordHistoryNow: true,
            focus: { blockId: cur.id, offset: 0 },
          });
          return;
        }

        const tone = cur.properties?.tone;
        const icon = cur.properties?.icon;

        if (offset === 0 && cur.content.length > 0) {
          const emptyBlock: BlockNode = {
            id: generateBlockId(),
            type: 'callout',
            content: '',
            properties: {
              ...(icon ? { icon } : {}),
              ...(tone ? { tone } : {}),
            },
          };
          next.splice(index, 0, emptyBlock);
          commitBlocks(next, {
            recordHistoryNow: true,
            focus: { blockId: cur.id, offset: 0 },
          });
          return;
        }

        const leftContent = cur.content.slice(0, offset);
        const rightContent = cur.content.slice(offset);
        const newBlock: BlockNode = {
          id: generateBlockId(),
          type: 'callout',
          content: rightContent,
          properties: {
            ...(icon ? { icon } : {}),
            ...(tone ? { tone } : {}),
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

      // 代码块 (code) 退格处理：空代码块降级为普通段落
      if (cur.type === 'code') {
        if (cur.content.length === 0) {
          next[index] = {
            ...cur,
            type: 'paragraph',
            properties: cleanBlockProperties('paragraph', cur.properties),
          };
          commitBlocks(next, {
            recordHistoryNow: true,
            focus: { blockId: cur.id, offset: 0 },
          });
        }
        return;
      }

      // 提示块 (callout) 退格处理：空提示块降级为普通段落；非空块首退格不合入上一块，仅将光标移至上一块末尾
      if (cur.type === 'callout') {
        if (cur.content.length === 0) {
          next[index] = {
            ...cur,
            type: 'paragraph',
            properties: cleanBlockProperties('paragraph', cur.properties),
          };
          commitBlocks(next, {
            recordHistoryNow: true,
            focus: { blockId: cur.id, offset: 0 },
          });
          return;
        }
        if (index > 0 && next[index - 1]) {
          setCursorFocus({ blockId: next[index - 1].id, offset: 'end' });
        }
        return;
      }

      // 引用块 (quote) 退格处理：空引用或首块降级为普通段落；非空向可合并文本前项合并
      if (cur.type === 'quote') {
        if (cur.content.length === 0 || index === 0) {
          next[index] = {
            ...cur,
            type: 'paragraph',
            properties: cleanBlockProperties('paragraph', cur.properties),
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
          next.splice(index - 1, 1);
          commitBlocks(next, {
            recordHistoryNow: true,
            focus: { blockId: cur.id, offset: 0 },
          });
          return;
        }

        if (!isTextMergeable(prevBlock.type)) {
          setCursorFocus({ blockId: prevBlock.id, offset: 'end' });
          return;
        }

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
            properties: cleanNonListProperties(cur.properties),
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

        if (!isTextMergeable(prevBlock.type)) {
          if (cur.content.length === 0) {
            next[index] = {
              ...cur,
              type: 'paragraph',
              properties: cleanNonListProperties(cur.properties),
            };
            commitBlocks(next, {
              recordHistoryNow: true,
              focus: { blockId: cur.id, offset: 0 },
            });
            return;
          }
          setCursorFocus({ blockId: prevBlock.id, offset: 'end' });
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
        next[index] = {
          ...cur,
          type: 'paragraph',
          properties: cleanNonListProperties(cur.properties),
        };
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

      // 如果上一块非可合并文本块（例如代码块、提示块等独立容器），严格保持容器边界：
      // 若当前块为空，则删除多余空白块并转移焦点至上一块末尾；若非空，严格禁止文本合入容器，仅安全转移光标
      if (!isTextMergeable(prevBlock.type)) {
        if (cur.content.length === 0) {
          next.splice(index, 1);
          commitBlocks(next, {
            recordHistoryNow: true,
            focus: { blockId: prevBlock.id, offset: 'end' },
          });
          return;
        }
        setCursorFocus({ blockId: prevBlock.id, offset: 'end' });
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

  const editorContainerRef = useRef<HTMLDivElement>(null);

  // Day 5: Slash Command (/) 状态与键盘流转
  const [slashMenuState, setSlashMenuState] = useState<{
    isOpen: boolean;
    blockIndex: number;
    slashIndex: number;
    query: string;
    position: { top: number; left: number };
  }>({
    isOpen: false,
    blockIndex: -1,
    slashIndex: -1,
    query: '',
    position: { top: 0, left: 0 },
  });
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);

  const handleSlashTrigger = useCallback(
    (index: number, query: string, position: { top: number; left: number }, slashIndex: number) => {
      setSlashMenuState({
        isOpen: true,
        blockIndex: index,
        slashIndex,
        query,
        position,
      });
      setSlashSelectedIndex(0);
    },
    []
  );

  const handleSlashClose = useCallback(() => {
    setSlashMenuState((prev) => (prev.isOpen ? { ...prev, isOpen: false } : prev));
  }, []);

  const handleSelectSlashCommand = useCallback(
    (item: SlashCommandItem) => {
      const { blockIndex, slashIndex, query } = slashMenuState;
      if (blockIndex < 0 || blockIndex >= blocksRef.current.length) {
        setSlashMenuState((prev) => ({ ...prev, isOpen: false }));
        return;
      }

      const curBlock = blocksRef.current[blockIndex];
      // 清除正文中的 `/<query>` 或 `、<query>`
      const cleanedContent = stripSlashCommand(curBlock.content, slashIndex, query.length);

      const next = [...blocksRef.current];
      let focus: { blockId: string; offset: number | 'start' | 'end' } | null = null;

      if (item.type === 'divider') {
        next[blockIndex] = { ...curBlock, type: 'divider', content: '', properties: undefined };
        // 如果是最后一个块，自动在其后追加一个段落以供继续输入
        if (blockIndex === next.length - 1) {
          const extra = createDefaultParagraph();
          next.push(extra);
          focus = { blockId: extra.id, offset: 0 };
        } else {
          const nextBlock = next[blockIndex + 1];
          if (nextBlock) {
            focus = { blockId: nextBlock.id, offset: 'start' };
          }
        }
      } else if (isListType(item.type)) {
        const isPrevList = isListType(curBlock.type);
        const level = isPrevList ? getBlockLevel(curBlock) : 0;
        const newProperties: Record<string, any> = cleanBlockProperties(item.type, curBlock.properties) || {};
        newProperties.level = level;
        if (item.type === 'todo') {
          newProperties.checked = normalizeChecked(curBlock.properties?.checked);
        } else {
          delete newProperties.checked;
        }

        next[blockIndex] = {
          ...curBlock,
          type: item.type,
          content: curBlock.type === 'divider' ? '' : cleanedContent,
          properties: newProperties,
        };
        focus = { blockId: curBlock.id, offset: cleanedContent.length };
      } else if (item.type === 'code') {
        next[blockIndex] = {
          ...curBlock,
          type: 'code',
          content: curBlock.type === 'divider' ? '' : cleanedContent,
          properties: cleanBlockProperties('code', curBlock.properties) || {
            language: 'javascript',
            wrap: false,
          },
        };
        focus = { blockId: curBlock.id, offset: cleanedContent.length };
      } else if (item.type === 'callout') {
        next[blockIndex] = {
          ...curBlock,
          type: 'callout',
          content: curBlock.type === 'divider' ? '' : cleanedContent,
          properties: cleanBlockProperties('callout', curBlock.properties) || {
            icon: '💡',
            tone: 'neutral',
          },
        };
        focus = { blockId: curBlock.id, offset: cleanedContent.length };
      } else if (item.type === 'database') {
        let dbId = curBlock.properties?.databaseId;
        if (!dbId || typeof dbId !== 'string') {
          const createDb = useWorkspaceStore.getState().createDatabase;
          dbId = createDb(cleanedContent.trim() || '未命名数据库');
        }
        next[blockIndex] = {
          ...curBlock,
          type: 'database',
          content: '',
          properties: {
            databaseId: dbId,
          },
        };
        focus = null;
      } else {
        const cleanedProperties = cleanBlockProperties(item.type, curBlock.properties);
        next[blockIndex] = {
          ...curBlock,
          type: item.type,
          content: curBlock.type === 'divider' ? '' : cleanedContent,
          properties: cleanedProperties,
        };
        focus = { blockId: curBlock.id, offset: cleanedContent.length };
      }

      commitBlocks(next, {
        recordHistoryNow: true,
        focus: focus || undefined,
      });

      setSlashMenuState((prev) => ({ ...prev, isOpen: false }));
    },
    [slashMenuState, commitBlocks]
  );

  const handleSlashKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!slashMenuState.isOpen) return false;

      const filtered = filterSlashCommands(slashMenuState.query);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
        return true;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
        return true;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (filtered[slashSelectedIndex]) {
          handleSelectSlashCommand(filtered[slashSelectedIndex]);
        }
        return true;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSlashMenuState((prev) => ({ ...prev, isOpen: false }));
        return true;
      }

      return false;
    },
    [slashMenuState, slashSelectedIndex, handleSelectSlashCommand]
  );

  // Day 5: 选中文字浮动菜单 (Bubble Menu) 状态与处理器
  const savedSelectionRangeRef = useRef<Range | null>(null);
  const [bubbleMenuState, setBubbleMenuState] = useState<{
    isOpen: boolean;
    blockId: string;
    position: { top: number; left: number };
    formats: FormatStates;
  }>({
    isOpen: false,
    blockId: '',
    position: { top: 0, left: 0 },
    formats: {
      bold: false,
      italic: false,
      underline: false,
      strikethrough: false,
      code: false,
      link: false,
    },
  });
  const bubbleMenuStateRef = useRef(bubbleMenuState);
  bubbleMenuStateRef.current = bubbleMenuState;

  const closeBubbleMenu = useCallback(() => {
    if (bubbleMenuStateRef.current.isOpen) {
      setBubbleMenuState((prev) => (prev.isOpen ? { ...prev, isOpen: false } : prev));
    }
  }, []);

  const updateBubbleMenu = useCallback(() => {
    if (typeof window === 'undefined') return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) {
      // 若焦点处于浮动工具栏内（例如正在超链接输入框中输入），严防关闭菜单与丢失暂存选区
      if (
        typeof document !== 'undefined' &&
        document.activeElement &&
        document.activeElement.closest('[role="toolbar"]')
      ) {
        return;
      }
      closeBubbleMenu();
      return;
    }

    const selectedText = sel.toString().trim();
    if (!selectedText) {
      if (
        typeof document !== 'undefined' &&
        document.activeElement &&
        document.activeElement.closest('[role="toolbar"]')
      ) {
        return;
      }
      closeBubbleMenu();
      return;
    }

    const range = sel.getRangeAt(0);
    const editorContainer = editorContainerRef.current;
    if (!editorContainer || !editorContainer.contains(range.commonAncestorContainer)) {
      closeBubbleMenu();
      return;
    }

    const node = range.commonAncestorContainer;
    const blockEl = (
      node.nodeType === Node.ELEMENT_NODE
        ? (node as HTMLElement)
        : node.parentElement
    )?.closest('[data-block-id]') as HTMLElement | null;

    if (!blockEl) {
      closeBubbleMenu();
      return;
    }

    if (blockEl.closest('[data-block-code-id]')) {
      closeBubbleMenu();
      return;
    }

    // 捕获并克隆当前有效选区供工具栏格式化与超链接使用
    savedSelectionRangeRef.current = range.cloneRange();

    const rect = range.getBoundingClientRect();
    const blockId = blockEl.getAttribute('data-block-id') || '';

    const isBold = typeof document.queryCommandState === 'function' ? document.queryCommandState('bold') : false;
    const isItalic = typeof document.queryCommandState === 'function' ? document.queryCommandState('italic') : false;
    const isUnderline = typeof document.queryCommandState === 'function' ? document.queryCommandState('underline') : false;
    const isStrike = typeof document.queryCommandState === 'function' ? document.queryCommandState('strikeThrough') : false;

    let parent: Node | null = range.commonAncestorContainer;
    let isCode = false;
    let isLink = false;
    let linkUrl = '';

    while (parent && parent !== blockEl) {
      if (parent.nodeType === Node.ELEMENT_NODE) {
        const el = parent as HTMLElement;
        if (el.tagName === 'CODE') isCode = true;
        if (el.tagName === 'A') {
          isLink = true;
          linkUrl = el.getAttribute('href') || '';
        }
      }
      parent = parent.parentNode;
    }

    setBubbleMenuState({
      isOpen: true,
      blockId,
      position: {
        top: rect.top,
        left: rect.left + rect.width / 2,
      },
      formats: {
        bold: isBold,
        italic: isItalic,
        underline: isUnderline,
        strikethrough: isStrike,
        code: isCode,
        link: isLink,
        linkUrl,
      },
    });
  }, []);

  useEffect(() => {
    const handleSelectionChange = () => {
      updateBubbleMenu();
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [updateBubbleMenu]);

  const handleFormat = useCallback(
    (format: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'code') => {
      let sel = window.getSelection();
      if ((!sel || sel.isCollapsed || !sel.rangeCount) && savedSelectionRangeRef.current) {
        sel?.removeAllRanges();
        sel?.addRange(savedSelectionRangeRef.current);
        sel = window.getSelection();
      }
      if (!sel || sel.isCollapsed || !sel.rangeCount) return;

      if (typeof document.execCommand === 'function') {
        try {
          if (format === 'bold') {
            document.execCommand('bold', false);
          } else if (format === 'italic') {
            document.execCommand('italic', false);
          } else if (format === 'underline') {
            document.execCommand('underline', false);
          } else if (format === 'strikethrough') {
            document.execCommand('strikeThrough', false);
          }
        } catch {}
      }

      if (format === 'code') {
        const range = sel.getRangeAt(0);
        let codeParent: HTMLElement | null = null;
        let p: Node | null = range.commonAncestorContainer;
        while (p && p.nodeType !== Node.DOCUMENT_NODE) {
          if (p.nodeType === Node.ELEMENT_NODE && (p as HTMLElement).tagName === 'CODE') {
            codeParent = p as HTMLElement;
            break;
          }
          p = p.parentNode;
        }

        if (codeParent) {
          const text = codeParent.innerText || codeParent.textContent || '';
          const textNode = document.createTextNode(text);
          codeParent.parentNode?.replaceChild(textNode, codeParent);
        } else {
          const codeEl = document.createElement('code');
          try {
            range.surroundContents(codeEl);
          } catch {
            const contents = range.extractContents();
            codeEl.appendChild(contents);
            range.insertNode(codeEl);
          }
        }
      }

      if (bubbleMenuState.blockId) {
        const blockEl = document.querySelector(`[data-block-id="${bubbleMenuState.blockId}"]`) as HTMLElement;
        if (blockEl) {
          const index = blocksRef.current.findIndex((b) => b.id === bubbleMenuState.blockId);
          if (index !== -1) {
            const hasHtml = /<[a-z][\s\S]*>/i.test(blockEl.innerHTML);
            const val = hasHtml ? sanitizeHtml(blockEl.innerHTML) : (blockEl.innerText ?? blockEl.textContent ?? '');
            const current = blocksRef.current;
            const target = current[index];
            if (target && target.content !== val) {
              const next = [...current];
              next[index] = { ...target, content: val };
              commitBlocks(next, { recordHistoryNow: true });
            }
          }
        }
      }

      setTimeout(updateBubbleMenu, 10);
    },
    [bubbleMenuState.blockId, commitBlocks, updateBubbleMenu]
  );

  const handleSetLink = useCallback(
    (url: string) => {
      let sel = window.getSelection();
      if ((!sel || sel.isCollapsed || !sel.rangeCount) && savedSelectionRangeRef.current) {
        sel?.removeAllRanges();
        sel?.addRange(savedSelectionRangeRef.current);
        sel = window.getSelection();
      }
      if (!sel || !sel.rangeCount) return;

      const range = sel.getRangeAt(0);
      let aParent: HTMLElement | null = null;
      let p: Node | null = range.commonAncestorContainer;
      while (p && p.nodeType !== Node.DOCUMENT_NODE) {
        if (p.nodeType === Node.ELEMENT_NODE && (p as HTMLElement).tagName === 'A') {
          aParent = p as HTMLElement;
          break;
        }
        p = p.parentNode;
      }

      if (aParent) {
        aParent.setAttribute('href', url);
        aParent.setAttribute('target', '_blank');
        aParent.setAttribute('rel', 'noopener noreferrer');
      } else {
        if (typeof document.execCommand === 'function') {
          try {
            document.execCommand('createLink', false, url);
          } catch {}
        }

        // 安全遍历修改新创建的 <a> 标签属性；若 execCommand 未生效（如 jsdom 环境），降级为 Range DOM 包裹
        const containerNode = range.commonAncestorContainer;
        const parentEl =
          containerNode.nodeType === Node.ELEMENT_NODE
            ? (containerNode as HTMLElement)
            : containerNode.parentElement;
        let found = false;
        if (parentEl) {
          const anchorList = parentEl.getElementsByTagName('a');
          for (let i = 0; i < anchorList.length; i++) {
            const a = anchorList[i];
            if (a.getAttribute('href') === url) {
              a.setAttribute('target', '_blank');
              a.setAttribute('rel', 'noopener noreferrer');
              found = true;
            }
          }
        }

        if (!found) {
          try {
            const a = document.createElement('a');
            a.setAttribute('href', url);
            a.setAttribute('target', '_blank');
            a.setAttribute('rel', 'noopener noreferrer');
            try {
              range.surroundContents(a);
            } catch {
              const contents = range.extractContents();
              a.appendChild(contents);
              range.insertNode(a);
            }
          } catch {}
        }
      }

      if (bubbleMenuState.blockId) {
        const blockEl = document.querySelector(`[data-block-id="${bubbleMenuState.blockId}"]`) as HTMLElement;
        if (blockEl) {
          const index = blocksRef.current.findIndex((b) => b.id === bubbleMenuState.blockId);
          if (index !== -1) {
            const val = sanitizeHtml(blockEl.innerHTML);
            const current = blocksRef.current;
            const target = current[index];
            if (target && target.content !== val) {
              const next = [...current];
              next[index] = { ...target, content: val };
              commitBlocks(next, { recordHistoryNow: true });
            }
          }
        }
      }

      setTimeout(updateBubbleMenu, 10);
    },
    [bubbleMenuState.blockId, commitBlocks, updateBubbleMenu]
  );

  const handleUnlink = useCallback(() => {
    let sel = window.getSelection();
    if ((!sel || sel.isCollapsed || !sel.rangeCount) && savedSelectionRangeRef.current) {
      sel?.removeAllRanges();
      sel?.addRange(savedSelectionRangeRef.current);
      sel = window.getSelection();
    }
    if (typeof document.execCommand === 'function') {
      try {
        document.execCommand('unlink', false);
      } catch {}
    }
    if (bubbleMenuState.blockId) {
      const blockEl = document.querySelector(`[data-block-id="${bubbleMenuState.blockId}"]`) as HTMLElement;
      if (blockEl) {
        const index = blocksRef.current.findIndex((b) => b.id === bubbleMenuState.blockId);
        if (index !== -1) {
          const val = sanitizeHtml(blockEl.innerHTML);
          const current = blocksRef.current;
          const target = current[index];
          if (target && target.content !== val) {
            const next = [...current];
            next[index] = { ...target, content: val };
            commitBlocks(next, { recordHistoryNow: true });
          }
        }
      }
    }
    setTimeout(updateBubbleMenu, 10);
  }, [bubbleMenuState.blockId, commitBlocks, updateBubbleMenu]);

  // 点击空白底部：聚焦最后一个块或追加新段落，并清空多选状态
  const handleBottomClick = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    setSelectedBlockIds([]);
    lastSelectedBlockIdRef.current = null;

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
      ref={editorContainerRef}
      className={cn("space-y-1 mt-4 min-h-[300px] cursor-text pb-24 relative", className)}
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
          isSelected={selectedBlockIds.includes(block.id)}
          isDragging={dragState?.draggingIds.includes(block.id)}
          dropPosition={
            dragState?.targetId === block.id &&
            !dragState.draggingIds.includes(block.id)
              ? dragState.position
              : null
          }
          onSelectBlock={handleSelectBlock}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}
          onClearCursorFocus={() => setCursorFocus(null)}
          onChangeContent={(content) => handleChangeContent(idx, content)}
          onChangeType={(newType) => handleChangeType(idx, newType)}
          onUpdateProperties={(props) => handleUpdateProperties(idx, props)}
          onSplit={(offset) => handleSplit(idx, offset)}
          onMergeUp={() => handleMergeUp(idx)}
          onIndent={() => handleIndent(idx)}
          onOutdent={() => handleOutdent(idx)}
          onFocusPrevious={() => handleFocusPrevious(idx)}
          onFocusNext={() => handleFocusNext(idx)}
          onPaste={(text, offset) => handlePaste(idx, text, offset)}
          onDelete={() => handleDeleteBlock(idx)}
          onInsertBelow={(type?: BlockType) => handleInsertBelow(idx, type)}
          onToggleTodo={() => handleToggleTodo(idx)}
          onUndo={handleUndo}
          onRedo={handleRedo}
          isSlashMenuOpen={slashMenuState.isOpen && slashMenuState.blockIndex === idx}
          onSlashTrigger={(query, pos, slashIndex) =>
            handleSlashTrigger(idx, query, pos, slashIndex)
          }
          onSlashClose={handleSlashClose}
          onSlashKeyDown={handleSlashKeyDown}
        />
      ))}

      {/* Day 5: 快捷斜杠指令浮层 */}
      <SlashCommandMenu
        isOpen={slashMenuState.isOpen}
        query={slashMenuState.query}
        position={slashMenuState.position}
        selectedIndex={slashSelectedIndex}
        onSelect={handleSelectSlashCommand}
        onClose={handleSlashClose}
        onHoverIndex={setSlashSelectedIndex}
      />

      {/* Day 5: 划选富文本浮动工具栏 */}
      <BubbleMenu
        isOpen={bubbleMenuState.isOpen}
        position={bubbleMenuState.position}
        formats={bubbleMenuState.formats}
        onFormat={handleFormat}
        onSetLink={handleSetLink}
        onUnlink={handleUnlink}
        onClose={() => setBubbleMenuState((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Day 6: 批量操作悬浮条 */}
      <BatchActionBar
        selectedCount={selectedBlockIds.length}
        onCopy={handleCopySelectedBlocks}
        onDelete={handleDeleteSelectedBlocks}
        onClear={() => {
          setSelectedBlockIds([]);
          lastSelectedBlockIdRef.current = null;
        }}
      />
    </div>
  );
};
