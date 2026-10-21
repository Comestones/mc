import * as Y from 'yjs';
/** Hocuspocus owns normal debounce; this layer retries failed stores and reports actual health. */
export function createPersistence(store, { retryMs = 1000 } = {}) {
  const failed = new Map(), loadErrors = new Set(), inFlight = new Map();
  let timer, closing = false;
  function schedule() {
    if (closing || timer || !failed.size) return;
    timer = setTimeout(async () => {
      timer = undefined;
      await Promise.allSettled(Array.from(failed.values(), document => save(document)));
      schedule();
    }, retryMs); timer.unref();
  }
  function save(document) {
    if (document.isDestroyed) return Promise.resolve();
    const name = document.name;
    const previous = inFlight.get(name) ?? Promise.resolve();
    const operation = previous.catch(() => {}).then(async () => {
      try {
        await store.save(name, Y.encodeStateAsUpdate(document)); failed.delete(name);
      } catch (error) { failed.set(name, document); schedule(); throw error; }
    });
    inFlight.set(name, operation);
    operation.finally(() => { if (inFlight.get(name) === operation) inFlight.delete(name); }).catch(() => {});
    return operation;
  }
  return {
    store,
    extension: {
      async onLoadDocument({ documentName }) {
        try { const state = await store.load(documentName); loadErrors.delete(documentName); return state ?? undefined; }
        catch { loadErrors.add(documentName); throw new Error('Stored document could not be loaded'); }
      },
      async onStoreDocument({ document }) { try { await save(document); } catch { throw new Error('Document persistence failed; retained for retry'); } },
    },
    async health() {
      try { await store.check(); } catch { return { healthy: false, pendingDocuments: failed.size, loadErrors: loadErrors.size }; }
      return { healthy: !failed.size && !loadErrors.size, pendingDocuments: failed.size, loadErrors: loadErrors.size };
    },
    async flush(documents) {
      clearTimeout(timer); timer = undefined;
      const results = await Promise.allSettled(Array.from(documents.values(), document => save(document)));
      if (results.some(result => result.status === 'rejected')) throw new Error('Shutdown persistence failed; unsaved documents remain in memory');
    },
    async close() { closing = true; clearTimeout(timer); await Promise.allSettled(inFlight.values()); await store.close(); },
  };
}
