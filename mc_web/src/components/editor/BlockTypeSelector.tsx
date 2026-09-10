import React, { useEffect, useRef } from 'react';
import {
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  Minus,
  Trash2,
  Check,
} from 'lucide-react';
import { BlockType } from '../../types/document';
import { cn } from '../../utils/cn';

interface BlockTypeSelectorProps {
  currentType: BlockType;
  isOpen: boolean;
  onClose: () => void;
  onSelectType: (type: BlockType) => void;
  onDelete?: () => void;
}

interface TypeOption {
  type: BlockType;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const TYPE_OPTIONS: TypeOption[] = [
  {
    type: 'paragraph',
    label: '正文段落',
    description: '普通的正文内容文本',
    icon: <Pilcrow className="w-4 h-4" />,
  },
  {
    type: 'heading1',
    label: '一级标题',
    description: '最大级别的大段落标题',
    icon: <Heading1 className="w-4 h-4" />,
  },
  {
    type: 'heading2',
    label: '二级标题',
    description: '中等层级的小节标题',
    icon: <Heading2 className="w-4 h-4" />,
  },
  {
    type: 'heading3',
    label: '三级标题',
    description: '最小级别的细分标题',
    icon: <Heading3 className="w-4 h-4" />,
  },
  {
    type: 'divider',
    label: '分割线',
    description: '视觉上分隔不同章节内容',
    icon: <Minus className="w-4 h-4" />,
  },
];

export const BlockTypeSelector: React.FC<BlockTypeSelectorProps> = ({
  currentType,
  isOpen,
  onClose,
  onSelectType,
  onDelete,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="absolute left-0 top-full mt-1 z-30 w-60 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-xl py-1.5 animate-in fade-in zoom-in-95 duration-100"
    >
      <div className="px-3 py-1 text-[11px] font-semibold text-text-muted-light dark:text-text-muted-dark uppercase tracking-wider">
        切换块类型
      </div>

      <div className="space-y-0.5 px-1">
        {TYPE_OPTIONS.map((item) => {
          const isSelected = currentType === item.type;
          return (
            <button
              key={item.type}
              type="button"
              onClick={() => {
                onSelectType(item.type);
                onClose();
              }}
              className={cn(
                'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors',
                isSelected
                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-medium'
                  : 'text-text-primary-light dark:text-text-primary-dark hover:bg-sidebar-hover-light dark:hover:bg-sidebar-hover-dark'
              )}
            >
              <div
                className={cn(
                  'p-1 rounded-md',
                  isSelected
                    ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400'
                    : 'bg-sidebar-hover-light dark:bg-sidebar-hover-dark text-text-muted-light dark:text-text-muted-dark'
                )}
              >
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="truncate">{item.label}</div>
                <div className="text-[10px] text-text-muted-light dark:text-text-muted-dark truncate">
                  {item.description}
                </div>
              </div>
              {isSelected && <Check className="w-3.5 h-3.5 text-blue-500" />}
            </button>
          );
        })}
      </div>

      {onDelete && (
        <div className="mt-1 pt-1 border-t border-border-light/60 dark:border-border-dark/60 px-1">
          <button
            type="button"
            onClick={() => {
              onDelete();
              onClose();
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
          >
            <div className="p-1 rounded-md bg-red-100/60 dark:bg-red-900/30 text-red-600 dark:text-red-400">
              <Trash2 className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div>删除此块</div>
              <div className="text-[10px] opacity-75">从当前文档中移除该块</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
