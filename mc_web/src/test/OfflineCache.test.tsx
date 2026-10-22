import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { IDBFactory, IDBKeyRange, IDBDatabase } from 'fake-indexeddb';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { createOfflineCache, cacheName, type CacheStatus } from '../collaboration/offlineCache';
import { createCollaborationSession, roomName } from '../collaboration/session';
import { CollaborationStatus } from '../components/common/CollaborationStatus';
import { useCollaborationStore } from '../collaboration/store';
const endpoint='ws://127.0.0.1:1234/',room='mc/v1/ws/page';
const disposers: Array<()=>unknown> = [];
beforeEach(()=>{vi.stubGlobal('indexedDB',new IDBFactory());vi.stubGlobal('IDBKeyRange',IDBKeyRange);});
afterEach(async()=>{for(const dispose of disposers.splice(0).reverse())await dispose();cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();useCollaborationStore.setState({cache:undefined,status:'disabled',synced:false});});
function cached(doc=new Y.Doc(),name=room,states:CacheStatus[]=[]){const cache=createOfflineCache(endpoint,name,doc,state=>states.push(state));disposers.push(()=>doc.destroy(),()=>cache.destroy());return {doc,cache,states};}
async function open(name:string){return new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(name);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function corrupt(name:string){const db=await open(name);await new Promise<void>((resolve,reject)=>{const tx=db.transaction('updates','readwrite');tx.objectStore('updates').add(Uint8Array.of(255));tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});db.close();}
describe('Day20 complete CRDT cache',()=>{
 it('isolates server, workspace, kind and canonical room IDs',()=>{
  const a=cacheName(endpoint,room);expect(a).toBe(cacheName('ws://127.0.0.1:1234',room));
  for(const other of [cacheName('ws://127.0.0.1:1235',room),cacheName(endpoint,roomName('other','page')),cacheName(endpoint,roomName('ws','page','database')),cacheName(endpoint,roomName('ws','page/other'))])expect(other).not.toBe(a);
 });
 it('restores identities, deletes and unsent edits after document and provider destruction',async()=>{
  const a=cached();expect(await a.cache.ready).toBe(true);a.doc.getText('text').insert(0,'离线甲😀');a.doc.getText('text').delete(0,2);expect(await a.cache.flush()).toBe(true);const vector=Y.encodeStateVector(a.doc);await a.cache.destroy();a.doc.destroy();
  const b=cached();expect(await b.cache.ready).toBe(true);expect(b.doc.getText('text').toString()).toBe('甲😀');expect(Y.encodeStateVector(b.doc)).toEqual(vector);expect(b.states.at(-1)).toBe('saved');
 });
 it('writes a journal readable by the upstream y-indexeddb provider',async()=>{
  const a=cached();await a.cache.ready;a.doc.getText('text').insert(0,'compatible');await a.cache.flush();await a.cache.destroy();
  const doc=new Y.Doc(),upstream=new IndexeddbPersistence(cacheName(endpoint,room),doc);disposers.push(()=>doc.destroy(),()=>upstream.destroy());await upstream.whenSynced;expect(doc.getText('text').toString()).toBe('compatible');
 });
 it('compacts frequent updates without losing content or identities',async()=>{
  const a=cached();await a.cache.ready;for(let i=0;i<510;i++)a.doc.getText('text').insert(0,'x');await a.cache.flush();const vector=Y.encodeStateVector(a.doc);await a.cache.destroy();const b=cached();await b.cache.ready;expect(b.doc.getText('text').length).toBe(510);expect(Y.encodeStateVector(b.doc)).toEqual(vector);
  const db=await open(cacheName(endpoint,room));const count=await new Promise<number>(resolve=>{const r=db.transaction('updates').objectStore('updates').count();r.onsuccess=()=>resolve(r.result);});db.close();expect(count).toBeLessThan(20);
 });
 it('corrupt replay leaves the editor and journal untouched and blocks connection',async()=>{
  const a=cached();await a.cache.ready;a.doc.getText('text').insert(0,'safe');await a.cache.flush();await a.cache.destroy();await corrupt(cacheName(endpoint,room));
  const states:CacheStatus[]=[];const session=createCollaborationSession({url:endpoint,workspaceId:'ws',pageId:'page',onState:()=>{},onCacheState:state=>states.push(state)});disposers.push(()=>session.destroy());session.connect();expect(await session.cacheReady).toBe(false);expect(session.socket.status).toBe('disconnected');expect(session.document.getText('text').toString()).toBe('');expect(states.at(-1)).toBe('error');
 });
 it('open denial is handled without claiming durability or opening a socket',async()=>{
  vi.stubGlobal('indexedDB',{open(){throw new DOMException('denied','SecurityError');}});const a=cached();expect(await a.cache.ready).toBe(false);a.doc.getText('text').insert(0,'memory');expect(await a.cache.flush()).toBe(false);expect(a.states).not.toContain('saved');expect(a.states.at(-1)).toBe('error');
 });
 it('aborted write reports error, preserves memory and never claims saved',async()=>{
  const a=cached();await a.cache.ready;a.states.length=0;const original=IDBDatabase.prototype.transaction;
  vi.spyOn(IDBDatabase.prototype,'transaction').mockImplementation(function(this:IDBDatabase,...args:Parameters<IDBDatabase['transaction']>){const tx=original.apply(this,args);if(args[1]==='readwrite')queueMicrotask(()=>tx.abort());return tx;});
  a.doc.getText('text').insert(0,'retained');expect(await a.cache.flush()).toBe(false);expect(a.doc.getText('text').toString()).toBe('retained');expect(a.states.at(-1)).toBe('error');expect(a.states).not.toContain('saved');
 });
 it('early destruction closes initialization without late callbacks or writes',async()=>{
  const a=cached();await a.cache.destroy();const count=a.states.length;expect(await a.cache.ready).toBe(false);expect(a.states.length).toBe(count);
 });
 it('status distinguishes local durability from a live collaboration connection',()=>{
  useCollaborationStore.setState({status:'disconnected',synced:false,pageBound:true,cache:'saved'});render(<CollaborationStatus/>);expect(screen.getByRole('status')).toHaveTextContent('通道离线 · 自动重连 · 离线缓存已保存');
  cleanup();useCollaborationStore.setState({cache:'error'});render(<CollaborationStatus/>);expect(screen.getByRole('status')).toHaveTextContent('离线缓存异常');expect(screen.getByRole('status')).not.toHaveTextContent('已保存');
 });
});
