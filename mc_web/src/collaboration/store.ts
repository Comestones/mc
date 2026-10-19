import { create } from 'zustand';
import type { ChannelState } from './session';
export const useCollaborationStore = create<ChannelState & { pageBound?: boolean }>(() => ({ status: 'disabled', synced: false }));
