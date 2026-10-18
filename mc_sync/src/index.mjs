import { createSyncServer, listenSyncServer, readConfig } from './server.mjs';

try {
  const server = await listenSyncServer(createSyncServer(readConfig()));
  console.log(`mc-sync listening at ${server.webSocketURL}; health ${server.httpURL}/healthz (memory only)`);
  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    const deadline = setTimeout(() => process.exit(1), 5000);
    deadline.unref();
    try { await server.destroy(); clearTimeout(deadline); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
} catch (error) {
  console.error(`mc-sync startup failed: ${error.message}`);
  process.exitCode = 1;
}
