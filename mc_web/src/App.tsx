import React, { useEffect } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { DocumentPage } from './pages/DocumentPage';
import { useWorkspaceStore } from './store/useWorkspaceStore';

export const App: React.FC = () => {
  const { theme, isHydrated, hydrateStore } = useWorkspaceStore();

  useEffect(() => {
    hydrateStore();
  }, [hydrateStore]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  if (!isHydrated) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background-light dark:bg-background-dark text-text-muted-light dark:text-text-muted-dark select-none">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
          <span className="text-xs font-medium tracking-wide">正在载入知识库工作区...</span>
        </div>
      </div>
    );
  }

  return (
    <AppLayout>
      <DocumentPage />
    </AppLayout>
  );
};

export default App;
