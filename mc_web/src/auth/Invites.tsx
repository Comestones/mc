import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError, call } from './api';
type Invite = { id: string; expires_at: string; max_uses: number; uses: number; revoked_at: string | null };
const input = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm';
function failure(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 410) return '邀请已过期、已撤销、已用完或不存在，请联系邀请人。';
    if (error.status === 409) return '该邮箱已注册，请先登录后使用邀请码加入。';
    if (error.status === 403) return '你没有管理此空间邀请的权限。';
    if (error.status === 401) return '登录已过期，请重新登录。';
    if (error.status === 400) return '请检查名称、邮箱、密码或邀请设置。';
    if (error.status === 429) return '请求过于频繁，请稍后再试。';
  }
  return '邀请服务暂时不可用，请重试。';
}
export function InvitePanel({ base, accessToken, workspaceId }: { base: string; accessToken: string; workspaceId: string }) {
  const [open,setOpen]=useState(false),[hours,setHours]=useState(24),[maxUses,setMaxUses]=useState(1);
  const [invites,setInvites]=useState<Invite[]>([]),[link,setLink]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const pending=useRef(false),mounted=useRef(false);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  async function reload() { const result=await call<{invites:Invite[]}>(base,'/api/invites/list',{workspaceId},accessToken);if(mounted.current)setInvites(result.invites); }
  async function action(run:()=>Promise<void>) { if(pending.current)return;pending.current=true;setBusy(true);setError('');try{await run();}catch(cause){if(mounted.current)setError(failure(cause));}finally{pending.current=false;if(mounted.current)setBusy(false);} }
  return <div className="mt-3">
    <button type="button" className="text-sm text-blue-700 underline" onClick={()=>{setOpen(!open);if(!open)void action(reload);}}>邀请设置</button>
    {open && <section aria-label="邀请设置" className="mt-3 space-y-3 border-t pt-3">
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <form className="space-y-3" onSubmit={event=>{event.preventDefault();void action(async()=>{const created=await call<{token:string}>(base,'/api/invites',{workspaceId,expiresInHours:hours,maxUses},accessToken);if(mounted.current)setLink(`${window.location.origin}${window.location.pathname}#invite=${created.token}`);await reload();});}}>
        <label className="block text-sm">有效小时数（1–720）<input className={input} type="number" min={1} max={720} step={1} required value={hours} onChange={e=>setHours(Number(e.target.value))}/></label>
        <label className="block text-sm">可用次数（1–100）<input className={input} type="number" min={1} max={100} step={1} required value={maxUses} onChange={e=>setMaxUses(Number(e.target.value))}/></label>
        <button disabled={busy} className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50">生成邀请链接</button>
      </form>
      {link && <label className="block text-sm">新邀请链接<input aria-label="新邀请链接" readOnly className={input} value={link} onFocus={e=>e.target.select()}/><span className="mt-1 block text-xs text-slate-500">请复制并私下发送给受邀者。链接仅本次显示，关闭页面后无法找回，可撤销后重新生成。</span></label>}
      <button disabled={busy} onClick={()=>void action(reload)} className="text-sm text-blue-700 underline">刷新邀请列表</button>
      <ul aria-label="邀请记录" className="space-y-2">{invites.map(invite=><li key={invite.id} className="rounded-lg bg-slate-50 p-3 text-xs">
        <p>已使用 {invite.uses} / {invite.max_uses} 次 · 到期 {new Date(invite.expires_at).toLocaleString()}</p>
        {invite.revoked_at ? <span>已撤销</span> : <button disabled={busy} className="mt-2 text-red-700 underline" onClick={()=>void action(async()=>{await call(base,'/api/invites/revoke',{workspaceId,id:invite.id},accessToken);setLink('');await reload();})}>撤销邀请</button>}
      </li>)}</ul>
    </section>}
  </div>;
}
export function RedeemInvite({base,token,onToken,accessToken,onClose,onRegistered,onJoined}:{base:string;token:string;onToken:(value:string)=>void;accessToken?:string;onClose:()=>void;onRegistered:(email:string)=>void;onJoined:()=>Promise<void>}) {
  const [workspace,setWorkspace]=useState(''),[name,setName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState('');
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);const pending=useRef(false),mounted=useRef(false);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  async function act(run:()=>Promise<void>){if(pending.current)return;pending.current=true;setBusy(true);setError('');try{await run();}catch(cause){if(mounted.current)setError(failure(cause));}finally{pending.current=false;if(mounted.current)setBusy(false);}}
  async function submit(e:FormEvent){e.preventDefault();if(!accessToken && password!==confirm){setError('两次输入的密码不一致。');return;}await act(async()=>{
    if(accessToken){await call(base,'/api/invites/join',{token},accessToken);if(mounted.current)await onJoined();}
    else {try{await call(base,'/api/invites/register',{token,email,password,displayName:name});if(mounted.current)onRegistered(email);}finally{if(mounted.current){setPassword('');setConfirm('');}}}
  });}
  return <section aria-label="接受邀请" className="mt-5 space-y-4">
    <h2 className="text-lg font-semibold">加入工作区</h2>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <label className="block text-sm">邀请码<input className={input} disabled={busy} value={token} maxLength={43} onChange={e=>{onToken(e.target.value.trim());setWorkspace('');}} autoComplete="off" /></label>
    <button disabled={busy || !token} className="text-sm text-blue-700 underline" onClick={()=>void act(async()=>{const result=await call<{workspaceName:string}>(base,'/api/invites/preview',{token});if(mounted.current)setWorkspace(result.workspaceName);})}>检查邀请码</button>
    {workspace && <form className="space-y-3" onSubmit={submit}>
      <p>你将加入：<strong>{workspace}</strong></p><p className="text-xs text-slate-500">加入后获得普通成员权限。</p>
      <fieldset disabled={busy} className="space-y-3">
        {!accessToken && <><label className="block text-sm">你的名称<input className={input} required maxLength={80} value={name} onChange={e=>setName(e.target.value)} autoComplete="name"/></label>
          <label className="block text-sm">邮箱<input className={input} required type="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username"/></label>
          <label className="block text-sm">密码<input className={input} required type="password" minLength={12} maxLength={1024} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password"/></label>
          <label className="block text-sm">确认密码<input className={input} required type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="new-password"/></label></>}
        <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50">{busy?'正在加入…':accessToken?'加入此空间':'注册并加入'}</button>
      </fieldset>
    </form>}
    <button disabled={busy} className="block text-sm text-blue-700 underline" onClick={onClose}>{accessToken?'返回工作区':'已有账户？先登录'}</button>
  </section>;
}
