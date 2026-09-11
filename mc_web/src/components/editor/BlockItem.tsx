import React, { useState } from 'react';
import {
  Plus,
  MoreVertical,
  CheckSquare,
  Square,
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  Minus,
  List,
  ListOrdered,
} from 'lucide-react';
import { BlockNode, BlockType } from '../../types/document';
import { TextBlock } from './TextBlock';
import { DividerBlock } from './DividerBlock';
import { BlockTypeSelector } from './BlockTypeSelector';
import { cn } from '../../utils/cn';

interface BlockItemProps {
  block: BlockNode;
  index: number;
  totalCount: number;
  orderNumber?: number;
  cursorFocus?: { offset: number | 'start' | 'end' } | null;
  onClearCursorFocus?: () => void;
  onChangeContent: (content: string) => void;
  onChangeType: (type: BlockType) => void;
  onSplit: (offset: number) => void;
  onMergeUp: () => void;
  onIndent?: () => void;
  onOutdent?: () => void;
  onFocusPrevious?: () => void;
  onFocusNext?: () => void;
  onPaste: (text: string, offset: number) => void;
  onDelete: () => void;
  onInsertBelow: () => void;
  onToggleTodo?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
}

export const BlockItem: React.FC<BlockItemProps> = ({
  block,
  index,
  totalCount: _totalCount,
  orderNumber,
  cursorFocus,
  onClearCursorFocus,
  onChangeContent,
  onChangeType,
  onSplit,
  onMergeUp,
  onIndent,
  onOutdent,
  onFocusPrevious,
  onFocusNext,
  onPaste,
  onDelete,
  onInsertBelow,
  onToggleTodo,
  onUndo,
  onRedo,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const level = Math.max(0, Number(block.properties?.level) || 0);
  const indentStyle = level > 0 ? { paddingLeft: `${level * 24}px` } : undefined;

  const getTypeIcon = () => {
    switch (block.type) {
      case 'heading1':
        return <Heading1 className="w-3.5 h-3.5" />;
      case 'heading2':
        return <Heading2 className="w-3.5 h-3.5" />;
      case 'heading3':
        return <Heading3 className="w-3.5 h-3.5" />;
      case 'divider':
        return <Minus className="w-3.5 h-3.5" />;
      case 'bulletList':
        return <List className="w-3.5 h-3.5" />;
      case 'numberedList':
        return <ListOrdered className="w-3.5 h-3.5" />;
      case 'todo':
        return <CheckSquare className="w-3.5 h-3.5" />;
      default:
        return <Pilcrow className="w-3.5 h-3.5" />;
    }
  };

  const renderContent = () => {
    switch (block.type) {
      case 'heading1':
      case 'heading2':
      case 'heading3':
      case 'paragraph':
        return (
          <TextBlock
            id={block.id}
            type={block.type}
            content={block.content}
            cursorFocus={cursorFocus}
            onClearCursorFocus={onClearCursorFocus}
            onChange={onChangeContent}
            onSplit={onSplit}
            onMergeUp={onMergeUp}
            onIndent={onIndent}
            onOutdent={onOutdent}
            onFocusPrevious={onFocusPrevious}
            onFocusNext={onFocusNext}
            onPaste={onPaste}
            onUndo={onUndo}
            onRedo={onRedo}
          />
        );

      case 'divider':
        return (
          <DividerBlock
            id={block.id}
            isFocused={isFocused}
            onFocus={() => setIsFocused(true)}
            onDelete={onDelete}
            onEnter={onInsertBelow}
            onFocusPrevious={onFocusPrevious}
            onFocusNext={onFocusNext}
          />
        );

      case 'bulletList':
        return (
          <div
            style={indentStyle}
            className="flex items-start gap-2 pl-2 transition-all"
          >
            <span className="text-text-muted-light dark:text-text-muted-dark select-none mt-1 leading-none font-bold text-base w-3.5 text-center flex-shrink-0">
              {level % 2 === 0 ? '•' : '◦'}
            </span>
            <div className="flex-1 min-w-0">
              <TextBlock
                id={block.id}
                type="paragraph"
                content={block.content}
                cursorFocus={cursorFocus}
                onClearCursorFocus={onClearCursorFocus}
                onChange={onChangeContent}
                onSplit={onSplit}
                onMergeUp={onMergeUp}
                onIndent={onIndent}
                onOutdent={onOutdent}
                onFocusPrevious={onFocusPrevious}
                onFocusNext={onFocusNext}
                onPaste={onPaste}
                onUndo={onUndo}
                onRedo={onRedo}
              />
            </div>
          </div>
        );

      case 'numberedList':
        return (
          <div
            style={indentStyle}
            className="flex items-start gap-2 pl-1 transition-all"
          >
            <span className="text-text-muted-light dark:text-text-muted-dark select-none min-w-[1.5rem] text-right font-medium text-sm leading-relaxed py-1 flex-shrink-0 font-mono">
              {`${orderNumber ?? 1}.`}
            </span>
            <div className="flex-1 min-w-0">
              <TextBlock
                id={block.id}
                type="paragraph"
                content={block.content}
                cursorFocus={cursorFocus}
                onClearCursorFocus={onClearCursorFocus}
                onChange={onChangeContent}
                onSplit={onSplit}
                onMergeUp={onMergeUp}
                onIndent={onIndent}
                onOutdent={onOutdent}
                onFocusPrevious={onFocusPrevious}
                onFocusNext={onFocusNext}
                onPaste={onPaste}
                onUndo={onUndo}
                onRedo={onRedo}
              />
            </div>
          </div>
        );

      case 'todo':
        const isChecked = !!block.properties?.checked;
        return (
          <div
            style={indentStyle}
            className="flex items-start gap-2.5 py-0.5 group/todo transition-all"
          >
            <button
              type="button"
              onClick={onToggleTodo}
              role="checkbox"
              aria-checked={isChecked}
              aria-label={isChecked ? '标记为未完成' : '标记为已完成'}
              className="mt-1 text-text-muted-light dark:text-text-muted-dark hover:text-blue-500 transition-colors flex-shrink-0"
            >
              {isChecked ? (
                <CheckSquare className="w-4 h-4 text-blue-500 fill-blue-500/20" />
              ) : (
                <Square className="w-4 h-4" />
              )}
            </button>
            <div
              className={cn(
                'flex-1 min-w-0 transition-opacity',
                isChecked &&
                  'line-through text-text-muted-light dark:text-text-muted-dark opacity-60'
              )}
            >
              <TextBlock
                id={block.id}
                type="paragraph"
                content={block.content}
                cursorFocus={cursorFocus}
                onClearCursorFocus={onClearCursorFocus}
                onChange={onChangeContent}
                onSplit={onSplit}
                onMergeUp={onMergeUp}
                onIndent={onIndent}
                onOutdent={onOutdent}
                onFocusPrevious={onFocusPrevious}
                onFocusNext={onFocusNext}
                onPaste={onPaste}
                onUndo={onUndo}
                onRedo={onRedo}
              />
            </div>
          </div>
        );

      case 'callout':
        return (
          <div className="p-3.5 rounded-xl bg-sidebar-light dark:bg-sidebar-dark border border-border-light dark:border-border-dark flex items-start gap-3 my-2">
            <span className="text-lg select-none">
              {block.properties?.icon || '💡'}
            </span>
            <div className="flex-1 min-w-0">
              <TextBlock
                id={block.id}
                type="paragraph"
                content={block.content}
                cursorFocus={cursorFocus}
                onClearCursorFocus={onClearCursorFocus}
                onChange={onChangeContent}
                onSplit={onSplit}
                onMergeUp={onMergeUp}
                onIndent={onIndent}
                onOutdent={onOutdent}
                onFocusPrevious={onFocusPrevious}
                onFocusNext={onFocusNext}
                onPaste={onPaste}
                onUndo={onUndo}
                onRedo={onRedo}
              />
            </div>
          </div>
        );

      default:
        // 未知块类型保底渲染，保证数据无损
        return (
          <div className="p-2 border border-dashed border-border-light dark:border-border-dark rounded-lg">
            <div className="text-[10px] text-text-muted-light uppercase font-mono">
              {block.type}
            </div>
            <TextBlock
              id={block.id}
              type="paragraph"
              content={block.content}
              cursorFocus={cursorFocus}
              onClearCursorFocus={onClearCursorFocus}
              onChange={onChangeContent}
              onSplit={onSplit}
              onMergeUp={onMergeUp}
              onIndent={onIndent}
              onOutdent={onOutdent}
              onFocusPrevious={onFocusPrevious}
              onFocusNext={onFocusNext}
              onPaste={onPaste}
              onUndo={onUndo}
              onRedo={onRedo}
            />
          </div>
        );
    }
  };

  return (
    <div
      data-block-wrapper-id={block.id}
      data-block-index={index}
      className="group/block relative flex items-start -ml-12 pl-12 transition-colors rounded-lg"
    >
      {/* 悬浮操作把手（Hover Action Bar） */}
      <div className="absolute left-1 top-1 opacity-0 group-hover/block:opacity-100 flex items-center gap-0.5 transition-opacity select-none z-10">
        {/* 快速在下方新增段落 */}
        <button
          type="button"
          onClick={onInsertBelow}
          title="在下方插入新块"
          className="p-1 rounded text-text-muted-light hover:text-text-primary-light dark:text-text-muted-dark dark:hover:text-text-primary-dark hover:bg-sidebar-hover-light dark:hover:bg-sidebar-hover-dark transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>

        {/* 块类型选择器触发器 */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            title="切换块类型或操作"
            className="p-1 rounded text-text-muted-light hover:text-text-primary-light dark:text-text-muted-dark dark:hover:text-text-primary-dark hover:bg-sidebar-hover-light dark:hover:bg-sidebar-hover-dark transition-colors flex items-center gap-0.5"
          >
            {getTypeIcon()}
            <MoreVertical className="w-3 h-3 opacity-60" />
          </button>

          <BlockTypeSelector
            currentType={block.type}
            isOpen={isMenuOpen}
            onClose={() => setIsMenuOpen(false)}
            onSelectType={onChangeType}
            onDelete={onDelete}
          />
        </div>
      </div>

      {/* 核心内容区 */}
      <div className="flex-1 min-w-0">{renderContent()}</div>
    </div>
  );
};
