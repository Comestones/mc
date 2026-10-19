import * as Y from 'yjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { useCollaborationChannel } from '../collaboration/useCollaborationChannel';
import { DocumentPage } from '../pages/DocumentPage';
import { CollaborationStatus } from '../components/common/CollaborationStatus';
import { readPage } from '../collaboration/pageModel';
import { MemoryStorage } from '../utils/workspaceStorage';
import type { SessionOptions, createCollaborationSession } from '../collaboration/session';

const mocks = vi.hoisted(() => ({ sessions: [] as Array<{ options: SessionOptions; session: ReturnType<typeof createCollaborationSession> }> }));
vi.mock('../collaboration/session', async importOriginal => {
  const real = await importOriginal<typeof import('../collaboration/session')>();
  return { ...real, createCollaborationSession: (options: SessionOptions) => {
    const actual = real.createCollaborationSession(options);
    const session = { ...actual, connect: vi.fn(), disconnect: vi.fn() };
    mocks.sessions.push({ options, session }); return session;
  } };
});
const initial = useWorkspaceStore.getState();
const blocks = [{ id: 'a', type: 'paragraph' as const, content: 'hello' }, { id: 'b', type: 'code' as const, content: 'code', properties: { language: 'plaintext', wrap: false } }];
let storage: MemoryStorage;
function Harness() { useCollaborationChannel('ws://127.0.0.1:1234'); return <><DocumentPage /><CollaborationStatus /></>; }
function connect() {
  const record = mocks.sessions[mocks.sessions.length - 1], doc = record.session.document;
  act(() => {
    doc.transact(() => {
      const root = doc.getMap('page'), nodes = new Y.Map<Y.Map<unknown>>(), order = new Y.Array<string>(), title = new Y.Text();
      root.set('title', title); title.insert(0, 'Page'); root.set('nodes', nodes); root.set('order', order);
      for (const block of blocks) {
        const node = new Y.Map(), text = new Y.Text(), props = new Y.Map();
        nodes.set(block.id, node); node.set('content', text); text.insert(0, block.content);
        node.set('type', block.type); node.set('properties', props); node.set('children', new Y.Array());
        for (const [key, value] of Object.entries(block.properties ?? {})) props.set(key, value);
        order.push([block.id]);
      }
      root.set('schema', 1);
    }, 'remote');
    record.options.onState({ status: 'connected', synced: true });
  });
  return doc;
}
function remoteText(doc: Y.Doc, id: string) { return (doc.getMap('page').get('nodes') as Y.Map<Y.Map<unknown>>).get(id)!.get('content') as Y.Text; }
function textElement() { return document.querySelector('[data-block-id="a"]') as HTMLElement; }
beforeEach(async () => {
  mocks.sessions.length = 0;
  storage = new MemoryStorage(null, { isPersistent: true });
  useWorkspaceStore.getState().setStorageAdapter(storage);
  await useWorkspaceStore.getState().hydrateStore();
  useWorkspaceStore.setState({ ...initial, isHydrated: true, workspace: { ...initial.workspace, id: 'ws' }, activePageId: 'p',
    documents: { p: { id: 'p', title: 'Page', parentId: null, createdAt: 1, updatedAt: 1, blocks: structuredClone(blocks) } } });
});
afterEach(() => { cleanup(); useWorkspaceStore.setState(initial); vi.restoreAllMocks(); });

describe('Day16 editor binding UI', () => {
  it('real editor inputs and page title write granular Yjs types and remote changes render', () => {
    render(<Harness />); const doc = connect();
    const editor = textElement(); editor.textContent = 'hello local'; fireEvent.input(editor);
    expect(remoteText(doc, 'a').toString()).toBe('hello local');
    fireEvent.change(screen.getByRole('textbox', { name: '页面标题' }), { target: { value: 'New title' } });
    expect(readPage(doc)?.title).toBe('New title');
    act(() => doc.transact(() => { remoteText(doc, 'a').insert(0, 'Remote '); }, 'remote'));
    expect(textElement()).toHaveTextContent('Remote hello local');
    expect(screen.getByRole('status', { name: '协同通道状态' })).toHaveTextContent('协同编辑已连接');
  });
  it('remote text insertion preserves focused caret offset without stealing focus', () => {
    render(<Harness />); const doc = connect(), editor = textElement();
    editor.focus(); const range = document.createRange(); range.setStart(editor.firstChild!, 3); range.collapse(true);
    window.getSelection()!.removeAllRanges(); window.getSelection()!.addRange(range);
    act(() => doc.transact(() => remoteText(doc, 'a').insert(0, 'R'), 'remote'));
    expect(editor).toHaveFocus();
    expect(window.getSelection()!.anchorOffset).toBe(4);
  });
  it('Chinese composition buffers remote updates and merges composed text on completion', () => {
    render(<Harness />); const doc = connect(), editor = textElement(); editor.focus();
    fireEvent.compositionStart(editor); editor.textContent = 'hello中';
    act(() => doc.transact(() => remoteText(doc, 'a').insert(0, '远端'), 'remote'));
    expect(editor).toHaveTextContent('hello中');
    fireEvent.input(editor, { isComposing: true });
    fireEvent.compositionEnd(editor);
    expect(editor).toHaveTextContent('远端hello中');
    expect(remoteText(doc, 'a').toString()).toBe('远端hello中');
  });
  it('code composition retains its draft while a remote update arrives', () => {
    render(<Harness />); const doc = connect(), editor = screen.getByRole('textbox', { name: '代码编辑区' });
    fireEvent.compositionStart(editor); fireEvent.change(editor, { target: { value: 'code中' } });
    act(() => doc.transact(() => remoteText(doc, 'b').insert(0, 'R'), 'remote'));
    expect(editor).toHaveValue('code中');
    fireEvent.compositionEnd(editor);
    expect(editor).toHaveValue('Rcode中'); expect(remoteText(doc, 'b').toString()).toBe('Rcode中');
  });
  it('keyboard undo/redo undoes local input and retains remote input', () => {
    render(<Harness />); const doc = connect(), editor = textElement(); editor.textContent = 'helloA'; fireEvent.input(editor);
    act(() => doc.transact(() => remoteText(doc, 'a').insert(remoteText(doc, 'a').length, 'B'), 'remote'));
    fireEvent.keyDown(editor, { key: 'z', ctrlKey: true });
    expect(textElement()).toHaveTextContent('helloB');
    fireEvent.keyDown(textElement(), { key: 'y', ctrlKey: true });
    expect(textElement()).toHaveTextContent('helloAB');
  });
  it('remote HTML is sanitized before DOM rendering', () => {
    render(<Harness />); const doc = connect();
    act(() => doc.transact(() => { const text = remoteText(doc, 'a'); text.delete(0, text.length); text.insert(0, '<img src=x onerror="alert(1)"><b>safe</b><a href="javascript:alert(1)">link</a>'); }, 'remote'));
    expect(textElement().querySelector('img')).toBeNull();
    expect(textElement().querySelector('[onerror]')).toBeNull();
    expect(textElement().querySelector('a')).not.toHaveAttribute('href');
    expect(textElement()).toHaveTextContent('safe');
  });
  it('title composition preserves remote title changes and local Chinese text', () => {
    render(<Harness />); const doc = connect(), input = screen.getByRole('textbox', { name: '页面标题' });
    fireEvent.compositionStart(input); fireEvent.change(input, { target: { value: 'Page中' } });
    act(() => doc.transact(() => (doc.getMap('page').get('title') as Y.Text).insert(0, 'Remote '), 'remote'));
    expect(input).toHaveValue('Page中');
    fireEvent.compositionEnd(input);
    expect(input).toHaveValue('Remote Page中'); expect(readPage(doc)?.title).toBe('Remote Page中');
  });
  it('remote formatting preserves the current text selection', () => {
    render(<Harness />); const doc = connect(), editor = textElement(); editor.focus();
    const range = document.createRange(); range.setStart(editor.firstChild!, 1); range.setEnd(editor.firstChild!, 4);
    window.getSelection()!.removeAllRanges(); window.getSelection()!.addRange(range);
    act(() => doc.transact(() => { const text = remoteText(doc, 'a'); text.delete(0, text.length); text.insert(0, '<b>hello</b>'); }, 'remote'));
    expect(window.getSelection()!.toString()).toBe('ell'); expect(editor).toHaveFocus();
  });
  it('remote code insertion remaps the focused textarea caret', () => {
    render(<Harness />); const doc = connect(), input = screen.getByRole('textbox', { name: '代码编辑区' }) as HTMLTextAreaElement;
    input.focus(); input.setSelectionRange(2, 2); fireEvent.select(input);
    act(() => doc.transact(() => remoteText(doc, 'b').insert(0, 'R'), 'remote'));
    expect(input.selectionStart).toBe(3); expect(input).toHaveFocus();
  });
  it('received remote title/blocks autosave and restore after hydrate', async () => {
    const ui = render(<Harness />), doc = connect();
    act(() => doc.transact(() => remoteText(doc, 'a').insert(0, 'Saved '), 'remote'));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 650)); });
    expect((await storage.load())?.documents.p.blocks?.[0].content).toBe('Saved hello');
    ui.unmount();
    await act(async () => { useWorkspaceStore.setState({ documents: {}, isHydrated: false }); await useWorkspaceStore.getState().hydrateStore(); });
    render(<DocumentPage />);
    expect(textElement()).toHaveTextContent('Saved hello');
  });
});
