import React, { useState, useRef, useEffect } from 'react';
import { Palette } from 'lucide-react';
import { CalloutTone, CALLOUT_TONES, normalizeCalloutTone, normalizeCalloutIcon } from '../../utils/blockUtils';
import { TextBlock } from './TextBlock';
import { cn } from '../../utils/cn';

interface CalloutBlockProps {
  id: string;
  content: string;
  icon?: string;
  tone?: CalloutTone;
  cursorFocus?: { offset: number | 'start' | 'end' } | null;
  onClearCursorFocus?: () => void;
  onChange: (newContent: string) => void;
  onChangeIcon?: (icon: string) => void;
  onChangeTone?: (tone: CalloutTone) => void;
  onSplit: (offset: number) => void;
  onMergeUp: () => void;
  onFocusPrevious?: () => void;
  onFocusNext?: () => void;
  onPaste: (text: string, offset: number) => void;
  onUndo?: () => void;
  onRedo?: () => void;
}

const PRESET_EMOJIS = ['💡', 'ℹ️', '✅', '⚠️', '❌', '🔥', '📌', '🚀', '📝', '⭐', '💬', '🎉'];

const TONE_STYLES: Record<CalloutTone, { wrapper: string; dot: string; label: string }> = {
  neutral: {
    wrapper: 'bg-neutral-100/70 dark:bg-neutral-900/60 border-neutral-300/80 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100',
    dot: 'bg-neutral-400',
    label: '中性灰',
  },
  info: {
    wrapper: 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/60 text-blue-950 dark:text-blue-100',
    dot: 'bg-blue-500',
    label: '信息蓝',
  },
  success: {
    wrapper: 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-950 dark:text-emerald-100',
    dot: 'bg-emerald-500',
    label: '成功绿',
  },
  warning: {
    wrapper: 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60 text-amber-950 dark:text-amber-100',
    dot: 'bg-amber-500',
    label: '警告黄',
  },
  danger: {
    wrapper: 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60 text-rose-950 dark:text-rose-100',
    dot: 'bg-rose-500',
    label: '危险红',
  },
};

export const CalloutBlock: React.FC<CalloutBlockProps> = ({
  id,
  content,
  icon,
  tone,
  cursorFocus,
  onClearCursorFocus,
  onChange,
  onChangeIcon,
  onChangeTone,
  onSplit,
  onMergeUp,
  onFocusPrevious,
  onFocusNext,
  onPaste,
  onUndo,
  onRedo,
}) => {
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isTonePickerOpen, setIsTonePickerOpen] = useState(false);
  const emojiMenuRef = useRef<HTMLDivElement>(null);
  const toneMenuRef = useRef<HTMLDivElement>(null);

  const safeTone = normalizeCalloutTone(tone);
  const safeIcon = normalizeCalloutIcon(icon);
  const toneStyle = TONE_STYLES[safeTone] || TONE_STYLES.neutral;

  // 点击外部关闭弹层
  useEffect(() => {
    if (!isEmojiPickerOpen && !isTonePickerOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        emojiMenuRef.current &&
        !emojiMenuRef.current.contains(e.target as Node)
      ) {
        setIsEmojiPickerOpen(false);
      }
      if (
        toneMenuRef.current &&
        !toneMenuRef.current.contains(e.target as Node)
      ) {
        setIsTonePickerOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isEmojiPickerOpen, isTonePickerOpen]);

  return (
    <div
      data-block-callout-id={id}
      data-callout-tone={safeTone}
      className={cn(
        'group/callout relative p-3.5 rounded-xl border flex items-start gap-3 my-2 transition-colors',
        toneStyle.wrapper
      )}
    >
      {/* 左侧图标选择器 */}
      <div className="relative flex-shrink-0" ref={emojiMenuRef}>
        <button
          type="button"
          onClick={() => setIsEmojiPickerOpen((prev) => !prev)}
          title="更换提示图标"
          aria-label={`更换图标，当前为 ${safeIcon}`}
          className="text-xl select-none hover:scale-110 active:scale-95 transition-transform p-0.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          {safeIcon}
        </button>

        {isEmojiPickerOpen && (
          <div className="absolute left-0 top-full mt-1.5 z-30 p-2 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-xl w-48">
            <div className="text-[10px] font-semibold text-text-muted-light dark:text-text-muted-dark uppercase mb-1.5 px-1">
              选择预设图标
            </div>
            <div className="grid grid-cols-4 gap-1">
              {PRESET_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    onChangeIcon?.(emoji);
                    setIsEmojiPickerOpen(false);
                  }}
                  className="w-9 h-9 flex items-center justify-center text-lg rounded-lg hover:bg-sidebar-hover-light dark:hover:bg-sidebar-hover-dark transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 中间核心文本编辑区 */}
      <div className="flex-1 min-w-0">
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
        />
      </div>

      {/* 右上角色调快速选择器 */}
      <div className="relative flex-shrink-0" ref={toneMenuRef}>
        <button
          type="button"
          onClick={() => setIsTonePickerOpen((prev) => !prev)}
          title="切换提示色调"
          aria-label="切换提示色调"
          className="opacity-0 group-hover/callout:opacity-100 focus:opacity-100 p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-text-muted-light dark:text-text-muted-dark transition-opacity"
        >
          <Palette className="w-3.5 h-3.5" />
        </button>

        {isTonePickerOpen && (
          <div className="absolute right-0 top-full mt-1 z-30 p-1.5 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-xl w-36 space-y-0.5">
            <div className="text-[10px] font-semibold text-text-muted-light dark:text-text-muted-dark uppercase px-1.5 py-0.5">
              提示背景色调
            </div>
            {CALLOUT_TONES.map((t) => {
              const opt = TONE_STYLES[t];
              const isSelected = safeTone === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    onChangeTone?.(t);
                    setIsTonePickerOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1 rounded-lg text-xs text-left transition-colors',
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-medium'
                      : 'hover:bg-sidebar-hover-light dark:hover:bg-sidebar-hover-dark text-text-primary-light dark:text-text-primary-dark'
                  )}
                >
                  <span className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', opt.dot)} />
                  <span className="flex-1">{opt.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
