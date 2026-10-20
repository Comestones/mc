import { create } from 'zustand';
import type { ChannelState } from './session';
export const useDatabaseChannelStore = create<{ channels: Record<string, ChannelState & { bound: boolean }> }>(() => ({ channels: {} }));
