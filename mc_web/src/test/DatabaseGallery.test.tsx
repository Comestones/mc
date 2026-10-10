import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react';
import { DatabaseBlock } from '../components/editor/DatabaseBlock';
import { DatabaseGallery, formatGalleryValue } from '../components/editor/database/DatabaseGallery';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { createDatabase, addProperty, addRow, validateDatabaseSchema, normalizeDatabaseSchema } from '../utils/databaseUtils';
import { normalizeViewConfig, updateViewConfig, safeCoverUrl } from '../utils/databaseViewUtils';
import { MemoryStorage } from '../utils/workspaceStorage';

function fixture() {
  let db = createDatabase('资料');
  for (const property of [
    { id: 'photo', name: '图片', type: 'url' as const },
    { id: 'notes', name: '摘要', type: 'text' as const },
    { id: 'amount', name: '数量', type: 'number' as const },
    { id: 'checked', name: '确认', type: 'checkbox' as const },
    { id: 'status', name: '状态', type: 'select' as const, options: [{ id: 'todo', name: '待办' }] },
    { id: 'priority', name: '优先级', type: 'select' as const, options: [{ id: 'high', name: '高' }] },
    { id: 'tags', name: '标签', type: 'multiSelect' as const, options: [{ id: 'a', name: '标签甲' }, { id: 'b', name: '标签乙' }] },
    { id: 'date', name: '日期', type: 'date' as const },
    { id: 'created', name: '创建时间', type: 'createdTime' as const },
  ]) db = addProperty(db, property);
  db = addRow(db, { 'prop-title': '资料一', photo: 'https://example.com/a.png', notes: '第一条摘要', amount: 0, checked: false, status: 'todo', tags: ['a', 'b'], date: '2026-10-10' });
  db = addRow(db, { 'prop-title': '资料二' });
  return db;
}
let db = fixture();
beforeEach(() => { db = fixture(); useWorkspaceStore.setState({ databases: { [db.id]: db } }); });
afterEach(cleanup);
const mount = () => render(<DatabaseBlock id="block" databaseId={db.id} />);
const gallery = () => fireEvent.click(screen.getByRole('tab', { name: '画廊' }));
const settings = () => fireEvent.click(screen.getByRole('button', { name: '画廊设置' }));

describe('Day 13 三视图和画廊', () => {
  it('旧 v2 数据库默认表格，规范化损坏配置并保留记录', () => {
    expect(validateDatabaseSchema(db)).toBe(true);
    expect(normalizeViewConfig(db, undefined).activeView).toBe('table');
    const broken = { ...db, viewConfig: { activeView: 'bad', boardGroupPropertyId: 'notes', gallery: { coverPropertyId: 'notes', visiblePropertyIds: ['notes', 'notes', 'missing', 'prop-title'] } } };
    expect(validateDatabaseSchema(broken)).toBe(false);
    const healed = normalizeDatabaseSchema(broken as unknown as typeof db);
    expect(validateDatabaseSchema(healed)).toBe(true);
    expect(healed.viewConfig?.gallery).toEqual({ coverPropertyId: null, visiblePropertyIds: ['notes'] });
    expect(healed.rowOrder).toEqual(db.rowOrder);
  });
  it('配置更新不可变且相同更新不写入，配置独立于记录', () => {
    const next = updateViewConfig(db, { activeView: 'gallery', gallery: { visiblePropertyIds: [] } });
    expect(db.viewConfig).toBeUndefined();
    expect(next.rows).toBe(db.rows);
    expect(next.viewConfig?.gallery.visiblePropertyIds).toEqual([]);
    expect(updateViewConfig(next, { activeView: 'gallery' })).toBe(next);
    expect(safeCoverUrl('javascript:alert(1)')).toBeNull();
    expect(safeCoverUrl('mailto:test@example.com')).toBeNull();
    expect(safeCoverUrl('data:image/svg+xml,x')).toBeNull();
    expect(safeCoverUrl('https://user:pass@example.com/a.png')).toBeNull();
    expect(safeCoverUrl('https://example.com/a.png')).toBe('https://example.com/a.png');
  });
  it('Tab 三视图完整切换且共享同一记录', () => {
    mount();
    expect(screen.getByRole('tab', { name: '表格' })).toHaveAttribute('aria-selected', 'true');
    gallery();
    expect(screen.getByRole('region', { name: '数据库画廊' })).toBeInTheDocument();
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '看板' }));
    expect(screen.getByRole('region', { name: '数据库看板' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '表格' }));
    expect(screen.getByRole('grid')).toBeInTheDocument();
    expect(useWorkspaceStore.getState().databases[db.id].rowOrder).toEqual(db.rowOrder);
  });
  it('键盘左右循环和 Home/End 自动激活、移动焦点，只有一个 Tab 停靠点', () => {
    mount();
    const table = screen.getByRole('tab', { name: '表格' });
    table.focus();
    fireEvent.keyDown(table, { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { name: '画廊' })).toHaveFocus();
    expect(screen.getAllByRole('tab').filter(tab => tab.tabIndex === 0)).toHaveLength(1);
    fireEvent.keyDown(screen.getByRole('tab', { name: '画廊' }), { key: 'Home' });
    expect(table).toHaveFocus();
    fireEvent.keyDown(table, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: '看板' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('tab', { name: '看板' }), { key: 'End' });
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', screen.getByRole('tab', { name: '画廊' }).id);
  });
  it('同一页面多个数据库的设置和 Tab ID 隔离', () => {
    const other = fixture();
    act(() => useWorkspaceStore.setState({ databases: { [db.id]: db, [other.id]: other } }));
    render(<><DatabaseBlock id="one" databaseId={db.id} /><DatabaseBlock id="two" databaseId={other.id} /></>);
    const containers = screen.getAllByTestId('database-block-container');
    fireEvent.click(within(containers[0]).getByRole('tab', { name: '画廊' }));
    expect(within(containers[1]).getByRole('grid')).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab');
    expect(new Set(tabs.map(tab => tab.id)).size).toBe(tabs.length);
  });
  it('字段开关可隐藏全部摘要，标题始终存在且切换视图保留设置', () => {
    mount(); gallery(); settings();
    for (const checkbox of screen.getAllByRole('checkbox')) if ((checkbox as HTMLInputElement).checked) fireEvent.click(checkbox);
    expect(screen.getByTestId(`gallery-card-${db.rowOrder[0]}`).querySelector('dl')).toBeNull();
    expect(screen.getByRole('button', { name: '打开记录：资料一' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: '摘要' }));
    expect(screen.getByText('第一条摘要')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '表格' })); gallery();
    expect(screen.getByText('第一条摘要')).toBeInTheDocument();
  });
  it('封面安全显示、空值占位和加载失败回退，更新链接可重试', () => {
    mount(); gallery(); settings();
    fireEvent.change(screen.getByRole('combobox', { name: '画廊封面来源' }), { target: { value: 'photo' } });
    const card = screen.getByTestId(`gallery-card-${db.rowOrder[0]}`);
    const image = card.querySelector('img')!;
    expect(image).toHaveAttribute('src', 'https://example.com/a.png');
    expect(image).toHaveAttribute('referrerpolicy', 'no-referrer');
    fireEvent.error(image);
    expect(within(card).getByTestId('gallery-cover-placeholder')).toBeInTheDocument();
    act(() => useWorkspaceStore.getState().updateDatabaseCell(db.id, db.rowOrder[0], 'photo', 'https://example.com/b.png'));
    expect(card.querySelector('img')).toHaveAttribute('src', 'https://example.com/b.png');
    act(() => useWorkspaceStore.getState().updateDatabaseCell(db.id, db.rowOrder[0], 'photo', 'mailto:test@example.com'));
    expect(card.querySelector('img')).toBeNull();
  });
  it('各类摘要正确显示标签名、零、false、日期和只读创建时间', () => {
    const row = db.rows[db.rowOrder[0]];
    expect(formatGalleryValue(db.properties.amount, row)).toBe('0');
    expect(formatGalleryValue(db.properties.checked, row)).toBe('未勾选');
    expect(formatGalleryValue(db.properties.status, row)).toBe('待办');
    expect(formatGalleryValue(db.properties.tags, row)).toBe('标签甲、标签乙');
    expect(formatGalleryValue(db.properties.date, row)).toBe('2026-10-10');
    expect(formatGalleryValue(db.properties.created, row)).not.toBe('—');
    expect(formatGalleryValue(db.properties.notes, db.rows[db.rowOrder[1]])).toBe('—');
  });
  it('删除/改变封面或分组字段类型后配置自愈，展示字段无悬空引用', () => {
    act(() => useWorkspaceStore.getState().updateDatabaseViewConfig(db.id, { activeView: 'gallery', boardGroupPropertyId: 'priority', gallery: { coverPropertyId: 'photo', visiblePropertyIds: ['photo', 'notes'] } }));
    mount();
    act(() => useWorkspaceStore.getState().changeDatabasePropertyType(db.id, 'photo', 'text'));
    expect(useWorkspaceStore.getState().databases[db.id].viewConfig?.gallery.coverPropertyId).toBeNull();
    act(() => useWorkspaceStore.getState().deleteDatabaseProperty(db.id, 'notes'));
    act(() => useWorkspaceStore.getState().deleteDatabaseProperty(db.id, 'priority'));
    const current = useWorkspaceStore.getState().databases[db.id];
    expect(current.viewConfig?.gallery.visiblePropertyIds).toEqual(['photo']);
    expect(current.viewConfig?.boardGroupPropertyId).toBe('status');
    expect(validateDatabaseSchema(current)).toBe(true);
  });
  it('画廊详情修改标题实时同步，Escape 归还焦点并恢复 Tab 控件', () => {
    mount(); gallery();
    fireEvent.click(screen.getByRole('button', { name: '打开记录：资料一' }));
    expect(screen.getByRole('tablist')).toHaveAttribute('inert');
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByDisplayValue('资料一'), { target: { value: '资料更新' } });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('button', { name: '打开记录：资料更新' })).toHaveFocus();
    expect(screen.getByRole('tablist')).not.toHaveAttribute('inert');
    fireEvent.click(screen.getByRole('tab', { name: '表格' }));
    expect(screen.getByRole('grid')).toHaveTextContent('资料更新');
  });
  it('删除详情记录后关闭弹窗、清理卡片并归还可用控件焦点', () => {
    render(<DatabaseGallery databaseId={db.id} />);
    fireEvent.click(screen.getByRole('button', { name: '打开记录：资料一' }));
    act(() => useWorkspaceStore.getState().deleteDatabaseRow(db.id, db.rowOrder[0]));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByTestId(`gallery-card-${db.rowOrder[0]}`)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '画廊设置' })).toHaveFocus();
  });
  it('空库可创建第一张卡片，无 URL/摘要字段仍可使用', () => {
    const empty = createDatabase('空库');
    act(() => useWorkspaceStore.setState({ databases: { [empty.id]: empty } }));
    render(<DatabaseGallery databaseId={empty.id} />); settings();
    expect(screen.getByText('暂无可展示字段，卡片始终显示标题。')).toBeInTheDocument();
    expect(screen.getByText('暂无记录，添加第一张卡片开始。')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '+ 新增卡片' }));
    expect(screen.getByRole('button', { name: '打开记录：记录 1' })).toBeInTheDocument();
  });
  it('500ms 自动保存后重建 Store/hydrate 恢复视图、封面、字段和看板分组', async () => {
    const storage = new MemoryStorage(null, { isPersistent: true });
    useWorkspaceStore.getState().setStorageAdapter(storage);
    await act(async () => { await useWorkspaceStore.getState().hydrateStore(); });
    act(() => useWorkspaceStore.setState({ databases: { [db.id]: db } }));
    const ui = mount();
    fireEvent.click(screen.getByRole('tab', { name: '看板' }));
    fireEvent.change(screen.getByRole('combobox', { name: '看板分组字段' }), { target: { value: 'priority' } });
    gallery(); settings();
    fireEvent.change(screen.getByRole('combobox', { name: '画廊封面来源' }), { target: { value: 'photo' } });
    fireEvent.click(screen.getByRole('checkbox', { name: '确认' }));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 650)); });
    const snapshot = await storage.load();
    expect(snapshot?.databases?.[db.id].viewConfig?.activeView).toBe('gallery');
    ui.unmount();
    await act(async () => {
      useWorkspaceStore.setState({ databases: {}, isHydrated: false });
      await useWorkspaceStore.getState().hydrateStore();
    });
    mount(); settings();
    expect(screen.getByRole('tab', { name: '画廊' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('combobox', { name: '画廊封面来源' })).toHaveValue('photo');
    expect(screen.getByRole('checkbox', { name: '确认' })).toBeChecked();
    fireEvent.click(screen.getByRole('tab', { name: '看板' }));
    expect(screen.getByRole('combobox', { name: '看板分组字段' })).toHaveValue('priority');
  });
});
