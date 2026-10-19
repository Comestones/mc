import { useCollaborationStore } from '../../collaboration/store';
export function CollaborationStatus() {
  const { status, synced, pageBound } = useCollaborationStore();
  const text = status === 'disabled' ? '本地编辑' : status === 'error' ? '协同通道配置异常'
    : status === 'disconnected' ? '通道离线 · 自动重连' : status === 'connecting' || !synced ? '协同通道连接中' : pageBound ? '协同编辑已连接' : '协同通道已连接';
  return <span role="status" aria-label="协同通道状态" title={pageBound ? "当前页面标题与正文已接入协同；数据库单元格仍仅保存在本地。" : "页面内容当前仅保存在本地，内容实时同步尚未接入。"}
    className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${status === 'connected' && synced ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-neutral-500/10 text-neutral-600 dark:text-neutral-300'}`}>{text}</span>;
}
