import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as Y from 'yjs';
import { DatabaseRooms, referencedDatabases } from '../collaboration/DatabaseRooms';
import { DatabaseBlock } from '../components/editor/DatabaseBlock';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { useCollaborationStore } from '../collaboration/store';
import { useDatabaseChannelStore } from '../collaboration/databaseChannelStore';
import { readDatabase } from '../collaboration/databaseModel';
import { createDatabase, addProperty, addRow, validateDatabaseSchema } from '../utils/databaseUtils';
import { MemoryStorage } from '../utils/workspaceStorage';
import type { DatabaseSchema } from '../types/database';
import type { SessionOptions, createCollaborationSession } from '../collaboration/session';
const mocks = vi.hoisted(() => ({ sessions: [] as Array<{ options: SessionOptions; session: ReturnType<typeof createCollaborationSession> }> }));
vi.mock('../collaboration/session', async importOriginal => {
  const real = await importOriginal<typeof import('../collaboration/session')>();
  return { ...real, createCollaborationSession: (options: SessionOptions) => {
    const session = { ...real.createCollaborationSession(options), connect: vi.fn(), disconnect: vi.fn() };
    mocks.sessions.push({ options, session }); return session;
  } };
});
const initial = useWorkspaceStore.getState(); let db: DatabaseSchema, storage: MemoryStorage;
function fixture() {
  let value = createDatabase('Day18');
  value = addProperty(value,{id:'notes',name:'备注',type:'text'}); value = addProperty(value,{id:'number',name:'数量',type:'number'});
  value = addProperty(value,{id:'status',name:'状态',type:'select',options:[{id:'todo',name:'待办'},{id:'done',name:'完成'}]});
  value = addRow(value,{'prop-title':'甲行',notes:'original',number:1,status:'todo'}); value = addRow(value,{'prop-title':'乙行'}); return value;
}
function seed(doc: Y.Doc, value: DatabaseSchema) {
  const root=doc.getMap('database'); doc.transact(()=> {
    const properties=new Y.Map(),rows=new Y.Map(); root.set('properties',properties);root.set('rows',rows);
    root.set('propertyOrder',Y.Array.from(value.propertyOrder));root.set('rowOrder',Y.Array.from(value.rowOrder));
    for (const key of ['id','title','createdAt','updatedAt'] as const) root.set(key,value[key]);
    for (const property of Object.values(value.properties)) {
      const item=new Y.Map(), options=new Y.Map(); properties.set(property.id,item);item.set('name',property.name);item.set('spec',{type:property.type,version:'initial'});if(property.width)item.set('width',property.width);
      item.set('options',options);item.set('optionOrder',Y.Array.from((property.options??[]).map(option=>option.id)));
      for(const option of property.options??[]) options.set(option.id,new Y.Map([['name',option.name]]));
    }
    for(const row of Object.values(value.rows)) {
      const item=new Y.Map(),cells=new Y.Map();rows.set(row.id,item);item.set('cells',cells);item.set('createdAt',row.createdAt);item.set('updatedAt',row.updatedAt);item.set('blocks',structuredClone(row.blocks));
      for(const [key,value] of Object.entries(row.cells)) cells.set(key,{version:'initial',value:structuredClone(value)});
    }
    root.set('schema',1);
  },'remote');
}
function connect(value=db, index=0) {
  const record=mocks.sessions[index]; act(()=>{seed(record.session.document,value);record.session.socket.status='connected' as never;record.session.provider.synced=true;record.options.onState({status:'connected',synced:true});});return record.session.document;
}
function cells(doc:Y.Doc,rowId=db.rowOrder[0]) {return ((doc.getMap('database').get('rows') as Y.Map<Y.Map<unknown>>).get(rowId)!.get('cells')) as Y.Map<unknown>;}
function cell(propertyId:string,rowId=db.rowOrder[0]) {return document.querySelector(`[data-row-id="${rowId}"] [data-property-id="${propertyId}"]`) as HTMLElement;}
function Harness() {return <><DatabaseRooms endpoint="ws://127.0.0.1:1234"/><DatabaseBlock id="db-block" databaseId={db.id}/></>;}
beforeEach(async()=> {
  mocks.sessions.length=0; db=fixture(); storage=new MemoryStorage(null,{isPersistent:true});
  useWorkspaceStore.getState().setStorageAdapter(storage);await useWorkspaceStore.getState().hydrateStore();
  useWorkspaceStore.setState({...initial,isHydrated:true,workspace:{...initial.workspace,id:'ws'},activePageId:'p',databases:{[db.id]:db},documents:{p:{id:'p',title:'Page',parentId:null,createdAt:1,updatedAt:1,blocks:[{id:'db-block',type:'database',content:'',properties:{databaseId:db.id}}]}}});
  useCollaborationStore.setState({boundPageId:'p',boundWorkspaceId:'ws'});useDatabaseChannelStore.setState({channels:{}});
});
afterEach(()=>{cleanup();useWorkspaceStore.setState(initial);vi.restoreAllMocks();});
describe('Day18 database collaboration UI',()=>{
  it('waits for the correct page binding and deduplicates nested database references',()=>{
    const blocks=useWorkspaceStore.getState().documents.p.blocks!;
    expect(referencedDatabases([...blocks,{id:'parent',type:'paragraph',content:'',children:blocks}, {id:'bad',type:'database',content:'',properties:{databaseId:'bad\nroom'}}])).toEqual([db.id]);
    const nested = { ...db, id:'nested-db', rows:{ cycle:{ ...db.rows[db.rowOrder[0]], blocks } } };
    const parent = { ...db, rows:{ parent:{ ...db.rows[db.rowOrder[0]], blocks:[{ id:'nested',type:'database' as const,content:'',properties:{databaseId:'nested-db'} }] } } };
    expect(referencedDatabases(blocks,{[db.id]:parent,'nested-db':nested})).toEqual([db.id,'nested-db'].sort());
    useCollaborationStore.setState({boundPageId:undefined});render(<Harness/>);expect(mocks.sessions).toHaveLength(0);
    act(()=>useCollaborationStore.setState({boundPageId:'p'}));expect(mocks.sessions).toHaveLength(1);expect(mocks.sessions[0].options).toMatchObject({kind:'database',workspaceId:'ws',pageId:db.id});
  });
  it('real cell, row, column and database-title controls write granular shared data',()=>{
    render(<Harness/>);const doc=connect();expect(screen.getByRole('status',{name:'数据库协同状态'})).toHaveTextContent('数据库协同已连接');
    fireEvent.doubleClick(cell('notes'));fireEvent.change(screen.getByTestId('db-cell-input'),{target:{value:'本地输入'}});fireEvent.keyDown(screen.getByTestId('db-cell-input'),{key:'Enter'});
    expect(readDatabase(doc)?.rows[db.rowOrder[0]].cells.notes).toBe('本地输入');
    fireEvent.change(screen.getByRole('textbox',{name:'数据库标题'}),{target:{value:'同步名称'}});expect(readDatabase(doc)?.title).toBe('同步名称');
    fireEvent.click(screen.getByTestId('db-add-row-btn'));expect(readDatabase(doc)?.rowOrder).toHaveLength(3);
    fireEvent.click(screen.getByTestId('table-add-column-btn'));expect(readDatabase(doc)?.propertyOrder).toHaveLength(5);
  });
  it('remote changes update table, board and gallery while view choice remains local',()=>{
    render(<Harness/>);const doc=connect(),update=vi.fn();doc.on('update',update);
    fireEvent.click(screen.getByRole('tab',{name:'看板'}));expect(update).not.toHaveBeenCalled();
    act(()=>cells(doc).set('status',{version:'initial',value:'done'}));expect(useWorkspaceStore.getState().databases[db.id].viewConfig?.activeView).toBe('board');
    expect(screen.getByRole('tab',{name:'看板'})).toHaveAttribute('aria-selected','true');
    fireEvent.click(screen.getByRole('tab',{name:'画廊'}));act(()=>cells(doc).set('prop-title',{version:'initial',value:'远端标题'}));expect(screen.getByText('远端标题')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab',{name:'表格'}));expect(cell('prop-title')).toHaveTextContent('远端标题');expect(validateDatabaseSchema(useWorkspaceStore.getState().databases[db.id])).toBe(true);
  });
  it('keeps the active draft and its column identity when remote cell/column changes arrive',()=>{
    render(<Harness/>);const doc=connect();fireEvent.doubleClick(cell('notes'));const input=screen.getByTestId('db-cell-input');fireEvent.change(input,{target:{value:'尚未提交'}});fireEvent.compositionStart(input);
    act(()=>doc.transact(()=>{cells(doc).set('notes',{version:'initial',value:'远端'});const order=doc.getMap('database').get('propertyOrder') as Y.Array<string>;order.delete(0,order.length);order.push(['notes','number','status','prop-title']);},'remote'));
    expect(screen.getByTestId('db-cell-input')).toHaveValue('尚未提交');expect(screen.getByTestId('db-cell-input').closest('[data-property-id]')).toHaveAttribute('data-property-id','notes');
    fireEvent.compositionEnd(input);fireEvent.keyDown(input,{key:'Enter'});expect(readDatabase(doc)?.rows[db.rowOrder[0]].cells.notes).toBe('尚未提交');expect(readDatabase(doc)?.rows[db.rowOrder[0]].cells.number).toBe(1);
  });
  it('remote row deletion and type migration dismiss stale editors without recreating data',()=>{
    render(<Harness/>);const doc=connect();fireEvent.doubleClick(cell('notes'));fireEvent.change(screen.getByTestId('db-cell-input'),{target:{value:'draft'}});
    act(()=>{const properties=doc.getMap('database').get('properties') as Y.Map<Y.Map<unknown>>;properties.get('notes')!.set('spec',{type:'checkbox',version:'new'});});
    expect(screen.queryByTestId('db-cell-input')).toBeNull();expect(readDatabase(doc)?.rows[db.rowOrder[0]].cells.notes).toBeUndefined();
    fireEvent.doubleClick(cell('prop-title'));act(()=>(doc.getMap('database').get('rows') as Y.Map<unknown>).delete(db.rowOrder[0]));expect(screen.queryByTestId('db-cell-input')).toBeNull();expect(useWorkspaceStore.getState().databases[db.id].rows[db.rowOrder[0]]).toBeUndefined();
  });
  it('remote updates autosave and restore after Store hydration',async()=>{
    const ui=render(<Harness/>),doc=connect();act(()=>cells(doc).set('notes',{version:'initial',value:'远端持久化'}));
    await waitFor(()=>expect(useWorkspaceStore.getState().storageStatus).toBe('saved'),{timeout:2000});ui.unmount();
    useWorkspaceStore.setState({databases:{},documents:{},isHydrated:false});await act(async()=>{await useWorkspaceStore.getState().hydrateStore();});
    expect(useWorkspaceStore.getState().databases[db.id].rows[db.rowOrder[0]].cells.notes).toBe('远端持久化');
  });
  it('loads a remote database absent locally and honors database deletion tombstones',()=>{
    useWorkspaceStore.setState({databases:{}});render(<Harness/>);const doc=connect();expect(screen.getByRole('grid')).toBeInTheDocument();
    act(()=>doc.getMap('database').set('deleted',true));expect(useWorkspaceStore.getState().databases[db.id]).toBeUndefined();expect(screen.getByTestId('database-block-fallback')).toBeInTheDocument();
  });
  it('invalid shared database roots do not erase the valid local snapshot',()=>{
    render(<Harness/>);const record=mocks.sessions[0];
    act(()=>{const root=record.session.document.getMap('database');root.set('id',db.id);root.set('schema',1);record.options.onState({status:'connected',synced:true});});
    expect(useWorkspaceStore.getState().databases[db.id].title).toBe('Day18');expect(screen.getByRole('grid')).toBeInTheDocument();
    expect(useDatabaseChannelStore.getState().channels[db.id].bound).toBe(false);
  });
  it('removes sessions, listeners and status on page/workspace change and unmount',()=>{
    const ui=render(<Harness/>);connect();const record=mocks.sessions[0];
    act(()=>window.dispatchEvent(new Event('offline')));expect(record.session.disconnect).toHaveBeenCalledTimes(1);
    act(()=>window.dispatchEvent(new Event('online')));expect(record.session.connect).toHaveBeenCalledTimes(2);
    act(()=>useWorkspaceStore.setState({workspace:{...initial.workspace,id:'other'}}));expect(record.session.document.isDestroyed).toBe(true);expect(useDatabaseChannelStore.getState().channels).toEqual({});
    ui.unmount();window.dispatchEvent(new Event('online'));expect(record.session.connect).toHaveBeenCalledTimes(2);
  });
});
