import { useEffect } from 'react';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { useCollaborationStore } from './store';
import { useDatabaseChannelStore } from './databaseChannelStore';
import { bindDatabase } from './databaseBinding';
import { collaborationUrl, createCollaborationSession } from './session';
import type { DatabaseSchema } from '../types/database';
import type { BlockNode } from '../types/document';
export function referencedDatabases(blocks: BlockNode[] = [], databases: Record<string, DatabaseSchema> = {}): string[] {
  const ids = new Set<string>();
  const visit = (items: BlockNode[], depth = 0) => {
    if (depth > 10) return;
    for (const block of items) {
      const id = block.properties?.databaseId;
      if (block.type === 'database' && typeof id === 'string' && id.length > 0 && id.length <= 128 && !/[\u0000-\u001f\u007f]/.test(id) && !['__proto__', 'constructor', 'prototype'].includes(id) && !ids.has(id)) {
        ids.add(id);
        // Row-as-page bodies may themselves reference a database; guard cycles by ID.
        for (const row of Object.values(databases[id]?.rows ?? {})) visit(row.blocks ?? [], depth + 1);
      }
      if (block.children) visit(block.children, depth + 1);
    }
  };
  visit(blocks); return Array.from(ids).sort();
}
function DatabaseRoom({ databaseId, workspaceId, endpoint }: { databaseId: string; workspaceId: string; endpoint: string }) {
  useEffect(() => {
    let disposed = false, bound = false, binding: ReturnType<typeof bindDatabase> | undefined;
    const publish = (state: { status: 'disabled' | 'connecting' | 'connected' | 'disconnected' | 'error'; synced: boolean }) => {
      if (disposed) return;
      useDatabaseChannelStore.setState(current => ({ channels: { ...current.channels, [databaseId]: { ...state, bound } } }));
    };
    const session = createCollaborationSession({ url: endpoint, kind: 'database', workspaceId, pageId: databaseId, onState: state => {
      publish(state); if (state.synced) binding?.synchronize();
    } });
    binding = bindDatabase({ session, databaseId,
      getSnapshot: () => {
        const state = useWorkspaceStore.getState(); return state.workspace.id === workspaceId ? state.databases[databaseId] ?? null : null;
      },
      onSnapshot: value => { if (useWorkspaceStore.getState().workspace.id === workspaceId) useWorkspaceStore.getState().applyCollaborativeDatabase(databaseId, value); },
      onReady: () => { bound = true; publish({ status: session.socket.status, synced: session.provider.synced }); },
    });
    const unsubscribe = useWorkspaceStore.subscribe(() => binding?.localChanged());
    const online = () => session.connect(), offline = () => session.disconnect();
    window.addEventListener('online', online); window.addEventListener('offline', offline);
    if (navigator.onLine) online(); else offline();
    return () => {
      disposed = true; window.removeEventListener('online', online); window.removeEventListener('offline', offline);
      unsubscribe(); binding?.destroy(); session.destroy();
      useDatabaseChannelStore.setState(current => { const channels = { ...current.channels }; delete channels[databaseId]; return { channels }; });
    };
  }, [databaseId, workspaceId, endpoint]);
  return null;
}
export function DatabaseRooms({ endpoint = import.meta.env.VITE_COLLABORATION_URL }: { endpoint?: string }) {
  const workspaceId = useWorkspaceStore(state => state.workspace.id), pageId = useWorkspaceStore(state => state.activePageId);
  const page = useWorkspaceStore(state => state.documents[state.activePageId]);
  const databases = useWorkspaceStore(state => state.databases);
  const boundPageId = useCollaborationStore(state => state.boundPageId), boundWorkspaceId = useCollaborationStore(state => state.boundWorkspaceId);
  let url: string | null = null; try { url = collaborationUrl(endpoint); } catch { return null; }
  if (!url || boundPageId !== pageId || boundWorkspaceId !== workspaceId) return null;
  return <>{referencedDatabases(page?.blocks, databases).map(id => <DatabaseRoom key={`${workspaceId}/${id}`} databaseId={id} workspaceId={workspaceId} endpoint={url!} />)}</>;
}
