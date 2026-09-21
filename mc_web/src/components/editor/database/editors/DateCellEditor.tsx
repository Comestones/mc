import React, { useState, useRef, useEffect } from 'react';
import { isValidDateString } from '../../../../utils/databaseUtils';

export interface DateCellEditorProps {
  value: string | null;
  onCommit: (val: string | null) => void;
  onCancel: () => void;
  onNavigate?: (direction: 'up' | 'down' | 'left' | 'right' | 'next' | 'prev') => void;
}

export const DateCellEditor: React.FC<DateCellEditorProps> = ({
  value,
  onCommit,
  onCancel,
  onNavigate,
}) => {
  const [draft, setDraft] = useState<string>(value || '');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleCommitDraft = (directionAfter?: 'next' | 'prev' | 'down') => {
    const trimmed = draft.trim();
    if (!trimmed) {
      onCommit(null);
      if (directionAfter && onNavigate) onNavigate(directionAfter);
      return;
    }

    if (isValidDateString(trimmed)) {
      setError(null);
      onCommit(trimmed);
      if (directionAfter && onNavigate) onNavigate(directionAfter);
    } else {
      setError('请输入有效日期 (YYYY-MM-DD)');
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      handleCommitDraft('down');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      handleCommitDraft(e.shiftKey ? 'prev' : 'next');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    }
  };

  const handleBlur = () => {
    // 若点击的是自身或未发生交互则尝试提交
    const trimmed = draft.trim();
    if (!trimmed) {
      onCommit(null);
      return;
    }
    if (isValidDateString(trimmed)) {
      onCommit(trimmed);
    } else {
      setError('请输入有效日期 (YYYY-MM-DD)');
    }
  };

  return (
    <div className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        placeholder="YYYY-MM-DD"
        data-testid="db-cell-input"
        value={draft}
        aria-invalid={Boolean(error)}
        aria-errormessage={error ? 'db-date-cell-error' : undefined}
        onChange={(e) => {
          setDraft(e.target.value);
          if (error) setError(null);
        }}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className={`w-full bg-white dark:bg-neutral-800 text-xs px-1.5 py-0.5 rounded outline-none border ${
          error
            ? 'border-red-500 ring-1 ring-red-500'
            : 'border-blue-500 ring-1 ring-blue-500'
        }`}
      />
      {error && (
        <div
          id="db-date-cell-error"
          data-testid="db-date-cell-error"
          role="alert"
          className="absolute left-0 top-full mt-1 z-50 px-2 py-1 text-[11px] text-white bg-red-600 rounded shadow-md whitespace-nowrap select-none animate-in fade-in duration-100"
        >
          {error}
        </div>
      )}
    </div>
  );
};
