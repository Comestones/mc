import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Copy, Check, WrapText } from 'lucide-react';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-go';
import { BlockType } from '../../types/document';
import {
  SUPPORTED_CODE_LANGUAGES,
  normalizeCodeLanguage,
} from '../../utils/blockUtils';
import { cn } from '../../utils/cn';

interface CodeBlockProps {
  id: string;
  content: string;
  language?: string;
  wrap?: boolean;
  cursorFocus?: { offset: number | 'start' | 'end' } | null;
  onClearCursorFocus?: () => void;
  onChange: (newContent: string) => void;
  onChangeLanguage?: (language: string) => void;
  onChangeWrap?: (wrap: boolean) => void;
  onSplit?: (offset: number) => void;
  onDelete?: () => void;
  onInsertBelow?: (type?: BlockType) => void;
  onMergeUp?: () => void;
  onFocusPrevious?: () => void;
  onFocusNext?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
}

/**
 * 纯 React 节点递归渲染 Prism token 语法树，从根本上杜绝 innerHTML / XSS 注入
 */
function renderPrismTokens(
  tokens: (string | Prism.Token)[],
  keyPrefix = 't'
): React.ReactNode[] {
  return tokens.map((token, i) => {
    const key = `${keyPrefix}-${i}`;
    if (typeof token === 'string') {
      return <span key={key}>{token}</span>;
    }

    const tokenType = token.type;
    const aliases = Array.isArray(token.alias)
      ? token.alias.join(' ')
      : token.alias || '';
    const classNames = `token ${tokenType} ${aliases}`.trim();

    const children = Array.isArray(token.content)
      ? renderPrismTokens(token.content, key)
      : typeof token.content === 'object' && token.content !== null
      ? renderPrismTokens([token.content as Prism.Token], key)
      : String(token.content);

    return (
      <span key={key} className={classNames}>
        {children}
      </span>
    );
  });
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  id,
  content,
  language = 'plaintext',
  wrap = false,
  cursorFocus,
  onClearCursorFocus: _onClearCursorFocus,
  onChange,
  onChangeLanguage,
  onChangeWrap,
  onInsertBelow,
  onMergeUp,
  onFocusPrevious,
  onFocusNext,
  onUndo,
  onRedo,
}) => {
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const isComposingRef = useRef(false);

  const safeLanguage = normalizeCodeLanguage(language);

  // 输入法合成期状态管理
  const handleCompositionStart = () => {
    isComposingRef.current = true;
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLTextAreaElement>) => {
    isComposingRef.current = false;
    onChange(e.currentTarget.value);
  };

  // 自动根据内容伸缩高度
  const adjustHeight = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.max(68, el.scrollHeight)}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [content, wrap]);

  // 光标对齐与聚焦处理
  useLayoutEffect(() => {
    if (cursorFocus && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      if (cursorFocus.offset === 'start') {
        textareaRef.current.setSelectionRange(0, 0);
      } else if (cursorFocus.offset === 'end') {
        textareaRef.current.setSelectionRange(len, len);
      } else if (typeof cursorFocus.offset === 'number') {
        const target = Math.min(len, Math.max(0, cursorFocus.offset));
        textareaRef.current.setSelectionRange(target, target);
      }
    }
  }, [cursorFocus]);

  // 一键复制代码
  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(content);
      } else {
        // 降级使用 textarea 选区复制
        const textarea = document.createElement('textarea');
        textarea.value = content;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 忽略非阻塞剪贴板错误
    }
  };

  // 键盘快捷键监听
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 中文/输入法合成阶段不拦截任何按键，杜绝打断拼音或误触发降级
    if (e.nativeEvent.isComposing || isComposingRef.current) {
      return;
    }

    // 1. Tab / Shift+Tab：缩进或缩退 2 个空格
    if (e.key === 'Tab') {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;

      if (e.shiftKey) {
        // Shift+Tab 缩退
        const lineStart = content.lastIndexOf('\n', start - 1) + 1;
        if (start !== end && content.substring(start, end).includes('\n')) {
          // 多行选中批量缩退
          const lineEndIndex = content.indexOf('\n', end);
          const lineEnd = lineEndIndex === -1 ? content.length : lineEndIndex;
          const selectedBlock = content.substring(lineStart, lineEnd);
          const lines = selectedBlock.split('\n');
          let removedFirst = 0;
          let totalRemoved = 0;

          const newLines = lines.map((line, idx) => {
            const count = line.startsWith('  ') ? 2 : line.startsWith(' ') ? 1 : 0;
            if (idx === 0) removedFirst = count;
            totalRemoved += count;
            return line.substring(count);
          });

          const newContent =
            content.substring(0, lineStart) + newLines.join('\n') + content.substring(lineEnd);
          onChange(newContent);
          setTimeout(() => {
            el.setSelectionRange(
              Math.max(lineStart, start - removedFirst),
              Math.max(lineStart, end - totalRemoved)
            );
          }, 0);
        } else {
          // 单行缩退：基于当前整行判断，解决光标在行首（start === lineStart）时缩退失效的问题
          const lineEndIndex = content.indexOf('\n', start);
          const lineEnd = lineEndIndex === -1 ? content.length : lineEndIndex;
          const fullLine = content.substring(lineStart, lineEnd);
          const count = fullLine.startsWith('  ') ? 2 : fullLine.startsWith(' ') ? 1 : 0;
          if (count > 0) {
            const newContent =
              content.substring(0, lineStart) + fullLine.substring(count) + content.substring(lineEnd);
            onChange(newContent);
            setTimeout(() => {
              el.setSelectionRange(
                Math.max(lineStart, start - count),
                Math.max(lineStart, end - count)
              );
            }, 0);
          }
        }
      } else {
        // Tab 缩进
        if (start !== end && content.substring(start, end).includes('\n')) {
          // 多行选中批量缩进
          const lineStart = content.lastIndexOf('\n', start - 1) + 1;
          const lineEndIndex = content.indexOf('\n', end);
          const lineEnd = lineEndIndex === -1 ? content.length : lineEndIndex;
          const selectedBlock = content.substring(lineStart, lineEnd);
          const lines = selectedBlock.split('\n');
          const newLines = lines.map((line) => '  ' + line);
          const addedTotal = lines.length * 2;
          const newContent =
            content.substring(0, lineStart) + newLines.join('\n') + content.substring(lineEnd);
          onChange(newContent);
          setTimeout(() => {
            el.setSelectionRange(start + 2, end + addedTotal);
          }, 0);
        } else {
          // 单行在光标处插入 2 个空格
          const newContent = content.substring(0, start) + '  ' + content.substring(end);
          onChange(newContent);
          setTimeout(() => {
            el.setSelectionRange(start + 2, start + 2);
          }, 0);
        }
      }
      return;
    }

    // 2. Ctrl/Cmd+Enter：在下方追加段落并跳转
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onInsertBelow?.('paragraph');
      return;
    }

    // 3. Backspace 在代码块首且内容为空时降级为普通段落
    if (e.key === 'Backspace' && content.length === 0) {
      e.preventDefault();
      onMergeUp?.();
      return;
    }

    // 4. 方向键上/下越界导航
    if (e.key === 'ArrowUp' && e.currentTarget.selectionStart === 0 && e.currentTarget.selectionEnd === 0) {
      e.preventDefault();
      onFocusPrevious?.();
      return;
    }

    if (e.key === 'ArrowDown') {
      const len = e.currentTarget.value.length;
      if (e.currentTarget.selectionStart === len && e.currentTarget.selectionEnd === len) {
        e.preventDefault();
        onFocusNext?.();
        return;
      }
    }

    // 5. Ctrl+Z / Ctrl+Y 撤销重做
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        onRedo?.();
      } else {
        onUndo?.();
      }
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
      e.preventDefault();
      onRedo?.();
      return;
    }
  };

  // 生成语法高亮虚拟 DOM
  const getTokens = () => {
    if (!content) return null;
    const grammar = Prism.languages[safeLanguage] || Prism.languages.plaintext;
    const tokens = Prism.tokenize(content, grammar);
    return renderPrismTokens(tokens);
  };

  // 滚动同步
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (preRef.current) {
      preRef.current.scrollTop = e.currentTarget.scrollTop;
      preRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  return (
    <div
      data-block-code-id={id}
      className="group/code relative my-2 rounded-xl overflow-hidden border border-border-light dark:border-border-dark bg-slate-900 text-slate-100 shadow-sm transition-all"
    >
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800/80 border-b border-slate-700/60 text-xs select-none">
        {/* 语言下拉选择 */}
        <div className="flex items-center gap-1.5">
          <select
            value={safeLanguage}
            onChange={(e) => onChangeLanguage?.(e.target.value)}
            aria-label="代码编程语言"
            className="bg-slate-700/60 hover:bg-slate-700 text-slate-200 text-xs rounded px-2 py-1 outline-none border border-slate-600/40 focus:border-blue-500 cursor-pointer transition-colors"
          >
            {SUPPORTED_CODE_LANGUAGES.map((item) => (
              <option key={item.value} value={item.value} className="bg-slate-800 text-slate-100">
                {item.label}
              </option>
            ))}
          </select>
        </div>

        {/* 右侧操作按钮 */}
        <div className="flex items-center gap-1.5">
          {/* 折行切换开关 */}
          <button
            type="button"
            onClick={() => onChangeWrap?.(!wrap)}
            title={wrap ? '切换为横向滚动' : '切换为自动折行'}
            aria-label={wrap ? '切换为横向滚动' : '切换为自动折行'}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors',
              wrap
                ? 'bg-blue-600/30 text-blue-400 border border-blue-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/60'
            )}
          >
            <WrapText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{wrap ? '折行' : '滚动'}</span>
          </button>

          {/* 一键复制代码 */}
          <button
            type="button"
            onClick={handleCopy}
            title="复制代码"
            aria-label="复制代码"
            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-slate-400 hover:text-slate-100 hover:bg-slate-700/60 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-medium">已复制</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">复制</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 核心双层代码编辑区：底可见 React-Safe 语法高亮，表层无感透明编辑 */}
      <div className="relative font-mono text-xs sm:text-sm">
        {/* 底层 Prism 语法高亮层 */}
        <pre
          ref={preRef}
          aria-hidden="true"
          className={cn(
            'p-3.5 m-0 font-mono text-xs sm:text-sm leading-relaxed pointer-events-none select-none',
            wrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre overflow-hidden'
          )}
        >
          <code className={`language-${safeLanguage}`}>
            {getTokens()}
            {/* 保证最后一行换行可见 */}
            {content.endsWith('\n') ? '\n' : ''}
          </code>
        </pre>

        {/* 表层原生多行可编辑 Textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          onScroll={handleScroll}
          aria-label="代码编辑区"
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          placeholder="// 在此输入代码，按 Ctrl+Enter 退出到段落..."
          className={cn(
            'absolute inset-0 w-full h-full p-3.5 m-0 font-mono text-xs sm:text-sm leading-relaxed bg-transparent resize-none outline-none border-none caret-blue-400',
            // 当内容存在时让文本透明展示下层高亮，光标保持高亮可见；空内容时展示灰色 placeholder
            content ? 'text-transparent selection:bg-blue-500/30' : 'text-slate-400',
            wrap ? 'whitespace-pre-wrap break-words overflow-hidden' : 'whitespace-pre overflow-x-auto'
          )}
        />
      </div>
    </div>
  );
};
