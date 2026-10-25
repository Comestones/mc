import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { SignJWT } from 'jose';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { WebSocket } from 'ws';
import * as Y from 'yjs';
import { startTestPostgres } from './postgresHarness.mjs';
import { createAuthService } from '../src/auth/service.mjs';
import { hashPassword, verifyPassword } from '../src/auth/password.mjs';
import { createSyncServer, listenSyncServer, readConfig } from '../src/server.mjs';
import * as schema from '../src/auth/schema.mjs';
let host, pool, server, auth;
const secret = 'test-only-secret-'.repeat(4), password = 'Test-only-password-2026';
const alice = randomUUID(), bob = randomUUID();
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(predicate, label, timeout = 12000) { const start = Date.now(); while (!await predicate()) { if (Date.now() - start > timeout) throw new Error(`Timeout: ${label}`); await pause(25); } }
async function request(path, { method = 'GET', token, data, origin } = {}) {
  const response = await fetch(`${server.httpURL}${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(data ? { 'Content-Type': 'application/json' } : {}), ...(origin ? { Origin: origin } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) });
  return { status: response.status, headers: response.headers, body: await response.json() };
}
function client(token, room = 'mc/v1/space-a/page') {
  const document = new Y.Doc(); let rejected = false;
  const provider = new HocuspocusProvider({ url: server.webSocketURL, name: room, token, document, WebSocketPolyfill: WebSocket,
    onAuthenticationFailed: () => { rejected = true; provider.configuration.websocketProvider.disconnect(); } });
  return { document, provider, get rejected() { return rejected; }, close() { provider.destroy(); provider.configuration.websocketProvider.destroy(); document.destroy(); } };
}
before(async () => {
  host = await startTestPostgres(); pool = new pg.Pool({ connectionString: host.url }); pool.on('error', () => {});
  server = await listenSyncServer(createSyncServer({ port: 0, databaseUrl: host.url, authMode: 'required', authSecret: secret })); auth = server.auth;
  const passwordHash = await hashPassword(password);
  await auth.db.insert(schema.users).values([{ id: alice, email: 'alice@example.test', displayName: 'Alice', passwordHash }, { id: bob, email: 'bob@example.test', displayName: 'Bob', passwordHash }]);
  await auth.db.insert(schema.workspaces).values([{ id: 'space-a', name: 'A', createdBy: alice }, { id: 'space-b', name: 'B', createdBy: bob }]);
  await auth.db.insert(schema.memberships).values([{ workspaceId: 'space-a', userId: alice, role: 'owner' }, { workspaceId: 'space-b', userId: bob, role: 'editor' }]);
  await auth.db.insert(schema.documentMeta).values([{ workspaceId: 'space-a', kind: 'page', id: 'page', createdBy: alice }, { workspaceId: 'space-a', kind: 'database', id: 'database', createdBy: alice }, { workspaceId: 'space-b', kind: 'page', id: 'page', createdBy: bob }]);
});
after(async () => { await server?.destroy(); await pool?.end(); await host?.stop(); });

test('configuration fails closed and password hashes are salted and bounded', async () => {
  for (const env of [{ MC_AUTH_MODE: 'typo' }, { MC_AUTH_MODE: 'required' }, { MC_AUTH_SECRET: secret }, { MC_SYNC_HOST: '0.0.0.0' }]) assert.throws(() => readConfig(env));
  assert.equal(readConfig({ MC_AUTH_MODE: 'required', MC_AUTH_SECRET: secret, MC_SYNC_DATABASE_URL: host.url }).authMode, 'required');
  assert.throws(() => createSyncServer({ address: '0.0.0.0' }));
  const a = await hashPassword(password), b = await hashPassword(password); assert.notEqual(a, b);
  assert.equal(await verifyPassword(password, a), true); assert.equal(await verifyPassword('wrong', a), false);
  assert.equal(await verifyPassword(password, undefined), false); await assert.rejects(hashPassword('short'));
  assert.equal(await verifyPassword('x'.repeat(1025), a), false);
});

test('versioned migrations are idempotent; Drizzle relationships and SQL constraints are real', async () => {
  await Promise.all([auth.initialize(), auth.initialize()]);
  assert.equal((await pool.query('SELECT count(*) FROM mc_auth_migrations')).rows[0].count, '1');
  await assert.rejects(auth.db.insert(schema.memberships).values({ workspaceId: 'space-a', userId: bob, role: 'invalid' }));
  await assert.rejects(auth.db.insert(schema.memberships).values({ workspaceId: 'missing', userId: bob, role: 'editor' }));
  await assert.rejects(auth.db.insert(schema.documentMeta).values({ workspaceId: 'space-a', kind: 'page', id: 'page', createdBy: alice }));
  await assert.rejects(auth.db.insert(schema.inviteTokens).values({ id: randomUUID(), workspaceId: 'space-a', createdBy: alice, tokenHash: 'hash', expiresAt: new Date(), maxUses: 1, uses: 2 }));
  await pool.query("UPDATE mc_auth_migrations SET checksum='invalid' WHERE version=1");
  await assert.rejects(auth.initialize(), /initialization failed/);
  // Restore from the immutable migration's digest, not by dropping existing tables/data.
  const { createHash } = await import('node:crypto'); const { readFile } = await import('node:fs/promises');
  const checksum = createHash('sha256').update((await readFile(new URL('../src/auth/0001.sql', import.meta.url), 'utf8')).replaceAll('\r\n', '\n')).digest('hex');
  await pool.query('UPDATE mc_auth_migrations SET checksum=$1 WHERE version=1', [checksum]);
  assert.equal((await pool.query('SELECT count(*) FROM mc_users')).rows[0].count, '2');
});

test('HTTP login, me, origin, malformed credentials, refresh replay and logout', async () => {
  assert.equal((await request('/api/me')).status, 401);
  assert.equal((await request('/api/auth/login', { method: 'POST', data: { email: 'missing@example.test', password } })).status, 401);
  assert.equal((await request('/api/auth/login', { method: 'POST', data: { email: 'alice@example.test', password: 'wrong' } })).status, 401);
  assert.equal((await request('/api/auth/login', { method: 'POST', origin: 'https://evil.example', data: { email: 'alice@example.test', password } })).status, 403);
  assert.equal((await request('/api/auth/login', { method: 'POST', data: { email: 'alice@example.test', password: 'x'.repeat(5000) } })).status, 413);
  assert.equal((await fetch(`${server.httpURL}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{broken' })).status, 400);
  assert.equal((await fetch(`${server.httpURL}/api/auth/login`, { method: 'POST', body: 'plaintext' })).status, 415);
  const login = await request('/api/auth/login', { method: 'POST', data: { email: ' Alice@Example.Test ', password }, origin: 'http://localhost:3000' });
  assert.equal(login.status, 200); assert.equal(login.headers.get('cache-control'), 'no-store'); assert.equal(login.headers.get('access-control-allow-origin'), 'http://localhost:3000');
  assert.equal(login.headers.get('set-cookie'), null);
  const me = await request('/api/me', { token: login.body.accessToken });
  assert.equal(me.status, 200); assert.deepEqual(me.body.workspaces.map(w => w.id), ['space-a']); assert.equal(me.body.user.passwordHash, undefined);
  const refresh = await request('/api/auth/refresh', { method: 'POST', data: { refreshToken: login.body.refreshToken } }); assert.equal(refresh.status, 200);
  assert.equal((await request('/api/auth/refresh', { method: 'POST', data: { refreshToken: login.body.refreshToken } })).status, 401);
  const row = (await pool.query('SELECT refresh_hash FROM mc_sessions ORDER BY created_at DESC LIMIT 1')).rows[0]; assert.notEqual(row.refresh_hash, refresh.body.refreshToken);
  assert.equal((await request('/api/auth/logout', { method: 'POST', token: refresh.body.accessToken })).status, 200);
  assert.equal((await request('/api/me', { token: login.body.accessToken })).status, 401);
  assert.equal((await request('/api/auth/refresh', { method: 'POST', data: { refreshToken: refresh.body.refreshToken } })).status, 401);
});

test('signature, algorithm, issuer, audience, expiry and database session checks reject forged tokens', async () => {
  const tokens = await auth.login('alice@example.test', password), identity = await auth.authenticate(tokens.accessToken);
  for (const variant of [{ secret: 'wrong'.repeat(10) }, { alg: 'HS384' }, { issuer: 'other' }, { audience: 'other' }, { expiry: '-1s' }, { sub: randomUUID() }, { sid: randomUUID() }]) {
    const token = await new SignJWT({ sid: variant.sid || identity.id }).setProtectedHeader({ alg: variant.alg || 'HS256', typ: 'JWT' })
      .setSubject(variant.sub || alice).setIssuer(variant.issuer || 'mc-sync').setAudience(variant.audience || 'mc-api').setIssuedAt().setExpirationTime(variant.expiry || '5m').sign(new TextEncoder().encode(variant.secret || secret));
    await assert.rejects(auth.authenticate(token));
  }
  await pool.query('UPDATE mc_users SET disabled_at=now() WHERE id=$1', [alice]);
  await assert.rejects(auth.authenticate(tokens.accessToken)); await assert.rejects(auth.refresh(tokens.refreshToken));
  await pool.query('UPDATE mc_users SET disabled_at=NULL WHERE id=$1', [alice]);
  await pool.query('UPDATE mc_sessions SET expires_at=now() WHERE id=$1', [identity.id]);
  await assert.rejects(auth.authenticate(tokens.accessToken));
});

test('concurrent refresh consumes once and sessions survive a new auth service instance', async () => {
  const tokens = await auth.login('alice@example.test', password);
  const outcomes = await Promise.allSettled([auth.refresh(tokens.refreshToken), auth.refresh(tokens.refreshToken)]);
  assert.equal(outcomes.filter(x => x.status === 'fulfilled').length, 1);
  const second = createAuthService({ databaseUrl: host.url, secret });
  try { await second.initialize(); assert.equal((await second.authenticate(outcomes.find(x => x.status === 'fulfilled').value.accessToken)).userId, alice); }
  finally { await second.close(); }
});

test('real WebSocket authorization protects pages, databases, missing metadata and tenant boundaries', async () => {
  const tokens = await auth.login('alice@example.test', password), clients = [];
  try {
    for (const [token, room] of [['', 'mc/v1/space-a/page'], [tokens.accessToken, 'mc/v1/space-b/page'], [tokens.accessToken, 'mc/v1/space-a/missing'], [tokens.accessToken, 'mc/db/v1/space-a/page']]) {
      const c = client(token, room); clients.push(c); await waitFor(() => c.rejected, 'rejected room'); assert.equal(c.provider.synced, false);
    }
    const a = client(tokens.accessToken), b = client(tokens.accessToken), database = client(tokens.accessToken, 'mc/db/v1/space-a/database'); clients.push(a,b,database);
    await waitFor(() => a.provider.synced && b.provider.synced && database.provider.synced, 'authorized clients');
    a.document.getText('test').insert(0, 'authorized edit'); await waitFor(() => b.document.getText('test').toString() === 'authorized edit', 'edit propagated');
    await auth.logout(await auth.authenticate(tokens.accessToken));
    await waitFor(() => server.hocuspocus.getConnectionsCount() === 0, 'passive revoked readers closed');
  } finally { clients.forEach(c => c.close()); }
});

test('membership removal and metadata deletion invalidate existing room access', async () => {
  const tokens = await auth.login('alice@example.test', password), identity = await auth.authenticate(tokens.accessToken);
  await auth.authorize(identity, 'mc/v1/space-a/page');
  await pool.query("UPDATE mc_document_meta SET deleted_at=now() WHERE workspace_id='space-a' AND kind='page'");
  await assert.rejects(auth.authorize(identity, 'mc/v1/space-a/page'));
  await pool.query("UPDATE mc_document_meta SET deleted_at=NULL WHERE workspace_id='space-a' AND kind='page'");
  const c = client(tokens.accessToken);
  await waitFor(() => c.provider.synced, 'member connected before removal');
  await pool.query("DELETE FROM mc_memberships WHERE workspace_id='space-a' AND user_id=$1", [alice]);
  await assert.rejects(auth.authorize(identity, 'mc/v1/space-a/page'));
  try {
    c.document.getText('test').insert(0, 'DENIED-WRITE');
    await waitFor(() => server.hocuspocus.getConnectionsCount() === 0, 'revoked writer closed');
    const { decodeSnapshot } = await import('../src/snapshotCodec.mjs');
    await waitFor(async () => !(server.hocuspocus.documents.has('mc/v1/space-a/page')), 'document persisted and unloaded');
    const row = (await pool.query("SELECT * FROM mc_yjs_documents WHERE document_name='mc/v1/space-a/page'")).rows[0];
    const restored = new Y.Doc(); Y.applyUpdate(restored, decodeSnapshot(row));
    assert.equal(restored.getText('test').toString().includes('DENIED-WRITE'), false); restored.destroy();
  } finally { c.close(); await auth.db.insert(schema.memberships).values({ workspaceId: 'space-a', userId: alice, role: 'owner' }); }
});

test('short access expiry and real database outage fail closed, then recover', async () => {
  const short = createAuthService({ databaseUrl: host.url, secret, accessSeconds: 1 });
  try {
    const tokens = await short.login('alice@example.test', password);
    const c = client(tokens.accessToken);
    try {
      await waitFor(() => c.provider.synced, 'short lived access connected');
      await waitFor(() => server.hocuspocus.getConnectionsCount() === 0, 'access expiry closes passive client');
      await assert.rejects(short.authenticate(tokens.accessToken));
    } finally { c.close(); }
    assert.ok((await short.refresh(tokens.refreshToken)).accessToken);
  } finally { await short.close(); }
  const tokens = await auth.login('alice@example.test', password);
  await host.postgres.stop();
  try { assert.equal((await request('/api/me', { token: tokens.accessToken })).status, 503); assert.equal((await request('/healthz')).status, 503); }
  finally { await host.postgres.start(); }
  assert.equal((await request('/api/me', { token: tokens.accessToken })).status, 200);
});

test('HTTP throttles bounded credential attempts without trusting forwarded headers', async () => {
  const statuses = [];
  for (let i = 0; i < 32; i++) statuses.push((await request('/api/me')).status);
  assert.ok(statuses.includes(429)); assert.ok(statuses.every(status => [401,429].includes(status)));
});
