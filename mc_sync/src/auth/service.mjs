import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq, isNull, gt, sql } from 'drizzle-orm';
import { SignJWT, jwtVerify } from 'jose';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import * as schema from './schema.mjs';
import { verifyPassword } from './password.mjs';
const digest = value => createHash('sha256').update(value).digest('hex');
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export class AuthError extends Error { constructor(status = 401) { super(status === 403 ? 'Forbidden' : status === 429 ? 'Too many requests' : 'Unauthorized'); this.status = status; } }
export function createAuthService({ databaseUrl, secret, accessSeconds = 900 }) {
  if (!databaseUrl || typeof secret !== 'string' || Buffer.byteLength(secret) < 32) throw new Error('Required authentication needs PostgreSQL and a secret of at least 32 bytes');
  const key = new TextEncoder().encode(secret);
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 5, connectionTimeoutMillis: 3000, statement_timeout: 5000, query_timeout: 6000 });
  pool.on('error', () => {});
  const db = drizzle(pool, { schema });
  let closed = false;
  const liveSession = async (id, userId) => {
    const rows = await db.select({ id: schema.sessions.id, userId: schema.users.id, email: schema.users.email, displayName: schema.users.displayName })
      .from(schema.sessions).innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
      .where(and(eq(schema.sessions.id, id), eq(schema.sessions.userId, userId), isNull(schema.sessions.revokedAt), isNull(schema.users.disabledAt), gt(schema.sessions.expiresAt, sql`now()`)));
    if (!rows.length) throw new AuthError();
    return rows[0];
  };
  const issue = async (id, userId, refreshToken) => ({
    accessToken: await new SignJWT({ sid: id }).setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).setSubject(userId)
      .setIssuer('mc-sync').setAudience('mc-api').setIssuedAt().setExpirationTime(`${accessSeconds}s`).sign(key),
    expiresIn: accessSeconds, refreshToken,
  });
  return {
    db,
    async initialize() {
      const migration = (await readFile(new URL('./0001.sql', import.meta.url), 'utf8')).replaceAll('\r\n', '\n');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query("SET LOCAL lock_timeout = '5s'");
        await client.query('SELECT pg_advisory_xact_lock(220022)');
        await client.query('CREATE TABLE IF NOT EXISTS mc_auth_migrations (version integer PRIMARY KEY, checksum text NOT NULL)');
        const existing = await client.query('SELECT checksum FROM mc_auth_migrations WHERE version=1');
        if (existing.rows.length && existing.rows[0].checksum !== digest(migration)) throw new Error('Authentication migration checksum mismatch');
        if (!existing.rows.length) {
          await client.query(migration);
          await client.query('INSERT INTO mc_auth_migrations VALUES (1,$1)', [digest(migration)]);
        }
        await client.query('COMMIT');
      } catch { await client.query('ROLLBACK').catch(() => {}); throw new Error('Authentication schema initialization failed'); }
      finally { client.release(); }
    },
    async check() { await pool.query('SELECT 1 FROM mc_auth_migrations LIMIT 1'); },
    async login(email, password) {
      const normalized = typeof email === 'string' ? email.trim().toLowerCase() : '';
      if (!normalized || normalized.length > 254 || typeof password !== 'string') throw new AuthError();
      const [user] = await db.select().from(schema.users).where(eq(schema.users.email, normalized));
      const valid = await verifyPassword(password, user?.passwordHash);
      if (!valid || user.disabledAt) throw new AuthError();
      const id = randomUUID(), refreshToken = randomBytes(32).toString('base64url');
      await db.insert(schema.sessions).values({ id, userId: user.id, refreshHash: digest(refreshToken), expiresAt: sql`now() + interval '7 days'` });
      return issue(id, user.id, refreshToken);
    },
    async authenticate(token) {
      let payload;
      try {
        if (typeof token !== 'string' || token.length > 4096) throw null;
        ({ payload } = await jwtVerify(token, key, { algorithms: ['HS256'], typ: 'JWT', issuer: 'mc-sync', audience: 'mc-api', requiredClaims: ['exp','iat','sub','sid'], maxTokenAge: `${accessSeconds}s` }));
        if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string' || !uuidPattern.test(payload.sub) || !uuidPattern.test(payload.sid)) throw null;
      } catch { throw new AuthError(); }
      return { ...await liveSession(payload.sid, payload.sub), expiresAt: payload.exp * 1000 };
    },
    async refresh(token) {
      if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new AuthError();
      const replacement = randomBytes(32).toString('base64url');
      // Atomic compare-and-swap: concurrent refreshes cannot both consume the same token.
      const result = await pool.query(`UPDATE mc_sessions s SET refresh_hash=$2 FROM mc_users u
        WHERE s.refresh_hash=$1 AND s.user_id=u.id AND s.revoked_at IS NULL AND s.expires_at>now() AND u.disabled_at IS NULL RETURNING s.id,s.user_id`, [digest(token), digest(replacement)]);
      if (!result.rows.length) throw new AuthError();
      return issue(result.rows[0].id, result.rows[0].user_id, replacement);
    },
    async logout(identity) { await db.update(schema.sessions).set({ revokedAt: new Date() }).where(eq(schema.sessions.id, identity.id)); },
    async me(identity) {
      const workspaces = await db.select({ id: schema.workspaces.id, name: schema.workspaces.name, role: schema.memberships.role }).from(schema.memberships)
        .innerJoin(schema.workspaces, eq(schema.workspaces.id, schema.memberships.workspaceId)).where(eq(schema.memberships.userId, identity.userId));
      return { user: { id: identity.userId, email: identity.email, displayName: identity.displayName }, workspaces };
    },
    async authorize(identity, room) {
      if (!identity || identity.expiresAt <= Date.now()) throw new AuthError();
      await liveSession(identity.id, identity.userId);
      const parts = room.split('/'), kind = parts[1] === 'db' ? 'database' : 'page';
      const workspaceId = decodeURIComponent(parts.at(-2)), id = decodeURIComponent(parts.at(-1));
      const rows = await db.select({ id: schema.documentMeta.id }).from(schema.documentMeta).innerJoin(schema.memberships,
        and(eq(schema.memberships.workspaceId, schema.documentMeta.workspaceId), eq(schema.memberships.userId, identity.userId)))
        .where(and(eq(schema.documentMeta.workspaceId, workspaceId), eq(schema.documentMeta.kind, kind), eq(schema.documentMeta.id, id), isNull(schema.documentMeta.deletedAt)));
      if (!rows.length) throw new AuthError(403);
    },
    async close() { if (!closed) { closed = true; await pool.end(); } },
  };
}
