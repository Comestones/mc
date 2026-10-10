import { useId } from 'react';
import { useWorkspaceStore } from '../../../store/useWorkspaceStore';
import type { DatabaseViewType } from '../../../types/database';
import { normalizeViewConfig } from '../../../utils/databaseViewUtils';
import { DatabaseTable } from './DatabaseTable';
import { DatabaseBoard } from './DatabaseBoard';
import { DatabaseGallery } from './DatabaseGallery';

const VIEWS: { id: DatabaseViewType; name: string }[] = [
  { id: 'table', name: '表格' }, { id: 'board', name: '看板' }, { id: 'gallery', name: '画廊' },
];

export function DatabaseViews({ databaseId }: { databaseId: string }) {
  const database = useWorkspaceStore(state => state.databases[databaseId]);
  const updateConfig = useWorkspaceStore(state => state.updateDatabaseViewConfig);
  const prefix = useId();
  if (!database) return null;
  const activeView = normalizeViewConfig(database, database.viewConfig).activeView;
  return <>
    <div role="tablist" aria-label="数据库视图" className="flex gap-2 px-4 py-2 text-xs">
      {VIEWS.map((view, index) => <button key={view.id} type="button" role="tab" id={`${prefix}-${view.id}`}
        aria-selected={activeView === view.id} aria-controls={`${prefix}-panel`} tabIndex={activeView === view.id ? 0 : -1}
        className={`rounded px-3 py-1.5 ${activeView === view.id ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
        onClick={() => updateConfig(databaseId, { activeView: view.id })}
        onKeyDown={event => {
          let next = index;
          if (event.key === 'ArrowRight') next = (index + 1) % VIEWS.length;
          else if (event.key === 'ArrowLeft') next = (index + VIEWS.length - 1) % VIEWS.length;
          else if (event.key === 'Home') next = 0;
          else if (event.key === 'End') next = VIEWS.length - 1;
          else return;
          event.preventDefault(); event.stopPropagation();
          updateConfig(databaseId, { activeView: VIEWS[next].id });
          event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
        }}>{view.name}</button>)}
    </div>
    <div role="tabpanel" id={`${prefix}-panel`} aria-labelledby={`${prefix}-${activeView}`} tabIndex={0}>
      {activeView === 'table' && <DatabaseTable databaseId={databaseId} />}
      {activeView === 'board' && <DatabaseBoard databaseId={databaseId} />}
      {activeView === 'gallery' && <DatabaseGallery databaseId={databaseId} />}
    </div>
  </>;
}
