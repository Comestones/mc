import React from 'react';
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { useCollaborationStore } from '../collaboration/store';
import { useCollaborationChannel } from '../collaboration/useCollaborationChannel';
import { CollaborationStatus } from '../components/common/CollaborationStatus';
import type { ChannelState, SessionOptions } from '../collaboration/session';

const mocks = vi.hoisted(() => ({ sessions: [] as Array<{ options: SessionOptions; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> }> }));
vi.mock('../collaboration/session', async importOriginal => {
  const real = await importOriginal<typeof import('../collaboration/session')>();
  return { ...real, createCollaborationSession: vi.fn((options: SessionOptions) => {
    const session = { options, connect: vi.fn(), disconnect: vi.fn(), destroy: vi.fn() };
    mocks.sessions.push(session); return session;
  }) };
});
const initial = useWorkspaceStore.getState();
const example = Object.values(initial.documents)[0];
beforeEach(() => {
  mocks.sessions.length = 0;
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  useCollaborationStore.setState({ status: 'disabled', synced: false });
  useWorkspaceStore.setState({ ...initial, isHydrated: true, workspace: { ...initial.workspace, id: 'ws' },
    activePageId: 'one', documents: { one: { ...example, id: 'one' }, two: { ...example, id: 'two' } } });
});
afterEach(() => { cleanup(); useWorkspaceStore.setState(initial); vi.restoreAllMocks(); });

describe('Day15 channel lifecycle and truthful status', () => {
  it('no endpoint, unhydrated or missing page creates no socket and preserves local content', () => {
    const documents = useWorkspaceStore.getState().documents;
    const disabled = renderHook(() => useCollaborationChannel(''));
    expect(mocks.sessions).toHaveLength(0); disabled.unmount();
    act(() => useWorkspaceStore.setState({ isHydrated: false }));
    const loading = renderHook(() => useCollaborationChannel('ws://127.0.0.1:1234'));
    expect(mocks.sessions).toHaveLength(0);
    act(() => useWorkspaceStore.setState({ isHydrated: true, activePageId: 'missing' }));
    expect(mocks.sessions).toHaveLength(0);
    expect(useWorkspaceStore.getState().documents).toBe(documents); loading.unmount();
  });
  it('invalid URL reports configuration error without modifying local documents', () => {
    const documents = useWorkspaceStore.getState().documents;
    renderHook(() => useCollaborationChannel('https://example.com'));
    expect(useCollaborationStore.getState().status).toBe('error');
    expect(mocks.sessions).toHaveLength(0);
    expect(useWorkspaceStore.getState().documents).toBe(documents);
  });
  it('active page and workspace changes destroy old session and start isolated room', () => {
    const ui = renderHook(() => useCollaborationChannel('ws://127.0.0.1:1234'));
    expect(mocks.sessions[0].options).toMatchObject({ workspaceId: 'ws', pageId: 'one' });
    expect(mocks.sessions[0].connect).toHaveBeenCalledTimes(1);
    act(() => useWorkspaceStore.setState({ activePageId: 'two' }));
    expect(mocks.sessions[0].destroy).toHaveBeenCalledTimes(1);
    expect(mocks.sessions[1].options.pageId).toBe('two');
    act(() => useWorkspaceStore.setState({ workspace: { ...initial.workspace, id: 'other' } }));
    expect(mocks.sessions[1].destroy).toHaveBeenCalledTimes(1);
    expect(mocks.sessions[2].options.workspaceId).toBe('other');
    ui.unmount(); expect(mocks.sessions[2].destroy).toHaveBeenCalledTimes(1);
    expect(useCollaborationStore.getState().status).toBe('disabled');
  });
  it('online/offline controls transport and unmount removes network listeners', () => {
    const ui = renderHook(() => useCollaborationChannel('ws://127.0.0.1:1234'));
    const session = mocks.sessions[0];
    act(() => window.dispatchEvent(new Event('offline')));
    expect(session.disconnect).toHaveBeenCalledTimes(1);
    act(() => window.dispatchEvent(new Event('online')));
    expect(session.connect).toHaveBeenCalledTimes(2);
    ui.unmount();
    window.dispatchEvent(new Event('online')); window.dispatchEvent(new Event('offline'));
    expect(session.connect).toHaveBeenCalledTimes(2);
    expect(session.disconnect).toHaveBeenCalledTimes(1);
  });
  it('initial offline waits for online without opening connection', () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    renderHook(() => useCollaborationChannel('ws://127.0.0.1:1234'));
    expect(mocks.sessions[0].connect).not.toHaveBeenCalled();
    expect(mocks.sessions[0].disconnect).toHaveBeenCalledTimes(1);
  });
  it('StrictMode replay and active-page deletion release sessions', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => <React.StrictMode>{children}</React.StrictMode>;
    renderHook(() => useCollaborationChannel('ws://127.0.0.1:1234'), { wrapper });
    expect(mocks.sessions).toHaveLength(2);
    expect(mocks.sessions[0].destroy).toHaveBeenCalledTimes(1);
    act(() => useWorkspaceStore.setState({ documents: {} }));
    expect(mocks.sessions[1].destroy).toHaveBeenCalledTimes(1);
    expect(useCollaborationStore.getState().status).toBe('disabled');
  });
  it('status reflects real connection/sync events and never claims editor content is synced', () => {
    render(<CollaborationStatus />);
    expect(screen.getByRole('status', { name: '协同通道状态' })).toHaveTextContent('本地编辑');
    for (const state of [
      { status: 'connecting', synced: false, text: '协同通道连接中' },
      { status: 'connected', synced: false, text: '协同通道连接中' },
      { status: 'connected', synced: true, text: '协同通道已连接' },
      { status: 'disconnected', synced: false, text: '通道离线' },
      { status: 'error', synced: false, text: '协同通道配置异常' },
    ]) {
      act(() => useCollaborationStore.setState(state as ChannelState));
      expect(screen.getByRole('status', { name: '协同通道状态' })).toHaveTextContent(state.text);
    }
    expect(screen.getByRole('status', { name: '协同通道状态' })).toHaveAttribute('title', expect.stringContaining('页面内容当前仅保存在本地'));
  });
});
