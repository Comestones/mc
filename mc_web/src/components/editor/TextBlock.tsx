import React, { useRef, useEffect, useLayoutEffect } from 'react';
import { BlockType } from '../../types/document';
import { cn } from '../../utils/cn';

interface TextBlockProps {
  id: string;
  type: BlockType;
  content: string;
  cursorFocus?: { offset: number | 'start' | 'end' } | null;
  onClearCursorFocus?: () => void;
  onChange: (newContent: string) => void;
  onSplit: (offset: number) => void;
  onMergeUp: () => void;
  onFocusPrevious?: () => void;
  onFocusNext?: () => void;
  onPaste: (text: string, offset: number) => void;
  onIndent?: () => void;
  onOutdent?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onFocus?: () => void;
}

function getCaretOffset(root: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.startContainer)) return 0;

  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(root);
  preCaretRange.setEnd(range.startContainer, range.startOffset);
  return preCaretRange.toString().length;
}

function setCaretOffset(root: HTMLElement, offset: number | 'start' | 'end') {
  const sel = window.getSelection();
  if (!sel) return;

  root.focus();
  const range = document.createRange();

  if (offset === 'start') {
    if (root.childNodes.length === 0) {
      const textNode = document.createTextNode('');
      root.appendChild(textNode);
      range.setStart(textNode, 0);
    } else {
      range.selectNodeContents(root);
      range.collapse(true);
    }
    sel.removeAllRanges();
    sel.addRange(range);
    return;
  }

  if (offset === 'end') {
    if (root.childNodes.length === 0) {
      const textNode = document.createTextNode('');
      root.appendChild(textNode);
      range.setStart(textNode, 0);
    } else {
      range.selectNodeContents(root);
      range.collapse(false);
    }
    sel.removeAllRanges();
    sel.addRange(range);
    return;
  }

  const numericOffset: number = offset;
  let currentOffset = 0;
  let found = false;

  function walk(node: Node) {
    if (found) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const textLen = (node as Text).length;
      if (currentOffset + textLen >= numericOffset) {
        range.setStart(node, Math.max(0, numericOffset - currentOffset));
        range.collapse(true);
        found = true;
        return;
      }
      currentOffset += textLen;
    } else {
      for (let i = 0; i < node.childNodes.length; i++) {
        walk(node.childNodes[i]);
        if (found) break;
      }
    }
  }

  walk(root);

  if (!found) {
    if (root.childNodes.length === 0) {
      const textNode = document.createTextNode('');
      root.appendChild(textNode);
      range.setStart(textNode, 0);
    } else {
      range.selectNodeContents(root);
      range.collapse(false);
    }
  }

  sel.removeAllRanges();
  sel.addRange(range);
}

export const TextBlock: React.FC<TextBlockProps> = ({
  id,
  type,
  content,
  cursorFocus,
  onClearCursorFocus: _onClearCursorFocus,
  onChange,
  onSplit,
  onMergeUp,
  onFocusPrevious,
  onFocusNext,
  onPaste,
  onIndent,
  onOutdent,
  onUndo,
  onRedo,
  onFocus,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const isComposingRef = useRef(false);

  // 同步外部 content 变更（避免在用户输入期间覆盖导致光标跳跃）
  useEffect(() => {
    if (!contentRef.current) return;
    const currentText = contentRef.current.innerText ?? contentRef.current.textContent ?? '';
    if (currentText !== content) {
      contentRef.current.innerText = content;
      if (!contentRef.current.innerText && content) {
        contentRef.current.textContent = content;
      }
    }
    // 确保空内容时 DOM 干净以便匹配 :empty 伪类
    if (!content) {
      contentRef.current.innerHTML = '';
    }
  }, [content]);

  const lastAppliedFocusRef = useRef<{ offset: number | 'start' | 'end' } | null>(null);

  // 当外部指令要求将光标聚焦到本块特定位置时执行
  useLayoutEffect(() => {
    if (cursorFocus && contentRef.current && lastAppliedFocusRef.current !== cursorFocus) {
      lastAppliedFocusRef.current = cursorFocus;
      setCaretOffset(contentRef.current, cursorFocus.offset);
    }
  }, [cursorFocus]);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    if (isComposingRef.current) return;
    const text = e.currentTarget.innerText ?? e.currentTarget.textContent ?? '';
    onChange(text);
  };

  const handleCompositionStart = () => {
    isComposingRef.current = true;
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLDivElement>) => {
    isComposingRef.current = false;
    const text = e.currentTarget.innerText ?? e.currentTarget.textContent ?? '';
    onChange(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // 中文/输入法合成阶段不拦截任何按键
    if (e.nativeEvent.isComposing || isComposingRef.current) {
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        onOutdent?.();
      } else {
        onIndent?.();
      }
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const offset = getCaretOffset(contentRef.current!);
      onSplit(offset);
      return;
    }

    if (e.key === 'Backspace') {
      const offset = getCaretOffset(contentRef.current!);
      const selection = window.getSelection();
      const isCollapsed = selection ? selection.isCollapsed : true;
      if (offset === 0 && isCollapsed) {
        e.preventDefault();
        onMergeUp();
        return;
      }
    }

    if (e.key === 'ArrowUp') {
      const offset = getCaretOffset(contentRef.current!);
      if (offset === 0) {
        e.preventDefault();
        onFocusPrevious?.();
        return;
      }
    }

    if (e.key === 'ArrowDown') {
      const offset = getCaretOffset(contentRef.current!);
      const totalLen = (contentRef.current?.innerText ?? contentRef.current?.textContent ?? '').length;
      if (offset >= totalLen) {
        e.preventDefault();
        onFocusNext?.();
        return;
      }
    }

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

  const handlePasteEvent = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    const offset = getCaretOffset(contentRef.current!);
    onPaste(text, offset);
  };

  const getPlaceholder = () => {
    switch (type) {
      case 'heading1':
        return '一级标题';
      case 'heading2':
        return '二级标题';
      case 'heading3':
        return '三级标题';
      case 'paragraph':
      default:
        return "键入 '/' 呼出快捷命令，或直接开始写作...";
    }
  };

  const getStyles = () => {
    switch (type) {
      case 'heading1':
        return 'text-2xl sm:text-3xl font-bold tracking-tight text-text-primary-light dark:text-text-primary-dark mt-4 mb-1';
      case 'heading2':
        return 'text-xl sm:text-2xl font-semibold tracking-tight text-text-primary-light dark:text-text-primary-dark mt-3 mb-1';
      case 'heading3':
        return 'text-lg sm:text-xl font-semibold tracking-tight text-text-primary-light dark:text-text-primary-dark mt-2 mb-0.5';
      case 'paragraph':
      default:
        return 'text-sm text-text-primary-light dark:text-text-primary-dark leading-relaxed py-1 min-h-[1.75rem]';
    }
  };

  return (
    <div
      ref={contentRef}
      contentEditable
      suppressContentEditableWarning
      data-block-id={id}
      data-placeholder={getPlaceholder()}
      onInput={handleInput}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      onKeyDown={handleKeyDown}
      onPaste={handlePasteEvent}
      onFocus={onFocus}
      className={cn(
        'w-full outline-none break-words empty:before:content-[attr(data-placeholder)] empty:before:text-text-muted-light/40 dark:empty:before:text-text-muted-dark/40 empty:before:pointer-events-none transition-colors',
        getStyles()
      )}
    />
  );
};
