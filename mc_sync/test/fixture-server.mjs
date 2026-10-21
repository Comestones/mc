import { createSyncServer, listenSyncServer } from '../src/server.mjs';
const server = await listenSyncServer(createSyncServer({ port: Number(process.env.MC_TEST_PORT || 0), databaseUrl: process.env.MC_TEST_DATABASE_URL, debounce: Number(process.env.MC_TEST_STORE_DEBOUNCE_MS || 50), maxDebounce: 200 }));
process.send?.({ port: server.address.port });
process.on('message', async message => {
  if (message === 'disconnect') server.hocuspocus.closeConnections();
  if (message === 'shutdown') { try { await server.destroy(); process.disconnect(); } catch (error) { console.error(error.message); process.exit(1); } }
});
