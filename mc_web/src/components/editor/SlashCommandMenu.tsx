import React, { useEffect, useRef, useMemo } from 'react';
import {
  Pilcrow,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Code,
  Quote,
  Lightbulb,
  Minus,
} from 'lucide-react';
import { BlockType } from '../../types/document';
import { cn } from '../../utils/cn';
import {
  SlashCommandItem,
  filterSlashCommands,
} from '../../utils/slashCommandUtils';

interface SlashCommandMenuProps {
  isOpen: boolean;
  query: string;
  position: { top: number; left: number };
  selectedIndex: number;
  onSelect: (item: SlashCommandItem) => void;
  onClose: () => void;
  onHoverIndex?: (index: number) => void;
}

const ICON_MAP: Record<BlockType, React.ReactNode> = {
  paragraph: <Pilcrow className="w-4 h-4" />,
  heading1: <Heading1 className="w-4 h-4" />,
  heading2: <Heading2 className="w-4 h-4" />,
  heading3: <Heading3 className="w-4 h-4" />,
  bulletList: <List className="w-4 h-4" />,
  numberedList: <ListOrdered className="w-4 h-4" />,
  todo: <CheckSquare className="w-4 h-4" />,
  code: <Code className="w-4 h-4" />,
  quote: <Quote className="w-4 h-4" />,
  callout: <Lightbulb className="w-4 h-4" />,
  divider: <Minus className="w-4 h-4" />,
  database: <Pilcrow className="w-4 h-4" />,
};

export const SlashCommandMenu: React.FC<SlashCommandMenuProps> = ({
  isOpen,
  query,
  position,
  selectedIndex,
  onSelect,
  onClose,
  onHoverIndex,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const filteredItems = useMemo(() => filterSlashCommands(query), [query]);

  // 当高亮索引发生变化时，确保高亮项在滚动视野内
  useEffect(() => {
    if (!isOpen) return;
    const el = itemRefs.current[selectedIndex];
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, isOpen]);

  // 点击菜单外部时自动关闭
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // 视口边界防御计算：若底部超出屏幕，自动向上翻折
  const menuHeight = 320;
  const menuWidth = 280;
  let top = position.top;
  let left = position.left;

  if (typeof window !== 'undefined') {
    if (top + menuHeight > window.innerHeight - 16) {
      top = Math.max(16, position.top - menuHeight - 32);
    }
    if (left + menuWidth > window.innerWidth - 16) {
      left = Math.max(16, window.innerWidth - menuWidth - 16);
    }
  }

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="快捷块类型选择"
      style={{ top: `${top}px`, left: `${left}px` }}
      className="fixed z-50 w-72 max-h-80 overflow-y-auto rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark shadow-xl backdrop-blur-md p-1.5 transition-all animate-in fade-in zoom-in-95 duration-100"
    >
      <div className="px-2.5 py-1.5 text-[11px] font-semibold tracking-wider uppercase text-text-muted-light dark:text-text-muted-dark select-none border-b border-border-light/60 dark:border-border-dark/60 mb-1">
        {query ? `匹配指令 (${filteredItems.length})` : '基础块指令 (输入拼音/英文检索)'}
      </div>

      {filteredItems.length === 0 ? (
        <div className="px-3 py-4 text-center text-xs text-text-muted-light dark:text-text-muted-dark select-none">
          未找到匹配指令 &quot;{query}&quot;
        </div>
      ) : (
        <div className="space-y-0.5">
          {filteredItems.map((item, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={item.id}
                ref={(el) => (itemRefs.current[idx] = el)}
                type="button"
                role="menuitem"
                onMouseDown={(e) => {
                  // 阻止默认失焦，保证选区或焦点不被抢占
                  e.preventDefault();
                  onSelect(item);
                }}
                onMouseEnter={() => onHoverIndex?.(idx)}
                className={cn(
                  'w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer',
                  isSelected
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                    : 'text-text-primary-light dark:text-text-primary-dark hover:bg-slate-100 dark:hover:bg-slate-800/60'
                )}
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition-colors',
                    isSelected
                      ? 'bg-blue-100 dark:bg-blue-800/40 border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-400'
                      : 'bg-slate-100 dark:bg-slate-800 border-border-light dark:border-border-dark text-text-muted-light dark:text-text-muted-dark'
                  )}
                >
                  {ICON_MAP[item.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate flex items-center justify-between">
                    <span>{item.label}</span>
                    <span className="text-[10px] text-text-muted-light/60 dark:text-text-muted-dark/60 font-mono">
                      /{item.keywords[0]}
                    </span>
                  </div>
                  <div className="text-[11px] text-text-muted-light dark:text-text-muted-dark truncate">
                    {item.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
