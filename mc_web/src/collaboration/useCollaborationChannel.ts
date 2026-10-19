import { bindPage } from './pageBinding';
import { registerEditorBinding } from './editorBridge';
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
    setState({ status: 'disabled', synced: false, pageBound: false });
    if (!hydrated || !pageExists) return;
    let session: ReturnType<typeof createCollaborationSession>;
    let binding: ReturnType<typeof bindPage> | undefined;
    let unsubscribe: (() => void) | undefined;
    let unregister: (() => void) | undefined;
    try {
      const url = collaborationUrl(endpoint);
      if (!url) return;
      session = createCollaborationSession({ url, workspaceId, pageId: activePageId, onState: state => {
        setState(state);
        if (state.synced) binding?.synchronize();
      } });
    } catch { setState({ status: 'error', synced: false }); return; }
    if (session.document) {
      binding = bindPage({ session,
        getSnapshot: () => {
          const state = useWorkspaceStore.getState(), page = state.documents[activePageId];
          return page && state.workspace.id === workspaceId ? { title: page.title, blocks: page.blocks ?? [] } : null;
        },
        onSnapshot: snapshot => {
          const state = useWorkspaceStore.getState();
          if (state.workspace.id === workspaceId && state.documents[activePageId]) state.updatePage(activePageId, snapshot);
        },
        onReady: () => { setState({ pageBound: true }); unregister = registerEditorBinding(activePageId, binding!); },
      });
      unsubscribe = useWorkspaceStore.subscribe(() => binding?.localChanged());
    }
    const online = () => session.connect();
    const offline = () => session.disconnect();
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    if (navigator.onLine) online(); else offline();
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
      unsubscribe?.(); unregister?.(); binding?.destroy(); session.destroy();
      setState({ status: 'disabled', synced: false, pageBound: false });
    };
  }, [endpoint, hydrated, workspaceId, activePageId, pageExists]);
}
