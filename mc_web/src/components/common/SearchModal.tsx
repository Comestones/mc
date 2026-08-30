import React, { useState, useEffect, useRef } from 'react';
import { Search, ArrowRight, X } from 'lucide-react';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';

export const SearchModal: React.FC = () => {
  const {
    documents,
    isSearchOpen,
    setIsSearchOpen,
    setActivePage,
  } = useWorkspaceStore();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // 监听全局 Ctrl+K / Cmd+K 快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      if (e.key === 'Escape' && isSearchOpen) {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, setIsSearchOpen]);

  useEffect(() => {
    if (isSearchOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isSearchOpen]);

  if (!isSearchOpen) return null;

  // 过滤匹配的页面列表
  const filteredDocs = Object.values(documents).filter((doc) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    const matchTitle = (doc.title || '').toLowerCase().includes(q);
    const matchBlock = (doc.blocks || []).some((b) =>
      (b.content || '').toLowerCase().includes(q)
    );
    return matchTitle || matchBlock;
  });

  const handleSelect = (docId: string) => {
    setActivePage(docId);
    setIsSearchOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredDocs.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev === 0 ? filteredDocs.length - 1 : prev - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredDocs[selectedIndex]) {
        handleSelect(filteredDocs[selectedIndex].id);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center pt-24 px-4 animate-in fade-in duration-150"
      onClick={() => setIsSearchOpen(false)}
    >
      <div
        className="w-full max-w-xl bg-surface-light dark:bg-surface-dark rounded-xl shadow-2xl border border-border-light dark:border-border-dark overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 搜索输入框 */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border-light dark:border-border-dark">
          <Search className="w-5 h-5 text-text-muted-light dark:text-text-muted-dark" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="搜索页面标题、内容或快捷指令..."
            className="w-full bg-transparent text-sm text-text-primary-light dark:text-text-primary-dark placeholder:text-text-muted-light dark:placeholder:text-text-muted-dark outline-none"
          />
          <button
            onClick={() => setIsSearchOpen(false)}
            className="p-1 rounded-md text-text-muted-light dark:text-text-muted-dark hover:bg-sidebar-hover-light dark:hover:bg-sidebar-hover-dark"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 搜索结果列表 */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filteredDocs.length > 0 ? (
            filteredDocs.map((doc, idx) => (
              <div
                key={doc.id}
                onClick={() => handleSelect(doc.id)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer text-xs transition-colors ${
                  idx === selectedIndex
                    ? 'bg-sidebar-hover-light dark:bg-sidebar-hover-dark text-text-primary-light dark:text-text-primary-dark font-medium'
                    : 'text-text-muted-light dark:text-text-muted-dark hover:bg-sidebar-hover-light/60 dark:hover:bg-sidebar-hover-dark/60'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-base">{doc.icon || '📄'}</span>
                  <div className="truncate">
                    <div className="font-medium text-text-primary-light dark:text-text-primary-dark">
                      {doc.title || '无标题页面'}
                    </div>
                    {doc.blocks && doc.blocks[0] && (
                      <div className="text-[11px] text-text-muted-light dark:text-text-muted-dark truncate max-w-sm">
                        {doc.blocks[0].content || '无额外内容'}
                      </div>
                    )}
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 opacity-40 flex-shrink-0" />
              </div>
            ))
          ) : (
            <div className="py-8 text-center text-xs text-text-muted-light dark:text-text-muted-dark">
              未找到匹配 "{query}" 的页面
            </div>
          )}
        </div>

        {/* 底部快捷键提示 */}
        <div className="px-4 py-2 border-t border-border-light/60 dark:border-border-dark/60 bg-sidebar-light/50 dark:bg-sidebar-dark/50 flex items-center justify-between text-[11px] text-text-muted-light dark:text-text-muted-dark">
          <div className="flex items-center gap-2">
            <span>↑↓ 导航</span>
            <span>↵ 确认跳转</span>
            <span>ESC 关闭</span>
          </div>
          <span>mc 知识库全局引擎</span>
        </div>
      </div>
    </div>
  );
};
