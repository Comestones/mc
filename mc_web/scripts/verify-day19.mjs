import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { gunzipSync } from 'node:zlib';
import * as Y from 'yjs';
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
after(async()=>{await pool?.end();await host?.stop();});
async function server(t, extra={}) {
  const child=fork(fileURLToPath(new URL('../../mc_sync/test/fixture-server.mjs',import.meta.url)),{env:{...process.env,MC_TEST_PORT:'0',MC_TEST_DATABASE_URL:host.url,...extra},stdio:['ignore','pipe','pipe','ipc']});
  let stderr='';child.stderr.on('data',chunk=>{stderr+=chunk;});
  const ready=await Promise.race([once(child,'message').then(([value])=>value),once(child,'exit').then(([code])=>{throw new Error(`Server exit ${code}: ${stderr}`);})]);
  let stopped=false;
  const stop=async()=>{if(stopped)return;stopped=true;const exited=once(child,'exit');child.send('shutdown');const deadline=setTimeout(()=>child.kill(),10000);const [code]=await exited;clearTimeout(deadline);assert.equal(code,0,'graceful service exit');assert.ok(!stderr.includes(host.url),'credentials must not enter logs');};
  t.after(stop);return {child,url:`ws://127.0.0.1:${ready.port}`,health:`http://127.0.0.1:${ready.port}/healthz`,stop,async crash(){if(stopped)return;stopped=true;const exited=once(child,'exit');child.kill('SIGKILL');await exited;}};
}
function client(t,url,{kind='page',pageId='page',workspaceId='persist-ws',snapshot}={}) {
  let value=structuredClone(snapshot),binding,state;
  const session=createCollaborationSession({url,kind,workspaceId,pageId,onState:next=>{state=next;if(next.synced)binding?.synchronize();},socketOptions:{WebSocketPolyfill:WebSocket,delay:50,minDelay:50,maxDelay:100,jitter:false}});
  const options={session,getSnapshot:()=>value,onSnapshot:next=>{value=next;}};
  binding=kind==='database'?bindDatabase({...options,databaseId:pageId}):bindPage(options);
  const destroy=()=>{binding.destroy();session.destroy();};t.after(destroy);session.connect();
  return {session,binding,state:()=>state,page:()=>value,destroy,edit(fn){value=fn(structuredClone(value));binding.localChanged();}};
}
const page={title:'Durable title',blocks:[{id:'a',type:'paragraph',content:'Durable body'},{id:'b',type:'paragraph',content:'second'}]};
async function persisted(name,predicate) {
  const result=await pool.query('SELECT format,state,checksum,raw_bytes FROM mc_yjs_documents WHERE document_name=$1',[name]);if(!result.rows.length)return false;
  const doc=new Y.Doc();try{Y.applyUpdate(doc,gunzipSync(result.rows[0].state));return predicate(doc);}finally{doc.destroy();}
}

test('service process restart restores page, database and tombstone to entirely fresh clients', {timeout:30000},async t=>{
  const initial=await server(t),a=client(t,initial.url,{snapshot:page});
  let db=createDatabase('Durable database');db.id='durable-db';db=addRow(db,{'prop-title':'Durable row'});const rowId=db.rowOrder[0];
  const b=client(t,initial.url,{kind:'database',pageId:db.id,snapshot:db});await waitFor(()=>a.binding.ready&&b.binding.ready,'initial clients');
  a.edit(value=>({...value,title:'Persisted title',blocks:value.blocks.slice(0,1).map(block=>({...block,content:'Persisted body'}))}));
  b.edit(value=>updateCell(value,rowId,'prop-title','Persisted cell'));
  await waitFor(()=>persisted('mc/v1/persist-ws/page',doc=>doc.getMap('page').get('title')?.toString()==='Persisted title'),'page stored');
  a.destroy();b.destroy();await initial.stop();
  const restarted=await server(t),fresh=client(t,restarted.url,{snapshot:{title:'stale',blocks:[]}}),freshDb=client(t,restarted.url,{kind:'database',pageId:db.id,snapshot:null});
  await waitFor(()=>fresh.binding.ready&&freshDb.binding.ready,'fresh restored');assert.equal(fresh.page().title,'Persisted title');assert.equal(fresh.page().blocks.length,1);assert.equal(fresh.page().blocks[0].content,'Persisted body');assert.equal(freshDb.page().rows[rowId].cells['prop-title'],'Persisted cell');
  freshDb.edit(()=>null);fresh.destroy();freshDb.destroy();await restarted.stop();
  const third=await server(t),stale=client(t,third.url,{kind:'database',pageId:db.id,snapshot:db});await waitFor(()=>stale.binding.ready&&stale.page()===null,'durable deletion tombstone');
  assert.equal((await (await fetch(third.health)).json()).storage,'postgresql');
});
test('committed state survives abrupt service termination without any surviving client', {timeout:20000},async t=>{
  const first=await server(t),a=client(t,first.url,{pageId:'crash-page',snapshot:page});await waitFor(()=>a.binding.ready,'bound');
  a.edit(value=>({...value,title:'Before crash'}));await waitFor(()=>persisted('mc/v1/persist-ws/crash-page',doc=>doc.getMap('page').get('title')?.toString()==='Before crash'),'commit before crash');
  a.destroy();await first.crash();const second=await server(t),fresh=client(t,second.url,{pageId:'crash-page',snapshot:{title:'old',blocks:[]}});await waitFor(()=>fresh.binding.ready,'crash recovery');assert.equal(fresh.page().title,'Before crash');
});
test('real database outage reports degraded health and retries dirty data after PostgreSQL restart', {timeout:40000},async t=>{
  const service=await server(t),a=client(t,service.url,{pageId:'outage-page',snapshot:page});await waitFor(()=>a.binding.ready,'outage bound');
  await waitFor(()=>persisted('mc/v1/persist-ws/outage-page',()=>true),'baseline commit');
  await host.postgres.stop();
  a.edit(value=>({...value,title:'Saved after outage'}));await pause(200);
  const unavailable=await fetch(service.health);assert.equal(unavailable.status,503);assert.equal((await unavailable.json()).status,'degraded');
  await host.postgres.start();
  await waitFor(()=>persisted('mc/v1/persist-ws/outage-page',doc=>doc.getMap('page').get('title')?.toString()==='Saved after outage'),'retry without new edits',20000);
  await waitFor(async()=> (await fetch(service.health)).status===200,'healthy after retry');
});
test('corrupt stored data rejects load and is never overwritten by a stale initialization', {timeout:20000},async t=>{
  await pool.query('INSERT INTO mc_yjs_documents(document_name,format,state,checksum,raw_bytes) VALUES($1,1,$2,$3,2)', ['mc/v1/persist-ws/corrupt-page',Buffer.from('corrupt'),'0'.repeat(64)]);
  const service=await server(t),fresh=client(t,service.url,{pageId:'corrupt-page',snapshot:page});await pause(800);assert.equal(fresh.binding.ready,false);
  const row=(await pool.query("SELECT state FROM mc_yjs_documents WHERE document_name='mc/v1/persist-ws/corrupt-page'")).rows[0];assert.equal(row.state.toString(),'corrupt');
  assert.equal((await fetch(service.health)).status,503);
});
