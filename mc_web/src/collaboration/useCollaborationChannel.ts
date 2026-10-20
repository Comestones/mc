import { bindPresence } from './presence';
import { bindPresenceDom } from './presenceDom';
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
    setState({ status: 'disabled', synced: false, pageBound: false, boundPageId: undefined, boundWorkspaceId: undefined, members: [], rename: undefined });
    if (!hydrated || !pageExists) return;
    let session: ReturnType<typeof createCollaborationSession>;
    let binding: ReturnType<typeof bindPage> | undefined;
    let unsubscribe: (() => void) | undefined;
    let unregister: (() => void) | undefined;
    let presence: ReturnType<typeof bindPresence> | undefined;
    let removePresenceDom: (() => void) | undefined;
    try {
      const url = collaborationUrl(endpoint);
      if (!url) return;
      session = createCollaborationSession({ url, workspaceId, pageId: activePageId, onState: state => {
        setState(state);
        if (state.synced) binding?.synchronize();
        presence?.setConnected(state.synced && !!binding?.ready);
      } });
    } catch { setState({ status: 'error', synced: false }); return; }
    if (session.document) {
      let name: string | null = null;
      try { name = localStorage.getItem('mc.collaboration.name'); } catch { /* storage can be unavailable */ }
      if (session.provider?.awareness) {
        presence = bindPresence({ document: session.document, awareness: session.provider.awareness, name,
          onMembers: members => setState({ members }) });
        setState({ rename: value => {
          presence?.rename(value);
          try { localStorage.setItem('mc.collaboration.name', session.provider.awareness?.getLocalState()?.user?.name ?? ''); } catch { /* ephemeral identity still works */ }
        } });
        removePresenceDom = bindPresenceDom(session.document, location => presence?.cursor(location));
      }
      binding = bindPage({ session,
        getSnapshot: () => {
          const state = useWorkspaceStore.getState(), page = state.documents[activePageId];
          return page && state.workspace.id === workspaceId ? { title: page.title, blocks: page.blocks ?? [] } : null;
        },
        onSnapshot: snapshot => {
          const state = useWorkspaceStore.getState();
          if (state.workspace.id === workspaceId && state.documents[activePageId]) state.updatePage(activePageId, snapshot);
        },
        onReady: () => { setState({ pageBound: true, boundPageId: activePageId, boundWorkspaceId: workspaceId }); unregister = registerEditorBinding(activePageId, binding!); presence?.setConnected(useCollaborationStore.getState().synced); },
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
      removePresenceDom?.(); presence?.destroy(); unsubscribe?.(); unregister?.(); binding?.destroy(); session.destroy();
      setState({ status: 'disabled', synced: false, pageBound: false, boundPageId: undefined, boundWorkspaceId: undefined, members: [], rename: undefined });
    };
  }, [endpoint, hydrated, workspaceId, activePageId, pageExists]);
}
