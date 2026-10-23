import { monitorEventLoopDelay } from 'node:perf_hooks';
import { createPostgresStore } from '../src/postgresStore.mjs';
import { createSyncServer, listenSyncServer } from '../src/server.mjs';
let stores = 0;
const underlying = process.env.MC_TEST_METRICS && process.env.MC_TEST_DATABASE_URL ? createPostgresStore({ url: process.env.MC_TEST_DATABASE_URL }) : undefined;
const snapshotStore = underlying ? { ...underlying, async save(...args) { await underlying.save(...args); stores++; } } : undefined;
const loop = process.env.MC_TEST_METRICS ? monitorEventLoopDelay({ resolution: 10 }) : undefined; loop?.enable();
const server = await listenSyncServer(createSyncServer({ port: Number(process.env.MC_TEST_PORT || 0), snapshotStore, databaseUrl: process.env.MC_TEST_DATABASE_URL, debounce: Number(process.env.MC_TEST_STORE_DEBOUNCE_MS || 50), maxDebounce: Number(process.env.MC_TEST_STORE_MAX_DEBOUNCE_MS || 200) }));
process.send?.({ port: server.address.port });
process.on('message', async message => {
  if (message?.type === 'metrics') { const documents = Array.from(server.hocuspocus.documents.values()); process.send?.({ type: 'metrics', id: message.id, documents: documents.length, connections: documents.reduce((sum, doc) => sum + doc.getConnectionsCount(), 0), stores, rssBytes: process.memoryUsage().rss, eventLoopP95Ms: Number(((loop?.percentile(95) ?? 0) / 1e6).toFixed(2)) }); }
  if (message === 'disconnect') server.hocuspocus.closeConnections();
  if (message === 'shutdown') { try { await server.destroy(); loop?.disable(); process.disconnect(); } catch (error) { console.error(error.message); process.exit(1); } }
});
