import React, { useState } from 'react';
import {
  Plus,
  MoreVertical,
  GripVertical,
  CheckSquare,
  Square,
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  Minus,
  List,
  ListOrdered,
  Code,
  Quote,
  Lightbulb,
  Table,
} from 'lucide-react';
import { BlockNode, BlockType } from '../../types/document';
import { TextBlock } from './TextBlock';
import { DividerBlock } from './DividerBlock';
import { BlockTypeSelector } from './BlockTypeSelector';
import { CodeBlock } from './CodeBlock';
import { QuoteBlock } from './QuoteBlock';
import { CalloutBlock } from './CalloutBlock';
import { DatabaseBlock } from './DatabaseBlock';
import { cn } from '../../utils/cn';
import { normalizeLevel, normalizeChecked } from '../../utils/blockUtils';

interface BlockItemProps {
  block: BlockNode;
  index: number;
  totalCount: number;
  orderNumber?: number;
  cursorFocus?: { offset: number | 'start' | 'end' } | null;
  isSelected?: boolean;
  isDragging?: boolean;
  dropPosition?: 'top' | 'bottom' | null;
  onSelectBlock?: (e: React.MouseEvent, blockId: string) => void;
  onDragStart?: (e: React.DragEvent, index: number, blockId: string) => void;
  onDragOver?: (e: React.DragEvent, index: number, blockId: string) => void;
  onDragLeave?: (e: React.DragEvent, index: number, blockId: string) => void;
  onDrop?: (e: React.DragEvent, index: number, blockId: string) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onClearCursorFocus?: () => void;
  onChangeContent: (content: string) => void;
  onChangeType: (type: BlockType) => void;
  onUpdateProperties?: (properties: Record<string, any>) => void;
  onSplit: (offset: number) => void;
  onMergeUp: () => void;
  onIndent?: () => void;
  onOutdent?: () => void;
  onFocusPrevious?: () => void;
  onFocusNext?: () => void;
  onPaste: (text: string, offset: number) => void;
  onDelete: () => void;
  onInsertBelow: (type?: BlockType) => void;
  onToggleTodo?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  isSlashMenuOpen?: boolean;
  onSlashTrigger?: (query: string, position: { top: number; left: number }, slashIndex: number) => void;
  onSlashClose?: () => void;
  onSlashKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => boolean;
}

export const BlockItem: React.FC<BlockItemProps> = ({
  block,
  index,
  totalCount: _totalCount,
  orderNumber,
  cursorFocus,
  isSelected,
  isDragging,
  dropPosition,
  onSelectBlock,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onClearCursorFocus,
  onChangeContent,
  onChangeType,
  onUpdateProperties,
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
  isSlashMenuOpen,
  onSlashTrigger,
  onSlashClose,
  onSlashKeyDown,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const level = normalizeLevel(block.properties?.level);
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
      case 'code':
        return <Code className="w-3.5 h-3.5" />;
      case 'quote':
        return <Quote className="w-3.5 h-3.5" />;
      case 'callout':
        return <Lightbulb className="w-3.5 h-3.5" />;
      case 'database':
        return <Table className="w-3.5 h-3.5" />;
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
            isSlashMenuOpen={isSlashMenuOpen}
            onSlashTrigger={onSlashTrigger}
            onSlashClose={onSlashClose}
            onSlashKeyDown={onSlashKeyDown}
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
                isSlashMenuOpen={isSlashMenuOpen}
                onSlashTrigger={onSlashTrigger}
                onSlashClose={onSlashClose}
                onSlashKeyDown={onSlashKeyDown}
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
                isSlashMenuOpen={isSlashMenuOpen}
                onSlashTrigger={onSlashTrigger}
                onSlashClose={onSlashClose}
                onSlashKeyDown={onSlashKeyDown}
              />
            </div>
          </div>
        );

      case 'todo':
        const isChecked = normalizeChecked(block.properties?.checked);
        return (
          <div
            style={indentStyle}
            className="flex items-start gap-2.5 py-0.5 group/todo transition-all"
          >
            <button
              type="button"
              onClick={onToggleTodo}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  onToggleTodo?.();
                }
              }}
              role="checkbox"
              aria-checked={isChecked}
              aria-label={isChecked ? '标记为未完成' : '标记为已完成'}
              className="mt-1 text-text-muted-light dark:text-text-muted-dark hover:text-blue-500 transition-colors flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
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
                isSlashMenuOpen={isSlashMenuOpen}
                onSlashTrigger={onSlashTrigger}
                onSlashClose={onSlashClose}
                onSlashKeyDown={onSlashKeyDown}
              />
            </div>
          </div>
        );

      case 'code':
        return (
          <CodeBlock
            id={block.id}
            content={block.content}
            language={block.properties?.language}
            wrap={block.properties?.wrap}
            cursorFocus={cursorFocus}
            onClearCursorFocus={onClearCursorFocus}
            onChange={onChangeContent}
            onChangeLanguage={(language) =>
              onUpdateProperties?.({ ...block.properties, language })
            }
            onChangeWrap={(wrap) =>
              onUpdateProperties?.({ ...block.properties, wrap })
            }
            onInsertBelow={onInsertBelow}
            onMergeUp={onMergeUp}
            onFocusPrevious={onFocusPrevious}
            onFocusNext={onFocusNext}
            onUndo={onUndo}
            onRedo={onRedo}
          />
        );

      case 'quote':
        return (
          <QuoteBlock
            id={block.id}
            content={block.content}
            cursorFocus={cursorFocus}
            onClearCursorFocus={onClearCursorFocus}
            onChange={onChangeContent}
            onSplit={onSplit}
            onMergeUp={onMergeUp}
            onFocusPrevious={onFocusPrevious}
            onFocusNext={onFocusNext}
            onPaste={onPaste}
            onUndo={onUndo}
            onRedo={onRedo}
            isSlashMenuOpen={isSlashMenuOpen}
            onSlashTrigger={onSlashTrigger}
            onSlashClose={onSlashClose}
            onSlashKeyDown={onSlashKeyDown}
          />
        );

      case 'callout':
        return (
          <CalloutBlock
            id={block.id}
            content={block.content}
            icon={block.properties?.icon}
            tone={block.properties?.tone}
            cursorFocus={cursorFocus}
            onClearCursorFocus={onClearCursorFocus}
            onChange={onChangeContent}
            onChangeIcon={(icon) =>
              onUpdateProperties?.({ ...block.properties, icon })
            }
            onChangeTone={(tone) =>
              onUpdateProperties?.({ ...block.properties, tone })
            }
            onSplit={onSplit}
            onMergeUp={onMergeUp}
            onFocusPrevious={onFocusPrevious}
            onFocusNext={onFocusNext}
            onPaste={onPaste}
            onUndo={onUndo}
            onRedo={onRedo}
            isSlashMenuOpen={isSlashMenuOpen}
            onSlashTrigger={onSlashTrigger}
            onSlashClose={onSlashClose}
            onSlashKeyDown={onSlashKeyDown}
          />
        );

      case 'database':
        return (
          <DatabaseBlock
            id={block.id}
            databaseId={block.properties?.databaseId}
            onUpdateProperties={onUpdateProperties}
            onDelete={onDelete}
            onFocusPrevious={onFocusPrevious}
            onFocusNext={onFocusNext}
          />
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
              isSlashMenuOpen={isSlashMenuOpen}
              onSlashTrigger={onSlashTrigger}
              onSlashClose={onSlashClose}
              onSlashKeyDown={onSlashKeyDown}
            />
          </div>
        );
    }
  };

  return (
    <div
      data-block-wrapper-id={block.id}
      data-block-index={index}
      data-selected={isSelected ? 'true' : undefined}
      onDragOver={(e) => onDragOver?.(e, index, block.id)}
      onDragLeave={(e) => onDragLeave?.(e, index, block.id)}
      onDrop={(e) => onDrop?.(e, index, block.id)}
      className={cn(
        'group/block relative flex items-start -ml-8 pl-8 sm:-ml-12 sm:pl-12 transition-all rounded-lg',
        isSelected &&
          'bg-blue-50/70 dark:bg-blue-950/30 ring-1 ring-blue-400/50 dark:ring-blue-500/50',
        isDragging && 'opacity-40'
      )}
    >
      {/* 拖拽放置上方指示线 */}
      {dropPosition === 'top' && (
        <div
          data-testid="drop-indicator-top"
          className="absolute -top-[2px] left-0 right-0 h-[2px] bg-blue-500 rounded-full z-20 pointer-events-none shadow-[0_0_4px_rgba(59,130,246,0.6)]"
        >
          <div className="absolute -left-1 -top-[3px] w-2 h-2 rounded-full bg-blue-500" />
        </div>
      )}

      {/* 拖拽放置下方指示线 */}
      {dropPosition === 'bottom' && (
        <div
          data-testid="drop-indicator-bottom"
          className="absolute -bottom-[2px] left-0 right-0 h-[2px] bg-blue-500 rounded-full z-20 pointer-events-none shadow-[0_0_4px_rgba(59,130,246,0.6)]"
        >
          <div className="absolute -left-1 -top-[3px] w-2 h-2 rounded-full bg-blue-500" />
        </div>
      )}

      {/* 悬浮操作把手（Hover Action Bar） */}
      <div
        className={cn(
          'absolute left-1 top-1 flex items-center gap-0.5 transition-opacity select-none z-10',
          isSelected ? 'opacity-100' : 'opacity-0 group-hover/block:opacity-100'
        )}
      >
        {/* 快速在下方新增段落 */}
        <button
          type="button"
          onClick={() => onInsertBelow()}
          title="在下方插入新块"
          className="p-1 rounded text-text-muted-light hover:text-text-primary-light dark:text-text-muted-dark dark:hover:text-text-primary-dark hover:bg-sidebar-hover-light dark:hover:bg-sidebar-hover-dark transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>

        {/* 6-dot 拖拽重排与多选手柄 (Grip Handle) */}
        <button
          type="button"
          draggable
          data-testid="grip-handle"
          data-grip-id={block.id}
          aria-label="拖拽重排或点击选中"
          title="拖拽重排，或 Shift+点击多选"
          onDragStart={(e) => onDragStart?.(e, index, block.id)}
          onDragEnd={onDragEnd}
          onClick={(e) => {
            onSelectBlock?.(e, block.id);
          }}
          className={cn(
            'p-1 rounded cursor-grab active:cursor-grabbing text-text-muted-light hover:text-text-primary-light dark:text-text-muted-dark dark:hover:text-text-primary-dark hover:bg-sidebar-hover-light dark:hover:bg-sidebar-hover-dark transition-colors',
            isSelected && 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40'
          )}
        >
          <GripVertical className="w-3.5 h-3.5" />
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
