import React, { useState, useEffect, useRef } from 'react';

export interface TextCellEditorProps {
  value: string;
  onCommit: (val: string) => void;
  onCancel: () => void;
  onNavigate: (direction: 'up' | 'down' | 'left' | 'right' | 'next' | 'prev') => void;
}

export const TextCellEditor: React.FC<TextCellEditorProps> = ({
  value,
  onCommit,
  onCancel,
  onNavigate,
}) => {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const isComposingRef = useRef(false);
  const committedRef = useRef(false);

  useEffect(() => {
    setDraft(value);
    committedRef.current = false;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [value]);

  const handleCommit = () => {
    if (committedRef.current) return;
    committedRef.current = true;
    onCommit(draft.trim());
  };

  const handleBlur = () => {
    handleCommit();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isComposingRef.current || e.nativeEvent.isComposing) {
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      handleCommit();
      onNavigate('down');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      handleCommit();
      onNavigate(e.shiftKey ? 'prev' : 'next');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      committedRef.current = true;
      onCancel();
    }
  };

  return (
    <input
      ref={inputRef}
      autoFocus
      type="text"
      data-testid="db-cell-input"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onCompositionStart={() => {
        isComposingRef.current = true;
      }}
      onCompositionEnd={() => {
        isComposingRef.current = false;
      }}
      className="w-full h-full p-0 m-0 bg-transparent border-none outline-none text-xs font-inherit text-text-primary-light dark:text-text-primary-dark select-text"
    />
  );
};
