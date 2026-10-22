import * as Y from 'yjs';
import { fetchUpdates, type IndexeddbPersistence } from 'y-indexeddb';
export type CacheStatus = 'loading' | 'saving' | 'saved' | 'error' | 'unavailable';
export function cacheName(endpoint: string, room: string) {
  return `mc.yjs.v1:${encodeURIComponent(new URL(endpoint).href)}:${room}`;
}
/** y-indexeddb's updates/custom schema and exported replay helper, with managed transactions.
 * v9.0.12's constructor leaves open/read/write rejections unhandled. Keep error handling here,
 * and acknowledge writes on transaction completion rather than request success.
 */
export function createOfflineCache(endpoint: string, room: string, document: Y.Doc, onState: (state: CacheStatus) => void) {
  let db: IDBDatabase | undefined, disposed = false, failed = false, loaded = false, writes = 0;
  const pending = new Set<Promise<void>>();
  const publish = (state: CacheStatus) => { if (!disposed) onState(state); };
  const fail = () => { failed = true; publish('error'); };
  const append = (update: Uint8Array) => {
    if (!db || disposed || failed) return;
    publish('saving');
    const operation = new Promise<void>((resolve, reject) => {
      try {
        const tx = db!.transaction('updates', 'readwrite'), store = tx.objectStore('updates');
        tx.oncomplete = () => resolve();
        tx.onabort = tx.onerror = () => reject(new Error('CRDT cache transaction failed'));
        store.add(update);
        // Compaction reads and replaces the whole journal under the same transaction lock.
        if (++writes >= 500) {
          writes = 0;
          const request = store.getAll();
          request.onsuccess = () => {
            const merged = new Y.Doc();
            try { for (const state of request.result) Y.applyUpdate(merged, state); const state = Y.encodeStateAsUpdate(merged); store.clear(); store.add(state); }
            catch { tx.abort(); } finally { merged.destroy(); }
          };
        }
      } catch { reject(new Error('CRDT cache is unavailable')); }
    });
    pending.add(operation);
    void operation.then(() => { pending.delete(operation); if (!pending.size && !failed) publish('saved'); }, () => { pending.delete(operation); fail(); });
  };
  const changed = (update: Uint8Array, origin: unknown) => { if (loaded && origin !== replayOrigin) append(update.slice()); };
  const replayOrigin = Symbol('cached-crdt-replay');
  document.on('update', changed);
  publish('loading');
  const ready = (async () => {
    try {
      db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(cacheName(endpoint, room));
        let finished = false;
        const timeout = setTimeout(() => { finished = true; reject(new Error('CRDT cache open timed out')); }, 3000);
        request.onupgradeneeded = () => {
          const value = request.result;
          if (!value.objectStoreNames.contains('updates')) value.createObjectStore('updates', { autoIncrement: true });
          if (!value.objectStoreNames.contains('custom')) value.createObjectStore('custom');
        };
        request.onerror = () => { clearTimeout(timeout); finished = true; reject(new Error('CRDT cache could not be opened')); };
        request.onsuccess = () => { clearTimeout(timeout); if (finished || disposed) { request.result.close(); reject(new Error('CRDT cache closed')); } else { finished = true; resolve(request.result); } };
      });
      if (disposed) { db.close(); return false; }
      db.onversionchange = () => { db?.close(); fail(); };
      // Replay into a temporary document: a corrupt journal must not partially mutate the editor.
      const staging = new Y.Doc();
      try {
        const replay = { db, doc: staging, _dbref: 0, _dbsize: 0, _destroyed: false };
        await fetchUpdates(replay as IndexeddbPersistence);
        if (disposed) return false;
        Y.applyUpdate(document, Y.encodeStateAsUpdate(staging), replayOrigin);
      } finally { staging.destroy(); }
      loaded = true;
      append(Y.encodeStateAsUpdate(document));
      await Promise.all(pending);
      return !failed;
    } catch { if (!disposed) fail(); db?.close(); return false; }
    finally { if (disposed) db?.close(); }
  })();
  return {
    ready,
    async flush() { await ready; await Promise.allSettled(pending); return !failed; },
    async destroy() {
      if (disposed) return; disposed = true; document.off('update', changed);
      await ready; await Promise.allSettled(pending); db?.close();
    },
  };
}
