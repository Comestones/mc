import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import { gunzipSync } from 'node:zlib';
import * as Y from 'yjs';
import { createCollaborationSession } from '../src/collaboration/session.ts';
import { bindPage } from '../src/collaboration/pageBinding.ts';
import { bindDatabase } from '../src/collaboration/databaseBinding.ts';
import { bindPresence } from '../src/collaboration/presence.ts';
import { createDatabase, addRow, updateCell } from '../src/utils/databaseUtils.ts';
import { startTestPostgres } from '../../mc_sync/test/postgresHarness.mjs';
import { createFaultRelay } from './support/faultRelay.mjs';
const requireSync = createRequire(new URL('../../mc_sync/package.json', import.meta.url));
const { WebSocket } = requireSync('ws'), pg = requireSync('pg');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(predicate, label, timeout = 35000) { const start = performance.now(); while (!await predicate()) { if (performance.now() - start > timeout) throw new Error(`Timed out: ${label}`); await pause(10); } }
const report = { schema: 1, recordedAt: new Date().toISOString(), environment: { node: process.version, platform: process.platform, arch: process.arch, logicalCpus: os.cpus().length, cpuModel: os.cpus()[0]?.model }, seed: 2101, scenarios: [], passed: false };
report.sourceSHA256 = Object.fromEntries(await Promise.all([['session','../src/collaboration/session.ts'],['scenario','./verify-day21.mjs'],['relay','./support/faultRelay.mjs'],['fixture','../../mc_sync/test/fixture-server.mjs']].map(async ([name,path])=>[name,createHash('sha256').update(await readFile(new URL(path,import.meta.url))).digest('hex')])));
function summary(samples) { const sorted = [...samples].sort((a,b)=>a-b), at = p => Math.round((sorted[Math.min(sorted.length-1, Math.ceil(sorted.length*p)-1)] ?? 0)*100)/100; return { samples: sorted.length, p50Ms: at(.5), p95Ms: at(.95), maxMs: at(1) }; }
after(async()=>{ if (process.env.MC_DAY21_REPORT) { await mkdir(new URL('../benchmarks/',import.meta.url),{recursive:true}); await writeFile(new URL('../benchmarks/day21-results.json',import.meta.url),JSON.stringify(report,null,2)+'\n'); } });
async function server(t, url, port=0) {
 const child=fork(fileURLToPath(new URL('../../mc_sync/test/fixture-server.mjs',import.meta.url)),{env:{...process.env,MC_TEST_PORT:String(port),MC_TEST_DATABASE_URL:url??'',MC_TEST_METRICS:'1',MC_TEST_STORE_DEBOUNCE_MS:'500',MC_TEST_STORE_MAX_DEBOUNCE_MS:'5000'},stdio:['ignore','pipe','pipe','ipc']});
 let stderr='';child.stderr.on('data',chunk=>{stderr+=chunk;});
 const ready=await Promise.race([once(child,'message').then(([value])=>value),once(child,'exit').then(([code])=>{throw new Error(`Service exit ${code}: ${stderr}`);})]);
 let stopped=false,request=0;
 const stop=async()=>{if(stopped)return;stopped=true;const exited=once(child,'exit');child.send('shutdown');const timer=setTimeout(()=>child.kill(),15000);const [code]=await exited;clearTimeout(timer);assert.equal(code,0,'service exits normally');assert.ok(!url||!stderr.includes(url),'no database credential in logs');};t?.after(stop);
 return {port:ready.port,url:`ws://127.0.0.1:${ready.port}`,stop,async metrics(){const id=++request;return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{child.off('message',receive);reject(new Error('Metrics timeout'));},3000);function receive(value){if(value.type==='metrics'&&value.id===id){clearTimeout(timeout);child.off('message',receive);resolve(value);}}child.on('message',receive);child.send({type:'metrics',id});});}};
}
const page={title:'Day21',blocks:[{id:'body',type:'paragraph',content:'base'}]};
function client(t,url,{id,kind='page',workspaceId='load',pageId='page',snapshot=page,WebSocketPolyfill=WebSocket,observe=()=>{}}={}) {
 let value=structuredClone(snapshot),binding,state,presence,members=[];
 const history=[];
 const session=createCollaborationSession({url,workspaceId,pageId,kind,persistence:false,socketOptions:{WebSocketPolyfill,delay:50,minDelay:50,maxDelay:200,jitter:false},onState:next=>{state=next;history.push(next);if(next.synced)binding?.synchronize();presence?.setConnected(next.synced&&!!binding?.ready);}});
 binding=(kind==='page'?bindPage:bindDatabase)({session,databaseId:pageId,getSnapshot:()=>value,onSnapshot:next=>{value=next;observe(id,next);},onReady:()=>presence?.setConnected(!!state?.synced)});
 if(kind==='page')presence=bindPresence({document:session.document,awareness:session.provider.awareness,name:`peer-${id}`,onMembers:next=>{members=next;}});
 let destroyed=false;const destroy=()=>{if(destroyed)return;destroyed=true;presence?.destroy();binding.destroy();return session.destroy();};t?.after(destroy);session.connect();
 return {session,binding,history,state:()=>state,members:()=>members,value:()=>value,destroy,edit(fn){value=fn(structuredClone(value));binding.localChanged();}};
}

test('online event storm does not restart a pending connection or reset its backoff', {timeout:15000},async t=>{
 const host=await server(t),relay=await createFaultRelay(host.url);t.after(()=>relay.close());relay.setFaults({delayMs:200});let attempts=0;
 class CountedWebSocket extends WebSocket {constructor(...args){super(...args);attempts++;}}
 const a=client(t,relay.url,{id:'storm',WebSocketPolyfill:CountedWebSocket});
 for(let index=0;index<30;index++){a.session.connect();await pause(3);}
 await waitFor(()=>a.binding.ready,'storm ready',10000);
 assert.equal(attempts,1,'online events share one pending transport attempt');const initialAttempts=attempts;
 a.session.disconnect();a.session.connect();await waitFor(()=>a.state()?.synced,'intentional reconnect',10000);
 a.destroy();const count=a.history.length;await pause(250);assert.equal(a.history.length,count);assert.equal(a.session.socket.webSocket,null);
 await relay.close(); await host.stop();
 report.scenarios.push({name:'online-event-storm',events:30,initialSocketAttempts:initialAttempts,passed:true});
});

test('online event storm preserves backoff while the service is unavailable', {timeout:15000},async t=>{
 const first=await server(t);await first.stop();let attempts=0;
 class CountedWebSocket extends WebSocket {constructor(...args){super(...args);attempts++;}}
 const a=client(t,first.url,{id:'backoff',WebSocketPolyfill:CountedWebSocket});
 for(let event=0;event<30;event++){a.session.connect();await pause(3);}await pause(100);
 const offlineAttempts=attempts;assert.ok(offlineAttempts<=4,`retry backoff was reset (${offlineAttempts} attempts)`);
 const recovered=await server(t,undefined,first.port);await waitFor(()=>a.binding.ready,'late service recovered',10000);a.destroy();await recovered.stop();
 report.scenarios.push({name:'offline-online-event-storm',events:30,offlineAttempts,testRetryMinMs:50,testRetryMaxMs:200,passed:true});
});

test('16 clients converge through delayed/dropped frames, partitions and reconnect cycles with PostgreSQL', {timeout:90000},async t=>{
 let cluster,pool,host,relay,cleaned=false;
 const groups=[],clients=[],tokens=new Map(),latencies=[];let phase='baseline';
 async function cleanup(){if(cleaned)return;cleaned=true;const errors=[];for(const action of [()=>clients.forEach(c=>c.destroy()),()=>relay?.close(),()=>host?.stop(),()=>pool?.end(),()=>cluster?.stop()]){try{await action();}catch(error){errors.push(error);}}if(errors.length)throw new AggregateError(errors,'Load test cleanup failed');}
 t.after(cleanup);cluster=await startTestPostgres();pool=new pg.Pool({connectionString:cluster.url});host=await server(undefined,cluster.url);report.environment.postgresql=(await pool.query('SHOW server_version')).rows[0].server_version;relay=await createFaultRelay(host.url);
 const observe=(id,snapshot)=>{if(!snapshot?.blocks)return;const text=snapshot.blocks[0]?.content??'';for(const [token,entry] of tokens){if(entry.sender!==id&&!entry.seen.has(id)&&text.includes(token)){entry.seen.add(id);latencies.push({phase:entry.phase,ms:performance.now()-entry.at});}}};
 for(let group=0;group<4;group++){
  const kind=group<2?'page':'database',workspaceId=group%2?'isolated':'load',pageId=kind==='page'?'shared-page':`db-${group}`;let snapshot=page;
  if(kind==='database'){snapshot=createDatabase('Load DB');snapshot.id=pageId;for(let row=0;row<4;row++)snapshot=addRow(snapshot,{'prop-title':`base-${row}`});}
  const peers=[];for(let peer=0;peer<4;peer++){const id=`${group}-${peer}`,c=client(undefined,relay.url,{id,kind,workspaceId,pageId,snapshot,observe});peers.push(c);clients.push(c);}groups.push({kind,workspaceId,pageId,peers,rows:snapshot.rowOrder,expected:new Set(),last:[]});
 }
 await waitFor(()=>clients.every(c=>c.binding.ready),'all clients initialized');await waitFor(()=>groups.filter(g=>g.kind==='page').every(g=>g.peers.every(c=>c.members().length===4)),'room-scoped presence');
 function workload(rounds){for(let index=0;index<rounds;index++)for(let g=0;g<groups.length;g++)for(let peer=0;peer<4;peer++){
  const group=groups[g],c=group.peers[peer],token=`[${phase}:${g}:${peer}:${index}]`;
  if(group.kind==='page'){group.expected.add(token);tokens.set(token,{sender:`${g}-${peer}`,at:performance.now(),phase,seen:new Set()});c.edit(value=>({...value,blocks:[{...value.blocks[0],content:value.blocks[0].content+token}]}));}
  else{group.last[peer]=token;c.edit(value=>updateCell(value,group.rows[peer],'prop-title',token));}
 }}
 const converged=()=>groups.every(group=>{
  const projected=group.peers.map(c=>JSON.stringify(c.value()));if(!projected.every(value=>value===projected[0]))return false;
  return group.peers.every(c=>group.kind==='page'?Array.from(group.expected).every(token=>c.value().blocks[0].content.includes(token)):group.last.every((token,index)=>c.value().rows[group.rows[index]].cells['prop-title']===token));
 });
 let start=performance.now();workload(20);await waitFor(converged,'baseline convergence');const baselineMs=performance.now()-start;
 const baseline=summary(latencies.filter(x=>x.phase==='baseline').map(x=>x.ms));assert.ok(baseline.samples>=100,'actual peer delivery samples');
 phase='weak';relay.setFaults({delayMs:40,jitterMs:80,dropEvery:11});workload(10);await pause(1500);relay.setFaults({delayMs:40,jitterMs:80});start=performance.now();
 // No disconnect here: production 15s state-vector resync must heal missed frames.
 await waitFor(converged,'state-vector repair after dropped application frames',35000);const repairMs=performance.now()-start;assert.ok(relay.metrics().dropped>0);
 const weak=summary(latencies.filter(x=>x.phase==='weak').map(x=>x.ms));
 phase='partition';relay.setFaults({blackhole:true});workload(5);await pause(200);relay.setFaults({delayMs:20,jitterMs:30});relay.cut();start=performance.now();await waitFor(()=>clients.every(c=>c.state()?.synced)&&converged(),'partition reconnect merge');const partitionMs=performance.now()-start;
 const beforeChurn=await host.metrics();for(let round=0;round<3;round++){for(const c of clients){c.session.disconnect();c.session.connect();for(let event=0;event<5;event++)c.session.connect();}await waitFor(()=>clients.every(c=>c.state()?.synced)&&converged(),'reconnect cycle');}
 const during=await host.metrics();assert.equal(during.connections,16);assert.equal(during.documents,4);assert.ok(during.stores>0);
 for(const group of groups){const room=group.kind==='page'?`mc/v1/${group.workspaceId}/${group.pageId}`:`mc/db/v1/${group.workspaceId}/${group.pageId}`;await waitFor(async()=>{const row=(await pool.query('SELECT state FROM mc_yjs_documents WHERE document_name=$1',[room])).rows[0];if(!row)return false;const restored=new Y.Doc();try{Y.applyUpdate(restored,gunzipSync(row.state));const expected=Y.encodeStateVector(group.peers[0].session.document);return Buffer.from(Y.encodeStateVector(restored)).equals(Buffer.from(expected));}finally{restored.destroy();}},'database has complete merged state');}
 for(const group of groups.filter(g=>g.kind==='page')){const other=groups.find(g=>g.kind==='page'&&g!==group);assert.ok(Array.from(other.expected).every(token=>!group.peers[0].value().blocks[0].content.includes(token)),'workspace contents remain isolated');}
 const snapshots=groups.map(g=>structuredClone(g.peers[0].value()));for(const c of clients)c.destroy();await waitFor(async()=>{const metrics=await host.metrics();return metrics.connections===0&&metrics.documents===0;},'all server rooms unloaded',12000);await waitFor(()=>relay.metrics().activeConnections===0,'all relay connections closed');const after=await host.metrics();
 for(let i=0;i<groups.length;i++){const g=groups[i],fresh=client(undefined,host.url,{id:`fresh-${i}`,kind:g.kind,workspaceId:g.workspaceId,pageId:g.pageId,snapshot:g.kind==='page'?page:null});await waitFor(()=>fresh.binding.ready,'fresh client loaded');assert.deepEqual(fresh.value(),snapshots[i]);fresh.destroy();}
 await cleanup();
 report.scenarios.push({name:'bounded-multi-client-load',clients:16,rooms:4,workspaces:2,pageEdits:280,databaseEdits:280,defaults:{forceSyncMs:15000,watchdogMs:45000,debounceMs:500,maxDebounceMs:5000},testRetry:{minMs:50,maxMs:200,jitter:false},faults:{oneWayDelayMs:[40,119],dropEveryNthFrame:11,partition:true},baselineConvergenceMs:Math.round(baselineMs),baselineDelivery:baseline,postFaultRepairMs:Math.round(repairMs),weakDelivery:weak,partitionRecoveryMs:Math.round(partitionMs),reconnectCycles:3,relay:relay.metrics(),server:{beforeChurn,during,after},freshDatabaseRecovery:true,passed:true});
 report.passed=report.scenarios.length===3;console.log(JSON.stringify(report.scenarios.at(-1),null,2));
});
