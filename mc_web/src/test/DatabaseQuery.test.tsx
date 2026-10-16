import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { DatabaseBlock } from '../components/editor/DatabaseBlock';
import type { DatabaseFilter, DatabaseSchema, DatabaseSort } from '../types/database';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { addProperty, addRow, changePropertyType, createDatabase, deleteProperty, deleteSelectOption, normalizeDatabaseSchema, updateCell, validateDatabaseSchema } from '../utils/databaseUtils';
import { normalizeQuery, queryRowIds, validQueryDate } from '../utils/databaseQueryUtils';
import { updateViewConfig } from '../utils/databaseViewUtils';
import { groupBoardRows } from '../utils/boardUtils';
import { MemoryStorage } from '../utils/workspaceStorage';

function fixture() {
  let db = createDatabase('Day14');
  for (const property of [
    { id: 'status', name: '状态', type: 'select' as const, options: [{ id: 'doing', name: '进行中' }, { id: 'done', name: '已完成' }] },
    { id: 'priority', name: '优先级', type: 'select' as const, options: [{ id: 'high', name: '高' }, { id: 'low', name: '低' }] },
    { id: 'amount', name: '数量', type: 'number' as const },
    { id: 'date', name: '日期', type: 'date' as const },
    { id: 'created', name: '创建时间', type: 'createdTime' as const },
    { id: 'checked', name: '确认', type: 'checkbox' as const },
    { id: 'tags', name: '标签', type: 'multiSelect' as const, options: [{ id: 'TagA', name: '甲' }, { id: 'TagB', name: '乙' }] },
    { id: 'notes', name: '摘要', type: 'text' as const },
    { id: 'url', name: '网址', type: 'url' as const },
  ]) db = addProperty(db, property);
  db = addRow(db, { 'prop-title': '任务10', status: 'doing', priority: 'high', amount: 10, date: '2026-10-16', checked: true, tags: ['TagA'], notes: 'Hello 世界', url: 'https://example.com/a' });
  db = addRow(db, { 'prop-title': '任务2', status: 'doing', priority: 'low', amount: 2, date: '2026-10-15', checked: false, tags: ['TagB'], notes: 'hello', url: 'https://example.com/b' });
  db = addRow(db, { 'prop-title': '任务3', status: 'done', priority: 'high', amount: 0, date: '2026-10-16', tags: ['TagA', 'TagB'] });
  db = addRow(db, { 'prop-title': '空记录' });
  db.rowOrder.forEach((id, index) => { db.rows[id].createdAt = new Date(2026, 9, 14 + index, 12).getTime(); });
  return db;
}
let db: DatabaseSchema;
const filter = (propertyId: string, operator: DatabaseFilter['operator'], value: DatabaseFilter['value'] = null, id = propertyId): DatabaseFilter => ({ id, propertyId, propertyType: db.properties[propertyId].type, operator, value });
const sort = (propertyId: string, direction: DatabaseSort['direction'] = 'asc'): DatabaseSort => ({ propertyId, propertyType: db.properties[propertyId].type, direction });
const result = (filters: DatabaseFilter[] = [], sorts: DatabaseSort[] = []) => queryRowIds(updateViewConfig(db, { query: { filters, sorts } }));
const mount = () => render(<DatabaseBlock id="block-day14" databaseId={db.id} />);
const open = () => fireEvent.click(screen.getByRole('button', { name: /筛选与排序（/ }));
const choose = (name: string, value: string) => fireEvent.change(screen.getByRole('combobox', { name }), { target: { value } });
const addFilter = (index: number, field: string, value: string) => {
  fireEvent.click(screen.getByRole('button', { name: '+ 添加筛选' }));
  choose(`筛选字段 ${index}`, field);
  choose(`筛选值 ${index}`, value);
};
const tableIds = () => Array.from(screen.getByRole('grid').querySelectorAll('tbody tr[data-row-id]')).map(row => row.getAttribute('data-row-id'));

beforeEach(async () => {
  db = fixture();
  useWorkspaceStore.getState().setStorageAdapter(new MemoryStorage(null, { isPersistent: true }));
  await useWorkspaceStore.getState().hydrateStore();
  useWorkspaceStore.setState({ databases: { [db.id]: db } });
});
afterEach(cleanup);

describe('Day14 查询数据契约', () => {
  it('旧 v2 配置兼容、空配置保持原始顺序且不修改记录', () => {
    expect(queryRowIds(db)).toEqual(db.rowOrder);
    const old = updateViewConfig(db, { activeView: 'gallery' });
    expect(validateDatabaseSchema(old)).toBe(true);
    const next = updateViewConfig(old, { query: { filters: [], sorts: [sort('amount')] } });
    expect(next.rows).toBe(old.rows);
    expect(next.rowOrder).toBe(old.rowOrder);
    expect(updateViewConfig(next, { query: next.viewConfig!.query! })).toBe(next);
    expect(db.viewConfig).toBeUndefined();
  });
  it('多字段 AND、数字 0/负数、未填写草稿均有正确含义', () => {
    expect(result([filter('status', 'equals', 'doing'), filter('priority', 'equals', 'high')])).toEqual([db.rowOrder[0]]);
    expect(result([filter('amount', 'equals', 0)])).toEqual([db.rowOrder[2]]);
    db = updateCell(db, db.rowOrder[2], 'amount', -1);
    expect(result([filter('amount', 'lt', 0)])).toEqual([db.rowOrder[2]]);
    expect(result([filter('amount', 'gte', 2)])).toEqual(db.rowOrder.slice(0, 2));
    expect(result([filter('amount', 'lte', 2)])).toEqual(db.rowOrder.slice(1, 3));
    expect(result([filter('amount', 'gt', 2)])).toEqual([db.rowOrder[0]]);
    expect(result([filter('amount', 'equals', null)])).toEqual(db.rowOrder);
  });
  it('文本不区分大小写、URL、否定条件排除空单元格', () => {
    expect(result([filter('notes', 'contains', 'HELLO')])).toEqual(db.rowOrder.slice(0, 2));
    expect(result([filter('notes', 'equals', 'HELLO')])).toEqual([db.rowOrder[1]]);
    expect(result([filter('notes', 'notContains', '世界')])).toEqual([db.rowOrder[1]]);
    expect(result([filter('notes', 'notEquals', 'hello')])).toEqual([db.rowOrder[0]]);
    expect(result([filter('url', 'contains', '/a')])).toEqual([db.rowOrder[0]]);
    expect(result([filter('notes', 'isEmpty')])).toEqual(db.rowOrder.slice(2));
    expect(result([filter('notes', 'isNotEmpty')])).toEqual(db.rowOrder.slice(0, 2));
  });
  it('多选使用稳定 option ID，复选框缺省 false 不当成空值', () => {
    expect(result([filter('tags', 'contains', 'TagA')])).toEqual([db.rowOrder[0], db.rowOrder[2]]);
    expect(result([filter('tags', 'notContains', 'TagA')])).toEqual([db.rowOrder[1]]);
    expect(result([filter('tags', 'isEmpty')])).toEqual([db.rowOrder[3]]);
    expect(result([filter('checked', 'equals', false)])).toEqual(db.rowOrder.slice(1));
    expect(result([filter('checked', 'isEmpty')])).toEqual([]);
  });
  it('日期严格校验、创建时间按本地日历过滤、实际时间排序', () => {
    expect(validQueryDate('2026-02-30')).toBe(false);
    expect(validQueryDate('2024-02-29')).toBe(true);
    expect(validQueryDate('2026-10-16T00:00:00Z')).toBe(false);
    expect(validQueryDate('0000-01-01')).toBe(false);
    expect(result([filter('date', 'gte', '2026-10-16')])).toEqual([db.rowOrder[0], db.rowOrder[2]]);
    expect(result([filter('created', 'equals', '2026-10-16')])).toEqual([db.rowOrder[2]]);
    expect(result([], [sort('created', 'desc')])).toEqual([...db.rowOrder].reverse());
  });
  it('数值排序、自然文本排序、升降序空值末尾与稳定同值', () => {
    expect(result([], [sort('amount')])).toEqual([db.rowOrder[2], db.rowOrder[1], db.rowOrder[0], db.rowOrder[3]]);
    expect(result([], [sort('amount', 'desc')])).toEqual(db.rowOrder);
    const text = result([], [sort('prop-title')]);
    expect(text.indexOf(db.rowOrder[1])).toBeLessThan(text.indexOf(db.rowOrder[0]));
    db = updateCell(db, db.rowOrder[0], 'amount', 2);
    expect(result([], [sort('amount')]).slice(1, 3)).toEqual(db.rowOrder.slice(0, 2));
  });
  it('多重排序按声明优先级，标签按显示名称、多选按名称序列', () => {
    expect(result([], [sort('status', 'desc'), sort('amount', 'desc')])).toEqual([db.rowOrder[2], db.rowOrder[0], db.rowOrder[1], db.rowOrder[3]]);
    const ids = result([], [sort('tags')]);
    expect(ids[ids.length - 1]).toBe(db.rowOrder[3]);
    const rows = queryRowIds(updateViewConfig(db, { query: { filters: [filter('status', 'equals', 'doing')], sorts: [sort('amount')] } }));
    expect(groupBoardRows(db, 'status', rows).find(group => group.id === 'doing')?.rowIds).toEqual([db.rowOrder[1], db.rowOrder[0]]);
  });
  it('严格拒绝非法规则，规范化清除重复ID、悬空字段/选项、类型及操作符错误', () => {
    const query = { filters: [filter('amount', 'equals', 2)], sorts: [sort('amount')] };
    const current = updateViewConfig(db, { query });
    for (const bad of [null, {}, { filters: 'bad', sorts: [] }, { filters: [{ ...filter('amount', 'equals', 2), value: Infinity }], sorts: [] },
      { filters: [filter('date', 'equals', '2026-02-30')], sorts: [] }, { filters: [filter('status', 'equals', 'missing')], sorts: [] },
      { filters: [{ ...filter('amount', 'equals', 2), operator: 'contains' }], sorts: [] },
      { filters: [filter('amount', 'equals', 2), filter('amount', 'equals', 3)], sorts: [sort('amount'), sort('amount')] },
      { filters: [{ ...filter('amount', 'equals', 2), propertyId: 'missing' }], sorts: [] },
      { filters: [], sorts: [{ ...sort('amount'), direction: 'wrong' }] }]) {
      const damaged = { ...current, viewConfig: { ...current.viewConfig!, query: bad } } as unknown as DatabaseSchema;
      expect(validateDatabaseSchema(damaged)).toBe(false);
      expect(validateDatabaseSchema(normalizeDatabaseSchema(damaged))).toBe(true);
    }
    expect(normalizeQuery(db, { filters: [{ ...filter('amount', 'equals', 2), propertyType: 'text' }], sorts: [] }).filters).toEqual([]);
  });
  it('字段删除/类型迁移/选项删除原子清理查询，旧记录仍在', () => {
    const current = updateViewConfig(db, { query: { filters: [filter('status', 'equals', 'doing'), filter('amount', 'gt', 1)], sorts: [sort('amount')] } });
    const deleted = deleteProperty(current, 'amount');
    expect(deleted.viewConfig?.query?.sorts).toEqual([]);
    expect(deleted.viewConfig?.query?.filters).toHaveLength(1);
    expect(changePropertyType(current, 'amount', 'text').viewConfig?.query?.filters).toHaveLength(1);
    const noOption = deleteSelectOption(current, 'status', 'doing');
    expect(noOption.viewConfig?.query?.filters.map(rule => rule.propertyId)).toEqual(['amount']);
    expect(validateDatabaseSchema(noOption)).toBe(true);
    expect(noOption.rowOrder).toEqual(db.rowOrder);
  });
});

describe('Day14 真实组件交互', () => {
  it('组合筛选在三视图得到相同记录，清空后全部恢复', () => {
    mount(); open();
    addFilter(1, 'status', 'doing'); addFilter(2, 'priority', 'high');
    expect(tableIds()).toEqual([db.rowOrder[0]]);
    expect(screen.getByRole('status', { name: '匹配记录数' })).toHaveTextContent('匹配 1 / 4');
    fireEvent.click(screen.getByRole('tab', { name: '看板' }));
    expect(screen.getAllByTestId(/^board-card-/)).toHaveLength(1);
    fireEvent.click(screen.getByRole('tab', { name: '画廊' }));
    expect(screen.getAllByTestId(/^gallery-card-/)).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: '清空筛选与排序' }));
    expect(screen.getAllByTestId(/^gallery-card-/)).toHaveLength(4);
    expect(useWorkspaceStore.getState().databases[db.id].rowOrder).toEqual(db.rowOrder);
  });
  it('多字段排序、方向、优先级调整与删除均由 UI 执行', () => {
    mount(); open();
    fireEvent.click(screen.getByRole('button', { name: '+ 添加排序' }));
    choose('排序字段 1', 'status'); choose('排序方向 1', 'desc');
    fireEvent.click(screen.getByRole('button', { name: '+ 添加排序' }));
    choose('排序字段 2', 'amount'); choose('排序方向 2', 'desc');
    expect(tableIds()).toEqual([db.rowOrder[2], db.rowOrder[0], db.rowOrder[1], db.rowOrder[3]]);
    fireEvent.click(screen.getByRole('button', { name: '提高排序优先级 2' }));
    expect(tableIds()).toEqual(db.rowOrder);
    fireEvent.click(screen.getByRole('button', { name: '删除排序 1' }));
    expect(screen.getByRole('combobox', { name: '排序字段 1' })).toHaveValue('status');
  });
  it('未填写条件不隐藏记录；空结果有清空入口，新增隐藏记录不丢失', () => {
    mount(); open();
    fireEvent.click(screen.getByRole('button', { name: '+ 添加筛选' }));
    expect(tableIds()).toEqual(db.rowOrder);
    fireEvent.change(screen.getByRole('textbox', { name: '筛选值 1' }), { target: { value: '无匹配词' } });
    expect(tableIds()).toEqual([]);
    expect(screen.getByText(/没有符合筛选条件的记录/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('db-add-row-btn'));
    expect(screen.getByRole('status', { name: '匹配记录数' })).toHaveTextContent('匹配 0 / 5');
    fireEvent.click(screen.getByRole('button', { name: '删除筛选 1' }));
    expect(tableIds()).toHaveLength(5);
  });
  it('画廊详情编辑使记录移出结果，详情仍可关闭且焦点有兜底', () => {
    mount(); open();
    fireEvent.click(screen.getByRole('button', { name: '+ 添加筛选' }));
    fireEvent.change(screen.getByRole('textbox', { name: '筛选值 1' }), { target: { value: '任务10' } });
    fireEvent.click(screen.getByRole('tab', { name: '画廊' }));
    fireEvent.click(screen.getByRole('button', { name: '打开记录：任务10' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByDisplayValue('任务10'), { target: { value: '已移出筛选' } });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: '关闭' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '画廊设置' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: '清空筛选与排序' }));
    expect(screen.getByRole('button', { name: '打开记录：已移出筛选' })).toBeInTheDocument();
  });
  it('数值输入、操作符更换、类型变化不会留下不可编辑的条件', () => {
    mount(); open();
    fireEvent.click(screen.getByRole('button', { name: '+ 添加筛选' }));
    choose('筛选字段 1', 'amount'); choose('筛选条件 1', 'gte');
    fireEvent.change(screen.getByRole('spinbutton', { name: '筛选值 1' }), { target: { value: '0' } });
    expect(tableIds()).toEqual(db.rowOrder.slice(0, 3));
    choose('筛选条件 1', 'isEmpty');
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(tableIds()).toEqual([db.rowOrder[3]]);
    act(() => useWorkspaceStore.getState().changeDatabasePropertyType(db.id, 'amount', 'text'));
    expect(screen.queryByRole('combobox', { name: '筛选字段 1' })).not.toBeInTheDocument();
    expect(tableIds()).toEqual(db.rowOrder);
  });
  it('排序变化中表格编辑仍绑定原行，提交后不会误写其他记录', () => {
    mount();
    const row = screen.getByRole('grid').querySelector(`tr[data-row-id="${db.rowOrder[0]}"]`)!;
    const amountCell = row.querySelectorAll('[role="gridcell"]')[3];
    fireEvent.doubleClick(amountCell);
    const input = screen.getByTestId('db-number-cell-input');
    act(() => useWorkspaceStore.getState().updateDatabaseViewConfig(db.id, { query: { filters: [], sorts: [sort('amount')] } }));
    expect(input).toHaveFocus();
    expect(input.closest('tr')).toHaveAttribute('data-row-id', db.rowOrder[0]);
    fireEvent.change(input, { target: { value: '1' } });
    fireEvent.blur(input);
    const current = useWorkspaceStore.getState().databases[db.id];
    expect(current.rows[db.rowOrder[0]].cells.amount).toBe(1);
    expect(current.rows[db.rowOrder[1]].cells.amount).toBe(2);
    expect(tableIds()).toEqual([db.rowOrder[2], db.rowOrder[0], db.rowOrder[1], db.rowOrder[3]]);
    const moved = screen.getByRole('grid').querySelector(`tr[data-row-id="${db.rowOrder[0]}"]`)!;
    fireEvent.keyDown(moved.querySelectorAll('[role="gridcell"]')[3], { key: 'ArrowDown' });
    expect(screen.getByRole('grid').querySelector(`tr[data-row-id="${db.rowOrder[1]}"]`)?.contains(document.activeElement)).toBe(true);
  });
  it('看板状态移动可使记录移出筛选，数据仍保留并可清空恢复', () => {
    mount(); open(); addFilter(1, 'status', 'doing');
    fireEvent.click(screen.getByRole('tab', { name: '看板' }));
    choose('移动记录：任务10', 'done');
    expect(screen.getAllByTestId(/^board-card-/)).toHaveLength(1);
    expect(useWorkspaceStore.getState().databases[db.id].rows[db.rowOrder[0]].cells.status).toBe('done');
    fireEvent.click(screen.getByRole('button', { name: '清空筛选与排序' }));
    expect(screen.getAllByTestId(/^board-card-/)).toHaveLength(4);
  });
  it('筛选结果增加不会抢走条件输入焦点，两个数据库查询互不影响', () => {
    const other = fixture();
    act(() => useWorkspaceStore.setState({ databases: { [db.id]: db, [other.id]: other } }));
    render(<><DatabaseBlock id="one" databaseId={db.id} /><DatabaseBlock id="two" databaseId={other.id} /></>);
    const containers = screen.getAllByTestId('database-block-container');
    const first = within(containers[0]);
    fireEvent.click(first.getByRole('button', { name: /筛选与排序（/ }));
    fireEvent.click(first.getByRole('button', { name: '+ 添加筛选' }));
    const input = first.getByRole('textbox', { name: '筛选值 1' });
    input.focus();
    fireEvent.change(input, { target: { value: '任务10' } });
    fireEvent.change(input, { target: { value: '任务' } });
    expect(input).toHaveFocus();
    expect(first.getByRole('status', { name: '匹配记录数' })).toHaveTextContent('匹配 3 / 4');
    expect(within(containers[1]).getByRole('status', { name: '匹配记录数' })).toHaveTextContent('匹配 4 / 4');
  });
  it('真实自动保存与 hydrate 恢复组合查询、排序及结果', async () => {
    const storage = new MemoryStorage(null, { isPersistent: true });
    useWorkspaceStore.getState().setStorageAdapter(storage);
    const ui = mount(); open();
    addFilter(1, 'status', 'doing');
    fireEvent.click(screen.getByRole('button', { name: '+ 添加排序' }));
    choose('排序字段 1', 'amount');
    fireEvent.click(screen.getByRole('tab', { name: '画廊' }));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 650)); });
    expect((await storage.load())?.databases?.[db.id].viewConfig?.query?.filters).toHaveLength(1);
    ui.unmount();
    await act(async () => {
      useWorkspaceStore.setState({ databases: {}, isHydrated: false });
      await useWorkspaceStore.getState().hydrateStore();
    });
    mount(); open();
    expect(screen.getByRole('combobox', { name: '筛选值 1' })).toHaveValue('doing');
    expect(screen.getByRole('combobox', { name: '排序字段 1' })).toHaveValue('amount');
    expect(screen.getAllByTestId(/^gallery-card-/).map(card => card.getAttribute('data-testid'))).toEqual([`gallery-card-${db.rowOrder[1]}`, `gallery-card-${db.rowOrder[0]}`]);
  });
});
