import { useEffect } from 'react';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { collaborationUrl, createCollaborationSession } from './session';
import { useCollaborationStore } from './store';

declare global {
  interface ImportMeta { readonly env: { readonly VITE_COLLABORATION_URL?: string } }
}
export function useCollaborationChannel(endpoint = import.meta.env.VITE_COLLABORATION_URL) {
  const hydrated = useWorkspaceStore(state => state.isHydrated);
  const workspaceId = useWorkspaceStore(state => state.workspace.id);
  const activePageId = useWorkspaceStore(state => state.activePageId);
  const pageExists = useWorkspaceStore(state => !!state.documents[state.activePageId]);
  useEffect(() => {
    const setState = useCollaborationStore.setState;
    setState({ status: 'disabled', synced: false });
    if (!hydrated || !pageExists) return;
    let session: ReturnType<typeof createCollaborationSession>;
    try {
      const url = collaborationUrl(endpoint);
      if (!url) return;
      session = createCollaborationSession({ url, workspaceId, pageId: activePageId, onState: setState });
    } catch { setState({ status: 'error', synced: false }); return; }
    const online = () => session.connect();
    const offline = () => session.disconnect();
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    if (navigator.onLine) online(); else offline();
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
      session.destroy();
      setState({ status: 'disabled', synced: false });
    };
  }, [endpoint, hydrated, workspaceId, activePageId, pageExists]);
}
