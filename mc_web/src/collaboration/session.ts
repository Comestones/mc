import { createOfflineCache, type CacheStatus } from './offlineCache.ts';
import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider';
import * as Y from 'yjs';

export type ChannelStatus = 'disabled' | 'connecting' | 'connected' | 'disconnected' | 'error';
export interface ChannelState { status: ChannelStatus; synced: boolean }
export function roomName(workspaceId: string, pageId: string, kind: 'page' | 'database' = 'page'): string {
  for (const id of [workspaceId, pageId]) {
    if (!id || id.length > 128 || /[\u0000-\u001f\u007f]/.test(id)) throw new Error('Invalid collaboration room ID');
  }
  return `${kind === 'database' ? 'mc/db/v1' : 'mc/v1'}/${encodeURIComponent(workspaceId)}/${encodeURIComponent(pageId)}`;
}
export function collaborationUrl(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  const url = new URL(value);
  if (!['ws:', 'wss:'].includes(url.protocol) || url.username || url.password || url.hash || url.search) throw new Error('Invalid collaboration URL');
  return url.href;
}
export interface SessionOptions {
  url: string;
  workspaceId: string;
  pageId: string;
  kind?: 'page' | 'database';
  onState: (state: ChannelState) => void;
  onLocalReady?: () => void;
  onCacheState?: (state: CacheStatus) => void;
  // Disable only in protocol tests; browsers cache by default when IndexedDB is available.
  persistence?: boolean;
  // Injectable only for transport tests; production uses the native browser WebSocket.
  forceSyncInterval?: number | false;
  socketOptions?: Partial<ConstructorParameters<typeof HocuspocusProviderWebsocket>[0]>;
}
export function createCollaborationSession(options: SessionOptions) {
  const name = roomName(options.workspaceId, options.pageId, options.kind);
  const url = collaborationUrl(options.url);
  if (!url) throw new Error('Collaboration URL is required');
  let disposed = false;
  let failed = false;
  let shouldConnect = false;
  let connectAfterClose = false;
  let cacheLoaded = false;
  const publish = (status: ChannelStatus, synced = false) => {
    if (!disposed && !failed) options.onState({ status, synced });
  };
  const document = new Y.Doc();
  const socket = new HocuspocusProviderWebsocket({
    url, autoConnect: false, initialDelay: 0, delay: 1000, minDelay: 1000, maxDelay: 30000,
    factor: 2, jitter: true, maxAttempts: 0, messageReconnectTimeout: 45000,
    ...options.socketOptions,
  });
  const provider = new HocuspocusProvider({
    websocketProvider: socket, name, document, awareness: options.kind === 'database' ? null : undefined, forceSyncInterval: options.forceSyncInterval ?? 15000,
    onStatus: ({ status }) => {
      publish(status);
      if (status === 'disconnected' && connectAfterClose) {
        connectAfterClose = false;
        queueMicrotask(() => { if (!disposed && shouldConnect) connect(); });
      }
    },
    onSynced: ({ state }) => { if (state) publish('connected', true); },
    onAuthenticationFailed: () => {
      publish('error'); failed = true; socket.disconnect();
    },
  });
  provider.attach();
  const connect = () => {
    if (disposed || failed) return;
    shouldConnect = true;
    if (cache && !cacheLoaded) { publish('connecting'); return; }
    if (socket.status === 'connected') {
      if (socket.webSocket?.readyState === 1) publish('connected', provider.synced);
      else connectAfterClose = true;
      return;
    }
    publish('connecting');
    void socket.connect().catch(() => publish('disconnected'));
  };
  let cache: ReturnType<typeof createOfflineCache> | undefined;
  if (options.persistence !== false && typeof indexedDB !== 'undefined') {
    cache = createOfflineCache(url, name, document, state => {
      if (disposed) return;
      options.onCacheState?.(state);
      if (state === 'error') { publish('error'); failed = true; socket.disconnect(); }
    });
    void cache.ready.then(success => {
      if (disposed) return;
      if (!success) { publish('error'); return; }
      cacheLoaded = true; options.onLocalReady?.();
      if (shouldConnect) connect();
    });
  } else options.onCacheState?.('unavailable');
  return {
    document, provider, socket, connect,
    cacheReady: cache?.ready ?? Promise.resolve(false),
    flushCache: () => cache?.flush() ?? Promise.resolve(false),
    disconnect() { if (!disposed) { shouldConnect = false; connectAfterClose = false; socket.disconnect(); publish('disconnected'); } },
    destroy() {
      if (disposed) return;
      disposed = true;
      const closing = cache?.destroy();
      provider.destroy(); socket.destroy(); document.destroy();
      return closing;
    },
  };
}
