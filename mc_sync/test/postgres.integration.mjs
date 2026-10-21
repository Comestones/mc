import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import * as Y from 'yjs';
import { WebSocket } from 'ws';
import { startTestPostgres } from './postgresHarness.mjs';
import { createPostgresStore } from '../src/postgresStore.mjs';
import { decodeSnapshot } from '../src/snapshotCodec.mjs';
import { createSyncServer, listenSyncServer } from '../src/server.mjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
let host,pool;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitFor(predicate,label,timeout=15000){const start=Date.now();while(!await predicate()){if(Date.now()-start>timeout)throw new Error(`Timed out: ${label}`);await pause(40);}}
before(async()=>{host=await startTestPostgres();pool=new pg.Pool({connectionString:host.url});const result=await pool.query('SHOW server_version');console.log(`Real PostgreSQL ${result.rows[0].server_version}`);});
after(async()=>{await pool?.end();await host?.stop();});
async function persisted(name,predicate) {
  const result=await pool.query('SELECT format,state,checksum,raw_bytes FROM mc_yjs_documents WHERE document_name=$1',[name]);if(!result.rows.length)return false;
  const doc=new Y.Doc();try{Y.applyUpdate(doc,decodeSnapshot(result.rows[0]));return predicate(doc);}finally{doc.destroy();}
}

test('real bytea gzip snapshots and transactional concurrent writers preserve Yjs data', {timeout:20000},async t=>{
  const first=createPostgresStore({url:host.url}),second=createPostgresStore({url:host.url});t.after(()=>first.close());t.after(()=>second.close());await first.initialize();await second.initialize();
  const a=new Y.Doc(),b=new Y.Doc(),loaded=new Y.Doc();t.after(()=>[a,b,loaded].forEach(doc=>doc.destroy()));
  a.getText('text').insert(0,'A'.repeat(2000));b.getText('text').insert(0,'B');
  await Promise.all([first.save('mc/v1/sql/concurrent',Y.encodeStateAsUpdate(a)),second.save('mc/v1/sql/concurrent',Y.encodeStateAsUpdate(b))]);
  Y.applyUpdate(loaded,await first.load('mc/v1/sql/concurrent'));assert.ok(loaded.getText('text').toString().includes('A'));assert.ok(loaded.getText('text').toString().includes('B'));
  const row=(await pool.query("SELECT format,octet_length(state) AS bytes,raw_bytes FROM mc_yjs_documents WHERE document_name='mc/v1/sql/concurrent'")).rows[0];assert.equal(row.format,1);assert.ok(row.bytes<row.raw_bytes);
  assert.equal(await first.load('mc/v1/sql/other'),null);
});
test('debounced writes coalesce bursts and graceful shutdown flushes pending content', {timeout:20000},async t=>{
  const store=createPostgresStore({url:host.url});let writes=0;
  const counted={...store,save:async(...args)=>{writes++;await store.save(...args);}};
  const service=await listenSyncServer(createSyncServer({port:0,snapshotStore:counted,debounce:250,maxDebounce:500}));t.after(()=>service.destroy());
  const name='mc/v1/persist-ws/debounce-page',document=new Y.Doc();
  const provider=new HocuspocusProvider({url:service.webSocketURL,name,document,WebSocketPolyfill:WebSocket});
  t.after(()=>{provider.destroy();provider.configuration.websocketProvider.destroy();document.destroy();});
  await waitFor(()=>provider.synced,'client synced');document.getText('text').insert(0,'Initial');
  await waitFor(()=>writes>0,'initial store');await pause(300);writes=0;
  for(let index=0;index<20;index++)document.getText('text').insert(0,'x');
  await waitFor(()=>writes>0,'debounced store');await pause(300);assert.equal(writes,1);
  // Edits more frequent than debounce must still reach SQL at maxDebounce.
  for(let index=0;index<9;index++){document.getText('text').insert(0,'y');await pause(80);}
  assert.ok(writes>1,'continuous edits reached the maximum debounce bound');
  await pause(300);const beforeShutdown=writes;
  document.getText('text').insert(0,'Flushed on shutdown');
  await waitFor(()=>service.hocuspocus.documents.get(name)?.getText('text').toString().startsWith('Flushed on shutdown'),'server received pending edit');
  assert.equal(writes,beforeShutdown,'final edit is still inside debounce window');
  await service.destroy();
  assert.ok(await persisted(name,doc=>doc.getText('text').toString().startsWith('Flushed on shutdown')));
});
test('unavailable PostgreSQL prevents startup rather than silently falling back to memory', {timeout:10000},async()=>{
  const service=createSyncServer({port:0,databaseUrl:'postgresql://user:secret@127.0.0.1:1/missing'});
  await assert.rejects(listenSyncServer(service),error=>!error.message.includes('secret'));assert.equal(service.httpServer.listening,false);await service.destroy();
});
