import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { gunzipSync } from 'node:zlib';
import * as Y from 'yjs';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
globalThis.IDBKeyRange=IDBKeyRange;
import { startTestPostgres } from '../../mc_sync/test/postgresHarness.mjs';
import { createCollaborationSession } from '../src/collaboration/session.ts';
import { bindPage } from '../src/collaboration/pageBinding.ts';
import { bindDatabase } from '../src/collaboration/databaseBinding.ts';
import { createDatabase, addRow, updateCell } from '../src/utils/databaseUtils.ts';
const requireSync=createRequire(new URL('../../mc_sync/package.json',import.meta.url));
const pg=requireSync('pg'),{WebSocket}=requireSync('ws');
let host,pool;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitFor(predicate,label,timeout=15000){const start=Date.now();while(!await predicate()){if(Date.now()-start>timeout)throw new Error(`Timed out: ${label}`);await pause(40);}}
before(async()=>{host=await startTestPostgres();pool=new pg.Pool({connectionString:host.url});const result=await pool.query('SHOW server_version');console.log(`Real PostgreSQL ${result.rows[0].server_version}`);});
after(async()=>{await pool?.end();await host?.stop();delete globalThis.indexedDB;delete globalThis.IDBKeyRange;});
async function server(t, extra={}) {
  const child=fork(fileURLToPath(new URL('../../mc_sync/test/fixture-server.mjs',import.meta.url)),{env:{...process.env,MC_TEST_PORT:'0',MC_TEST_DATABASE_URL:host.url,...extra},stdio:['ignore','pipe','pipe','ipc']});
  let stderr='';child.stderr.on('data',chunk=>{stderr+=chunk;});
  const ready=await Promise.race([once(child,'message').then(([value])=>value),once(child,'exit').then(([code])=>{throw new Error(`Server exit ${code}: ${stderr}`);})]);
  let stopped=false;
  const stop=async()=>{if(stopped)return;stopped=true;const exited=once(child,'exit');child.send('shutdown');const deadline=setTimeout(()=>child.kill(),10000);const [code]=await exited;clearTimeout(deadline);assert.equal(code,0,'graceful service exit');assert.ok(!stderr.includes(host.url),'credentials must not enter logs');};
  t.after(stop);return {child,url:`ws://127.0.0.1:${ready.port}`,health:`http://127.0.0.1:${ready.port}/healthz`,stop,async crash(){if(stopped)return;stopped=true;const exited=once(child,'exit');child.kill('SIGKILL');await exited;}};
}
function client(t,url,{kind='page',pageId='page',workspaceId='offline-ws',snapshot,connect=true,factory=new IDBFactory()}={}) {
 globalThis.indexedDB=factory;
 let value=structuredClone(snapshot),binding,state,cache;
 const session=createCollaborationSession({url,kind,workspaceId,pageId,onLocalReady:()=>binding?.restore(),onCacheState:next=>{cache=next;},onState:next=>{state=next;if(next.synced)binding?.synchronize();},socketOptions:{WebSocketPolyfill:WebSocket,delay:50,minDelay:50,maxDelay:100,jitter:false}});
 const options={session,getSnapshot:()=>value,onSnapshot:next=>{value=next;}};
 binding=kind==='database'?bindDatabase({...options,databaseId:pageId}):bindPage(options);
 const destroy=()=>{binding.destroy();return session.destroy();};t.after(destroy);if(connect)session.connect();
 return {session,binding,factory,state:()=>state,cache:()=>cache,page:()=>value,destroy,edit(fn){value=fn(structuredClone(value));binding.localChanged();}};
}
const page={title:'Durable title',blocks:[{id:'a',type:'paragraph',content:'Durable body'},{id:'b',type:'paragraph',content:'second'}]};
async function persisted(name,predicate) {
  const result=await pool.query('SELECT format,state,checksum,raw_bytes FROM mc_yjs_documents WHERE document_name=$1',[name]);if(!result.rows.length)return false;
  const doc=new Y.Doc();try{Y.applyUpdate(doc,gunzipSync(result.rows[0].state));return predicate(doc);}finally{doc.destroy();}
}

test('closed offline page recovers before connection and merges concurrent text without duplicate seed', {timeout:30000},async t=>{
 const service=await server(t),a=client(t,service.url,{snapshot:page}),b=client(t,service.url,{snapshot:page});await waitFor(()=>a.binding.ready&&b.binding.ready,'bound');
 a.session.disconnect();await waitFor(()=>!a.state()?.synced,'offline');a.edit(value=>({...value,title:value.title+'甲😀',blocks:[{...value.blocks[0],content:value.blocks[0].content+'离线正文'}]}));assert.equal(await a.session.flushCache(),true);await a.destroy();
 b.edit(value=>({...value,title:value.title+'乙',blocks:value.blocks.map(block=>({...block,content:block.content+'远端正文'}))}));
 const c=client(t,service.url,{snapshot:{title:'stale JSON',blocks:[]},connect:false,factory:a.factory});assert.equal(await c.session.cacheReady,true);assert.ok(c.binding.ready);assert.ok(c.page().title.includes('甲😀'));assert.ok(c.page().blocks[0].content.includes('离线正文'));assert.equal(c.session.socket.status,'disconnected');
 c.edit(value=>({...value,title:value.title+'续写'}));await c.session.flushCache();c.session.connect();await waitFor(()=>c.state()?.synced&&b.page().title.includes('甲😀')&&b.page().title.includes('乙')&&b.page().title.includes('续写'),'merged');assert.equal(c.page().title,b.page().title);assert.equal(b.page().title.split('甲😀').length-1,1);assert.equal(b.page().blocks.length,1);assert.ok(b.page().blocks[0].content.includes('离线正文'));assert.ok(b.page().blocks[0].content.includes('远端正文'));
});
test('cached database restores offline cells and a deletion tombstone across session destruction', {timeout:30000},async t=>{
 const service=await server(t);let db=createDatabase('Offline database');db.id='offline-db';db=addRow(db,{'prop-title':'base'});db=addRow(db,{'prop-title':'second'});const [row,second]=db.rowOrder;
 const a=client(t,service.url,{kind:'database',pageId:db.id,snapshot:db}),b=client(t,service.url,{kind:'database',pageId:db.id,snapshot:db});await waitFor(()=>a.binding.ready&&b.binding.ready,'bound');a.session.disconnect();a.edit(value=>updateCell(value,row,'prop-title','offline cell'));await a.session.flushCache();await a.destroy();b.edit(value=>updateCell(value,second,'prop-title','remote cell'));
 const c=client(t,service.url,{kind:'database',pageId:db.id,snapshot:db,connect:false,factory:a.factory});await c.session.cacheReady;assert.equal(c.page().rows[row].cells['prop-title'],'offline cell');c.session.connect();await waitFor(()=>b.page().rows[row].cells['prop-title']==='offline cell'&&c.page().rows[second].cells['prop-title']==='remote cell','cells merged');c.session.disconnect();c.edit(()=>null);await c.session.flushCache();await c.destroy();
 const deleted=client(t,service.url,{kind:'database',pageId:db.id,snapshot:db,connect:false,factory:a.factory});await deleted.session.cacheReady;assert.equal(deleted.page(),null);assert.ok(deleted.binding.ready);deleted.session.connect();await waitFor(()=>b.page()===null,'deletion sync');
});
test('client cache and PostgreSQL recover after all clients close and the service restarts', {timeout:30000},async t=>{
 const first=await server(t),a=client(t,first.url,{pageId:'restart-page',snapshot:page});await waitFor(()=>a.binding.ready,'bound');await waitFor(()=>persisted('mc/v1/offline-ws/restart-page',()=>true),'baseline committed');a.session.disconnect();a.edit(value=>({...value,title:'unsent after restart'}));await a.session.flushCache();await a.destroy();await first.stop();
 const second=await server(t,{MC_TEST_PORT:new URL(first.url).port}),c=client(t,second.url,{pageId:'restart-page',snapshot:page,connect:false,factory:a.factory});await c.session.cacheReady;assert.equal(c.page().title,'unsent after restart');c.session.connect();await waitFor(()=>persisted('mc/v1/offline-ws/restart-page',doc=>doc.getMap('page').get('title')?.toString()==='unsent after restart'),'appended to PostgreSQL');const fresh=client(t,second.url,{pageId:'restart-page',snapshot:page});await waitFor(()=>fresh.binding.ready&&fresh.page().title==='unsent after restart','fresh client');
});
test('buffered edits rebase during cache load and different server/workspace/room caches stay isolated', {timeout:30000},async t=>{
 const service=await server(t),a=client(t,service.url,{pageId:'isolation-page',snapshot:page});await waitFor(()=>a.binding.ready,'bound');a.session.disconnect();a.edit(value=>({...value,title:'cached base'}));await a.session.flushCache();await a.destroy();const c=client(t,service.url,{pageId:'isolation-page',snapshot:{title:'cached base',blocks:page.blocks},connect:false,factory:a.factory});c.edit(value=>({...value,title:value.title+' buffered'}));await c.session.cacheReady;assert.equal(c.page().title,'cached base buffered');
 for(const options of [{workspaceId:'other',pageId:'isolation-page'},{workspaceId:'offline-ws',pageId:'other'}]){const isolated=client(t,service.url,{...options,snapshot:page,connect:false,factory:a.factory});await isolated.session.cacheReady;assert.equal(isolated.binding.ready,false);assert.equal(isolated.page().title,page.title);}
 const other=client(t,'ws://127.0.0.1:1',{pageId:'isolation-page',snapshot:page,connect:false,factory:a.factory});await other.session.cacheReady;assert.equal(other.binding.ready,false);
});
