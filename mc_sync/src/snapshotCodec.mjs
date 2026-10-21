import { createHash, timingSafeEqual } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import * as Y from 'yjs';
export class SnapshotError extends Error { constructor(message) { super(message); this.name = 'SnapshotError'; } }
export const MAX_SNAPSHOT_BYTES = 16 * 1024 * 1024;
export function validateUpdate(value) {
  if (!(value instanceof Uint8Array) || value.length > MAX_SNAPSHOT_BYTES) throw new SnapshotError('Invalid snapshot size');
  const doc = new Y.Doc();
  try { Y.applyUpdate(doc, value); } catch { throw new SnapshotError('Invalid Yjs snapshot'); }
  finally { doc.destroy(); }
  return value;
}
export function encodeSnapshot(update) {
  const raw = Buffer.from(validateUpdate(update));
  const state = gzipSync(raw);
  if (state.length > MAX_SNAPSHOT_BYTES) throw new SnapshotError('Compressed snapshot exceeds limit');
  return { state, checksum: createHash('sha256').update(raw).digest('hex'), raw_bytes: raw.length };
}
export function decodeSnapshot(row) {
  if (row.format !== 1 || !Buffer.isBuffer(row.state) || row.state.length > MAX_SNAPSHOT_BYTES
    || !Number.isInteger(row.raw_bytes) || row.raw_bytes < 2 || row.raw_bytes > MAX_SNAPSHOT_BYTES
    || typeof row.checksum !== 'string' || !/^[a-f0-9]{64}$/.test(row.checksum)) throw new SnapshotError('Invalid stored snapshot metadata');
  let raw;
  try { raw = gunzipSync(row.state, { maxOutputLength: MAX_SNAPSHOT_BYTES }); } catch { throw new SnapshotError('Invalid compressed snapshot'); }
  if (raw.length !== row.raw_bytes || !timingSafeEqual(createHash('sha256').update(raw).digest(), Buffer.from(row.checksum, 'hex'))) throw new SnapshotError('Snapshot checksum mismatch');
  return validateUpdate(raw);
}
export function mergeUpdates(previous, current) {
  const doc = new Y.Doc();
  try { if (previous) Y.applyUpdate(doc, validateUpdate(previous)); Y.applyUpdate(doc, validateUpdate(current)); return validateUpdate(Y.encodeStateAsUpdate(doc)); }
  finally { doc.destroy(); }
}
