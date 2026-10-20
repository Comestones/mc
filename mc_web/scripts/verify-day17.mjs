import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as Y from 'yjs';
import { createCollaborationSession } from '../src/collaboration/session.ts';
import { bindPresence, decodeCursor } from '../src/collaboration/presence.ts';
const { WebSocket } = createRequire(new URL('../../mc_sync/package.json', import.meta.url))('ws');
const fixture = fileURLToPath(new URL('../../mc_sync/test/fixture-server.mjs', import.meta.url));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(predicate, label, timeout = 10000) {
  const start = Date.now();
  while (!predicate()) { if (Date.now() - start > timeout) throw new Error(`Timed out: ${label}`); await pause(20); }
}
async function server(t) {
  const child = fork(fixture, { env: { ...process.env, MC_TEST_PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  let stderr = ''; child.stderr.on('data', chunk => { stderr += chunk; });
  const ready = await Promise.race([
    once(child, 'message').then(([message]) => message),
    once(child, 'exit').then(([code]) => { throw new Error(`Server exit ${code}: ${stderr}`); }),
  ]);
  t.after(async () => {
    const exit = once(child, 'exit'); child.send('shutdown');
    const deadline = setTimeout(() => child.kill(), 3000);
    const [code] = await exit; clearTimeout(deadline);
    assert.equal(code, 0, 'server must shut down without deadline kill');
  });
  return { url: `ws://127.0.0.1:${ready.port}` };
}
function client(t, url, pageId = 'p', workspaceId = 'ws', name = '甲') {
  let presence, members = [], state;
  const session = createCollaborationSession({ url, workspaceId, pageId,
    onState: next => { state = next; presence?.setConnected(next.synced); },
    socketOptions: { WebSocketPolyfill: WebSocket, delay: 50, minDelay: 50, maxDelay: 100, jitter: false } });
  presence = bindPresence({ document: session.document, awareness: session.provider.awareness, name,
    onMembers: next => { members = next; } });
  t.after(() => { presence.destroy(); session.destroy(); });
  session.connect();
  return { session, presence, members: () => members, state: () => state };
}
async function pair(t) {
  const host = await server(t), a = client(t, host.url), b = client(t, host.url, 'p', 'ws', '乙');
  await waitFor(() => a.members().length === 2 && b.members().length === 2, 'two members');
  return { host, a, b };
}
function title(doc) { const root = doc.getMap('page'); if (!root.has('title')) root.set('title', new Y.Text('hello')); return root.get('title'); }

test('join, rename, disconnect, reconnect and destroy remove membership', { timeout: 15000 }, async t => {
  const { a, b } = await pair(t);
  assert.equal(a.members().filter(member => member.self).length, 1);
  a.presence.rename('  中文协作者  ');
  await waitFor(() => b.members().some(member => member.name === '中文协作者'), 'rename');
  b.session.disconnect();
  await waitFor(() => a.members().length === 1 && b.members().length === 0, 'disconnect removal');
  b.session.connect();
  await waitFor(() => a.members().length === 2 && b.members().length === 2, 'reconnect presence');
  b.presence.destroy(); b.session.destroy();
  await waitFor(() => a.members().length === 1, 'destroy removal');
});
test('relative backward range follows remote edits; awareness adds no document updates', { timeout: 15000 }, async t => {
  const { a, b } = await pair(t);
  title(a.session.document);
  await waitFor(() => b.session.document.getMap('page').has('title'), 'title sync');
  let updates = 0; a.session.document.on('update', () => updates++);
  a.presence.cursor({ field: 'title', anchor: 4, head: 1 });
  await waitFor(() => b.members().find(member => !member.self)?.cursor?.head === 1, 'cursor sync');
  assert.equal(updates, 0);
  title(b.session.document).insert(0, '远端');
  await waitFor(() => b.members().find(member => !member.self)?.cursor?.anchor === 6, 'relative insert');
  assert.equal(b.members().find(member => !member.self).cursor.head, 3);
  a.presence.cursor(null);
  await waitFor(() => b.members().find(member => !member.self)?.cursor === null, 'clear cursor');
});
test('room and workspace isolation exclude unrelated members', { timeout: 15000 }, async t => {
  const { host, a } = await pair(t);
  const otherPage = client(t, host.url, 'other'), otherWorkspace = client(t, host.url, 'p', 'other');
  await waitFor(() => otherPage.members().length === 1 && otherWorkspace.members().length === 1, 'isolated');
  assert.equal(a.members().length, 2);
  assert.equal(otherPage.members()[0].self, true);
  assert.equal(otherWorkspace.members()[0].self, true);
});
test('invalid profiles and cursor positions do not break valid peers', { timeout: 15000 }, async t => {
  const { a, b } = await pair(t);
  a.session.provider.awareness.setLocalState({ user: { name: 'Injected', color: 'url(evil)' }, cursor: {} });
  await waitFor(() => b.members().length === 1, 'invalid profile');
  a.presence.rename('valid');
  a.session.provider.awareness.setLocalStateField('cursor', { field: 'title', anchor: { type: { client: -1, clock: 0 } }, head: {} });
  await waitFor(() => b.members().length === 2, 'valid profile');
  assert.equal(b.members().find(member => !member.self).cursor, null);
  assert.equal(decodeCursor(b.session.document, { field: 'block', blockId: 'missing', anchor: [], head: [] }), null);
});
test('deleted targets hide the caret and disposed listeners stay silent', { timeout: 15000 }, async t => {
  const { a, b } = await pair(t);
  title(a.session.document);
  await waitFor(() => b.session.document.getMap('page').has('title'), 'title sync');
  a.presence.cursor({ field: 'title', anchor: 2, head: 2 });
  await waitFor(() => b.members().some(member => !member.self && member.cursor), 'cursor');
  b.session.document.getMap('page').delete('title');
  assert.equal(b.members().find(member => !member.self).cursor, null);
  b.presence.destroy(); a.presence.rename('later'); await pause(100);
  assert.deepEqual(b.members(), []);
});
