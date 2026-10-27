import { before,after,test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { randomUUID,createHash } from 'node:crypto';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { WebSocket } from 'ws';
import * as Y from 'yjs';
import { startTestPostgres } from './postgresHarness.mjs';
import { createSyncServer,listenSyncServer } from '../src/server.mjs';
import { createAuthService } from '../src/auth/service.mjs';
let host,pool,server,auth,owner,ownerTokens,workspaceId,memberTokens,member;
const secret='day24-test-secret-'.repeat(3),setupToken='day24-test-setup-'.repeat(3),password='Day24-test-password!';
const register=(token,email)=>({token,email,password,displayName:'受邀测试成员'});
async function api(path,data,token){const res=await fetch(server.httpURL+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(data)});return {status:res.status,body:await res.json()};}
async function create(maxUses=3){return auth.createInvite(owner,{workspaceId,expiresInHours:24,maxUses});}
before(async()=>{host=await startTestPostgres();pool=new pg.Pool({connectionString:host.url});pool.on('error',()=>{});server=await listenSyncServer(createSyncServer({port:0,databaseUrl:host.url,authMode:'required',authSecret:secret,setupToken}));auth=server.auth;await auth.setup({setupToken,email:'owner@example.test',password,displayName:'所有者',workspaceName:'邀请空间'});ownerTokens=await auth.login('owner@example.test',password);owner=await auth.authenticate(ownerTokens.accessToken);workspaceId=(await auth.me(owner)).workspaces[0].id;});
after(async()=>{await server?.destroy();await pool?.end();await host?.stop();});
test('owner HTTP management is scoped, bounded and never lists raw invitation secrets',async()=>{
 assert.equal((await api('/api/invites',{workspaceId,expiresInHours:24,maxUses:2})).status,401);
 assert.equal((await api('/api/invites',{workspaceId:'other',expiresInHours:24,maxUses:2},ownerTokens.accessToken)).status,403);
 for(const settings of [{expiresInHours:0,maxUses:1},{expiresInHours:721,maxUses:1},{expiresInHours:1,maxUses:101},{expiresInHours:1.5,maxUses:2}])assert.equal((await api('/api/invites',{workspaceId,...settings},ownerTokens.accessToken)).status,400);
 const result=await api('/api/invites',{workspaceId,expiresInHours:1,maxUses:2},ownerTokens.accessToken);assert.equal(result.status,200);assert.match(result.body.token,/^[A-Za-z0-9_-]{43}$/);
 const row=(await pool.query('SELECT * FROM mc_invite_tokens WHERE id=$1',[result.body.id])).rows[0];assert.equal(row.token_hash,createHash('sha256').update(result.body.token).digest('hex'));assert.notEqual(row.token_hash,result.body.token);
 const list=await api('/api/invites/list',{workspaceId},ownerTokens.accessToken);assert.equal(list.status,200);assert.ok(!JSON.stringify(list.body).includes(result.body.token));assert.equal(list.body.invites[0].token_hash,undefined);
});
test('preview does not consume; invited registration joins only the target space as non-admin editor',async()=>{
 const invite=await create();for(let i=0;i<2;i++)assert.equal((await api('/api/invites/preview',{token:invite.token})).status,200);
 assert.equal((await pool.query('SELECT uses FROM mc_invite_tokens WHERE id=$1',[invite.id])).rows[0].uses,0);
 assert.equal((await api('/api/invites/register',register(invite.token,'member@example.test'))).status,200);
 memberTokens=await auth.login('member@example.test',password);member=await auth.authenticate(memberTokens.accessToken);
 assert.deepEqual((await auth.me(member)).workspaces.map(w=>[w.id,w.role]),[[workspaceId,'editor']]);assert.equal((await pool.query('SELECT is_admin FROM mc_users WHERE id=$1',[member.userId])).rows[0].is_admin,false);
 assert.equal((await api('/api/invites', {workspaceId,expiresInHours:24,maxUses:1},memberTokens.accessToken)).status,403);
 assert.equal((await api('/api/invites/list',{workspaceId},memberTokens.accessToken)).status,403);
 assert.equal((await api('/api/invites/revoke',{workspaceId,id:invite.id},memberTokens.accessToken)).status,403);
 assert.equal((await api('/api/invites/register',register(invite.token,'member@example.test'))).status,409);
 assert.equal((await pool.query('SELECT uses FROM mc_invite_tokens WHERE id=$1',[invite.id])).rows[0].uses,1);
 await assert.rejects(auth.registerInvite(register('x'.repeat(43),'missing@example.test')),{status:410});
});
test('two concurrent registrations compete for one use without overbooking or orphan users',async()=>{
 const invite=await create(1);const results=await Promise.allSettled([auth.registerInvite(register(invite.token,'race1@example.test')),auth.registerInvite(register(invite.token,'race2@example.test'))]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.status,410);
 assert.equal((await pool.query('SELECT uses FROM mc_invite_tokens WHERE id=$1',[invite.id])).rows[0].uses,1);
 assert.equal((await pool.query("SELECT count(*) FROM mc_users WHERE email IN ('race1@example.test','race2@example.test')")).rows[0].count,'1');
 await assert.rejects(auth.previewInvite({token:invite.token}),{status:410});
});
test('expiry, revocation, creator demotion and cross-space revoke are enforced',async()=>{
 const expired=await create();await pool.query("UPDATE mc_invite_tokens SET expires_at=now()-interval '1 second' WHERE id=$1",[expired.id]);await assert.rejects(auth.registerInvite(register(expired.token,'expired@example.test')),{status:410});
 const revoked=await create();assert.equal((await api('/api/invites/revoke',{workspaceId,id:revoked.id},ownerTokens.accessToken)).status,200);await assert.rejects(auth.previewInvite({token:revoked.token}),{status:410});
 await assert.rejects(auth.revokeInvite(owner,{workspaceId:'other',id:revoked.id}),{status:403});
 const stale=await create();await pool.query("UPDATE mc_memberships SET role='editor' WHERE user_id=$1",[owner.userId]);try{await assert.rejects(auth.previewInvite({token:stale.token}),{status:410});await assert.rejects(auth.registerInvite(register(stale.token,'stale@example.test')),{status:410});}finally{await pool.query("UPDATE mc_memberships SET role='owner' WHERE user_id=$1",[owner.userId]);}
});
test('membership insertion failure rolls back the user and consumption counter',async()=>{
 const invite=await create();await pool.query("CREATE FUNCTION reject_invited_member() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test membership failure'; END $$; CREATE TRIGGER reject_invited_member BEFORE INSERT ON mc_memberships FOR EACH ROW EXECUTE FUNCTION reject_invited_member()");
 try{await assert.rejects(auth.registerInvite(register(invite.token,'rollback@example.test')));}finally{await pool.query('DROP TRIGGER reject_invited_member ON mc_memberships; DROP FUNCTION reject_invited_member()');}
 assert.equal((await pool.query("SELECT count(*) FROM mc_users WHERE email='rollback@example.test'")).rows[0].count,'0');assert.equal((await pool.query('SELECT uses FROM mc_invite_tokens WHERE id=$1',[invite.id])).rows[0].uses,0);
});
test('existing account join is idempotent, consumes only a new membership and preserves role',async()=>{
 const invite=await create();await auth.joinInvite(owner,{token:invite.token});assert.equal((await pool.query('SELECT uses FROM mc_invite_tokens WHERE id=$1',[invite.id])).rows[0].uses,0);assert.equal((await auth.me(owner)).workspaces[0].role,'owner');
 const other=randomUUID();await pool.query('INSERT INTO mc_workspaces (id,name,created_by) VALUES ($1,$2,$3)',[other,'另一个空间',owner.userId]);await pool.query("INSERT INTO mc_memberships VALUES ($1,$2,'owner')",[other,owner.userId]);const additional=await auth.createInvite(owner,{workspaceId:other,expiresInHours:2,maxUses:3});
 assert.equal((await api('/api/invites/join',{token:additional.token},memberTokens.accessToken)).status,200);await auth.joinInvite(member,{token:additional.token});assert.equal((await pool.query('SELECT uses FROM mc_invite_tokens WHERE id=$1',[additional.id])).rows[0].uses,1);assert.equal((await auth.me(member)).workspaces.length,2);
});
test('invited member can authenticate a real room, and invitation counters survive new service instances',async()=>{
 await pool.query("INSERT INTO mc_document_meta (workspace_id,kind,id,created_by) VALUES ($1,'page','invited-page',$2)",[workspaceId,owner.userId]);
 const document=new Y.Doc();const provider=new HocuspocusProvider({url:server.webSocketURL,name:`mc/v1/${workspaceId}/invited-page`,token:memberTokens.accessToken,document,WebSocketPolyfill:WebSocket});
 try{const start=Date.now();while(!provider.synced){if(Date.now()-start>10000)throw new Error('room did not sync');await new Promise(r=>setTimeout(r,25));}assert.equal(provider.synced,true);}finally{provider.destroy();provider.configuration.websocketProvider.destroy();document.destroy();}
 const invite=await create(1);await auth.registerInvite(register(invite.token,'persisted@example.test'));const second=createAuthService({databaseUrl:host.url,secret});try{await second.initialize();await assert.rejects(second.registerInvite(register(invite.token,'overflow@example.test')),{status:410});}finally{await second.close();}
});
