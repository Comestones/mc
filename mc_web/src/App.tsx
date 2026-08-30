import React, { useEffect } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { DocumentPage } from './pages/DocumentPage';
import { useWorkspaceStore } from './store/useWorkspaceStore';

export const App: React.FC = () => {
  const { theme } = useWorkspaceStore();

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  return (
    <AppLayout>
      <DocumentPage />
    </AppLayout>
  );
};

export default App;
