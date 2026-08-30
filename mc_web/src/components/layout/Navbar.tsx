import React from 'react';
import {
  PanelLeft,
  Star,
  Users,
  Search,
  Plus,
} from 'lucide-react';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { ThemeToggle } from '../common/ThemeToggle';
import { cn } from '../../utils/cn';

export const Navbar: React.FC = () => {
  const {
    activePageId,
    documents,
    isSidebarCollapsed,
    toggleSidebar,
    getBreadcrumbs,
    setActivePage,
    toggleFavorite,
    createPage,
    setIsSearchOpen,
  } = useWorkspaceStore();

  const activeDoc = documents[activePageId];
  const breadcrumbs = getBreadcrumbs(activePageId);

  return (
    <header className="h-11 px-4 flex items-center justify-between border-b border-border-light/80 dark:border-border-dark/80 bg-background-light dark:bg-background-dark select-none flex-shrink-0 z-20 transition-colors">
      {/* 左侧：展开侧边栏按钮 + 面包屑 */}
      <div className="flex items-center gap-2 min-w-0">
        {isSidebarCollapsed && (
          <button
            onClick={toggleSidebar}
            title="展开侧边栏 (Ctrl+\)"
            className="p-1 rounded-md text-text-muted-light dark:text-text-muted-dark hover:bg-sidebar-hover-light dark:hover:bg-sidebar-hover-dark hover:text-text-primary-light dark:hover:text-text-primary-dark transition-colors"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
        )}

        {/* 动态面包屑导航 */}
        <nav className="flex items-center gap-1.5 text-xs text-text-muted-light dark:text-text-muted-dark truncate">
          {breadcrumbs.length > 0 ? (
            breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <React.Fragment key={crumb.id}>
                  {idx > 0 && <span className="text-text-muted-light/40 dark:text-text-muted-dark/40">/</span>}
                  <button
                    onClick={() => setActivePage(crumb.id)}
                    className={cn(
                      'flex items-center gap-1 hover:text-text-primary-light dark:hover:text-text-primary-dark hover:underline truncate max-w-[140px]',
                      isLast && 'font-medium text-text-primary-light dark:text-text-primary-dark'
                    )}
                  >
                    <span>{crumb.icon || '📄'}</span>
                    <span className="truncate">{crumb.title || '无标题页面'}</span>
                  </button>
                </React.Fragment>
              );
            })
          ) : (
            <span>未选择页面</span>
          )}
        </nav>
      </div>

      {/* 右侧：操作项与状态 */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* 协同在线感知状态 */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-medium mr-1">
          <Users className="w-3 h-3" />
          <span>双人协同就绪</span>
        </div>

        {/* 快捷搜索 */}
        <button
          onClick={() => setIsSearchOpen(true)}
          title="搜索文档 (Ctrl+K)"
          className="p-1.5 rounded-md text-text-muted-light dark:text-text-muted-dark hover:bg-sidebar-hover-light dark:hover:bg-sidebar-hover-dark hover:text-text-primary-light dark:hover:text-text-primary-dark transition-colors"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* 快速新建同级页面 */}
        <button
          onClick={() => createPage(activeDoc?.parentId || null, '新建页面', '📄')}
          title="快速新建页面"
          className="p-1.5 rounded-md text-text-muted-light dark:text-text-muted-dark hover:bg-sidebar-hover-light dark:hover:bg-sidebar-hover-dark hover:text-text-primary-light dark:hover:text-text-primary-dark transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>

        {/* 收藏按钮 */}
        {activeDoc && (
          <button
            onClick={() => toggleFavorite(activeDoc.id)}
            title={activeDoc.isFavorite ? '取消收藏' : '收藏此页'}
            className="p-1.5 rounded-md text-text-muted-light dark:text-text-muted-dark hover:bg-sidebar-hover-light dark:hover:bg-sidebar-hover-dark hover:text-text-primary-light dark:hover:text-text-primary-dark transition-colors"
          >
            <Star
              className={cn(
                'w-4 h-4',
                activeDoc.isFavorite && 'fill-amber-400 text-amber-400'
              )}
            />
          </button>
        )}

        {/* 主题切换 */}
        {isSidebarCollapsed && <ThemeToggle />}
      </div>
    </header>
  );
};
