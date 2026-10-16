import { useMemo } from 'react';
import { useWorkspaceStore } from '../../../store/useWorkspaceStore';
import { queryRowIds } from '../../../utils/databaseQueryUtils';

export function useDatabaseRowIds(databaseId: string) {
  const database = useWorkspaceStore(state => state.databases[databaseId]);
  return useMemo(() => database ? queryRowIds(database) : [], [database]);
}
