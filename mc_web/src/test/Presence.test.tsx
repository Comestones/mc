import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import * as Y from 'yjs';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness';
import { bindPresence, COLORS, createIdentity, decodeCursor } from '../collaboration/presence';
import { bindPresenceDom, cursorRects, htmlOffsets, readCursor } from '../collaboration/presenceDom';
import { OnlineMembers } from '../components/common/OnlineMembers';
import { PresenceOverlay } from '../collaboration/PresenceOverlay';
import { useCollaborationStore } from '../collaboration/store';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { useCollaborationChannel } from '../collaboration/useCollaborationChannel';
import { writePage } from '../collaboration/pageModel';
import type { SessionOptions, createCollaborationSession } from '../collaboration/session';

const mocks = vi.hoisted(() => ({ sessions: [] as Array<{ options: SessionOptions; session: ReturnType<typeof createCollaborationSession> }> }));
vi.mock('../collaboration/session', async importOriginal => {
  const real = await importOriginal<typeof import('../collaboration/session')>();
  return { ...real, createCollaborationSession: (options: SessionOptions) => {
    const session = { ...real.createCollaborationSession(options), connect: vi.fn(), disconnect: vi.fn() };
    mocks.sessions.push({ options, session }); return session;
  } };
});
const initial = useWorkspaceStore.getState();
const page = { title: 'Page', blocks: [{ id: 'a', type: 'paragraph' as const, content: '<b>he&amp;llo</b>😀' }, { id: 'code', type: 'code' as const, content: 'hello' }] };
const resources: Array<() => void> = [];
function seed(doc: Y.Doc) {
  const root = doc.getMap('page');
  doc.transact(() => { root.set('schema', 1); root.set('title', new Y.Text()); root.set('nodes', new Y.Map()); root.set('order', new Y.Array()); });
  writePage(doc, { title: '', blocks: [] }, page);
}
function model() {
  const doc = new Y.Doc(); seed(doc);
  const awareness = new Awareness(doc); resources.push(() => { awareness.destroy(); doc.destroy(); });
  return { doc, awareness };
}
function editors() { return render(<><input aria-label="页面标题" defaultValue="Page" /><div contentEditable data-block-id="a" suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: page.blocks[0].content }} /><div data-block-code-id="code"><textarea aria-label="代码编辑区" defaultValue="hello" /></div><input aria-label="搜索" /></>); }
function select(root: HTMLElement, start: number, end = start) {
  root.focus(); const selection = window.getSelection()!; selection.removeAllRanges();
  selection.setBaseAndExtent(root.firstChild!.firstChild ?? root.firstChild!, start, root.firstChild!.firstChild ?? root.firstChild!, end);
}
function rect(left = 100, top = 100, width = 80, height = 20) { return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() {} } as DOMRect; }
beforeEach(() => {
  mocks.sessions.length = 0;
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  useCollaborationStore.setState({ status: 'disabled', synced: false, pageBound: false, members: [], rename: undefined });
  useWorkspaceStore.setState({ ...initial, isHydrated: true, workspace: { ...initial.workspace, id: 'ws' }, activePageId: 'p', documents: {
    p: { ...page, id: 'p', parentId: null, createdAt: 1, updatedAt: 1 }, q: { ...page, id: 'q', parentId: null, createdAt: 1, updatedAt: 1 },
  } });
});
afterEach(() => { cleanup(); resources.splice(0).forEach(dispose => dispose()); useWorkspaceStore.setState(initial); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('Day17 presence and selection UI', () => {
  it('normalizes names by Unicode characters and assigns a stable safe color', () => {
    expect(createIdentity(12345).name).toBe('访客2345');
    expect(createIdentity(1, ' \n甲\u0000乙 ').name).toBe('甲乙');
    expect(Array.from(createIdentity(1, '😀'.repeat(30)).name)).toHaveLength(24);
    expect(COLORS).toContain(createIdentity(1).color);
  });
  it('publishes cursor without document changes, preserves it on rename and resolves relative offsets', () => {
    const { doc, awareness } = model(); let members: Parameters<Parameters<typeof bindPresence>[0]['onMembers']>[0] = [];
    const presence = bindPresence({ document: doc, awareness, onMembers: next => { members = next; } }); resources.push(presence.destroy);
    presence.setConnected(true); const update = vi.fn(); doc.on('update', update);
    presence.cursor({ field: 'title', anchor: 4, head: 1 }); presence.rename('乙');
    expect(update).not.toHaveBeenCalled(); expect(members[0]).toMatchObject({ self: true, name: '乙', cursor: { anchor: 4, head: 1 } });
    (doc.getMap('page').get('title') as Y.Text).insert(0, '新');
    expect(members[0].cursor).toMatchObject({ anchor: 5, head: 2 });
    presence.setConnected(false); expect(members).toEqual([]); expect(awareness.getLocalState()).toBeNull();
  });
  it('rejects malformed relative positions and positions for a different shared type', () => {
    const { doc } = model();
    expect(decodeCursor(doc, { field: 'title', anchor: null, head: [] })).toBeNull();
    const other = doc.getText('unrelated'); other.insert(0, 'x'); const pos = Y.relativePositionToJSON(Y.createRelativePositionFromTypeIndex(other, 1));
    expect(decodeCursor(doc, { field: 'title', anchor: pos, head: pos })).toBeNull();
    expect(decodeCursor(doc, { field: 'title', anchor: { tname: 'x', assoc: 2 }, head: {} })).toBeNull();
  });
  it('maps formatted HTML, entities and emoji to stored UTF-16 positions', () => {
    const { doc } = model(); editors(); const root = document.querySelector('[data-block-id="a"]') as HTMLElement;
    const map = htmlOffsets(page.blocks[0].content); expect(map.text).toBe('he&llo😀');
    select(root, 1, 3); expect(readCursor(doc)).toMatchObject({ field: 'block', blockId: 'a', anchor: 4, head: 10 });
    root.textContent = 'out of sync'; expect(readCursor(doc)).toBeNull();
  });
  it('captures native title/code backward selections and ignores unrelated controls', () => {
    const { doc } = model(); editors();
    const title = screen.getByRole('textbox', { name: '页面标题' }) as HTMLInputElement; title.focus(); title.setSelectionRange(1, 4, 'backward');
    expect(readCursor(doc)).toMatchObject({ field: 'title', anchor: 4, head: 1 });
    const code = screen.getByRole('textbox', { name: '代码编辑区' }) as HTMLTextAreaElement; code.focus(); code.setSelectionRange(2, 2);
    expect(readCursor(doc)).toEqual({ field: 'block', blockId: 'code', anchor: 2, head: 2 });
    screen.getByRole('textbox', { name: '搜索' }).focus(); expect(readCursor(doc)).toBeNull();
  });
  it('throttles selection updates, clears during IME/blur and removes pending listeners', () => {
    vi.useFakeTimers(); vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    const { doc } = model(); editors(); const publish = vi.fn(), dispose = bindPresenceDom(doc, publish);
    const input = screen.getByRole('textbox', { name: '页面标题' }) as HTMLInputElement; input.focus(); input.setSelectionRange(2, 2);
    for (let i = 0; i < 20; i++) document.dispatchEvent(new Event('selectionchange'));
    vi.advanceTimersByTime(50); expect(publish).toHaveBeenCalledTimes(1); expect(publish).toHaveBeenLastCalledWith({ field: 'title', anchor: 2, head: 2 });
    fireEvent.compositionStart(input); expect(publish).toHaveBeenLastCalledWith(null);
    fireEvent.input(input); vi.advanceTimersByTime(50); expect(publish).toHaveBeenLastCalledWith(null);
    fireEvent.compositionEnd(input); vi.advanceTimersByTime(50); expect(publish).toHaveBeenLastCalledWith({ field: 'title', anchor: 2, head: 2 });
    window.dispatchEvent(new Event('blur')); expect(publish).toHaveBeenLastCalledWith(null);
    document.dispatchEvent(new Event('selectionchange')); dispose(); const count = publish.mock.calls.length;
    vi.advanceTimersByTime(100); document.dispatchEvent(new Event('selectionchange')); vi.advanceTimersByTime(100); expect(publish).toHaveBeenCalledTimes(count);
  });
  it('does not publish a selection spanning multiple blocks', () => {
    const { doc } = model(); editors(); const root = document.querySelector('[data-block-id="a"]') as HTMLElement;
    root.focus(); const selection = window.getSelection()!; selection.setBaseAndExtent(root.firstChild!.firstChild!, 1, screen.getByRole('textbox', { name: '搜索' }), 0);
    expect(readCursor(doc)).toBeNull();
  });
  it('shows online avatars, edits own name, handles Escape and hides on disconnect', () => {
    const rename = vi.fn(); useCollaborationStore.setState({ members: [
      { clientId: 1, name: '甲', self: true, color: COLORS[0], cursor: null }, { clientId: 2, name: '乙', self: false, color: COLORS[1], cursor: null }], rename });
    render(<OnlineMembers />); expect(screen.getByLabelText('当前页面在线 2 人')).toBeInTheDocument();
    expect(screen.getByTitle('甲（你）')).toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: '编辑协作昵称' }));
    const input = screen.getByRole('textbox', { name: '协作昵称' }); expect(input).toHaveFocus(); fireEvent.change(input, { target: { value: '新名字' } });
    fireEvent.submit(screen.getByRole('form', { name: '协作昵称设置' })); expect(rename).toHaveBeenCalledWith('新名字');
    fireEvent.click(screen.getByRole('button', { name: '编辑协作昵称' })); fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' }); expect(screen.queryByRole('textbox')).toBeNull();
    act(() => useCollaborationStore.setState({ members: [] })); expect(screen.queryByRole('button')).toBeNull();
  });
  it('renders only remote carets/ranges and recomputes on scroll without changing local selection', () => {
    vi.useFakeTimers();
    editors(); vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([rect()] as unknown as DOMRectList);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(rect());
    const ranges = vi.spyOn(Range.prototype, 'getClientRects').mockReturnValue([rect(120, 100, 20)] as unknown as DOMRectList);
    const root = document.querySelector('[data-block-id="a"]') as HTMLElement; select(root, 1, 3); const selection = window.getSelection()!.toString();
    const location = { field: 'block' as const, blockId: 'a', anchor: 4, head: 10 };
    useCollaborationStore.setState({ members: [ { clientId: 1, name: '自己', color: COLORS[0], self: true, cursor: location }, { clientId: 2, name: '远端', color: COLORS[1], self: false, cursor: location } ] });
    render(<PresenceOverlay />); expect(document.querySelector('[data-remote-cursor="2"]')).not.toBeNull(); expect(document.querySelector('[data-remote-cursor="1"]')).toBeNull();
    expect(window.getSelection()!.toString()).toBe(selection);
    ranges.mockReturnValue([rect(140, 100, 20)] as unknown as DOMRectList);
    fireEvent.scroll(document); act(() => vi.advanceTimersByTime(30));
    expect(document.querySelector('[data-remote-cursor="2"]')!.lastElementChild).toHaveStyle({ left: '140px' });
    act(() => useCollaborationStore.setState({ members: [] })); expect(document.querySelector('[data-remote-cursor]')).toBeNull();
  });
  it('native input measurement cleans its mirror and preserves focus and selection', () => {
    editors(); vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([rect()] as unknown as DOMRectList);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(rect()); vi.spyOn(Range.prototype, 'getClientRects').mockReturnValue([rect(120)] as unknown as DOMRectList);
    const input = screen.getByRole('textbox', { name: '页面标题' }) as HTMLInputElement; input.focus(); input.setSelectionRange(1, 3);
    const children = document.body.childElementCount; expect(cursorRects({ field: 'title', anchor: 2, head: 2 })).not.toBeNull();
    expect(document.body.childElementCount).toBe(children); expect(input).toHaveFocus(); expect(input.selectionStart).toBe(1); expect(input.selectionEnd).toBe(3);
  });
  it('hook lifecycle binds presence only after sync, cleans on page switch and restores on reconnect', () => {
    function Harness() { useCollaborationChannel('ws://127.0.0.1:1234'); return <OnlineMembers />; }
    const ui = render(<Harness />); const record = mocks.sessions[0];
    expect(useCollaborationStore.getState().members).toEqual([]);
    act(() => { seed(record.session.document); record.options.onState({ status: 'connected', synced: true }); });
    expect(useCollaborationStore.getState().members).toHaveLength(1);
    act(() => useCollaborationStore.getState().rename?.('测试昵称'));
    expect(record.session.provider.awareness!.getLocalState()!.user.name).toBe('测试昵称');
    act(() => record.options.onState({ status: 'disconnected', synced: false })); expect(useCollaborationStore.getState().members).toEqual([]);
    act(() => record.options.onState({ status: 'connected', synced: true })); expect(useCollaborationStore.getState().members).toHaveLength(1);
    act(() => useWorkspaceStore.setState({ activePageId: 'q' })); expect(record.session.document.isDestroyed).toBe(true); expect(useCollaborationStore.getState().members).toEqual([]);
    ui.unmount(); expect(useCollaborationStore.getState().rename).toBeUndefined();
  });
  it('filters remote profiles and destroys presence without later callbacks', () => {
    const a = model(), b = model(), receive = vi.fn(); const presence = bindPresence({ document: a.doc, awareness: a.awareness, onMembers: receive }); presence.setConnected(true);
    b.awareness.setLocalState({ user: { name: 'Remote', color: 'red' } }); applyAwarenessUpdate(a.awareness, encodeAwarenessUpdate(b.awareness, [b.doc.clientID]), 'test');
    expect(receive.mock.lastCall![0]).toHaveLength(1);
    b.awareness.setLocalState({ user: { name: 'Remote', color: COLORS[1] } }); applyAwarenessUpdate(a.awareness, encodeAwarenessUpdate(b.awareness, [b.doc.clientID]), 'test');
    expect(receive.mock.lastCall![0]).toHaveLength(2);
    presence.destroy(); const count = receive.mock.calls.length; a.doc.getMap('page').set('other', 1); expect(receive).toHaveBeenCalledTimes(count);
  });
});
