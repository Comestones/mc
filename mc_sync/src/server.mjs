import { createAuthService } from './auth/service.mjs';
import { authHttp } from './auth/http.mjs';
import { createPostgresStore } from './postgresStore.mjs';
import { createPersistence } from './persistence.mjs';
import { seedDatabase } from './databaseSeed.mjs';
import { seedPage } from './pageSeed.mjs';
import { Server } from '@hocuspocus/server';

const DEFAULT_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:4173', 'http://127.0.0.1:4173'];
function integer(value, fallback, min, max, name) {
  if (value === undefined || value === '') return fallback;
  if (!/^\d+$/.test(String(value))) throw new Error(`${name} must be an integer`);
  const number = Number(value);
  if (number < min || number > max) throw new Error(`${name} out of range`);
  return number;
}
export function readConfig(env = process.env) {
  const address = env.MC_SYNC_HOST || '127.0.0.1';
  const origins = (env.MC_SYNC_ORIGINS ? env.MC_SYNC_ORIGINS.split(',') : DEFAULT_ORIGINS).map(value => value.trim());
  if (origins.some(value => {
    try { const url = new URL(value); return !['http:', 'https:'].includes(url.protocol) || url.origin !== value; }
    catch { return true; }
  })) throw new Error('MC_SYNC_ORIGINS must contain exact HTTP(S) origins');
  const authMode = env.MC_AUTH_MODE || 'local';
  if (!['local', 'required'].includes(authMode)) throw new Error('MC_AUTH_MODE must be local or required');
  if (authMode === 'local' && (!['127.0.0.1', '::1', 'localhost'].includes(address) || env.MC_AUTH_SECRET)) throw new Error('Local mode requires loopback and no authentication secret');
  if (authMode === 'required' && (!env.MC_SYNC_DATABASE_URL || Buffer.byteLength(env.MC_AUTH_SECRET || '') < 32)) throw new Error('Required authentication needs PostgreSQL and a secret of at least 32 bytes');
  return { authMode, authSecret: env.MC_AUTH_SECRET, address, port: integer(env.MC_SYNC_PORT, 1234, 1, 65535, 'MC_SYNC_PORT'),
    databaseUrl: env.MC_SYNC_DATABASE_URL?.trim() || undefined,
    debounce: integer(env.MC_SYNC_STORE_DEBOUNCE_MS, 500, 0, 60000, 'MC_SYNC_STORE_DEBOUNCE_MS'),
    maxDebounce: integer(env.MC_SYNC_STORE_MAX_DEBOUNCE_MS, 5000, 1, 300000, 'MC_SYNC_STORE_MAX_DEBOUNCE_MS'),
    timeout: integer(env.MC_SYNC_TIMEOUT_MS, 60000, 1000, 300000, 'MC_SYNC_TIMEOUT_MS'), origins };
}
export function validRoom(name) {
  if (typeof name !== 'string' || name.length > 1024) return false;
  const parts = name.split('/');
  const start = parts.length === 4 && parts[0] === 'mc' && parts[1] === 'v1' ? 2
    : parts.length === 5 && parts[0] === 'mc' && parts[1] === 'db' && parts[2] === 'v1' ? 3 : 0;
  if (!start) return false;
  return parts.slice(start).every(part => {
    try {
      const decoded = decodeURIComponent(part);
      return decoded.length > 0 && decoded.length <= 128 && !/[\u0000-\u001f\u007f]/.test(decoded) && encodeURIComponent(decoded) === part;
    } catch { return false; }
  });
}
export function createSyncServer(options = {}) {
  const { origins = DEFAULT_ORIGINS, databaseUrl, snapshotStore, persistenceRetryMs, authMode = 'local', authSecret, ...configuration } = options;
  if (!['local', 'required'].includes(authMode)) throw new Error('Invalid authentication mode');
  if (authMode === 'local' && (authSecret || !['127.0.0.1', '::1', 'localhost'].includes(configuration.address || '127.0.0.1'))) throw new Error('Local mode requires loopback and no authentication secret');
  const auth = authMode === 'required' ? createAuthService({ databaseUrl, secret: authSecret }) : null;
  const handleAuth = auth ? authHttp(auth, origins) : null;
  const authConnections = new Set();
  const denied = { code: 4401, reason: 'Authorization expired or revoked' };
  const store = snapshotStore ?? (databaseUrl ? createPostgresStore({ url: databaseUrl }) : null);
  const persistence = store ? createPersistence(store, { retryMs: persistenceRetryMs }) : null;
  const server = new Server({
    name: 'mc-sync', address: '127.0.0.1', port: 1234, timeout: 60000,
    stopOnSignals: false, quiet: true, debounce: 500, maxDebounce: 5000,
    extensions: persistence ? [persistence.extension] : [],
    websocketOptions: { maxPayload: 1024 * 1024 },
    async onUpgrade({ request, socket }) {
      const origin = request.headers.origin;
      if (origin && !origins.includes(origin)) {
        socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
        throw null; // Hocuspocus hook contract: abort the default upgrade after writing response.
      }
    },
    async onAuthenticate({ documentName, token }) {
      if (!validRoom(documentName)) throw new Error('Invalid mc room');
      if (!auth) return;
      try {
        const identity = await auth.authenticate(token);
        await auth.authorize(identity, documentName);
        return { identity };
      } catch { throw new Error('Unauthorized'); }
    },
    async beforeHandleMessage({ context, documentName }) {
      if (auth) { try { await auth.authorize(context.identity, documentName); } catch { throw denied; } }
    },
    async connected({ connection, context, documentName }) {
      if (!auth) return;
      let checking = false;
      const expiry = setTimeout(() => connection.close(denied), Math.max(0, context.identity.expiresAt - Date.now()));
      const timer = setInterval(async () => {
        if (checking) return;
        checking = true;
        try { await auth.authorize(context.identity, documentName); }
        catch { connection.close(denied); }
        finally { checking = false; }
      }, 5000);
      expiry.unref(); timer.unref();
      const clean = () => { clearTimeout(expiry); clearInterval(timer); authConnections.delete(clean); };
      authConnections.add(clean); connection.onClose(clean);
    },
    async onStateless({ document, documentName, payload }) {
      try {
        const request = JSON.parse(payload);
        if (documentName.startsWith('mc/db/v1/')) seedDatabase(document, request, decodeURIComponent(documentName.split('/')[4]));
        else seedPage(document, request);
      } catch { /* Ignore malformed initialization requests. */ }
    },
    async onRequest({ request, response }) {
      if (handleAuth && await handleAuth(request, response)) throw null;
      const healthy = request.method === 'GET' && request.url === '/healthz';
      const state = healthy && persistence ? await persistence.health() : { healthy: true };
      if (healthy && auth) { try { await auth.check(); } catch { state.healthy = false; } }
      response.writeHead(healthy ? state.healthy ? 200 : 503 : 404, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify(healthy ? { status: state.healthy ? 'ok' : 'degraded', service: 'mc-sync', authentication: authMode, storage: store?.kind ?? 'memory', protocol: 'mc/v1', ...(persistence ? { persistence: state } : {}) } : { error: 'Not found' }));
      throw null;
    },
    ...configuration,
  });
  // Hocuspocus closes document sessions; upgraded TCP sockets also need closing on shutdown.
  const sockets = new Set();
  server.httpServer.on('connection', socket => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  });
  server.persistence = persistence;
  server.auth = auth;
  const destroy = server.destroy.bind(server);
  let shutdown;
  server.destroy = () => shutdown ??= (async () => {
    if (persistence) {
      server.hocuspocus.closeConnections();
      await persistence.flush(server.hocuspocus.documents);
    }
    for (const clean of authConnections) clean();
    await destroy();
    for (const socket of sockets) socket.destroy();
    await persistence?.close();
    await auth?.close();
  })().catch(error => { shutdown = undefined; throw error; });
  return server;
}
export async function listenSyncServer(server) {
  let rejectListen;
  const failed = new Promise((_, reject) => { rejectListen = reject; });
  const onError = error => rejectListen(error);
  server.httpServer.once('error', onError);
  try {
    await server.auth?.initialize();
    await server.persistence?.store.initialize();
    await Promise.race([server.listen(), failed]);
  } catch (error) {
    if (!server.httpServer.listening) { await server.persistence?.close(); await server.auth?.close(); }
    throw error;
  }
  finally { server.httpServer.off('error', onError); }
  return server;
}
