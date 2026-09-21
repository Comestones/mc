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
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false);

  useEffect(() => {
    setDraft(
      value !== null && value !== undefined && Number.isFinite(value) ? String(value) : ''
    );
    setError(null);
    committedRef.current = false;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [value]);

  const validateDraft = (text: string): { valid: boolean; value: number | null; error?: string } => {
    const trimmed = text.trim();
    if (!trimmed) {
      return { valid: true, value: null };
    }
    const n = Number(trimmed);
    if (!Number.isNaN(n) && Number.isFinite(n)) {
      return { valid: true, value: n };
    }
    return { valid: false, value: null, error: '请输入有效数字' };
  };

  const tryCommit = (): boolean => {
    if (committedRef.current) return false;
    const result = validateDraft(draft);
    if (!result.valid) {
      setError(result.error || '请输入有效数字');
      inputRef.current?.focus();
      return false;
    }
    setError(null);
    committedRef.current = true;
    onCommit(result.value);
    return true;
  };

  const handleBlur = () => {
    tryCommit();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (tryCommit()) {
        onNavigate('down');
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (tryCommit()) {
        onNavigate(e.shiftKey ? 'prev' : 'next');
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      committedRef.current = true;
      setError(null);
      onCancel();
    }
  };

  return (
    <div className="relative w-full h-full flex items-center justify-end">
      <input
        ref={inputRef}
        autoFocus
        type="text"
        data-testid="db-number-cell-input"
        aria-invalid={!!error}
        aria-errormessage={error ? 'db-number-cell-error' : undefined}
        value={draft}
        onChange={(e) => {
          // 允许数字、负号、小数点
          const val = e.target.value;
          if (/^-?\d*\.?\d*$/.test(val) || val === '') {
            setDraft(val);
            if (error) setError(null);
          }
        }}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={`w-full h-full p-0 m-0 bg-transparent border-none outline-none font-mono text-xs text-right text-text-primary-light dark:text-text-primary-dark select-text ${
          error ? 'text-red-600 dark:text-red-400' : ''
        }`}
        placeholder="0"
      />
      {error && (
        <div
          id="db-number-cell-error"
          role="alert"
          data-testid="db-number-cell-error"
          className="absolute top-full right-0 mt-1 z-50 px-2 py-0.5 bg-red-600 text-white text-[11px] font-sans font-medium rounded shadow-lg whitespace-nowrap pointer-events-none"
        >
          {error}
        </div>
      )}
    </div>
  );
};
