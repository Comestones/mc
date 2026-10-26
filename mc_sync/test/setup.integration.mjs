import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { startTestPostgres } from './postgresHarness.mjs';
import { createSyncServer, listenSyncServer } from '../src/server.mjs';
import { createAuthService } from '../src/auth/service.mjs';
let host,pool,server;
const secret='day23-test-secret-'.repeat(3), setupToken='day23-initialization-'.repeat(3);
const input={ email:'Admin@Example.Test', displayName:'测试管理员', workspaceName:'默认空间', password:'Day23-test-password!', setupToken };
async function api(path,data,token){const response=await fetch(server.httpURL+path,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})});return {status:response.status,body:await response.json()};}
before(async()=>{host=await startTestPostgres();pool=new pg.Pool({connectionString:host.url});pool.on('error',()=>{});server=await listenSyncServer(createSyncServer({port:0,databaseUrl:host.url,authMode:'required',authSecret:secret,setupToken}));});
after(async()=>{await server?.destroy();await pool?.end();await host?.stop();});

test('fresh deployment requires setup, absent or wrong bootstrap key cannot claim admin',async()=>{
 assert.deepEqual((await api('/api/setup')).body,{setupRequired:true,setupEnabled:true});
 for(const data of [{...input,setupToken:''},{...input,setupToken:'wrong'},{...input,email:'bad'},{...input,password:'short'},{...input,workspaceName:' '}]) assert.ok([400,403].includes((await api('/api/setup',data)).status));
 assert.equal((await pool.query('SELECT count(*) FROM mc_users')).rows[0].count,'0');
 const unavailable=createAuthService({databaseUrl:host.url,secret});
 try{assert.equal((await unavailable.setupStatus()).setupEnabled,false);await assert.rejects(unavailable.setup(input),{status:403});}finally{await unavailable.close();}
});
test('failure after user insert rolls back user, workspace, membership and setup marker',async()=>{
 await pool.query("CREATE FUNCTION reject_test_workspace() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test insertion failure'; END $$; CREATE TRIGGER reject_test_workspace BEFORE INSERT ON mc_workspaces FOR EACH ROW EXECUTE FUNCTION reject_test_workspace()");
 try{assert.equal((await api('/api/setup',input)).status,503);}finally{await pool.query('DROP TRIGGER reject_test_workspace ON mc_workspaces; DROP FUNCTION reject_test_workspace()');}
 for(const table of ['mc_users','mc_workspaces','mc_memberships','mc_setup_state']) assert.equal((await pool.query(`SELECT count(*) FROM ${table}`)).rows[0].count,'0');
 assert.equal((await api('/api/setup')).body.setupRequired,true);
});
test('parallel first visitors create exactly one administrator and owner workspace',async()=>{
 const results=await Promise.all([api('/api/setup',input),api('/api/setup',{...input,email:'other@example.test'})]);
 assert.deepEqual(results.map(result=>result.status).sort(),[200,409]);
 for(const table of ['mc_users','mc_workspaces','mc_memberships','mc_setup_state']) assert.equal((await pool.query(`SELECT count(*) FROM ${table}`)).rows[0].count,'1');
 const row=(await pool.query('SELECT u.email,u.password_hash,u.is_admin,w.name,m.role FROM mc_users u JOIN mc_memberships m ON m.user_id=u.id JOIN mc_workspaces w ON w.id=m.workspace_id')).rows[0];
 assert.equal(row.is_admin,true);assert.equal(row.name,input.workspaceName);assert.equal(row.role,'owner');assert.notEqual(row.password_hash,input.password);
 const login=await api('/api/auth/login',{email:row.email,password:input.password});assert.equal(login.status,200);
 const me=await api('/api/me',undefined,login.body.accessToken);assert.equal(me.body.workspaces.length,1);assert.equal(me.body.workspaces[0].name,input.workspaceName);
 assert.equal((await api('/api/setup')).body.setupRequired,false);
});
test('restart and disabled or demoted admin never reopen the one-time setup',async()=>{
 await server.destroy();server=await listenSyncServer(createSyncServer({port:0,databaseUrl:host.url,authMode:'required',authSecret:secret,setupToken}));
 assert.equal((await api('/api/setup')).body.setupRequired,false);
 await pool.query('UPDATE mc_users SET disabled_at=now(),is_admin=false');
 assert.equal((await api('/api/setup')).body.setupRequired,false);assert.equal((await api('/api/setup',input)).status,409);
});
test('database outage does not report an empty installation and recovery preserves state',async()=>{
 await host.postgres.stop();try{assert.equal((await api('/api/setup')).status,503);}finally{await host.postgres.start();}
 assert.equal((await api('/api/setup')).body.setupRequired,false);
});
