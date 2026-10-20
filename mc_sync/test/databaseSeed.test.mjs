import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Y from 'yjs';
import { seedDatabase, validDatabase } from '../src/databaseSeed.mjs';
import { validRoom } from '../src/server.mjs';
const db = () => ({id:'db',title:'Database',createdAt:1,updatedAt:1,properties:{title:{id:'title',name:'Title',type:'title'}},propertyOrder:['title'],rows:{r:{id:'r',databaseId:'db',cells:{title:'row'},createdAt:1,updatedAt:1}},rowOrder:['r']});
const request = () => ({kind:'initialize-database',source:'first',database:db()});
test('database seeding is atomic, room-bound and ignores stale subsequent proposals', () => {
  const document = new Y.Doc();
  try {
    assert.equal(seedDatabase(document,request(),'other'),false);
    assert.equal(seedDatabase(document,request(),'db'),true);
    const second=request();second.database.title='stale';assert.equal(seedDatabase(document,second,'db'),false);
    assert.equal(document.getMap('database').get('title'),'Database');
    assert.equal(document.getMap('database').get('rows').get('r').get('cells').get('title').value,'row');
    assert.ok(validRoom('mc/db/v1/workspace/db'));assert.ok(!validRoom('mc/db/v1/workspace/db/extra'));
  } finally {document.destroy();}
});
test('malformed snapshots fail before writing any database structure', () => {
  const cases=[null,{}, {...request(),source:null}, {...request(),database:{...db(),propertyOrder:['title','title']}}, {...request(),database:{...db(),rows:{bad:{...db().rows.r,id:'bad',databaseId:'wrong'}}}},
    {...request(),database:{...db(),properties:{title:{id:'title',name:'Title',type:'unknown'}}}}];
  const badCell=request();badCell.database.rows.r.cells.unknown='dangling';cases.push(badCell);
  const badBlocks=request();badBlocks.database.rows.r.blocks=[{id:'a',type:'unknown',content:''}];cases.push(badBlocks);
  for (const value of cases) {const document=new Y.Doc();try {assert.equal(seedDatabase(document,value,'db'),false);assert.equal(document.getMap('database').size,0);}finally {document.destroy();}}
  assert.equal(validDatabase({...db(),createdAt:NaN}),false);
});
