import { createSyncServer, listenSyncServer } from '../src/server.mjs';
const server = await listenSyncServer(createSyncServer({ port: Number(process.env.MC_TEST_PORT || 0) }));
process.send?.({ port: server.address.port });
process.on('message', async message => {
  if (message === 'disconnect') server.hocuspocus.closeConnections();
  if (message === 'shutdown') { await server.destroy(); process.disconnect(); }
});
