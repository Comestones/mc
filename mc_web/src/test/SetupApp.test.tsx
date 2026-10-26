import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import SetupApp, { apiOrigin } from '../auth/SetupApp';
const response=(body:unknown,status=200)=>Promise.resolve({ok:status===200,status,json:async()=>body});
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks();});
function fill(label:string,value:string){fireEvent.change(screen.getByLabelText(label,{exact:true}),{target:{value}});}
async function setupForm(){render(<SetupApp url="http://localhost:1234"/>);await screen.findByRole('button',{name:'创建管理员与工作区'});fill('管理员名称','测试管理员');fill('邮箱','admin@example.test');fill('密码','test-password-23');fill('确认密码','test-password-23');fill('部署初始化密钥','test-key-for-local-only-1234567890');}
test('account service URL rejects credentials, query strings and unsupported schemes',()=>{
 expect(apiOrigin('https://example.test/')).toBe('https://example.test');for(const url of ['file:///a','http://u:p@localhost','http://localhost?token=a','http://localhost/path'])expect(()=>apiOrigin(url)).toThrow();
});
test('initial service failure blocks setup and permits explicit retry',async()=>{
 const fetch=vi.fn().mockRejectedValueOnce(new Error()).mockImplementation(()=>response({setupRequired:true,setupEnabled:true}));vi.stubGlobal('fetch',fetch);
 render(<SetupApp url="http://localhost:1234"/>);await screen.findByRole('alert');expect(screen.queryByRole('button',{name:'创建管理员与工作区'})).toBeNull();fireEvent.click(screen.getByText('重新检查部署状态'));await screen.findByRole('button',{name:'创建管理员与工作区'});
});
test('missing deployment key configuration does not expose a claim form',async()=>{
 vi.stubGlobal('fetch',vi.fn(()=>response({setupRequired:true,setupEnabled:false})));render(<SetupApp url="http://localhost:1234"/>);await screen.findByText(/部署尚未开放初始化/);expect(screen.queryByLabelText('密码',{exact:true})).toBeNull();
});
test('mismatched passwords never submit; success clears secrets and switches to login',async()=>{
 const fetch=vi.fn().mockImplementationOnce(()=>response({setupRequired:true,setupEnabled:true})).mockImplementation(()=>response({created:true}));vi.stubGlobal('fetch',fetch);
 await setupForm();fill('确认密码','different-password');fireEvent.click(screen.getByRole('button',{name:'创建管理员与工作区'}));await screen.findByText('两次输入的密码不一致。');expect(fetch).toHaveBeenCalledTimes(1);
 fill('确认密码','test-password-23');fireEvent.click(screen.getByRole('button',{name:'创建管理员与工作区'}));await screen.findByText('初始化完成。请登录你的管理员账户。');expect(screen.getByLabelText('密码',{exact:true})).toHaveValue('');expect(screen.queryByLabelText('部署初始化密钥')).toBeNull();
});
test('conflict keeps setup blocked until server state is rechecked',async()=>{
 const fetch=vi.fn().mockImplementationOnce(()=>response({setupRequired:true,setupEnabled:true})).mockImplementationOnce(()=>response({},409)).mockImplementation(()=>response({setupRequired:false,setupEnabled:true}));vi.stubGlobal('fetch',fetch);
 await setupForm();fireEvent.click(screen.getByRole('button',{name:'创建管理员与工作区'}));await screen.findByText(/初始化已完成或邮箱已存在/);fireEvent.click(screen.getByText('重新检查部署状态'));await screen.findByRole('button',{name:'登录'});
});
test('login and logout expose only server-owned workspaces and never write local credentials',async()=>{
 localStorage.setItem('day23-anonymous-canary','unchanged');const write=vi.spyOn(Storage.prototype,'setItem');
 const fetch=vi.fn().mockImplementationOnce(()=>response({setupRequired:false,setupEnabled:true})).mockImplementationOnce(()=>response({accessToken:'access',refreshToken:'refresh',expiresIn:900})).mockImplementationOnce(()=>response({user:{id:'u',displayName:'管理员',email:'admin@example.test'},workspaces:[{id:'w',name:'默认空间',role:'owner'}]})).mockImplementation(()=>response({ok:true}));vi.stubGlobal('fetch',fetch);
 render(<SetupApp url="http://localhost:1234"/>);await screen.findByRole('button',{name:'登录'});fill('邮箱','admin@example.test');fill('密码','test-password-23');fireEvent.click(screen.getByRole('button',{name:'登录'}));await screen.findByText('默认空间');expect(write).not.toHaveBeenCalled();expect(localStorage.getItem('day23-anonymous-canary')).toBe('unchanged');fireEvent.click(screen.getByRole('button',{name:'退出登录'}));await screen.findByText('已退出登录。');expect(screen.queryByText('默认空间')).toBeNull();
});
test('double submit while pending makes one request',async()=>{
 let resolve: (value:unknown)=>void=()=>{};const fetch=vi.fn().mockImplementationOnce(()=>response({setupRequired:true,setupEnabled:true})).mockImplementation(()=>new Promise(done=>{resolve=done;}));vi.stubGlobal('fetch',fetch);
 await setupForm();const button=screen.getByRole('button',{name:'创建管理员与工作区'});fireEvent.click(button);fireEvent.click(button);expect(fetch).toHaveBeenCalledTimes(2);expect(button).toBeDisabled();resolve({ok:true,json:async()=>({created:true})});await waitFor(()=>expect(screen.getByRole('button',{name:'登录'})).toBeEnabled());
});
