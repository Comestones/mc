import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Plus, Trash2, Star } from 'lucide-react';
import { DocumentItem } from '../../types/document';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { cn } from '../../utils/cn';

interface PageTreeItemProps {
  document: DocumentItem;
  level?: number;
}

export const PageTreeItem: React.FC<PageTreeItemProps> = ({
  document,
  level = 0,
}) => {
  const {
    documents,
    activePageId,
    setActivePage,
    createPage,
    deletePage,
    toggleFavorite,
  } = useWorkspaceStore();

  const [isExpanded, setIsExpanded] = useState(true);

  // 查找当前页面的直接子页面
  const childDocs = Object.values(documents).filter(
    (doc) => doc.parentId === document.id
  );
  const hasChildren = childDocs.length > 0;
  const isActive = activePageId === document.id;

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleAddChild = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(true);
    createPage(document.id, '无标题子页面', '📄');
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`确定要删除页面 "${document.title || '无标题页面'}" 吗？`)) {
      deletePage(document.id);
    }
  };

  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite(document.id);
  };

  return (
    <div className="select-none">
      <div
        onClick={() => setActivePage(document.id)}
        style={{ paddingLeft: `${Math.max(8, level * 14 + 8)}px` }}
        className={cn(
          'group relative flex items-center justify-between py-1 pr-2 rounded-md text-sm cursor-pointer transition-colors duration-150',
          isActive
            ? 'bg-sidebar-hover-light dark:bg-sidebar-hover-dark font-medium text-text-primary-light dark:text-text-primary-dark'
            : 'text-text-muted-light dark:text-text-muted-dark hover:bg-sidebar-hover-light/60 dark:hover:bg-sidebar-hover-dark/60 hover:text-text-primary-light dark:hover:text-text-primary-dark'
        )}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {/* 折叠/展开箭头 */}
          <button
            onClick={handleToggleExpand}
            className={cn(
              'p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors',
              !hasChildren && 'invisible'
            )}
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-text-muted-light dark:text-text-muted-dark" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-text-muted-light dark:text-text-muted-dark" />
            )}
          </button>

          {/* 页面图标与标题 */}
          <span className="text-sm flex-shrink-0">{document.icon || '📄'}</span>
          <span className="truncate text-xs tracking-tight">
            {document.title || '无标题页面'}
          </span>
        </div>

        {/* 悬浮操作按钮组 */}
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity flex-shrink-0">
          <button
            onClick={handleFavorite}
            title={document.isFavorite ? '取消收藏' : '收藏页面'}
            className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-text-muted-light dark:text-text-muted-dark"
          >
            <Star
              className={cn(
                'w-3 h-3',
                document.isFavorite && 'fill-amber-400 text-amber-400'
              )}
            />
          </button>

          <button
            onClick={handleAddChild}
            title="添加子页面"
            className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-text-muted-light dark:text-text-muted-dark"
          >
            <Plus className="w-3 h-3" />
          </button>

          <button
            onClick={handleDelete}
            title="删除页面"
            className="p-1 rounded hover:bg-red-500/20 text-text-muted-light dark:text-text-muted-dark hover:text-red-500"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* 递归渲染子页面 */}
      {hasChildren && isExpanded && (
        <div className="flex flex-col">
          {childDocs.map((child) => (
            <PageTreeItem key={child.id} document={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
};
