import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createCollaborationSession, roomName } from '../src/collaboration/session.ts';
import { bindDatabase } from '../src/collaboration/databaseBinding.ts';
import { readDatabase } from '../src/collaboration/databaseModel.ts';
import { same } from '../src/collaboration/pageModel.ts';
import { createDatabase, addProperty, addRow, updateCell, deleteRow, deleteProperty, reorderRows, changePropertyType, deleteSelectOption, updateSelectOption, validateDatabaseSchema } from '../src/utils/databaseUtils.ts';
const { WebSocket } = createRequire(new URL('../../mc_sync/package.json', import.meta.url))('ws');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(predicate, label, timeout = 10000) {
  const start = Date.now(); while (!predicate()) { if (Date.now() - start > timeout) throw new Error(`Timed out: ${label}`); await pause(20); }
}
async function server(t) {
  const child = fork(fileURLToPath(new URL('../../mc_sync/test/fixture-server.mjs', import.meta.url)), { env: { ...process.env, MC_TEST_PORT: '0' }, stdio: ['ignore','pipe','pipe','ipc'] });
  const ready = await Promise.race([once(child, 'message').then(([data]) => data), once(child, 'exit').then(([code]) => { throw new Error(`Server exit ${code}`); })]);
  t.after(async () => { const exit = once(child, 'exit'); child.send('shutdown'); const deadline = setTimeout(() => child.kill(), 3000); const [code] = await exit; clearTimeout(deadline); assert.equal(code, 0); });
  return `ws://127.0.0.1:${ready.port}`;
}
function fixture() {
  let db = createDatabase('Shared database'); db.id = 'shared-db';
  for (const prop of [{ id:'text', name:'Text', type:'text' }, { id:'number', name:'Number', type:'number' }, {id:'check', name:'Check', type:'checkbox'},
    {id:'select', name:'Status', type:'select', options:[{id:'a',name:'A'},{id:'b',name:'B'}]}, {id:'tags',name:'Tags',type:'multiSelect',options:[{id:'a',name:'A'},{id:'b',name:'B'}]},
    {id:'date',name:'Date',type:'date'}, {id:'url',name:'URL',type:'url'}, {id:'created',name:'Created',type:'createdTime'}]) db = addProperty(db, prop);
  db = addRow(db, {'prop-title':'Row A',text:'initial',number:10}); db = addRow(db, {'prop-title':'Row B'});
  return db;
}
function client(t, url, original, { workspaceId = 'ws', id = original?.id ?? 'shared-db' } = {}) {
  let snapshot = structuredClone(original), binding, state;
  const session = createCollaborationSession({ url, workspaceId, pageId:id, kind:'database', onState: next => { state = next; if (next.synced) binding?.synchronize(); },
    socketOptions: { WebSocketPolyfill: WebSocket, delay:50,minDelay:50,maxDelay:100,jitter:false } });
  binding = bindDatabase({ session, databaseId:id, getSnapshot: () => snapshot, onSnapshot: value => { snapshot = value; } });
  t.after(() => { binding.destroy(); session.destroy(); }); session.connect();
  return { session, binding, page: () => snapshot, state: () => state, edit(fn) { snapshot = fn(structuredClone(snapshot)); binding.localChanged(); } };
}
async function pair(t) { const url = await server(t), db = fixture(), a = client(t,url,db), b = client(t,url,db); await waitFor(() => a.binding.ready && b.binding.ready && same(a.page(),b.page()),'pair'); return {url,a,b,db}; }
async function converge(a,b) { await waitFor(() => same(a.page(),b.page()),'convergence'); if (a.page()) assert.ok(validateDatabaseSchema(a.page())); }
async function offline(a,b) { a.session.disconnect(); b.session.disconnect(); await waitFor(()=>a.state().status==='disconnected' && b.state().status==='disconnected','offline'); }
async function reconnect(a,b) { a.session.connect(); b.session.connect(); await waitFor(()=>a.state().synced && b.state().synced,'reconnect'); await converge(a,b); }

test('atomic first seed, stale late join and missing local snapshot use the server database', { timeout:15000 }, async t => {
  const {url,a,b,db} = await pair(t); assert.equal(a.page().rowOrder.length,2); assert.equal(b.page().propertyOrder.length,9);
  const row = db.rowOrder[0]; a.edit(value=>updateCell(value,row,'text','server truth')); await converge(a,b);
  const stale = client(t,url,db), missing = client(t,url,null);
  await waitFor(()=>stale.binding.ready && missing.binding.ready && stale.page()?.rows[row].cells.text==='server truth' && missing.page()?.rows[row].cells.text==='server truth','late join');
  assert.equal(roomName('ws','shared-db','database'),'mc/db/v1/ws/shared-db'); assert.notEqual(roomName('ws','shared-db'),roomName('ws','shared-db','database'));
});
test('offline edits to different cells/rows preserve both and each cell type round trips', { timeout:15000 }, async t => {
  const {a,b,db}=await pair(t), [first,second]=db.rowOrder; await offline(a,b);
  a.edit(value=>updateCell(updateCell(value,first,'text','甲'),first,'number',0));
  b.edit(value=>updateCell(updateCell(value,second,'text','乙'),first,'check',false));
  await reconnect(a,b); assert.equal(a.page().rows[first].cells.text,'甲'); assert.equal(a.page().rows[second].cells.text,'乙'); assert.equal(a.page().rows[first].cells.number,0); assert.equal(a.page().rows[first].cells.check,false);
  for (const [key,value] of [['select','b'],['tags',['a','b']],['date','2026-10-20'],['url','https://example.com/']]) a.edit(db=>updateCell(db,first,key,value));
  await converge(a,b); assert.deepEqual(b.page().rows[first].cells.tags,['a','b']); assert.equal(Object.hasOwn(b.page().rows[first].cells,'created'),false);
});
test('same-cell concurrent assignments converge deterministically without corrupting types', { timeout:15000 }, async t => {
  const {a,b,db}=await pair(t), row=db.rowOrder[0]; await offline(a,b);
  a.edit(value=>updateCell(value,row,'number',12)); b.edit(value=>updateCell(value,row,'number',34)); await reconnect(a,b);
  assert.ok([12,34].includes(a.page().rows[row].cells.number)); assert.deepEqual(readDatabase(a.session.document),readDatabase(b.session.document));
});
test('concurrent row/column creation and moves retain stable unique IDs', { timeout:15000 }, async t => {
  const {a,b,db}=await pair(t); await offline(a,b);
  a.edit(value=>addRow(addProperty(value,{id:'left',name:'Left',type:'text'}),{'prop-title':'From A'},0));
  b.edit(value=>addRow(addProperty(value,{id:'right',name:'Right',type:'number'}),{'prop-title':'From B'},0)); await reconnect(a,b);
  assert.equal(a.page().rowOrder.length,4); assert.ok(a.page().properties.left && a.page().properties.right);
  await offline(a,b); a.edit(value=>reorderRows(value,[...value.rowOrder].reverse())); b.edit(value=>reorderRows(value,[...value.rowOrder.slice(1),value.rowOrder[0]])); await reconnect(a,b);
  assert.equal(new Set(a.page().rowOrder).size,4); assert.equal(a.page().rowOrder.filter(id=>db.rows[id]).length,2);
});
test('row and column deletion wins over stale edits and cannot resurrect records', { timeout:15000 }, async t => {
  const {a,b,db}=await pair(t),row=db.rowOrder[0]; await offline(a,b);
  a.edit(value=>deleteProperty(deleteRow(value,row),'text')); b.edit(value=>updateCell(updateCell(value,row,'text','stale'),db.rowOrder[1],'text','stale column')); await reconnect(a,b);
  assert.equal(a.page().rows[row],undefined); assert.equal(a.page().properties.text,undefined); assert.equal(Object.hasOwn(a.page().rows[db.rowOrder[1]].cells,'text'),false);
});
test('type migration vs stale cell writes remains schema-valid; obsolete epochs are hidden', { timeout:15000 }, async t => {
  const {a,b,db}=await pair(t),row=db.rowOrder[0]; await offline(a,b);
  a.edit(value=>changePropertyType(value,'number','checkbox')); b.edit(value=>updateCell(value,row,'number',123)); await reconnect(a,b);
  assert.equal(a.page().properties.number.type,'checkbox'); const value=a.page().rows[row].cells.number; assert.ok(value===undefined || typeof value==='boolean');
  a.edit(value=>updateCell(value,row,'number',true)); await converge(a,b); assert.equal(b.page().rows[row].cells.number,true);
});
test('option deletion cleans stale choices while edits to other options survive', { timeout:15000 }, async t => {
  const {a,b,db}=await pair(t),row=db.rowOrder[0]; await offline(a,b);
  a.edit(value=>deleteSelectOption(value,'select','a')); b.edit(value=>updateCell(updateSelectOption(value,'select','b',{name:'renamed'}),row,'select','a')); await reconnect(a,b);
  assert.equal(a.page().rows[row].cells.select,undefined); assert.equal(a.page().properties.select.options[0].name,'renamed');
});
test('database tombstone rejects stale edits and late snapshots without reinitialization', { timeout:15000 }, async t => {
  const {url,a,b,db}=await pair(t); await offline(a,b); a.edit(()=>null); b.edit(value=>({...value,title:'stale'})); await reconnect(a,b); assert.equal(b.page(),null);
  const late=client(t,url,db); await waitFor(()=>late.binding.ready && late.page()===null,'late tombstone'); assert.equal(late.session.document.getMap('database').get('deleted'),true);
});
test('handshake edits survive and database/workspace/page namespaces remain isolated', { timeout:15000 }, async t => {
  const url=await server(t),db=fixture(),a=client(t,url,db); const row=db.rowOrder[0]; a.edit(value=>updateCell(value,row,'text','buffered'));
  const other=client(t,url,{...db,id:'other',rows:Object.fromEntries(Object.entries(db.rows).map(([id,row])=>[id,{...row,databaseId:'other'}]))});
  const workspace=client(t,url,db,{workspaceId:'other'}); await waitFor(()=>a.binding.ready && other.binding.ready && workspace.binding.ready,'rooms ready');
  assert.equal(a.page().rows[row].cells.text,'buffered'); assert.equal(workspace.page().rows[row].cells.text,'initial'); assert.equal(other.page().rows[row].cells.text,'initial');
  let updates=0; a.session.document.on('update',()=>updates++); a.edit(value=>({...value,viewConfig:{activeView:'gallery',boardGroupPropertyId:null,gallery:{coverPropertyId:null,visiblePropertyIds:[]}},updatedAt:Date.now()})); assert.equal(updates,0);
  a.binding.destroy(); a.edit(value=>({...value,title:'disposed'})); assert.equal(readDatabase(a.session.document).title,'Shared database');
});


test('independent row bodies and metadata synchronize without whole-database replacement', { timeout:15000 }, async t => {
  const {a,b,db}=await pair(t),[first,second]=db.rowOrder;await offline(a,b);
  a.edit(value=>({...value,title:'Renamed',rows:{...value.rows,[first]:{...value.rows[first],blocks:[{id:'left-body',type:'paragraph',content:'甲正文'}]}}}));
  b.edit(value=>({...value,description:'Description',rows:{...value.rows,[second]:{...value.rows[second],blocks:[{id:'right-body',type:'paragraph',content:'乙正文'}]}}}));
  await reconnect(a,b);assert.equal(a.page().title,'Renamed');assert.equal(a.page().description,'Description');
  assert.equal(a.page().rows[first].blocks[0].content,'甲正文');assert.equal(a.page().rows[second].blocks[0].content,'乙正文');
});
