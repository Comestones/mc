import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';

export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useWorkspaceStore();

  return (
    <button
      onClick={toggleTheme}
      title={theme === 'dark' ? '切换为亮色模式' : '切换为暗色模式'}
      className="p-1.5 rounded-md text-text-muted-light dark:text-text-muted-dark hover:bg-sidebar-hover-light dark:hover:bg-sidebar-hover-dark hover:text-text-primary-light dark:hover:text-text-primary-dark transition-colors duration-150"
    >
      {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
};
