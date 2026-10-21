import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Y from 'yjs';
import { gzipSync } from 'node:zlib';
import { encodeSnapshot, decodeSnapshot, mergeUpdates, MAX_SNAPSHOT_BYTES } from '../src/snapshotCodec.mjs';
import { createPersistence } from '../src/persistence.mjs';
import { createPostgresStore } from '../src/postgresStore.mjs';
const waitFor = async condition => { const start = Date.now(); while (!condition()) { if (Date.now() - start > 2000) throw new Error('Retry timed out'); await new Promise(resolve => setTimeout(resolve, 10)); } };
test('gzip binary snapshot preserves full Yjs identities, history and deletes', () => {
  const a = new Y.Doc(), b = new Y.Doc();
  try {
    a.getText('title').insert(0, '甲'.repeat(2000)); a.getText('title').delete(0, 1);
    const raw = Y.encodeStateAsUpdate(a), packed = encodeSnapshot(raw); assert.ok(packed.state.length < raw.length);
    Y.applyUpdate(b, decodeSnapshot({ ...packed, format: 1 })); assert.equal(b.getText('title').toString(), a.getText('title').toString());
    assert.deepEqual(Y.encodeStateVector(a), Y.encodeStateVector(b));
  } finally { a.destroy(); b.destroy(); }
});
test('invalid gzip/checksum/format/size/Yjs data fail closed', () => {
  const doc = new Y.Doc();
  try {
    const valid = { ...encodeSnapshot(Y.encodeStateAsUpdate(doc)), format: 1 };
    for (const bad of [{...valid,format:2},{...valid,state:Buffer.from('bad')},{...valid,checksum:'0'.repeat(64)},{...valid,raw_bytes:MAX_SNAPSHOT_BYTES+1}]) assert.throws(()=>decodeSnapshot(bad));
    assert.throws(()=>encodeSnapshot(Uint8Array.from([255])));
    assert.throws(()=>decodeSnapshot({...valid,state:gzipSync(Buffer.alloc(MAX_SNAPSHOT_BYTES+1))}));
  } finally { doc.destroy(); }
});
test('merging independently edited snapshots keeps both insertions', () => {
  const seed=new Y.Doc(),a=new Y.Doc(),b=new Y.Doc(),merged=new Y.Doc();
  try {seed.getText('text').insert(0,'x');const state=Y.encodeStateAsUpdate(seed);Y.applyUpdate(a,state);Y.applyUpdate(b,state);a.getText('text').insert(1,'甲');b.getText('text').insert(1,'乙');Y.applyUpdate(merged,mergeUpdates(Y.encodeStateAsUpdate(a),Y.encodeStateAsUpdate(b)));assert.ok(merged.getText('text').toString().includes('甲'));assert.ok(merged.getText('text').toString().includes('乙'));}
  finally {[seed,a,b,merged].forEach(doc=>doc.destroy());}
});
test('store failure retains dirty documents, retries without another edit and flush reports failure', async () => {
  let fail=true,saved,closed=false;
  const store={load:async()=>null,check:async()=>{},save:async(_name,state)=>{if(fail)throw new Error('temporary');saved=state;},close:async()=>{closed=true;}};
  const binding=createPersistence(store,{retryMs:20}),doc=new Y.Doc();doc.name='mc/v1/ws/page';doc.getText('text').insert(0,'recover');
  try {
    await assert.rejects(binding.extension.onStoreDocument({document:doc}),/persistence failed/);
    assert.equal((await binding.health()).pendingDocuments,1);
    await assert.rejects(binding.flush(new Map([[doc.name,doc]])),/Shutdown persistence failed/);
    fail=false;await waitFor(()=>saved!==undefined);assert.equal((await binding.health()).healthy,true);
    await binding.flush(new Map([[doc.name,doc]]));
  } finally {await binding.close();doc.destroy();}assert.equal(closed,true);
});
test('load errors reject initialization instead of creating an empty replacement', async () => {
  const binding=createPersistence({load:async()=>{throw new Error('corrupt');},check:async()=>{},close:async()=>{},save:async()=>{throw new Error('must not save');}});
  try {await assert.rejects(binding.extension.onLoadDocument({documentName:'mc/v1/ws/p'}),/could not be loaded/);assert.equal((await binding.health()).loadErrors,1);}finally{await binding.close();}
});
test('connection URL validation never echoes credentials', () => {
  assert.throws(()=>createPostgresStore({url:'https://user:secret@example.com'}),error=>!error.message.includes('secret'));
});
