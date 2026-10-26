import React, { useEffect, useRef, useState } from 'react';

type Setup = { setupRequired: boolean; setupEnabled: boolean };
type Tokens = { accessToken: string; refreshToken: string; expiresIn: number };
type Account = { user: { id: string; displayName: string; email: string }; workspaces: { id: string; name: string; role: string }[] };
export function apiOrigin(value: string): string {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('账户服务地址配置无效');
  return url.origin;
}
class ApiError extends Error { constructor(public status: number) { super('请求未完成'); } }
async function call<T>(base: string, path: string, data?: unknown, token?: string): Promise<T> {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(base + path, { method: data === undefined ? 'GET' : 'POST', credentials: 'omit', signal: controller.signal,
      headers: { ...(data !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(data !== undefined ? { body: JSON.stringify(data) } : {}) });
    if (!response.ok) throw new ApiError(response.status);
    return await response.json();
  } finally { clearTimeout(timer); }
}
function message(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return '邮箱或密码不正确，或会话已过期。';
    if (error.status === 403) return '初始化密钥不正确，或当前来源未获允许。';
    if (error.status === 409) return '初始化已完成或邮箱已存在，请重新检查部署状态。';
    if (error.status === 400) return '请检查邮箱、名称和密码格式。';
    if (error.status === 429) return '请求过于频繁，请稍后再试。';
  }
  return '暂时无法连接账户服务，请稍后重试。';
}
export default function SetupApp({ url }: { url: string }) {
  let base = ''; let configError = '';
  try { base = apiOrigin(url); } catch { configError = '账户服务地址配置无效，请检查部署配置。'; }
  const [setup, setSetup] = useState<Setup | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [tokens, setTokens] = useState<Tokens | null>(null);
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false); const [revision, setRevision] = useState(0);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState(''); const [displayName, setDisplayName] = useState('');
  const [workspaceName, setWorkspaceName] = useState('我的工作区'); const [setupToken, setSetupToken] = useState('');
  const mounted = useRef(false), operation = useRef(0), submitting = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; operation.current++; }; }, []);
  useEffect(() => {
    if (!base) return;
    let cancelled = false; setError(''); setSetup(null);
    void call<Setup>(base, '/api/setup').then(value => { if (!cancelled) setSetup(value); }).catch(cause => { if (!cancelled) setError(message(cause)); });
    return () => { cancelled = true; };
  }, [base, revision]);
  useEffect(() => {
    if (!tokens) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void call<Tokens>(base, '/api/auth/refresh', { refreshToken: tokens.refreshToken }).then(next => {
        if (!cancelled) setTokens(next);
      }).catch(() => {
        if (!cancelled) { setTokens(null); setAccount(null); setNotice('会话已结束，请重新登录。'); }
      });
    }, Math.max(1000, (tokens.expiresIn - 60) * 1000));
    return () => { cancelled = true; clearTimeout(timer); };
  }, [base, tokens]);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (submitting.current || !setup) return;
    setError(''); setNotice('');
    if (setup.setupRequired && password !== confirm) { setError('两次输入的密码不一致。'); return; }
    submitting.current = true; setBusy(true); const current = ++operation.current;
    try {
      if (setup.setupRequired) {
        await call(base, '/api/setup', { email, password, displayName, workspaceName, setupToken });
        if (!mounted.current || current !== operation.current) return;
        setSetup({ setupRequired: false, setupEnabled: false }); setNotice('初始化完成。请登录你的管理员账户。');
      } else {
        const next = await call<Tokens>(base, '/api/auth/login', { email, password });
        const me = await call<Account>(base, '/api/me', undefined, next.accessToken);
        if (!mounted.current || current !== operation.current) return;
        setTokens(next); setAccount(me);
      }
    } catch (cause) {
      if (mounted.current && current === operation.current) setError(message(cause));
    } finally {
      submitting.current = false;
      if (mounted.current && current === operation.current) { setBusy(false); setPassword(''); setConfirm(''); setSetupToken(''); }
    }
  }
  async function logout() {
    if (!tokens || submitting.current) return;
    submitting.current = true; setBusy(true); setError(''); const current = ++operation.current;
    try {
      await call(base, '/api/auth/logout', {}, tokens.accessToken);
      if (mounted.current && current === operation.current) { setAccount(null); setTokens(null); setNotice('已退出登录。'); }
    } catch (cause) { if (mounted.current && current === operation.current) setError(message(cause)); }
    finally { submitting.current = false; if (mounted.current) setBusy(false); }
  }
  const input = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60';
  return <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900 sm:py-16">
    <section className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8" aria-busy={busy}>
      <div className="mb-6 text-sm font-semibold tracking-widest text-blue-600">mc · 你的知识工作区</div>
      <h1 className="text-2xl font-semibold">{account ? '工作区已就绪' : setup?.setupRequired ? '欢迎使用 mc' : setup ? '登录 mc' : '正在检查部署状态'}</h1>
      {configError && <p role="alert" className="mt-4 text-red-700">{configError}</p>}
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">{notice}</p>}
      {!configError && !setup && !error && <p role="status" className="mt-4 text-sm text-slate-600">正在连接账户服务…</p>}
      {!configError && !account && error && <button type="button" disabled={busy} onClick={() => setRevision(value => value + 1)} className="mt-4 text-sm text-blue-700 underline">重新检查部署状态</button>}
      {account ? <div className="mt-5 space-y-4">
        <p>你好，{account.user.displayName}</p><p className="text-sm text-slate-500">{account.user.email}</p>
        <ul className="space-y-3" aria-label="你的工作区">{account.workspaces.map(workspace => <li key={workspace.id} className="rounded-xl border border-slate-200 p-4"><strong>{workspace.name}</strong><p className="mt-1 text-sm text-slate-500">{workspace.role === 'owner' ? '空间所有者' : '空间成员'}</p></li>)}</ul>
        <p className="text-sm text-slate-600">账户和空间已创建。账户工作区的文档编辑入口将在后续阶段接入。</p>
        <button type="button" disabled={busy} onClick={logout} className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-50">{busy ? '正在退出…' : '退出登录'}</button>
      </div> : setup && !configError && <>
        <p className="mt-3 text-sm leading-6 text-slate-600">{setup.setupRequired ? '创建首个管理员账户和默认工作区，开始配置你的 mc。现有本地文档不会自动导入。' : '使用你的账户查看已创建的工作区。关闭或刷新页面后需要重新登录。'}</p>
        {setup.setupRequired && !setup.setupEnabled ? <p role="status" className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">部署尚未开放初始化。请管理员在服务端配置 MC_SETUP_TOKEN 后重启服务，再重新检查。<button className="mt-2 block underline" onClick={() => setRevision(value => value + 1)}>重新检查</button></p> :
        <form onSubmit={submit} className="mt-6 space-y-4">
          <fieldset disabled={busy} className="space-y-4">
            {setup.setupRequired && <><label className="block text-sm font-medium">管理员名称<input className={input} value={displayName} onChange={event => setDisplayName(event.target.value)} required maxLength={80} autoComplete="name" /></label>
              <label className="block text-sm font-medium">工作区名称<input className={input} value={workspaceName} onChange={event => setWorkspaceName(event.target.value)} required maxLength={100} /></label></>}
            <label className="block text-sm font-medium">邮箱<input className={input} type="email" value={email} onChange={event => setEmail(event.target.value)} required maxLength={254} autoComplete="username" /></label>
            <label className="block text-sm font-medium">密码<input className={input} type="password" value={password} onChange={event => setPassword(event.target.value)} required minLength={setup.setupRequired ? 12 : undefined} maxLength={1024} autoComplete={setup.setupRequired ? 'new-password' : 'current-password'} /></label>
            {setup.setupRequired && <><p className="text-xs text-slate-500">密码至少 12 个字符，最多 1024 字节。</p><label className="block text-sm font-medium">确认密码<input className={input} type="password" value={confirm} onChange={event => setConfirm(event.target.value)} required autoComplete="new-password" /></label>
              <label className="block text-sm font-medium">部署初始化密钥<input className={input} type="password" value={setupToken} onChange={event => setSetupToken(event.target.value)} required maxLength={1024} autoComplete="off" /></label><p className="text-xs leading-5 text-slate-500">由部署管理员提供，用于保护首次初始化。请勿使用登录密码代替。</p></>}
            <button className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50" type="submit">{busy ? '正在提交…' : setup.setupRequired ? '创建管理员与工作区' : '登录'}</button>
          </fieldset>
        </form>}
      </>}
    </section>
  </main>;
}
