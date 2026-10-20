import { useEffect, useRef, useState } from 'react';
import { useCollaborationStore } from '../../collaboration/store';
export function OnlineMembers() {
  const members = useCollaborationStore(state => state.members);
  const rename = useCollaborationStore(state => state.rename);
  const [open, setOpen] = useState(false), [draft, setDraft] = useState('');
  const root = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null);
  const self = members.find(member => member.self);
  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', close); return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  useEffect(() => { if (!self) setOpen(false); }, [self]);
  if (!self) return null;
  return <div ref={root} className="relative flex items-center gap-1" aria-label={`当前页面在线 ${members.length} 人`}>
    <button type="button" aria-label="编辑协作昵称" aria-expanded={open} onClick={() => { setDraft(self.name); setOpen(value => !value); }} className="flex items-center -space-x-1 rounded-full focus-visible:outline-blue-500">
      {members.slice(0, 4).map(member => <span key={member.clientId} title={`${member.name}${member.self ? '（你）' : ''}`} className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 text-white text-[10px] grid place-items-center" style={{ backgroundColor: member.color }}>{Array.from(member.name)[0]}</span>)}
      {members.length > 4 && <span className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-[10px] grid place-items-center">+{members.length - 4}</span>}
    </button>
    <span className="hidden sm:inline text-[11px] text-text-muted-light dark:text-text-muted-dark">在线 {members.length} 人</span>
    {open && <form aria-label="协作昵称设置" className="absolute right-0 top-9 w-64 p-3 rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark shadow-lg z-50" onSubmit={event => { event.preventDefault(); if (draft.trim()) { rename?.(draft); setOpen(false); } }} onKeyDown={event => { if (event.key === 'Escape') { setOpen(false); root.current?.querySelector('button')?.focus(); } }}>
      <label className="block text-xs mb-2">协作昵称<input ref={input} aria-label="协作昵称" value={draft} maxLength={48} onChange={event => setDraft(event.target.value)} className="mt-1 block w-full rounded border border-border-light dark:border-border-dark bg-transparent px-2 py-1 text-sm" /></label>
      <p className="text-[11px] text-text-muted-light dark:text-text-muted-dark mb-2">访客昵称用于当前页面的在线显示，最多 24 个字符。</p>
      <button type="submit" disabled={!draft.trim()} className="rounded bg-blue-600 px-2 py-1 text-xs text-white disabled:opacity-40">保存昵称</button>
    </form>}
  </div>;
}
