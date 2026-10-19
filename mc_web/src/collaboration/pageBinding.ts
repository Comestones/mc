import * as Y from 'yjs';
import type { createCollaborationSession } from './session.ts';
import { LOCAL_EDIT, mergeBufferedText, readPage, same, writePage, type PageSnapshot } from './pageModel.ts';
export interface PageBindingOptions {
  session: ReturnType<typeof createCollaborationSession>;
  getSnapshot: () => PageSnapshot | null;
  onSnapshot: (snapshot: PageSnapshot) => void;
  onReady?: () => void;
}
export function bindPage(options: PageBindingOptions) {
  const { session, getSnapshot, onSnapshot } = options;
  const initial = getSnapshot();
  let reflected = initial;
  let sent: PageSnapshot | null = null;
  const source = `${session.document.clientID}-${Date.now()}`;
  let synchronized = false, ready = false, disposed = false, reflecting = false;
  const undoManager = new Y.UndoManager(session.document.getMap('page'), { trackedOrigins: new Set([LOCAL_EDIT]), captureTimeout: 500 });
  function reflect() {
    if (disposed || !synchronized) return;
    const remote = readPage(session.document), local = getSnapshot();
    if (!remote || !local) return;
    if (!ready) {
      ready = true;
      const base = session.document.getMap('page').get('seedSource') === source ? sent : initial;
      reflected = remote;
      if (base && !same(base, local)) writePage(session.document, base, local, true);
      options.onReady?.();
    }
    const latest = readPage(session.document);
    if (!latest) return;
    reflected = latest;
    if (!same(latest, getSnapshot())) {
      reflecting = true;
      try { onSnapshot(latest); } finally { reflecting = false; }
    }
  }
  session.document.getMap('page').observeDeep(reflect);
  return {
    get ready() { return ready; },
    synchronize() {
      if (disposed) return;
      synchronized = true;
      if (!readPage(session.document)) {
        sent = getSnapshot();
        if (sent) session.provider.sendStateless(JSON.stringify({ kind: 'initialize-page', source, page: sent }));
      }
      reflect();
    },
    localChanged() {
      if (disposed || !ready || reflecting || !reflected) return;
      const next = getSnapshot();
      if (next && !same(next, reflected)) writePage(session.document, reflected, next);
    },
    undo() { if (!disposed && ready) { undoManager.stopCapturing(); undoManager.undo(); } },
    redo() { if (!disposed && ready) { undoManager.stopCapturing(); undoManager.redo(); } },
    stopCapturing() { undoManager.stopCapturing(); },
    rebaseTitle(base: string, input: string) {
      const title = session.document.getMap('page').get('title') as Y.Text;
      return mergeBufferedText(base, input, title.toString());
    },
    rebase(id: string, base: string, input: string) {
      const nodes = session.document.getMap('page').get('nodes') as Y.Map<Y.Map<unknown>> | undefined;
      const content = nodes?.get(id)?.get('content') as Y.Text | undefined;
      return content ? mergeBufferedText(base, input, content.toString()) : undefined;
    },
    destroy() {
      if (disposed) return; disposed = true;
      session.document.getMap('page').unobserveDeep(reflect); undoManager.destroy();
    },
  };
}
