import React from 'react';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { SearchModal } from '../common/SearchModal';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background-light dark:bg-background-dark font-sans">
      {/* 1. 左侧边栏 */}
      <Sidebar />

      {/* 2. 右侧主工作区 */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* 顶栏 */}
        <Navbar />
        {/* 主内容 */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          {children}
        </main>
      </div>

      {/* 3. 全局搜索模态框 */}
      <SearchModal />
    </div>
  );
};
