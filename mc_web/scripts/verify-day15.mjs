import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createCollaborationSession, collaborationUrl, roomName } from '../src/collaboration/session.ts';
const requireSync = createRequire(new URL('../../mc_sync/package.json', import.meta.url));
const { WebSocket } = requireSync('ws');
const fixture = fileURLToPath(new URL('../../mc_sync/test/fixture-server.mjs', import.meta.url));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(predicate, label, timeout = 10000) {
  const start = Date.now();
  while (!predicate()) { if (Date.now() - start > timeout) throw new Error(`Timed out: ${label}`); await pause(20); }
}
async function server(t, port = 0) {
  const child = fork(fixture, { env: { ...process.env, MC_TEST_PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  let stderr = ''; child.stderr.on('data', chunk => { stderr += chunk; });
  const ready = await Promise.race([
    once(child, 'message').then(([message]) => message),
    once(child, 'exit').then(([code]) => { throw new Error(`Server exit ${code}: ${stderr}`); }),
  ]);
  let stopped = false;
  const stop = async () => {
    if (stopped) return; stopped = true;
    const exit = once(child, 'exit');
    child.send('shutdown');
    const deadline = setTimeout(() => child.kill(), 3000);
    const [code] = await exit; clearTimeout(deadline);
    assert.equal(code, 0, 'server must shut down without deadline kill');
  };
  t.after(stop);
  return { url: `ws://127.0.0.1:${ready.port}`, port: ready.port, stop, child };
}
function client(t, url, workspaceId = 'ws', pageId = 'page', overrides = {}, forceSyncInterval = 15000) {
  let state;
  const history = [];
  const session = createCollaborationSession({ url, workspaceId, pageId,
    forceSyncInterval,
    onState: next => { state = next; history.push(next); },
    socketOptions: { WebSocketPolyfill: WebSocket, delay: 50, minDelay: 50, maxDelay: 100, jitter: false, ...overrides },
  });
  t.after(() => session.destroy());
  session.connect();
  return { ...session, history, state: () => state };
}

test('URL/room validation accepts encoded IDs and rejects credentials/protocols', () => {
  assert.equal(collaborationUrl(''), null);
  assert.equal(collaborationUrl('ws://127.0.0.1:1234'), 'ws://127.0.0.1:1234/');
  for (const value of ['http://example.com', 'ws://user:pass@localhost', 'ws://localhost/#x', 'ws://localhost/?token=x']) assert.throws(() => collaborationUrl(value));
  assert.equal(roomName('工作区', 'page/a'), 'mc/v1/%E5%B7%A5%E4%BD%9C%E5%8C%BA/page%2Fa');
  assert.throws(() => roomName('', 'page'));
});

test('production client exchanges actual Yjs transport updates and isolates workspace/page rooms', { timeout: 15000 }, async t => {
  const host = await server(t);
  const a = client(t, host.url), b = client(t, host.url);
  const otherPage = client(t, host.url, 'ws', 'other'), otherWorkspace = client(t, host.url, 'other', 'page');
  await waitFor(() => [a, b, otherPage, otherWorkspace].every(peer => peer.state()?.synced), 'initial sync');
  a.document.getMap('transport-test').set('a', 'hello');
  b.document.getMap('transport-test').set('b', 'world');
  await waitFor(() => a.document.getMap('transport-test').get('b') === 'world' && b.document.getMap('transport-test').get('a') === 'hello', 'bidirectional exchange');
  await pause(100);
  assert.equal(otherPage.document.getMap('transport-test').size, 0);
  assert.equal(otherWorkspace.document.getMap('transport-test').size, 0);
});

test('disconnect automatically reconnects; server restart resends in-memory client state', { timeout: 20000 }, async t => {
  const host = await server(t);
  const a = client(t, host.url);
  await waitFor(() => a.state()?.synced, 'initial sync');
  a.document.getMap('transport-test').set('before', 'restart');
  a.socket.webSocket.close();
  await waitFor(() => a.history.some(state => state.status === 'disconnected'), 'disconnected status');
  await waitFor(() => a.state()?.synced, 'automatic reconnect');
  await host.stop();
  await waitFor(() => a.state()?.status !== 'connected', 'server stopped');
  a.document.getMap('transport-test').set('during', 'offline');
  const restarted = await server(t, host.port);
  await waitFor(() => a.state()?.synced, 'restart reconnect');
  const b = client(t, restarted.url);
  await waitFor(() => b.state()?.synced && b.document.getMap('transport-test').get('during') === 'offline', 'resend state');
  assert.equal(b.document.getMap('transport-test').get('before'), 'restart');
});

test('server unavailable keeps retrying and later connects; destroy cancels callbacks/resources', { timeout: 15000 }, async t => {
  const host = await server(t); const port = host.port; await host.stop();
  const a = client(t, host.url);
  await pause(250);
  assert.equal(a.state()?.synced, false);
  await server(t, port);
  await waitFor(() => a.state()?.synced, 'late availability');
  a.destroy(); a.destroy();
  const count = a.history.length;
  await pause(300);
  assert.equal(a.history.length, count);
  assert.equal(a.socket.webSocket, null);
  assert.equal(a.document.isDestroyed, true);
});

test('watchdog reconnects a silent socket; forced sync keeps a healthy idle channel alive', { timeout: 15000 }, async t => {
  const host = await server(t);
  const a = client(t, host.url, 'ws', 'watchdog', { messageReconnectTimeout: 400 });
  await waitFor(() => a.state()?.synced, 'initial sync');
  const firstSocket = a.socket.webSocket;
  // A watchdog shorter than the heartbeat models a silent application-level channel.
  await waitFor(() => a.socket.webSocket !== firstSocket && a.state()?.synced, 'watchdog reconnect', 5000);
  assert.ok(a.history.some(state => state.status === 'disconnected'));
  const b = client(t, host.url, 'ws', 'healthy', { messageReconnectTimeout: 400 }, 100);
  await waitFor(() => b.state()?.synced, 'healthy sync');
  const healthySocket = b.socket.webSocket;
  await pause(700);
  assert.equal(b.socket.webSocket, healthySocket);
});


test('repeated online event preserves synced status; immediate offline/online race recovers', { timeout: 15000 }, async t => {
  const host = await server(t);
  const a = client(t, host.url);
  await waitFor(() => a.state()?.synced, 'initial sync');
  a.connect();
  assert.equal(a.state()?.synced, true);
  a.disconnect(); a.connect();
  await waitFor(() => a.state()?.synced, 'rapid offline-online reconnect');
});
