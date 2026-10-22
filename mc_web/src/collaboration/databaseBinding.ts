import type { DatabaseSchema } from '../types/database.ts';
import type { createCollaborationSession } from './session.ts';
import { readDatabase, sharedDatabase, writeDatabase } from './databaseModel.ts';
import { same } from './pageModel.ts';
export function bindDatabase(options: {
  session: ReturnType<typeof createCollaborationSession>; databaseId: string;
  getSnapshot: () => DatabaseSchema | null; onSnapshot: (value: DatabaseSchema | null) => void; onReady?: () => void;
}) {
  const { session, databaseId, getSnapshot, onSnapshot } = options, root = session.document.getMap('database');
  const initial = getSnapshot(), source = `${session.document.clientID}-${crypto.randomUUID()}`;
  let sent: DatabaseSchema | null = null, reflected = initial, ready = false, synced = false, disposed = false, reflecting = false;
  function reflect() {
    if (disposed || !synced || root.get('schema') !== 1 || root.get('id') !== databaseId) return;
    const remote = readDatabase(session.document);
    if (!remote && root.get('deleted') !== true) return; // An invalid payload is not a deletion.
    if (!ready) {
      ready = true;
      const base = root.get('seedSource') === source ? sent : initial, current = getSnapshot();
      reflected = remote;
      if (remote && base && !same(sharedDatabase(base), sharedDatabase(current))) writeDatabase(session.document, base, current);
      options.onReady?.();
    }
    const next = readDatabase(session.document); reflected = next;
    const current = getSnapshot();
    const local = current ? { ...current, viewConfig: undefined } : null;
    if (!same(next, local)) {
      reflecting = true; try { onSnapshot(next); } finally { reflecting = false; }
    }
  }
  root.observeDeep(reflect);
  return {
    get ready() { return ready; },
    restore() { if (!disposed) { synced = true; reflect(); } },
    synchronize() {
      if (disposed) return; synced = true;
      if (!root.has('schema')) { sent = getSnapshot(); if (sent) session.provider.sendStateless(JSON.stringify({ kind: 'initialize-database', source, database: sent })); }
      reflect();
    },
    localChanged() {
      if (disposed || !ready || reflecting || !reflected) return;
      const next = getSnapshot();
      if (!same(sharedDatabase(next), sharedDatabase(reflected))) writeDatabase(session.document, reflected, next);
    },
    destroy() { if (disposed) return; disposed = true; root.unobserveDeep(reflect); },
  };
}
