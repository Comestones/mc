import React, { useState, useRef, useEffect } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Link as LinkIcon,
  Unlink,
  Check,
  X,
} from 'lucide-react';
import { cn } from '../../utils/cn';

export interface FormatStates {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  code: boolean;
  link: boolean;
  linkUrl?: string;
}

interface BubbleMenuProps {
  isOpen: boolean;
  position: { top: number; left: number };
  formats: FormatStates;
  onFormat: (format: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'code') => void;
  onSetLink: (url: string) => void;
  onUnlink: () => void;
  onClose: () => void;
}

export const BubbleMenu: React.FC<BubbleMenuProps> = ({
  isOpen,
  position,
  formats,
  onFormat,
  onSetLink,
  onUnlink,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [isLinkInputOpen, setIsLinkInputOpen] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // 当格式或选区变动时，同步当前选区的链接
  useEffect(() => {
    if (formats.linkUrl) {
      setUrlInput(formats.linkUrl);
    } else {
      setUrlInput('');
    }
  }, [formats.linkUrl, isOpen]);

  // 打开链接输入框时自动聚焦
  useEffect(() => {
    if (isLinkInputOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isLinkInputOpen]);

  // 关闭菜单时重置内部状态
  useEffect(() => {
    if (!isOpen) {
      setIsLinkInputOpen(false);
    }
  }, [isOpen]);

  // 点击外部时关闭
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose?.();
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleConfirmLink = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) {
      onUnlink();
    } else {
      // 自动补齐 https:// 协议
      const safeUrl = /^(https?:\/\/|mailto:|tel:|#|\/)/i.test(trimmed)
        ? trimmed
        : `https://${trimmed}`;
      onSetLink(safeUrl);
    }
    setIsLinkInputOpen(false);
  };

  const handleLinkKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirmLink();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsLinkInputOpen(false);
    }
  };

  // 视口边界防御计算
  const menuHeight = isLinkInputOpen ? 80 : 40;
  const menuWidth = isLinkInputOpen ? 280 : 240;
  let top = position.top - 46; // 默认悬浮于选区上方
  let left = position.left - menuWidth / 2;

  if (typeof window !== 'undefined') {
    // 靠近屏幕顶端时，翻折至选区正下方
    if (top < menuHeight) {
      top = position.top + 28;
    }
    // 水平防溢出
    if (left < 16) {
      left = 16;
    } else if (left + menuWidth > window.innerWidth - 16) {
      left = window.innerWidth - menuWidth - 16;
    }
  }

  return (
    <div
      ref={menuRef}
      role="toolbar"
      aria-label="文字浮动格式化工具栏"
      style={{ top: `${top}px`, left: `${left}px` }}
      className="fixed z-50 rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark shadow-xl backdrop-blur-md transition-all animate-in fade-in zoom-in-95 duration-100 p-1"
    >
      {isLinkInputOpen ? (
        // 超链接输入面板
        <div className="flex items-center gap-1.5 p-1 w-64 text-xs">
          <input
            ref={inputRef}
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={handleLinkKeyDown}
            placeholder="输入链接地址 (如 example.com)..."
            className="flex-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-text-primary-light dark:text-text-primary-dark border border-border-light dark:border-border-dark outline-none focus:border-blue-500 text-xs"
          />
          <button
            type="button"
            title="确认链接"
            aria-label="确认链接"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleConfirmLink}
            className="p-1 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          {formats.link && (
            <button
              type="button"
              title="清除链接"
              aria-label="清除链接"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onUnlink();
                setIsLinkInputOpen(false);
              }}
              className="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400"
            >
              <Unlink className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            title="取消"
            aria-label="取消"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setIsLinkInputOpen(false)}
            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-text-muted-light dark:text-text-muted-dark"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        // 6 大格式化按钮工具条
        <div className="flex items-center gap-0.5 select-none">
          {/* 1. 加粗 */}
          <button
            type="button"
            title="加粗 (Ctrl+B)"
            aria-label="加粗"
            data-active={formats.bold ? 'true' : 'false'}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onFormat('bold')}
            className={cn(
              'p-1.5 rounded-lg text-xs transition-colors',
              formats.bold
                ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 font-bold'
                : 'text-text-muted-light dark:text-text-muted-dark hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-text-primary-light dark:hover:text-text-primary-dark'
            )}
          >
            <Bold className="w-3.5 h-3.5" />
          </button>

          {/* 2. 斜体 */}
          <button
            type="button"
            title="斜体 (Ctrl+I)"
            aria-label="斜体"
            data-active={formats.italic ? 'true' : 'false'}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onFormat('italic')}
            className={cn(
              'p-1.5 rounded-lg text-xs transition-colors',
              formats.italic
                ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'
                : 'text-text-muted-light dark:text-text-muted-dark hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-text-primary-light dark:hover:text-text-primary-dark'
            )}
          >
            <Italic className="w-3.5 h-3.5" />
          </button>

          {/* 3. 下划线 */}
          <button
            type="button"
            title="下划线 (Ctrl+U)"
            aria-label="下划线"
            data-active={formats.underline ? 'true' : 'false'}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onFormat('underline')}
            className={cn(
              'p-1.5 rounded-lg text-xs transition-colors',
              formats.underline
                ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'
                : 'text-text-muted-light dark:text-text-muted-dark hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-text-primary-light dark:hover:text-text-primary-dark'
            )}
          >
            <Underline className="w-3.5 h-3.5" />
          </button>

          {/* 4. 删除线 */}
          <button
            type="button"
            title="删除线 (Ctrl+Shift+X)"
            aria-label="删除线"
            data-active={formats.strikethrough ? 'true' : 'false'}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onFormat('strikethrough')}
            className={cn(
              'p-1.5 rounded-lg text-xs transition-colors',
              formats.strikethrough
                ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'
                : 'text-text-muted-light dark:text-text-muted-dark hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-text-primary-light dark:hover:text-text-primary-dark'
            )}
          >
            <Strikethrough className="w-3.5 h-3.5" />
          </button>

          {/* 分隔微标 */}
          <div className="w-[1px] h-3.5 bg-border-light dark:border-border-dark my-auto mx-0.5" />

          {/* 5. 行内代码 */}
          <button
            type="button"
            title="行内代码"
            aria-label="行内代码"
            data-active={formats.code ? 'true' : 'false'}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onFormat('code')}
            className={cn(
              'p-1.5 rounded-lg text-xs transition-colors font-mono',
              formats.code
                ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'
                : 'text-text-muted-light dark:text-text-muted-dark hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-text-primary-light dark:hover:text-text-primary-dark'
            )}
          >
            <Code className="w-3.5 h-3.5" />
          </button>

          {/* 6. 超链接 */}
          <button
            type="button"
            title={formats.link ? '编辑超链接' : '插入超链接'}
            aria-label="超链接"
            data-active={formats.link ? 'true' : 'false'}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setIsLinkInputOpen(true)}
            className={cn(
              'p-1.5 rounded-lg text-xs transition-colors',
              formats.link
                ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'
                : 'text-text-muted-light dark:text-text-muted-dark hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-text-primary-light dark:hover:text-text-primary-dark'
            )}
          >
            <LinkIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
