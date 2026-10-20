import { useDatabaseChannelStore } from '../../collaboration/databaseChannelStore';
export function DatabaseCollaborationStatus({ databaseId }: { databaseId: string }) {
  const channel = useDatabaseChannelStore(state => state.channels[databaseId]);
  if (!channel) return null;
  const text = channel.status === 'error' ? '数据库协同异常'
    : channel.status === 'disconnected' ? '数据库离线 · 自动重连'
    : channel.synced && channel.bound ? '数据库协同已连接' : '数据库协同连接中';
  return <span role="status" aria-label="数据库协同状态" className="text-[11px] text-text-muted-light dark:text-text-muted-dark" title="共享行、字段和单元格；视图、筛选和排序由各自浏览器保存。">{text}</span>;
}
