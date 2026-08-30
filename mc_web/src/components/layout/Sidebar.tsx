import React from 'react';
import {
  PanelLeftClose,
  Plus,
  Search,
  BookOpen,
  Star,
} from 'lucide-react';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { PageTreeItem } from './PageTreeItem';
import { ThemeToggle } from '../common/ThemeToggle';

export const Sidebar: React.FC = () => {
  const {
    workspace,
    documents,
    isSidebarCollapsed,
    toggleSidebar,
    createPage,
    setIsSearchOpen,
  } = useWorkspaceStore();

  // 顶级页面列表 (parentId 为 null)
  const topLevelDocs = Object.values(documents).filter(
    (doc) => doc.parentId === null
  );

  // 收藏页面列表
  const favoriteDocs = Object.values(documents).filter((doc) => doc.isFavorite);

  if (isSidebarCollapsed) {
    return null;
  }

  return (
    <aside className="w-64 h-screen flex flex-col bg-sidebar-light dark:bg-sidebar-dark border-r border-border-light dark:border-border-dark flex-shrink-0 select-none z-30 transition-all duration-200">
      {/* 1. 工作区头部 */}
      <div className="p-3 flex items-center justify-between border-b border-border-light/60 dark:border-border-dark/60">
        <div className="flex items-center gap-2 min-w-0 flex-1 px-1 py-1 rounded-lg hover:bg-sidebar-hover-light dark:hover:bg-sidebar-hover-dark cursor-pointer transition-colors">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs shadow-sm flex-shrink-0">
            {workspace.icon}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xs font-semibold text-text-primary-light dark:text-text-primary-dark truncate">
              {workspace.name}
            </h1>
            <p className="text-[10px] text-text-muted-light dark:text-text-muted-dark truncate">
              {workspace.memberCount} 成员协作空间
            </p>
          </div>
        </div>

        <button
          onClick={toggleSidebar}
          title="收起侧边栏 (Ctrl+\)"
          className="p-1 rounded-md text-text-muted-light dark:text-text-muted-dark hover:bg-sidebar-hover-light dark:hover:bg-sidebar-hover-dark hover:text-text-primary-light dark:hover:text-text-primary-dark transition-colors"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* 2. 快捷操作入口 */}
      <div className="px-2 pt-2 pb-1 space-y-0.5">
        <button
          onClick={() => setIsSearchOpen(true)}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs text-text-muted-light dark:text-text-muted-dark hover:bg-sidebar-hover-light dark:hover:bg-sidebar-hover-dark hover:text-text-primary-light dark:hover:text-text-primary-dark transition-colors"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5" />
            <span>搜索文档</span>
          </div>
          <kbd className="text-[10px] px-1.5 py-0.5 bg-black/5 dark:bg-white/10 rounded border border-black/10 dark:border-white/10">
            Ctrl+K
          </kbd>
        </button>

        <button
          onClick={() => createPage(null, '新建页面', '📄')}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-text-muted-light dark:text-text-muted-dark hover:bg-sidebar-hover-light dark:hover:bg-sidebar-hover-dark hover:text-text-primary-light dark:hover:text-text-primary-dark transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>新建顶级页面</span>
        </button>
      </div>

      {/* 3. 页面树列表（带滚动） */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-4">
        {/* 收藏夹 */}
        {favoriteDocs.length > 0 && (
          <div>
            <div className="px-2 py-1 text-[11px] font-semibold text-text-muted-light dark:text-text-muted-dark flex items-center gap-1.5">
              <Star className="w-3 h-3 text-amber-500 fill-amber-500/20" />
              <span>快速收藏</span>
            </div>
            <div className="space-y-0.5 mt-0.5">
              {favoriteDocs.map((doc) => (
                <PageTreeItem key={`fav-${doc.id}`} document={doc} level={0} />
              ))}
            </div>
          </div>
        )}

        {/* 所有页面 */}
        <div>
          <div className="px-2 py-1 flex items-center justify-between text-[11px] font-semibold text-text-muted-light dark:text-text-muted-dark">
            <div className="flex items-center gap-1.5">
              <BookOpen className="w-3 h-3" />
              <span>知识库目录</span>
            </div>
            <button
              onClick={() => createPage(null, '新建页面', '📄')}
              title="新建页面"
              className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-0.5 mt-0.5">
            {topLevelDocs.length > 0 ? (
              topLevelDocs.map((doc) => (
                <PageTreeItem key={doc.id} document={doc} level={0} />
              ))
            ) : (
              <div className="px-3 py-4 text-center text-xs text-text-muted-light dark:text-text-muted-dark">
                暂无页面，点击下方创建
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. 底部工具栏 */}
      <div className="p-2.5 border-t border-border-light/60 dark:border-border-dark/60 flex items-center justify-between text-xs text-text-muted-light dark:text-text-muted-dark">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px]">本地极速缓存就绪</span>
        </div>

        <div className="flex items-center gap-1">
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
};
