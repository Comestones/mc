import type { CacheStatus } from './offlineCache';
import { create } from 'zustand';
import type { ChannelState } from './session';
export const useDatabaseChannelStore = create<{ channels: Record<string, ChannelState & { bound: boolean; cache?: CacheStatus }> }>(() => ({ channels: {} }));
