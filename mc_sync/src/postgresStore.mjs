import pg from 'pg';
import * as Y from 'yjs';
import { decodeSnapshot, encodeSnapshot, mergeUpdates, SnapshotError } from './snapshotCodec.mjs';
const CREATE_TABLE = `CREATE TABLE IF NOT EXISTS mc_yjs_documents (
  document_name TEXT PRIMARY KEY,
  format SMALLINT NOT NULL CHECK (format = 1),
  state BYTEA NOT NULL,
  checksum CHAR(64) NOT NULL,
  raw_bytes INTEGER NOT NULL CHECK (raw_bytes >= 2),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;
function failure(error) {
  if (error instanceof SnapshotError) return error;
  const code = typeof error?.code === 'string' && /^[a-zA-Z0-9_]+$/.test(error.code) ? error.code : 'unavailable';
  return new Error(`PostgreSQL operation failed (${code})`);
}
export function createPostgresStore({ url, pool: injectedPool } = {}) {
  if (!injectedPool) {
    try { const parsed = new URL(url); if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) throw null; }
    catch { throw new Error('MC_SYNC_DATABASE_URL must be a PostgreSQL connection URL'); }
  }
  const pool = injectedPool ?? new pg.Pool({ connectionString: url, max: 5, connectionTimeoutMillis: 3000, statement_timeout: 5000, query_timeout: 6000, application_name: 'mc-sync' });
  // Idle socket failures are retried by subsequent operations, without leaking connection details.
  pool.on('error', () => {});
  let closed = false;
  const emptyDoc = new Y.Doc(), empty = encodeSnapshot(Y.encodeStateAsUpdate(emptyDoc)); emptyDoc.destroy();
  return {
    kind: 'postgresql',
    async initialize() { try { await pool.query(CREATE_TABLE); } catch (error) { throw failure(error); } },
    async check() { try { await pool.query('SELECT 1'); } catch (error) { throw failure(error); } },
    async load(name) {
      try {
        const result = await pool.query('SELECT format, state, checksum, raw_bytes FROM mc_yjs_documents WHERE document_name = $1', [name]);
        return result.rows.length ? decodeSnapshot(result.rows[0]) : null;
      } catch (error) { throw failure(error); }
    },
    async save(name, update) {
      let client;
      try {
        client = await pool.connect(); await client.query('BEGIN');
        await client.query("SET LOCAL lock_timeout = '5s'");
        // Establish a row before locking. ON CONFLICT waits for concurrent first writers.
        await client.query('INSERT INTO mc_yjs_documents (document_name, format, state, checksum, raw_bytes) VALUES ($1, 1, $2, $3, $4) ON CONFLICT (document_name) DO NOTHING', [name, empty.state, empty.checksum, empty.raw_bytes]);
        const existing = await client.query('SELECT format, state, checksum, raw_bytes FROM mc_yjs_documents WHERE document_name = $1 FOR UPDATE', [name]);
        const merged = encodeSnapshot(mergeUpdates(decodeSnapshot(existing.rows[0]), update));
        await client.query('UPDATE mc_yjs_documents SET state = $2, checksum = $3, raw_bytes = $4, updated_at = CURRENT_TIMESTAMP WHERE document_name = $1', [name, merged.state, merged.checksum, merged.raw_bytes]);
        await client.query('COMMIT');
      } catch (error) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        throw failure(error);
      } finally { client?.release(); }
    },
    async close() { if (closed) return; closed = true; await pool.end(); },
  };
}
