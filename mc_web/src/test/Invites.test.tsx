import { useState } from 'react';
import { afterEach,expect,test,vi } from 'vitest';
import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { InvitePanel,RedeemInvite } from '../auth/Invites';
import SetupApp from '../auth/SetupApp';
const token='a'.repeat(43),base='http://localhost:1234';
const response=(body:unknown,status=200)=>Promise.resolve({ok:status===200,status,json:async()=>body});
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks();window.history.replaceState(null,'','/');});
function fill(label:string,value:string){fireEvent.change(screen.getByLabelText(label,{exact:true}),{target:{value}});}
function Redeem({accessToken,onRegistered=vi.fn(),onJoined=vi.fn(async()=>{})}:{accessToken?:string;onRegistered?:(email:string)=>void;onJoined?:()=>Promise<void>}){const[value,setValue]=useState(token);return <RedeemInvite base={base} token={value} onToken={setValue} accessToken={accessToken} onClose={()=>{}} onRegistered={onRegistered} onJoined={onJoined}/>;}
test('owner generates a fragment link with configured expiry and limit, then revokes it',async()=>{
 const row={id:'id',expires_at:'2026-12-01T00:00:00Z',max_uses:2,uses:0,revoked_at:null};
 const fetch=vi.fn().mockImplementationOnce(()=>response({invites:[]})).mockImplementationOnce(()=>response({token})).mockImplementationOnce(()=>response({invites:[row]})).mockImplementationOnce(()=>response({ok:true})).mockImplementation(()=>response({invites:[{...row,revoked_at:'2026-10-27T00:00:00Z'}]}));vi.stubGlobal('fetch',fetch);
 render(<InvitePanel base={base} accessToken="access" workspaceId="space"/>);fireEvent.click(screen.getByText('邀请设置'));await waitFor(()=>expect(screen.getByRole('button',{name:'生成邀请链接'})).toBeEnabled());fill('有效小时数（1–720）','48');fill('可用次数（1–100）','2');fireEvent.click(screen.getByRole('button',{name:'生成邀请链接'}));await screen.findByLabelText('新邀请链接');expect(screen.getByLabelText('新邀请链接')).toHaveValue(`${window.location.origin}/#invite=${token}`);
 expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({workspaceId:'space',expiresInHours:48,maxUses:2});fireEvent.click(await screen.findByRole('button',{name:'撤销邀请'}));await screen.findByText('已撤销');expect(screen.queryByLabelText('新邀请链接')).toBeNull();
});
test('expired preview shows a useful error and never renders registration fields',async()=>{
 vi.stubGlobal('fetch',vi.fn(()=>response({},410)));render(<Redeem/>);fireEvent.click(screen.getByRole('button',{name:'检查邀请码'}));await screen.findByText(/邀请已过期/);expect(screen.queryByLabelText('密码',{exact:true})).toBeNull();
});
test('register mismatch blocks submission; successful invitation passes only expected fields',async()=>{
 const fetch=vi.fn().mockImplementationOnce(()=>response({workspaceName:'目标空间'})).mockImplementation(()=>response({joined:true}));vi.stubGlobal('fetch',fetch);const registered=vi.fn();render(<Redeem onRegistered={registered}/>);fireEvent.click(screen.getByRole('button',{name:'检查邀请码'}));await screen.findByText('目标空间');fill('你的名称','受邀者');fill('邮箱','invite@example.test');fill('密码','Day24-test-password');fill('确认密码','different-password');fireEvent.click(screen.getByRole('button',{name:'注册并加入'}));await screen.findByText('两次输入的密码不一致。');expect(fetch).toHaveBeenCalledTimes(1);fill('确认密码','Day24-test-password');fireEvent.click(screen.getByRole('button',{name:'注册并加入'}));await waitFor(()=>expect(registered).toHaveBeenCalledWith('invite@example.test'));expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({token,email:'invite@example.test',password:'Day24-test-password',displayName:'受邀者'});
});
test('existing authenticated user joins without entering another password',async()=>{
 const fetch=vi.fn().mockImplementationOnce(()=>response({workspaceName:'目标空间'})).mockImplementation(()=>response({joined:true}));vi.stubGlobal('fetch',fetch);const joined=vi.fn(async()=>{});render(<Redeem accessToken="access" onJoined={joined}/>);fireEvent.click(screen.getByRole('button',{name:'检查邀请码'}));fireEvent.click(await screen.findByRole('button',{name:'加入此空间'}));await waitFor(()=>expect(joined).toHaveBeenCalledOnce());expect(fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer access');expect(screen.queryByLabelText('密码',{exact:true})).toBeNull();
});
test('known email conflict clears passwords and directs the user to sign in',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockImplementationOnce(()=>response({workspaceName:'目标空间'})).mockImplementation(()=>response({},409)));render(<Redeem/>);fireEvent.click(screen.getByRole('button',{name:'检查邀请码'}));await screen.findByText('目标空间');fill('你的名称','受邀者');fill('邮箱','existing@example.test');fill('密码','Day24-test-password');fill('确认密码','Day24-test-password');fireEvent.click(screen.getByRole('button',{name:'注册并加入'}));await screen.findByText(/该邮箱已注册/);expect(screen.getByLabelText('密码',{exact:true})).toHaveValue('');expect(screen.getByRole('button',{name:'已有账户？先登录'})).toBeEnabled();
});
test('link fragment is captured into invitation UI and removed from location without storage writes',async()=>{
 window.history.replaceState(null,'',`/#invite=${token}`);const storage=vi.spyOn(Storage.prototype,'setItem');vi.stubGlobal('fetch',vi.fn(()=>response({setupRequired:false,setupEnabled:false})));render(<SetupApp url={base}/>);await screen.findByLabelText('邀请码');expect(screen.getByLabelText('邀请码')).toHaveValue(token);expect(window.location.hash).toBe('');expect(storage).not.toHaveBeenCalled();
});
