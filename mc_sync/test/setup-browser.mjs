// Disposable browser acceptance server. No default production account is created.
import { startTestPostgres } from './postgresHarness.mjs';
import { createSyncServer, listenSyncServer } from '../src/server.mjs';
const host = await startTestPostgres();
let server;
try {
 server = await listenSyncServer(createSyncServer({port:1243,databaseUrl:host.url,authMode:'required',authSecret:'day23-browser-secret-for-test-only',setupToken:'day23-browser-setup-key-for-test-only',origins:['http://127.0.0.1:3023']}));
 console.log('DAY23 browser fixture ready on 127.0.0.1:1243. Send stop to clean up.');
 process.stdin.setEncoding('utf8'); process.stdin.resume();
 await new Promise(resolve=>process.stdin.once('data',resolve));
} finally { await server?.destroy(); await host.stop(); process.stdin.pause(); }
