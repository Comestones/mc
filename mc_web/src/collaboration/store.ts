import { create } from 'zustand';
import type { ChannelState } from './session';
export const useCollaborationStore = create<ChannelState>(() => ({ status: 'disabled', synced: false }));
