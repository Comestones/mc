import React from 'react';
import { TextBlock } from './TextBlock';

interface QuoteBlockProps {
  id: string;
  content: string;
  cursorFocus?: { offset: number | 'start' | 'end' } | null;
  onClearCursorFocus?: () => void;
  onChange: (newContent: string) => void;
  onSplit: (offset: number) => void;
  onMergeUp: () => void;
  onFocusPrevious?: () => void;
  onFocusNext?: () => void;
  onPaste: (text: string, offset: number) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  isSlashMenuOpen?: boolean;
  onSlashTrigger?: (query: string, position: { top: number; left: number }, slashIndex: number) => void;
  onSlashClose?: () => void;
  onSlashKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => boolean;
}

export const QuoteBlock: React.FC<QuoteBlockProps> = ({
  id,
  content,
  cursorFocus,
  onClearCursorFocus,
  onChange,
  onSplit,
  onMergeUp,
  onFocusPrevious,
  onFocusNext,
  onPaste,
  onUndo,
  onRedo,
  isSlashMenuOpen,
  onSlashTrigger,
  onSlashClose,
  onSlashKeyDown,
}) => {
  return (
    <div
      data-block-quote-id={id}
      className="relative my-1.5 pl-4 pr-3 py-1 rounded-r-lg border-l-4 border-blue-500 dark:border-blue-400 bg-neutral-500/5 dark:bg-neutral-500/10 italic transition-colors"
    >
      <TextBlock
        id={id}
        type="paragraph"
        content={content}
        cursorFocus={cursorFocus}
        onClearCursorFocus={onClearCursorFocus}
        onChange={onChange}
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
    </div>
  );
};
