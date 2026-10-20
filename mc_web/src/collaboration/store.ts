import { create } from 'zustand';
import type { ChannelState } from './session';
import type { PresenceMember } from './presenceTypes';
export const useCollaborationStore = create<ChannelState & {
  pageBound?: boolean; boundPageId?: string; boundWorkspaceId?: string; members: PresenceMember[]; rename?: (name: string) => void;
}>(() => ({ status: 'disabled', synced: false, members: [] }));
