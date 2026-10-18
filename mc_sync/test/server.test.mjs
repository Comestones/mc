import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { createSyncServer, listenSyncServer, readConfig, validRoom } from '../src/server.mjs';

test('configuration defaults, strict ranges, origins and encoded room contract', () => {
  assert.equal(readConfig({}).address, '127.0.0.1');
  assert.equal(readConfig({}).port, 1234);
  for (const value of ['0', '-1', 'abc', '1234.5', '65536']) assert.throws(() => readConfig({ MC_SYNC_PORT: value }));
  assert.throws(() => readConfig({ MC_SYNC_TIMEOUT_MS: '100' }));
  assert.throws(() => readConfig({ MC_SYNC_ORIGINS: '*' }));
  assert.throws(() => readConfig({ MC_SYNC_ORIGINS: 'http://localhost:3000/path' }));
  assert.equal(validRoom('mc/v1/workspace/page'), true);
  assert.equal(validRoom(`mc/v1/${encodeURIComponent('工作区')}/${encodeURIComponent('page/a')}`), true);
  for (const name of ['', 'test', 'mc/v1//page', 'mc/v1/ws/a/b', 'mc/v1/ws/%ZZ', 'mc/v1/ws/%00', `mc/v1/ws/${'a'.repeat(129)}`]) assert.equal(validRoom(name), false);
});

test('real health HTTP, 404, allowed and rejected browser origins, clean shutdown', async t => {
  const server = await listenSyncServer(createSyncServer({ port: 0 }));
  t.after(() => server.destroy());
  const url = server.httpURL;
  const response = await fetch(`${url}/healthz`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).storage, 'memory');
  assert.equal((await fetch(`${url}/missing`)).status, 404);
  const allowed = new WebSocket(server.webSocketURL, { origin: 'http://localhost:3000' });
  await new Promise((resolve, reject) => { allowed.once('open', resolve); allowed.once('error', reject); });
  allowed.close();
  const rejected = new WebSocket(server.webSocketURL, { origin: 'https://untrusted.example' });
  await new Promise((resolve, reject) => {
    rejected.once('unexpected-response', (_request, incoming) => { assert.equal(incoming.statusCode, 403); incoming.resume(); rejected.terminate(); resolve(); });
    rejected.once('open', () => reject(new Error('Unexpected origin accepted')));
    rejected.on('error', () => {});
  });
});

test('occupied port rejects startup instead of hanging or uncaught error', async t => {
  const first = await listenSyncServer(createSyncServer({ port: 0 }));
  t.after(() => first.destroy());
  const second = createSyncServer({ port: first.address.port });
  await assert.rejects(listenSyncServer(second), { code: 'EADDRINUSE' });
  await second.destroy();
});
