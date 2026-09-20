import React, { useState, useEffect, useRef } from 'react';

export interface NumberCellEditorProps {
  value: number | null | undefined;
  onCommit: (val: number | null) => void;
  onCancel: () => void;
  onNavigate: (direction: 'up' | 'down' | 'left' | 'right' | 'next' | 'prev') => void;
}

export const NumberCellEditor: React.FC<NumberCellEditorProps> = ({
  value,
  onCommit,
  onCancel,
  onNavigate,
}) => {
  const [draft, setDraft] = useState<string>(
    value !== null && value !== undefined && Number.isFinite(value) ? String(value) : ''
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false);

  useEffect(() => {
    setDraft(
      value !== null && value !== undefined && Number.isFinite(value) ? String(value) : ''
    );
    committedRef.current = false;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [value]);

  const parseNumber = (text: string): number | null => {
    const trimmed = text.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  };

  const handleCommit = () => {
    if (committedRef.current) return;
    committedRef.current = true;
    onCommit(parseNumber(draft));
  };

  const handleBlur = () => {
    handleCommit();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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
      data-testid="db-number-cell-input"
      value={draft}
      onChange={(e) => {
        // 允许数字、负号、小数点
        const val = e.target.value;
        if (/^-?\d*\.?\d*$/.test(val) || val === '') {
          setDraft(val);
        }
      }}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className="w-full h-full p-0 m-0 bg-transparent border-none outline-none font-mono text-xs text-right text-text-primary-light dark:text-text-primary-dark select-text"
      placeholder="0"
    />
  );
};
