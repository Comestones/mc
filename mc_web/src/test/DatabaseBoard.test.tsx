import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react';
import { DatabaseBoard } from '../components/editor/database/DatabaseBoard';
import { DatabaseBlock } from '../components/editor/DatabaseBlock';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { createDatabase, addProperty, addRow, validateDatabaseSchema, deleteSelectOption } from '../utils/databaseUtils';
import { groupBoardRows } from '../utils/boardUtils';
import { MemoryStorage, validateWorkspaceSnapshot } from '../utils/workspaceStorage';

function fixture() {
  let db = createDatabase('任务');
  db = addProperty(db, { id: 'status', name: '状态', type: 'select', options: [
    { id: 'todo', name: '待办' }, { id: 'done', name: '完成' },
  ] });
  db = addRow(db, { 'prop-title': '任务一', status: 'todo' });
  db = addRow(db, { 'prop-title': '任务二' });
  return db;
}
let db = fixture();
const transfer = () => {
  const values: Record<string, string> = {};
  return { types: [] as string[], effectAllowed: '', dropEffect: '',
    setData(type: string, value: string) { values[type] = value; this.types.push(type); },
    getData(type: string) { return values[type] ?? ''; },
  };
};
beforeEach(() => { db = fixture(); useWorkspaceStore.setState({ databases: { [db.id]: db } }); });
afterEach(cleanup);

describe('Day 12 看板验收', () => {
  it('保留空列、未分组和行顺序，删除选项后不丢失记录', () => {
    expect(groupBoardRows(db, 'status').map(group => group.rowIds)).toEqual([[db.rowOrder[0]], [], [db.rowOrder[1]]]);
    const removed = deleteSelectOption(db, 'status', 'todo');
    expect(groupBoardRows(removed, 'status').at(-1)?.rowIds).toEqual(db.rowOrder);
    expect(groupBoardRows(db, 'prop-title')).toEqual([]);
  });
  it('跨列拖拽只更新状态并保留正文和顺序，拖回未分组可清空', () => {
    render(<DatabaseBoard databaseId={db.id} />);
    const dataTransfer = transfer();
    fireEvent.dragStart(screen.getByRole('button', { name: '打开记录：任务一' }), { dataTransfer });
    fireEvent.dragOver(screen.getByTestId('board-column-option-done'), { dataTransfer });
    fireEvent.drop(screen.getByTestId('board-column-option-done'), { dataTransfer });
    const updated = useWorkspaceStore.getState().databases[db.id];
    expect(updated.rows[db.rowOrder[0]].cells.status).toBe('done');
    expect(updated.rowOrder).toEqual(db.rowOrder);
    expect(updated.rows[db.rowOrder[0]].blocks).toEqual(db.rows[db.rowOrder[0]].blocks);
    expect(validateDatabaseSchema(updated)).toBe(true);
    expect(within(screen.getByTestId('board-column-option-done')).getByText('任务一')).toBeInTheDocument();
    fireEvent.dragStart(screen.getByRole('button', { name: '打开记录：任务一' }), { dataTransfer });
    fireEvent.drop(screen.getByTestId('board-column-ungrouped'), { dataTransfer });
    expect(useWorkspaceStore.getState().databases[db.id].rows[db.rowOrder[0]].cells.status).toBeNull();
  });
  it('拒绝外部或另一数据库的拖拽', () => {
    const other = fixture();
    act(() => useWorkspaceStore.setState({ databases: { [db.id]: db, [other.id]: other } }));
    render(<><DatabaseBoard databaseId={db.id} /><DatabaseBoard databaseId={other.id} /></>);
    const boards = screen.getAllByRole('region', { name: '数据库看板' });
    const dataTransfer = transfer();
    fireEvent.dragStart(within(boards[0]).getByRole('button', { name: '打开记录：任务一' }), { dataTransfer });
    fireEvent.drop(within(boards[1]).getByTestId('board-column-option-done'), { dataTransfer });
    expect(useWorkspaceStore.getState().databases[other.id].rows[other.rowOrder[0]].cells.status).toBe('todo');
    fireEvent.drop(within(boards[0]).getByTestId('board-column-option-done'), { dataTransfer: transfer() });
    expect(useWorkspaceStore.getState().databases[db.id].rows[db.rowOrder[0]].cells.status).toBe('todo');
  });
  it('键盘可移动卡片、列内新增预填状态，并通过保存和 hydrate 恢复', async () => {
    const storage = new MemoryStorage(null, { isPersistent: true });
    useWorkspaceStore.getState().setStorageAdapter(storage);
    await act(async () => { await useWorkspaceStore.getState().hydrateStore(); });
    act(() => useWorkspaceStore.setState({ databases: { [db.id]: db } }));
    render(<DatabaseBoard databaseId={db.id} />);
    fireEvent.change(screen.getByRole('combobox', { name: '移动记录：任务一' }), { target: { value: 'done' } });
    fireEvent.click(screen.getByRole('button', { name: '在完成新增记录' }));
    const current = useWorkspaceStore.getState().databases[db.id];
    expect(current.rows[current.rowOrder[2]].cells.status).toBe('done');
    await act(async () => { await useWorkspaceStore.getState().saveToStorage(true); });
    const snapshot = await storage.load();
    expect(validateWorkspaceSnapshot(snapshot)).toBe(true);
    expect(snapshot!.databases![db.id].rows[db.rowOrder[0]].cells.status).toBe('done');
    await act(async () => {
      useWorkspaceStore.setState({ databases: {}, isHydrated: false });
      await useWorkspaceStore.getState().hydrateStore();
    });
    expect(within(screen.getByTestId('board-column-option-done')).getByText('任务一')).toBeInTheDocument();
  });
  it('字段切换/删除和选项删除后自动重组，过期拖拽不会写入', () => {
    render(<DatabaseBoard databaseId={db.id} />);
    const dataTransfer = transfer();
    fireEvent.dragStart(screen.getByRole('button', { name: '打开记录：任务一' }), { dataTransfer });
    act(() => useWorkspaceStore.getState().deleteDatabaseSelectOption(db.id, 'status', 'todo'));
    expect(within(screen.getByTestId('board-column-ungrouped')).getByText('任务一')).toBeInTheDocument();
    act(() => useWorkspaceStore.getState().deleteDatabaseProperty(db.id, 'status'));
    expect(screen.getByText('添加单选状态字段后即可按状态分组。')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '添加状态字段' }));
    fireEvent.drop(screen.getByTestId('board-column-option-done'), { dataTransfer });
    const current = useWorkspaceStore.getState().databases[db.id];
    expect(validateDatabaseSchema(current)).toBe(true);
    expect(within(screen.getByTestId('board-column-ungrouped')).getByText('任务一')).toBeInTheDocument();
  });
  it('切换分组字段显示对应选项和记录', () => {
    act(() => useWorkspaceStore.getState().addDatabaseProperty(db.id, { id: 'priority', name: '优先级', type: 'select', options: [{ id: 'high', name: '高' }] }));
    render(<DatabaseBoard databaseId={db.id} />);
    fireEvent.change(screen.getByRole('combobox', { name: '看板分组字段' }), { target: { value: 'priority' } });
    expect(screen.queryByTestId('board-column-option-todo')).not.toBeInTheDocument();
    expect(screen.getByTestId('board-column-option-high')).toBeInTheDocument();
    expect(within(screen.getByTestId('board-column-ungrouped')).getAllByRole('article')).toHaveLength(2);
  });
  it('详情修改标题实时同步，Escape 关闭后归还焦点', () => {
    render(<DatabaseBoard databaseId={db.id} />);
    const trigger = screen.getByRole('button', { name: '打开记录：任务一' });
    fireEvent.click(trigger);
    expect(screen.getByTestId('database-board-container')).toHaveAttribute('inert');
    const dialog = screen.getByRole('dialog');
    const title = within(dialog).getByDisplayValue('任务一');
    fireEvent.change(title, { target: { value: '已修改任务' } });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '打开记录：已修改任务' })).toHaveFocus();
    expect(screen.getByTestId('database-board-container')).not.toHaveAttribute('inert');
  });
  it('同列拖拽不产生无效更新，已删除卡片的拖拽安全忽略', () => {
    render(<DatabaseBoard databaseId={db.id} />);
    const dataTransfer = transfer();
    const before = useWorkspaceStore.getState().databases[db.id];
    fireEvent.dragStart(screen.getByRole('button', { name: '打开记录：任务一' }), { dataTransfer });
    fireEvent.drop(screen.getByTestId('board-column-option-todo'), { dataTransfer });
    expect(useWorkspaceStore.getState().databases[db.id]).toBe(before);
    fireEvent.dragStart(screen.getByRole('button', { name: '打开记录：任务一' }), { dataTransfer });
    act(() => useWorkspaceStore.getState().deleteDatabaseRow(db.id, db.rowOrder[0]));
    fireEvent.drop(screen.getByTestId('board-column-option-done'), { dataTransfer });
    expect(useWorkspaceStore.getState().databases[db.id].rows[db.rowOrder[0]]).toBeUndefined();
    expect(validateDatabaseSchema(useWorkspaceStore.getState().databases[db.id])).toBe(true);
  });
  it('详情行被删除时关闭弹窗，解除背景隔离并归还可用控件焦点', () => {
    render(<DatabaseBoard databaseId={db.id} />);
    fireEvent.click(screen.getByRole('button', { name: '打开记录：任务一' }));
    act(() => useWorkspaceStore.getState().deleteDatabaseRow(db.id, db.rowOrder[0]));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('database-board-container')).not.toHaveAttribute('inert');
    expect(screen.getByRole('combobox', { name: '看板分组字段' })).toHaveFocus();
  });
  it('表格与看板共享数据，状态更新后切回表格仍保留', () => {
    render(<DatabaseBlock id="block" databaseId={db.id} />);
    fireEvent.click(screen.getByRole('tab', { name: '看板' }));
    fireEvent.change(screen.getByRole('combobox', { name: '移动记录：任务一' }), { target: { value: 'done' } });
    fireEvent.click(screen.getByRole('tab', { name: '表格' }));
    expect(screen.getByRole('grid')).toBeInTheDocument();
    expect(useWorkspaceStore.getState().databases[db.id].rows[db.rowOrder[0]].cells.status).toBe('done');
  });
});
