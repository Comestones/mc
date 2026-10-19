import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createCollaborationSession } from '../src/collaboration/session.ts';
const requireSync = createRequire(new URL('../../mc_sync/package.json', import.meta.url));
const { WebSocket } = requireSync('ws');
const fixture = fileURLToPath(new URL('../../mc_sync/test/fixture-server.mjs', import.meta.url));
import { bindPage } from '../src/collaboration/pageBinding.ts';
import { same } from '../src/collaboration/pageModel.ts';
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
function client(t, url, page, pageId = 'page') {
  let snapshot = structuredClone(page), state, binding;
  const session = createCollaborationSession({ url, workspaceId: 'ws', pageId,
    onState: next => { state = next; if (next.synced) binding?.synchronize(); },
    socketOptions: { WebSocketPolyfill: WebSocket, delay: 50, minDelay: 50, maxDelay: 100, jitter: false },
  });
  binding = bindPage({ session, getSnapshot: () => snapshot, onSnapshot: next => { snapshot = next; } });
  t.after(() => { binding.destroy(); session.destroy(); });
  session.connect();
  return { session, binding, state: () => state, page: () => snapshot,
    edit(update) { snapshot = update(structuredClone(snapshot)); binding.localChanged(); } };
}
const block = (id, content, type = 'paragraph', properties) => ({ id, content, type, ...(properties ? { properties } : {}) });
const initial = { title: 'Shared page', blocks: [block('a', 'hello'), block('b', 'world')] };
async function pair(t) {
  const host = await server(t);
  const a = client(t, host.url, initial), b = client(t, host.url, initial);
  await waitFor(() => a.binding.ready && b.binding.ready && same(a.page(), b.page()), 'pair binding');
  return { host, a, b };
}
async function converged(a, b) { await waitFor(() => same(a.page(), b.page()), 'page convergence'); }

test('first-room seed is atomic: concurrent opens and stale late join do not duplicate or overwrite', { timeout: 15000 }, async t => {
  const { host, a, b } = await pair(t);
  assert.ok(same(a.page(), initial));
  assert.equal(a.page().blocks.length, 2);
  a.edit(page => ({ ...page, title: 'Server title' }));
  await waitFor(() => b.page().title === 'Server title', 'title sync');
  const late = client(t, host.url, { title: 'stale title', blocks: [block('other', 'stale')] });
  await waitFor(() => late.binding.ready, 'late join');
  assert.ok(same(late.page(), a.page()));
});

test('disconnected simultaneous edits to the same Y.Text merge without dropping either insertion', { timeout: 15000 }, async t => {
  const { a, b } = await pair(t);
  a.session.disconnect(); b.session.disconnect();
  await waitFor(() => a.state()?.status === 'disconnected' && b.state()?.status === 'disconnected', 'offline');
  a.edit(page => { page.blocks[0].content += '甲'; return page; });
  b.edit(page => { page.blocks[0].content += '乙'; return page; });
  a.session.connect(); b.session.connect();
  await waitFor(() => a.page().blocks[0].content.includes('乙') && b.page().blocks[0].content.includes('甲'), 'same block merge');
  await converged(a, b);
  assert.equal(a.page().blocks[0].content.length, 'hello甲乙'.length);
});

test('concurrent different-block edits, title changes and independent properties survive', { timeout: 15000 }, async t => {
  const { a, b } = await pair(t);
  a.edit(page => { page.blocks[0].content = 'A'; page.blocks[0].type = 'todo'; page.blocks[0].properties = { checked: true, level: 0 }; return page; });
  b.edit(page => { page.title = 'B title'; page.blocks[1].content = 'B'; return page; });
  await waitFor(() => b.page().blocks[0].content === 'A' && a.page().blocks[1].content === 'B', 'independent edits');
  await converged(a, b);
  assert.equal(a.page().title, 'B title'); assert.equal(a.page().blocks[0].properties.checked, true);
});

test('block insert/delete/reorder and nested child content converge with stable unique IDs', { timeout: 15000 }, async t => {
  const { a, b } = await pair(t);
  a.edit(page => { page.blocks.push({ ...block('code', 'const x = 1', 'code', { language: 'javascript', wrap: true }), children: [block('child', 'child')] }); return page; });
  await waitFor(() => b.page().blocks.some(node => node.id === 'code'), 'insert');
  b.edit(page => { page.blocks = [page.blocks[2], page.blocks[0]]; return page; });
  await converged(a, b);
  assert.deepEqual(a.page().blocks.map(node => node.id), ['code', 'a']);
  assert.equal(a.page().blocks[0].children[0].content, 'child');
  a.session.disconnect(); b.session.disconnect();
  await pause(60);
  a.edit(page => { page.blocks.reverse(); return page; });
  b.edit(page => { page.blocks.unshift(block('new', 'new')); return page; });
  a.session.connect(); b.session.connect();
  await waitFor(() => a.page().blocks.some(node => node.id === 'new'), 'concurrent insert');
  await converged(a, b);
  const ids = a.page().blocks.map(node => node.id);
  assert.equal(new Set(ids).size, ids.length); assert.equal(ids.length, 3);
});

test('local undo/redo preserves another user text and excludes server initialization', { timeout: 15000 }, async t => {
  const { a, b } = await pair(t);
  a.binding.undo(); assert.ok(same(a.page(), initial));
  a.edit(page => { page.blocks[0].content += '甲'; return page; });
  await waitFor(() => b.page().blocks[0].content.includes('甲'), 'A insertion');
  b.edit(page => { page.blocks[0].content += '乙'; return page; });
  await waitFor(() => a.page().blocks[0].content.includes('乙'), 'B insertion');
  a.binding.undo();
  await converged(a, b);
  assert.equal(a.page().blocks[0].content, 'hello乙');
  a.binding.redo(); await converged(a, b);
  assert.ok(a.page().blocks[0].content.includes('甲')); assert.ok(a.page().blocks[0].content.includes('乙'));
});

test('remote delete wins over a concurrent stale text update and destruction stops reflection', { timeout: 15000 }, async t => {
  const { a, b } = await pair(t);
  b.session.disconnect(); await pause(50);
  a.edit(page => { page.blocks = page.blocks.filter(node => node.id !== 'a'); return page; });
  b.edit(page => { page.blocks[0].content = 'stale update'; return page; });
  b.session.connect();
  await waitFor(() => !b.page().blocks.some(node => node.id === 'a'), 'delete wins');
  await converged(a, b);
  b.binding.destroy();
  a.edit(page => ({ ...page, title: 'After destroy' })); await pause(100);
  assert.notEqual(b.page().title, 'After destroy');
});

test('edits made during initial handshake are retained and pages remain isolated', { timeout: 15000 }, async t => {
  const { host, a } = await pair(t);
  const pending = client(t, host.url, initial);
  pending.edit(page => { page.blocks[0].content += 'buffered'; return page; });
  await waitFor(() => pending.binding.ready && a.page().blocks[0].content.includes('buffered'), 'buffered write');
  const isolated = client(t, host.url, { title: 'Other', blocks: [block('z', 'private')] }, 'other');
  await waitFor(() => isolated.binding.ready, 'isolated page');
  assert.equal(isolated.page().title, 'Other'); assert.equal(isolated.page().blocks[0].id, 'z');
});


test('UTF-16 emoji edits remain well formed and synchronize as whole characters', { timeout: 15000 }, async t => {
  const host = await server(t);
  const page = { title: '😀', blocks: [block('emoji', '😀')] };
  const a = client(t, host.url, page), b = client(t, host.url, page);
  await waitFor(() => a.binding.ready && b.binding.ready, 'emoji pages');
  a.edit(value => { value.title = '😁'; value.blocks[0].content = '😁'; return value; });
  await waitFor(() => b.page().title === '😁' && b.page().blocks[0].content === '😁', 'emoji replacement');
  assert.equal(b.page().blocks[0].content.isWellFormed(), true);
});
