import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { BlockEditor } from '../components/editor/BlockEditor';
import { DocumentPage } from '../pages/DocumentPage';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { BlockNode, DocumentItem } from '../types/document';

// 辅助函数：在 contenteditable 元素中定位光标
function setCaretPosition(el: HTMLElement, offset: number) {
  el.focus();
  let textNode = el.firstChild;
  if (!textNode) {
    textNode = document.createTextNode(el.innerText || '');
    el.appendChild(textNode);
  }
  const range = document.createRange();
  const safeOffset = Math.min(offset, (textNode as Text).length || 0);
  range.setStart(textNode, safeOffset);
  range.collapse(true);

  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

// 辅助函数：向 Zustand Store 注册符合 DocumentItem 契约的测试文档
function registerTestDoc(id: string, blocks: BlockNode[], title = '测试页面') {
  const docItem: DocumentItem = {
    id,
    title,
    parentId: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    blocks,
  };

  useWorkspaceStore.setState((state) => ({
    ...state,
    documents: {
      ...state.documents,
      [id]: docItem,
    },
  }));
}

// 辅助函数：类型安全地获取指定文档的块列表
function getDocBlocks(docId: string): BlockNode[] {
  return useWorkspaceStore.getState().documents[docId]?.blocks ?? [];
}

describe('BlockEditor Component & Store Integration', () => {
  const testDocId = 'test-doc-1';

  beforeEach(() => {
    vi.useFakeTimers();
    registerTestDoc(testDocId, [
      { id: 'b-p1', type: 'paragraph', content: '第一段文本' },
      { id: 'b-h1', type: 'heading1', content: '核心标题' },
      { id: 'b-p2', type: 'paragraph', content: '第二段文本' },
    ]);
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('1. 真实挂载 BlockEditor，能正确渲染传入的初始块并支持空文档保底', () => {
    const blocks = getDocBlocks(testDocId);
    const { unmount } = render(
      <BlockEditor documentId={testDocId} initialBlocks={blocks} />
    );

    expect(screen.getByText('第一段文本')).toBeInTheDocument();
    expect(screen.getByText('核心标题')).toBeInTheDocument();
    expect(screen.getByText('第二段文本')).toBeInTheDocument();

    unmount();

    // 空初始块保底
    registerTestDoc('empty-doc', []);
    render(<BlockEditor documentId="empty-doc" initialBlocks={[]} />);
    const editors = document.querySelectorAll('[data-block-id]');
    expect(editors.length).toBe(1);
    expect(editors[0].getAttribute('data-placeholder')).toContain('直接开始写作');
  });

  it('2. 编辑文本内容时，Store 立即同步并且 500ms 后成功记录历史快照', () => {
    const blocks = getDocBlocks(testDocId);
    render(<BlockEditor documentId={testDocId} initialBlocks={blocks} />);

    const firstBlockEl = screen.getByText('第一段文本');
    firstBlockEl.innerText = '修改后的第一段文本';
    act(() => {
      fireEvent.input(firstBlockEl);
    });

    // Zustand Store 必须同步更新
    const updatedBlocks = getDocBlocks(testDocId);
    expect(updatedBlocks[0]?.content).toBe('修改后的第一段文本');

    // 推进 500ms 触发历史记录定时器，确保无抛错且状态稳定
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(getDocBlocks(testDocId)[0]?.content).toBe('修改后的第一段文本');
  });

  it('3. 在块中间按 Enter：拆分为两个块，标题回车降级为段落', () => {
    const blocks = getDocBlocks(testDocId);
    render(<BlockEditor documentId={testDocId} initialBlocks={blocks} />);

    // 在标题块 "核心标题" 中间 (offset 2: "核心" | "标题") 按 Enter
    const headingEl = screen.getByText('核心标题');
    setCaretPosition(headingEl, 2);

    act(() => {
      fireEvent.keyDown(headingEl, { key: 'Enter' });
    });

    const blocksAfter = getDocBlocks(testDocId);
    expect(blocksAfter.length).toBe(4);
    expect(blocksAfter[1]?.content).toBe('核心');
    expect(blocksAfter[1]?.type).toBe('heading1');
    expect(blocksAfter[2]?.content).toBe('标题');
    expect(blocksAfter[2]?.type).toBe('paragraph'); // 降级为段落
  });

  it('4. 在块首 (offset 0) 按 Enter：上方插入空段落，当前块保持下移', () => {
    const blocks = getDocBlocks(testDocId);
    render(<BlockEditor documentId={testDocId} initialBlocks={blocks} />);

    const p1El = screen.getByText('第一段文本');
    setCaretPosition(p1El, 0);

    act(() => {
      fireEvent.keyDown(p1El, { key: 'Enter' });
    });

    const blocksAfter = getDocBlocks(testDocId);
    expect(blocksAfter.length).toBe(4);
    expect(blocksAfter[0]?.type).toBe('paragraph');
    expect(blocksAfter[0]?.content).toBe('');
    expect(blocksAfter[1]?.content).toBe('第一段文本');
  });

  it('5. 在块首按 Backspace：标题降级为普通段落；首块越界拦截保底', () => {
    const initialBlocks: BlockNode[] = [
      { id: 'h1-top', type: 'heading1', content: '顶层标题' },
    ];
    registerTestDoc('doc-single', initialBlocks);
    render(<BlockEditor documentId="doc-single" initialBlocks={initialBlocks} />);

    const h1El = screen.getByText('顶层标题');
    setCaretPosition(h1El, 0);

    // 首块是标题，退格必须降级为段落且保留内容
    act(() => {
      fireEvent.keyDown(h1El, { key: 'Backspace' });
    });

    const state1 = getDocBlocks('doc-single');
    expect(state1.length).toBe(1);
    expect(state1[0]?.type).toBe('paragraph');
    expect(state1[0]?.content).toBe('顶层标题');

    // 已经是首块段落，再次退格不能越界删除
    const pEl = screen.getByText('顶层标题');
    setCaretPosition(pEl, 0);
    act(() => {
      fireEvent.keyDown(pEl, { key: 'Backspace' });
    });

    const state2 = getDocBlocks('doc-single');
    expect(state2.length).toBe(1);
    expect(state2[0]?.content).toBe('顶层标题');
  });

  it('6. 在块首按 Backspace 与上一块合并内容', () => {
    const blocks = getDocBlocks(testDocId);
    render(<BlockEditor documentId={testDocId} initialBlocks={blocks} />);

    const p2El = screen.getByText('第二段文本');
    setCaretPosition(p2El, 0);

    // 在第二段文本块首退格，应与前一个块（核心标题）合并
    act(() => {
      fireEvent.keyDown(p2El, { key: 'Backspace' });
    });

    const blocksAfter = getDocBlocks(testDocId);
    expect(blocksAfter.length).toBe(2);
    expect(blocksAfter[1]?.content).toBe('核心标题第二段文本');
  });

  it('7. 分割线 (Divider) 交互：删除相邻分割线与插入分割线末尾追加段落', () => {
    const initial: BlockNode[] = [
      { id: 'p-1', type: 'paragraph', content: '第一段' },
      { id: 'd-1', type: 'divider', content: '' },
      { id: 'p-2', type: 'paragraph', content: '第二段' },
    ];
    registerTestDoc('doc-divider', initial);
    render(<BlockEditor documentId="doc-divider" initialBlocks={initial} />);

    const p2El = screen.getByText('第二段');
    setCaretPosition(p2El, 0);

    // 在分割线下方的段落块首退格，删除分割线
    act(() => {
      fireEvent.keyDown(p2El, { key: 'Backspace' });
    });

    const blocksAfter = getDocBlocks('doc-divider');
    expect(blocksAfter.length).toBe(2);
    expect(blocksAfter[0]?.content).toBe('第一段');
    expect(blocksAfter[1]?.content).toBe('第二段');
  });

  it('8. 多行纯文本粘贴：自动拆解为多个独立块', () => {
    const blocks = getDocBlocks(testDocId);
    render(<BlockEditor documentId={testDocId} initialBlocks={blocks} />);

    const p1El = screen.getByText('第一段文本');
    setCaretPosition(p1El, 2); // "第一" | "段文本"

    const clipboardData = {
      getData: (type: string) => (type === 'text/plain' ? '行A\n行B\n行C' : ''),
    };

    act(() => {
      fireEvent.paste(p1El, { clipboardData });
    });

    const blocksAfter = getDocBlocks(testDocId);
    expect(blocksAfter.length).toBe(5);
    expect(blocksAfter[0]?.content).toBe('第一行A');
    expect(blocksAfter[1]?.content).toBe('行B');
    expect(blocksAfter[2]?.content).toBe('行C段文本');
  });

  it('9. 撤销 (Undo: Ctrl+Z) 与 重做 (Redo: Ctrl+Y / Ctrl+Shift+Z)', () => {
    const initial: BlockNode[] = [
      { id: 'b-undo-1', type: 'paragraph', content: '初始内容' },
    ];
    registerTestDoc('doc-undo', initial);
    render(<BlockEditor documentId="doc-undo" initialBlocks={initial} />);

    const blockEl = screen.getByText('初始内容');
    setCaretPosition(blockEl, 4);

    // 执行一次拆分
    act(() => {
      fireEvent.keyDown(blockEl, { key: 'Enter' });
    });
    expect(getDocBlocks('doc-undo').length).toBe(2);

    // 在当前聚焦元素上按下 Ctrl+Z 触发 Undo
    const secondBlockEl = document.querySelectorAll('[data-block-id]')[1] as HTMLElement;
    act(() => {
      fireEvent.keyDown(secondBlockEl, { key: 'z', ctrlKey: true });
    });

    const afterUndo = getDocBlocks('doc-undo');
    expect(afterUndo.length).toBe(1);
    expect(afterUndo[0]?.content).toBe('初始内容');

    // 按下 Ctrl+Y 触发 Redo
    const firstBlockEl = screen.getByText('初始内容');
    act(() => {
      fireEvent.keyDown(firstBlockEl, { key: 'y', ctrlKey: true });
    });

    const afterRedo = getDocBlocks('doc-undo');
    expect(afterRedo.length).toBe(2);
  });

  it('10. 切页与卸载时定时器生命周期清理，杜绝历史串写与内存泄漏', () => {
    registerTestDoc('doc-timer-1', [{ id: 't1', type: 'paragraph', content: '文档1' }]);
    registerTestDoc('doc-timer-2', [{ id: 't2', type: 'paragraph', content: '文档2' }]);

    const { rerender, unmount } = render(
      <BlockEditor documentId="doc-timer-1" initialBlocks={[{ id: 't1', type: 'paragraph', content: '文档1' }]} />
    );

    const el1 = screen.getByText('文档1');
    el1.innerText = '文档1修改中';
    act(() => {
      fireEvent.input(el1);
    });

    // 立即切页到文档2（在 500ms 定时器触发前）
    act(() => {
      rerender(
        <BlockEditor documentId="doc-timer-2" initialBlocks={[{ id: 't2', type: 'paragraph', content: '文档2' }]} />
      );
    });

    // 推进 600ms
    act(() => {
      vi.advanceTimersByTime(600);
    });

    // 此时文档 2 必须维持文档 2 的自身内容，不受文档 1 定时器污染
    const doc2Blocks = getDocBlocks('doc-timer-2');
    expect(doc2Blocks[0]?.content || '文档2').toBe('文档2');

    // 卸载组件不报任何内存警告或挂起异常
    unmount();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
  });

  it('11. 中文 IME 输入法合成期 (isComposing) 不拦截 Enter 或 Backspace', () => {
    const blocks = getDocBlocks(testDocId);
    render(<BlockEditor documentId={testDocId} initialBlocks={blocks} />);

    const p1El = screen.getByText('第一段文本');
    setCaretPosition(p1El, 2);

    // 模拟输入法开始
    act(() => {
      fireEvent.compositionStart(p1El);
    });

    // 在合成期按下 Enter（如拼音确认）
    act(() => {
      fireEvent.keyDown(p1El, { key: 'Enter' });
    });

    // 块数量不得发生拆分
    const blocksAfterEnter = getDocBlocks(testDocId);
    expect(blocksAfterEnter.length).toBe(3);

    // 模拟合成期按退格
    act(() => {
      fireEvent.keyDown(p1El, { key: 'Backspace' });
    });
    const blocksAfterBackspace = getDocBlocks(testDocId);
    expect(blocksAfterBackspace.length).toBe(3);

    // 合成结束并提交中文
    act(() => {
      fireEvent.compositionEnd(p1El, { currentTarget: { innerText: '第一段文本拼音' } });
    });
  });

  it('12. 真实渲染 bulletList、numberedList、todo 块，验证符号与动态连续序号展示', () => {
    const listBlocks: BlockNode[] = [
      { id: 'b-bullet', type: 'bulletList', content: '无序项A', properties: { level: 0 } },
      { id: 'b-num-1', type: 'numberedList', content: '有序项1', properties: { level: 0 } },
      { id: 'b-num-2', type: 'numberedList', content: '有序项2', properties: { level: 0 } },
      { id: 'b-num-sub', type: 'numberedList', content: '子有序项1', properties: { level: 1 } },
      { id: 'b-todo', type: 'todo', content: '待办项任务', properties: { level: 0, checked: false } },
    ];
    registerTestDoc('doc-lists', listBlocks);
    render(<BlockEditor documentId="doc-lists" initialBlocks={listBlocks} />);

    expect(screen.getByText('无序项A')).toBeInTheDocument();
    expect(screen.getByText('•')).toBeInTheDocument();

    expect(screen.getByText('有序项1')).toBeInTheDocument();
    expect(screen.getAllByText('1.').length).toBe(2); // 根级第一项与子级第一项均展示 1.
    expect(screen.getByText('2.')).toBeInTheDocument();

    expect(screen.getByText('待办项任务')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: '标记为已完成' })).toBeInTheDocument();
  });

  it('13. 待办项 (Todo) 点击勾选切换与划线状态，仍可编辑文本', () => {
    const todoBlocks: BlockNode[] = [
      { id: 't-1', type: 'todo', content: '待处理事务', properties: { level: 0, checked: false } },
    ];
    registerTestDoc('doc-todo-toggle', todoBlocks);
    render(<BlockEditor documentId="doc-todo-toggle" initialBlocks={todoBlocks} />);

    const checkboxBtn = screen.getByRole('checkbox', { name: '标记为已完成' });
    act(() => {
      fireEvent.click(checkboxBtn);
    });

    // Zustand Store 状态同步更新为 checked: true
    expect(getDocBlocks('doc-todo-toggle')[0]?.properties?.checked).toBe(true);

    // 划线状态下仍可编辑
    const textEl = screen.getByText('待处理事务');
    textEl.innerText = '待处理事务更新';
    act(() => {
      fireEvent.input(textEl);
    });
    expect(getDocBlocks('doc-todo-toggle')[0]?.content).toBe('待处理事务更新');

    // 再次点击取消勾选
    const checkedBtn = screen.getByRole('checkbox', { name: '标记为未完成' });
    act(() => {
      fireEvent.click(checkedBtn);
    });
    expect(getDocBlocks('doc-todo-toggle')[0]?.properties?.checked).toBe(false);
  });

  it('14. 列表项按 Enter 拆分：保持同列表类型与同级 level；待办新项 checked 为 false', () => {
    const initial: BlockNode[] = [
      { id: 't-split', type: 'todo', content: '第一项第二项', properties: { level: 1, checked: true } },
    ];
    registerTestDoc('doc-enter-split', initial);
    render(<BlockEditor documentId="doc-enter-split" initialBlocks={initial} />);

    const todoEl = screen.getByText('第一项第二项');
    setCaretPosition(todoEl, 3); // "第一项" | "第二项"

    act(() => {
      fireEvent.keyDown(todoEl, { key: 'Enter' });
    });

    const blocksAfter = getDocBlocks('doc-enter-split');
    expect(blocksAfter.length).toBe(2);
    expect(blocksAfter[0]?.content).toBe('第一项');
    expect(blocksAfter[0]?.properties?.checked).toBe(true);
    expect(blocksAfter[0]?.properties?.level).toBe(1);

    expect(blocksAfter[1]?.content).toBe('第二项');
    expect(blocksAfter[1]?.type).toBe('todo');
    expect(blocksAfter[1]?.properties?.level).toBe(1);
    expect(blocksAfter[1]?.properties?.checked).toBe(false); // 新块 checked 必须重置为 false
  });

  it('15. 空列表项按 Enter 退出：子级 (level > 0) 缩退，根级 (level === 0) 退出为普通段落', () => {
    const listBlocks: BlockNode[] = [
      { id: 'b-sub-empty', type: 'bulletList', content: '', properties: { level: 1 } },
    ];
    registerTestDoc('doc-exit-list', listBlocks);
    render(<BlockEditor documentId="doc-exit-list" initialBlocks={listBlocks} />);

    const emptySubEl = document.querySelector('[data-block-id="b-sub-empty"]') as HTMLElement;

    // 首次在空子级列表按 Enter：缩退为 level 0
    act(() => {
      fireEvent.keyDown(emptySubEl, { key: 'Enter' });
    });
    const state1 = getDocBlocks('doc-exit-list');
    expect(state1.length).toBe(1);
    expect(state1[0]?.type).toBe('bulletList');
    expect(state1[0]?.properties?.level).toBe(0);

    // 再次在根级空列表按 Enter：退出为普通段落 (paragraph)
    act(() => {
      fireEvent.keyDown(emptySubEl, { key: 'Enter' });
    });
    const state2 = getDocBlocks('doc-exit-list');
    expect(state2.length).toBe(1);
    expect(state2[0]?.type).toBe('paragraph');
  });

  it('16. Tab 与 Shift+Tab 缩进与防跳级：仅同家族允许缩进，不能跳级，Shift+Tab 减一至 0', () => {
    const blocks: BlockNode[] = [
      { id: 'n-0', type: 'numberedList', content: '第一项', properties: { level: 0 } },
      { id: 'n-1', type: 'numberedList', content: '第二项', properties: { level: 0 } },
      { id: 'p-sep', type: 'paragraph', content: '隔离段落' },
      { id: 'n-2', type: 'numberedList', content: '第三项', properties: { level: 0 } },
    ];
    registerTestDoc('doc-tab-test', blocks);
    render(<BlockEditor documentId="doc-tab-test" initialBlocks={blocks} />);

    // 16a: 首项按 Tab 禁止缩进
    const firstEl = screen.getByText('第一项');
    act(() => {
      fireEvent.keyDown(firstEl, { key: 'Tab' });
    });
    expect(getDocBlocks('doc-tab-test')[0]?.properties?.level).toBe(0);

    // 16b: 第二项前项为同类型 level 0，按 Tab 缩进至 1
    const secondEl = screen.getByText('第二项');
    act(() => {
      fireEvent.keyDown(secondEl, { key: 'Tab' });
    });
    expect(getDocBlocks('doc-tab-test')[1]?.properties?.level).toBe(1);

    // 16c: 第二项再次按 Tab：禁止跳级（前项为 0，最大为 1）
    act(() => {
      fireEvent.keyDown(secondEl, { key: 'Tab' });
    });
    expect(getDocBlocks('doc-tab-test')[1]?.properties?.level).toBe(1);

    // 16d: 隔着段落的第三项按 Tab：禁止跨段落缩进
    const thirdEl = screen.getByText('第三项');
    act(() => {
      fireEvent.keyDown(thirdEl, { key: 'Tab' });
    });
    expect(getDocBlocks('doc-tab-test')[3]?.properties?.level).toBe(0);

    // 16e: Shift+Tab 缩退第二项从 level 1 降为 level 0
    act(() => {
      fireEvent.keyDown(secondEl, { key: 'Tab', shiftKey: true });
    });
    expect(getDocBlocks('doc-tab-test')[1]?.properties?.level).toBe(0);
  });

  it('17. 列表项块首 Backspace：子级先缩退，根级首块降级为段落，存在前项时合并文本与删除分割线', () => {
    // 17a: 子级缩退与根级首块降级为段落（清洗 properties）
    const blocks: BlockNode[] = [
      { id: 'b-lvl1', type: 'bulletList', content: '单块子级', properties: { level: 1 } },
    ];
    registerTestDoc('doc-backspace-list', blocks);
    render(<BlockEditor documentId="doc-backspace-list" initialBlocks={blocks} />);

    const itemEl = screen.getByText('单块子级');
    setCaretPosition(itemEl, 0);

    // 子级按退格：先缩退至 level 0
    act(() => {
      fireEvent.keyDown(itemEl, { key: 'Backspace' });
    });
    const state1 = getDocBlocks('doc-backspace-list');
    expect(state1[0]?.properties?.level).toBe(0);

    // 根级首块按退格：降级为普通段落 (paragraph) 且清理 properties
    act(() => {
      fireEvent.keyDown(itemEl, { key: 'Backspace' });
    });
    const state2 = getDocBlocks('doc-backspace-list');
    expect(state2[0]?.type).toBe('paragraph');
    expect(state2[0]?.content).toBe('单块子级');
    expect(state2[0]?.properties).toBeUndefined();

    // 17b: 存在兼容前项时，根级列表块退格与前项文本合并并删除自身
    const mergeBlocks: BlockNode[] = [
      { id: 'p-prev', type: 'paragraph', content: '前置文本' },
      { id: 'b-curr', type: 'bulletList', content: '后续列表项', properties: { level: 0 } },
    ];
    registerTestDoc('doc-backspace-merge', mergeBlocks);
    render(<BlockEditor documentId="doc-backspace-merge" initialBlocks={mergeBlocks} />);

    const currEl = screen.getByText('后续列表项');
    setCaretPosition(currEl, 0);

    act(() => {
      fireEvent.keyDown(currEl, { key: 'Backspace' });
    });

    const stateMerge = getDocBlocks('doc-backspace-merge');
    expect(stateMerge.length).toBe(1);
    expect(stateMerge[0]?.id).toBe('p-prev');
    expect(stateMerge[0]?.content).toBe('前置文本后续列表项');

    // 17c: 前项为分割线时，根级列表块退格删除分割线
    const divBlocks: BlockNode[] = [
      { id: 'd-div', type: 'divider', content: '' },
      { id: 'b-after-div', type: 'bulletList', content: '分割线下列表', properties: { level: 0 } },
    ];
    registerTestDoc('doc-backspace-div', divBlocks);
    render(<BlockEditor documentId="doc-backspace-div" initialBlocks={divBlocks} />);

    const afterDivEl = screen.getByText('分割线下列表');
    setCaretPosition(afterDivEl, 0);

    act(() => {
      fireEvent.keyDown(afterDivEl, { key: 'Backspace' });
    });

    const stateDiv = getDocBlocks('doc-backspace-div');
    expect(stateDiv.length).toBe(1);
    expect(stateDiv[0]?.id).toBe('b-after-div');
    expect(stateDiv[0]?.content).toBe('分割线下列表');
  });

  it('18. 列表块内多行纯文本粘贴：自动拆解为同类型同级的新列表块', () => {
    const initial: BlockNode[] = [
      { id: 'num-paste', type: 'numberedList', content: '起始前缀', properties: { level: 1 } },
    ];
    registerTestDoc('doc-list-paste', initial);
    render(<BlockEditor documentId="doc-list-paste" initialBlocks={initial} />);

    const targetEl = screen.getByText('起始前缀');
    setCaretPosition(targetEl, 4); // 末尾

    const clipboardData = {
      getData: (type: string) => (type === 'text/plain' ? '行1\n行2\n行3' : ''),
    };

    act(() => {
      fireEvent.paste(targetEl, { clipboardData });
    });

    const blocksAfter = getDocBlocks('doc-list-paste');
    expect(blocksAfter.length).toBe(3);
    expect(blocksAfter[0]?.content).toBe('起始前缀行1');
    expect(blocksAfter[1]?.content).toBe('行2');
    expect(blocksAfter[2]?.content).toBe('行3');
    blocksAfter.forEach((b) => {
      expect(b.type).toBe('numberedList');
      expect(b.properties?.level).toBe(1);
    });
  });

  it('19. 规范化函数在组件挂载与渲染时的容错：负数、小数、字符串、NaN、Infinity 及非布尔 checked', () => {
    const malformedBlocks: BlockNode[] = [
      { id: 'b-dec', type: 'bulletList', content: '小数层级', properties: { level: 1.8 } },
      { id: 'b-neg', type: 'bulletList', content: '负数层级', properties: { level: -5 } },
      { id: 'b-str', type: 'numberedList', content: '字符串层级', properties: { level: '2' as any } },
      { id: 'b-nan', type: 'numberedList', content: 'NaN层级', properties: { level: NaN } },
      { id: 'b-inf', type: 'numberedList', content: '无穷大层级', properties: { level: Infinity } },
      { id: 't-str-chk', type: 'todo', content: '非布尔勾选', properties: { level: 0, checked: 'true' as any } },
      { id: 't-num-chk', type: 'todo', content: '数字勾选', properties: { level: 0, checked: 1 as any } },
      { id: 'p-residue', type: 'paragraph', content: '残留属性段落', properties: { level: 2, checked: true } },
    ];
    registerTestDoc('doc-malformed', malformedBlocks);
    render(<BlockEditor documentId="doc-malformed" initialBlocks={malformedBlocks} />);

    // 验证内部规范化后写入 Store 的属性
    const normalized = getDocBlocks('doc-malformed');
    expect(normalized[0]?.properties?.level).toBe(1); // 1.8 向下取整为 1
    expect(normalized[1]?.properties?.level).toBe(0); // -5 归一化为 0
    expect(normalized[2]?.properties?.level).toBe(0); // '2' 归一化为 0
    expect(normalized[3]?.properties?.level).toBe(0); // NaN 归一化为 0
    expect(normalized[4]?.properties?.level).toBe(0); // Infinity 归一化为 0
    expect(normalized[5]?.properties?.checked).toBe(false); // 'true' 归一化为 false
    expect(normalized[6]?.properties?.checked).toBe(false); // 1 归一化为 false
    expect(normalized[7]?.properties).toBeUndefined(); // paragraph 剥除 level 和 checked

    // 验证渲染视图中的视觉缩进：小数层级按 1*24=24px 缩进，负数/字符串/NaN/Infinity 无额外缩进样式
    const decWrapper = document.querySelector('[data-block-wrapper-id="b-dec"] div[style]') as HTMLElement;
    expect(decWrapper?.style.paddingLeft).toBe('24px');

    const strWrapper = document.querySelector('[data-block-wrapper-id="b-str"] div[style]') as HTMLElement;
    expect(strWrapper).toBeNull(); // 0 级无 paddingLeft 样式

    // 验证 Todo aria-checked 严格为 false
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0].getAttribute('aria-checked')).toBe('false');
    expect(checkboxes[1].getAttribute('aria-checked')).toBe('false');
  });

  it('20. 真实组件 BlockTypeSelector 转换链路：保留 ID/内容，离开列表彻底清除 level/checked，进入列表明确初始化', () => {
    const initial: BlockNode[] = [
      { id: 'b-trans', type: 'todo', content: '待转换核心文本', properties: { level: 1, checked: true } },
    ];
    registerTestDoc('doc-type-trans', initial);
    render(<BlockEditor documentId="doc-type-trans" initialBlocks={initial} />);

    // 打开类型选择器
    const moreBtn = screen.getByTitle('切换块类型或操作');
    act(() => {
      fireEvent.click(moreBtn);
    });

    // 20a: 转为无序列表 (bulletList)
    const bulletOption = screen.getByText('无序列表');
    act(() => {
      fireEvent.click(bulletOption);
    });

    const state1 = getDocBlocks('doc-type-trans');
    expect(state1[0]?.type).toBe('bulletList');
    expect(state1[0]?.id).toBe('b-trans');
    expect(state1[0]?.content).toBe('待转换核心文本');
    expect(state1[0]?.properties?.level).toBe(1); // 列表族互转保留 level
    expect(state1[0]?.properties?.checked).toBeUndefined(); // checked 被彻底清除

    // 20b: 从 bulletList 转为 paragraph (离开列表族)
    act(() => {
      fireEvent.click(moreBtn);
    });
    const paragraphOption = screen.getByText('正文段落');
    act(() => {
      fireEvent.click(paragraphOption);
    });

    const state2 = getDocBlocks('doc-type-trans');
    expect(state2[0]?.type).toBe('paragraph');
    expect(state2[0]?.id).toBe('b-trans');
    expect(state2[0]?.content).toBe('待转换核心文本');
    expect(state2[0]?.properties).toBeUndefined(); // level 和 checked 彻底被清除

    // 20c: 从 paragraph 再次转回 bulletList (重新进入列表族)
    act(() => {
      fireEvent.click(moreBtn);
    });
    act(() => {
      fireEvent.click(screen.getByText('无序列表'));
    });

    const state3 = getDocBlocks('doc-type-trans');
    expect(state3[0]?.type).toBe('bulletList');
    expect(state3[0]?.properties?.level).toBe(0); // 必须重新初始化为 0，而非残留 1！
    expect(state3[0]?.properties?.checked).toBeUndefined();
  });

  it('21. Todo 复选框支持键盘 Space 与 Enter 键无障碍切换勾选状态', () => {
    const initial: BlockNode[] = [
      { id: 't-key', type: 'todo', content: '键盘操作任务', properties: { level: 0, checked: false } },
    ];
    registerTestDoc('doc-todo-keys', initial);
    render(<BlockEditor documentId="doc-todo-keys" initialBlocks={initial} />);

    const checkbox = screen.getByRole('checkbox', { name: '标记为已完成' });

    // 按 Space 键切换为勾选
    act(() => {
      fireEvent.keyDown(checkbox, { key: ' ' });
    });
    expect(getDocBlocks('doc-todo-keys')[0]?.properties?.checked).toBe(true);

    // 按 Enter 键切换为未勾选
    const checkedBox = screen.getByRole('checkbox', { name: '标记为未完成' });
    act(() => {
      fireEvent.keyDown(checkedBox, { key: 'Enter' });
    });
    expect(getDocBlocks('doc-todo-keys')[0]?.properties?.checked).toBe(false);
  });

  it('22. 列表场景中文输入法 IME 合成期 (isComposing) 不拦截 Enter、Tab 或 Backspace', () => {
    const listBlocks: BlockNode[] = [
      { id: 'b-ime-1', type: 'bulletList', content: '第一项', properties: { level: 0 } },
      { id: 'b-ime-2', type: 'bulletList', content: '第二项', properties: { level: 0 } },
    ];
    registerTestDoc('doc-list-ime', listBlocks);
    render(<BlockEditor documentId="doc-list-ime" initialBlocks={listBlocks} />);

    const item2El = screen.getByText('第二项');
    setCaretPosition(item2El, 2);

    // 开启中文输入法合成
    act(() => {
      fireEvent.compositionStart(item2El);
    });

    // 合成期按下 Enter (如选拼音)
    act(() => {
      fireEvent.keyDown(item2El, { key: 'Enter' });
    });
    expect(getDocBlocks('doc-list-ime').length).toBe(2); // 禁止拆分

    // 合成期按下 Tab
    act(() => {
      fireEvent.keyDown(item2El, { key: 'Tab' });
    });
    expect(getDocBlocks('doc-list-ime')[1]?.properties?.level).toBe(0); // 禁止缩进

    // 合成期光标在 0 处按 Backspace
    setCaretPosition(item2El, 0);
    act(() => {
      fireEvent.keyDown(item2El, { key: 'Backspace' });
    });
    expect(getDocBlocks('doc-list-ime').length).toBe(2); // 禁止向上合并

    // 结束输入法合成
    act(() => {
      fireEvent.compositionEnd(item2El, { currentTarget: { innerText: '第二项输入完成' } });
    });
  });

  it('23. 列表组件在浅色/深色主题与窄屏响应式容器下的类名与样式渲染正确', () => {
    const blocks: BlockNode[] = [
      { id: 'b-resp', type: 'bulletList', content: '响应式项', properties: { level: 1 } },
      { id: 't-resp', type: 'todo', content: '待办暗色项', properties: { level: 0, checked: true } },
    ];
    registerTestDoc('doc-responsive', blocks);
    const { container } = render(<BlockEditor documentId="doc-responsive" initialBlocks={blocks} />);

    // 验证窄屏响应式边距：采用 sm 前缀响应式 padding/margin
    const wrapperEl = container.querySelector('[data-block-wrapper-id="b-resp"]');
    expect(wrapperEl?.className).toContain('-ml-8 pl-8 sm:-ml-12 sm:pl-12');

    // 验证待办完成项的暗色类名
    const todoTextContainer = container.querySelector('.line-through');
    expect(todoTextContainer?.className).toContain('dark:text-text-muted-dark');
  });

  it('24. [P1 真实链路集成] 挂载 DocumentPage：列表拆分、缩进、勾选、粘贴经 Store 同步后 Ctrl+Z / Ctrl+Y 完美可逆', () => {
    const pageId = 'doc-page-integration';
    registerTestDoc(pageId, [
      { id: 'b-it-1', type: 'bulletList', content: '主列表项A', properties: { level: 0 } },
      { id: 'b-it-2', type: 'bulletList', content: '主列表项B', properties: { level: 0 } },
      { id: 't-it-3', type: 'todo', content: '待办项C', properties: { level: 0, checked: false } },
    ]);
    useWorkspaceStore.setState({ activePageId: pageId });

    render(<DocumentPage />);

    // 验证初始渲染通过 DocumentPage 正常展示
    expect(screen.getByText('主列表项A')).toBeInTheDocument();
    expect(screen.getByText('主列表项B')).toBeInTheDocument();
    expect(screen.getByText('待办项C')).toBeInTheDocument();

    // 24a: 列表拆分并撤销重做
    const itemA = screen.getByText('主列表项A');
    setCaretPosition(itemA, 4); // "主列表项" | "A"
    act(() => {
      fireEvent.keyDown(itemA, { key: 'Enter' });
    });

    // Store 同步更新，并且 DocumentPage 会把新的 doc.blocks 回传给 BlockEditor
    expect(getDocBlocks(pageId).length).toBe(4);

    // 在当前活动的块上按下 Ctrl+Z
    const splitNewItem = screen.getByText('A');
    act(() => {
      fireEvent.keyDown(splitNewItem, { key: 'z', ctrlKey: true });
    });

    // 关键验证：经过父组件重渲染后，Ctrl+Z 依然生效，恢复为 3 个块！(P1 修复证明)
    expect(getDocBlocks(pageId).length).toBe(3);
    expect(screen.getByText('主列表项A')).toBeInTheDocument();

    // Ctrl+Y 重做
    const restoredItem = screen.getByText('主列表项A');
    act(() => {
      fireEvent.keyDown(restoredItem, { key: 'y', ctrlKey: true });
    });
    expect(getDocBlocks(pageId).length).toBe(4);

    // 撤销回初始状态以进行下一步测试
    act(() => {
      fireEvent.keyDown(screen.getByText('A'), { key: 'z', ctrlKey: true });
    });
    expect(getDocBlocks(pageId).length).toBe(3);

    // 24b: 列表 Tab 缩进并撤销
    const itemB = screen.getByText('主列表项B');
    act(() => {
      fireEvent.keyDown(itemB, { key: 'Tab' });
    });
    expect(getDocBlocks(pageId)[1]?.properties?.level).toBe(1);

    // 按 Ctrl+Z 撤销缩进
    act(() => {
      fireEvent.keyDown(itemB, { key: 'z', ctrlKey: true });
    });
    expect(getDocBlocks(pageId)[1]?.properties?.level).toBe(0);

    // 24c: Todo 勾选并撤销
    const todoCheckBtn = screen.getByRole('checkbox', { name: '标记为已完成' });
    act(() => {
      fireEvent.click(todoCheckBtn);
    });
    expect(getDocBlocks(pageId)[2]?.properties?.checked).toBe(true);

    const todoText = screen.getByText('待办项C');
    act(() => {
      fireEvent.keyDown(todoText, { key: 'z', ctrlKey: true });
    });
    expect(getDocBlocks(pageId)[2]?.properties?.checked).toBe(false);

    // 24d: 多行粘贴并撤销
    setCaretPosition(todoText, 4);
    const clipboardData = {
      getData: (type: string) => (type === 'text/plain' ? '多行1\n多行2' : ''),
    };
    act(() => {
      fireEvent.paste(todoText, { clipboardData });
    });
    expect(getDocBlocks(pageId).length).toBe(4);

    const pastedItem = screen.getByText('多行2');
    act(() => {
      fireEvent.keyDown(pastedItem, { key: 'z', ctrlKey: true });
    });
    expect(getDocBlocks(pageId).length).toBe(3);
    expect(getDocBlocks(pageId)[2]?.content).toBe('待办项C');
  });

  it('25. [P1 页面切换隔离] 切换 activePageId 时干净重置新文档历史并清理定时器', () => {
    registerTestDoc('page-a', [{ id: 'pa-1', type: 'paragraph', content: '页面A文本' }]);
    registerTestDoc('page-b', [{ id: 'pb-1', type: 'paragraph', content: '页面B文本' }]);

    useWorkspaceStore.setState({ activePageId: 'page-a' });
    const { rerender } = render(<DocumentPage />);

    expect(screen.getByText('页面A文本')).toBeInTheDocument();

    // 在页面 A 输入并产生历史
    const paEl = screen.getByText('页面A文本');
    setCaretPosition(paEl, 5);
    act(() => {
      fireEvent.keyDown(paEl, { key: 'Enter' });
    });
    expect(getDocBlocks('page-a').length).toBe(2);

    // 切换到页面 B
    act(() => {
      useWorkspaceStore.setState({ activePageId: 'page-b' });
    });
    rerender(<DocumentPage />);

    expect(screen.getByText('页面B文本')).toBeInTheDocument();
    expect(screen.queryByText('页面A文本')).not.toBeInTheDocument();

    // 页面 B 的历史索引应为 0，按 Ctrl+Z 不能回退到页面 A 的操作
    const pbEl = screen.getByText('页面B文本');
    act(() => {
      fireEvent.keyDown(pbEl, { key: 'z', ctrlKey: true });
    });
    expect(getDocBlocks('page-b').length).toBe(1);
    expect(getDocBlocks('page-b')[0]?.content).toBe('页面B文本');
  });

  it('26. [Day 4] 代码块 (CodeBlock) 渲染、语言切换、折行切换与一键复制', async () => {
    const docId = 'doc-code-1';
    const initial: BlockNode[] = [
      {
        id: 'code-1',
        type: 'code',
        content: 'const answer = 42;',
        properties: { language: 'javascript', wrap: false },
      },
    ];
    registerTestDoc(docId, initial);
    render(<BlockEditor documentId={docId} initialBlocks={initial} />);

    const textarea = screen.getByLabelText('代码编辑区') as HTMLTextAreaElement;
    expect(textarea.value).toBe('const answer = 42;');

    // 语言下拉切换为 python
    const langSelect = screen.getByRole('combobox', { name: '代码编程语言' }) as HTMLSelectElement;
    expect(langSelect.value).toBe('javascript');

    act(() => {
      fireEvent.change(langSelect, { target: { value: 'python' } });
    });
    expect(getDocBlocks(docId)[0]?.properties?.language).toBe('python');

    // 折行切换
    const wrapBtn = screen.getByRole('button', { name: /折行|滚动/ });
    act(() => {
      fireEvent.click(wrapBtn);
    });
    expect(getDocBlocks(docId)[0]?.properties?.wrap).toBe(true);

    // 复制代码测试
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
    const copyBtn = screen.getByRole('button', { name: '复制代码' });
    await act(async () => {
      fireEvent.click(copyBtn);
    });
    expect(screen.getByText('已复制')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
  });

  it('27. [Day 4] 代码块 (CodeBlock) 键盘交互：Tab 缩进 2 空格、Shift+Tab 缩退、Ctrl+Enter 退出、空 Backspace 降级', () => {
    const docId = 'doc-code-kb';
    const initial: BlockNode[] = [
      {
        id: 'code-kb',
        type: 'code',
        content: 'line1\n  line2',
        properties: { language: 'typescript', wrap: false },
      },
    ];
    registerTestDoc(docId, initial);
    render(<BlockEditor documentId={docId} initialBlocks={initial} />);

    const textarea = screen.getByLabelText('代码编辑区') as HTMLTextAreaElement;

    // 27a: Tab 缩进 2 空格
    textarea.selectionStart = 5; // "line1|"
    textarea.selectionEnd = 5;
    act(() => {
      fireEvent.keyDown(textarea, { key: 'Tab', shiftKey: false });
    });
    expect(getDocBlocks(docId)[0]?.content).toBe('line1  \n  line2');

    // 27b: Shift+Tab 缩退 2 空格
    const curContent = getDocBlocks(docId)[0]?.content || '';
    textarea.selectionStart = curContent.indexOf('line2');
    textarea.selectionEnd = textarea.selectionStart;
    act(() => {
      fireEvent.keyDown(textarea, { key: 'Tab', shiftKey: true });
    });
    expect(getDocBlocks(docId)[0]?.content).toBe('line1  \nline2');

    // 27c: Ctrl+Enter 退出到下方新段落
    act(() => {
      fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });
    });
    const blocksAfterCtrlEnter = getDocBlocks(docId);
    expect(blocksAfterCtrlEnter.length).toBe(2);
    expect(blocksAfterCtrlEnter[1]?.type).toBe('paragraph');
    expect(blocksAfterCtrlEnter[1]?.content).toBe('');

    // 27d: 空代码块按 Backspace 降级为普通段落
    const emptyDocId = 'doc-code-empty';
    registerTestDoc(emptyDocId, [
      { id: 'c-empty', type: 'code', content: '', properties: { language: 'go', wrap: false } },
    ]);
    render(<BlockEditor documentId={emptyDocId} initialBlocks={[{ id: 'c-empty', type: 'code', content: '', properties: { language: 'go', wrap: false } }]} />);
    const emptyTextareas = screen.getAllByLabelText('代码编辑区');
    const targetEmptyTextarea = emptyTextareas[emptyTextareas.length - 1];
    act(() => {
      fireEvent.keyDown(targetEmptyTextarea, { key: 'Backspace' });
    });
    const degradedBlocks = getDocBlocks(emptyDocId);
    expect(degradedBlocks[0]?.type).toBe('paragraph');
    expect(degradedBlocks[0]?.properties).toBeUndefined();
  });

  it('28. [Day 4] 安全语法高亮渲染：完全杜绝 dangerouslySetInnerHTML，防 XSS 注入', () => {
    const docId = 'doc-code-xss';
    const initial: BlockNode[] = [
      {
        id: 'code-xss',
        type: 'code',
        content: '<script>alert("xss")</script><img onerror=alert(1) />',
        properties: { language: 'html', wrap: false },
      },
    ];
    registerTestDoc(docId, initial);
    render(<BlockEditor documentId={docId} initialBlocks={initial} />);

    // 检查是否有任何被注入的 script 或 img 危险标签
    expect(document.querySelector('script[src*="xss"]')).toBeNull();
    expect(document.querySelector('img[onerror]')).toBeNull();
    // 文本内容纯文本高亮
    expect(screen.getByText(/alert\("xss"\)/)).toBeInTheDocument();
  });

  it('29. [Day 4] 引用块 (QuoteBlock) 渲染、拆分与回车/退格退出降级', () => {
    const docId = 'doc-quote';
    const initial: BlockNode[] = [
      { id: 'q-1', type: 'quote', content: '登高壮观天地间大江茫茫去不还' },
    ];
    registerTestDoc(docId, initial);
    render(<BlockEditor documentId={docId} initialBlocks={initial} />);

    const quoteWrapper = document.querySelector('[data-block-quote-id="q-1"]');
    expect(quoteWrapper).toBeInTheDocument();
    expect(quoteWrapper?.className).toContain('border-l-4');

    // 29a: 在文字中间回车拆分为两个引用块
    const quoteTextEl = screen.getByText('登高壮观天地间大江茫茫去不还');
    setCaretPosition(quoteTextEl, 7); // 登高壮观天地间 | 大江茫茫去不还
    act(() => {
      fireEvent.keyDown(quoteTextEl, { key: 'Enter' });
    });

    const splitBlocks = getDocBlocks(docId);
    expect(splitBlocks.length).toBe(2);
    expect(splitBlocks[0]?.type).toBe('quote');
    expect(splitBlocks[0]?.content).toBe('登高壮观天地间');
    expect(splitBlocks[1]?.type).toBe('quote');
    expect(splitBlocks[1]?.content).toBe('大江茫茫去不还');

    // 29b: 空引用块按回车退出降级为普通段落
    const emptyQuoteDoc = 'doc-quote-empty';
    registerTestDoc(emptyQuoteDoc, [{ id: 'q-empty', type: 'quote', content: '' }]);
    render(<BlockEditor documentId={emptyQuoteDoc} initialBlocks={[{ id: 'q-empty', type: 'quote', content: '' }]} />);

    const emptyQuoteEl = document.querySelector('[data-block-quote-id="q-empty"] [contenteditable="true"]') as HTMLElement;
    act(() => {
      fireEvent.keyDown(emptyQuoteEl, { key: 'Enter' });
    });
    expect(getDocBlocks(emptyQuoteDoc)[0]?.type).toBe('paragraph');

    // 29c: 空引用块按退格降级为普通段落
    const emptyQuoteDoc2 = 'doc-quote-empty-bs';
    registerTestDoc(emptyQuoteDoc2, [{ id: 'q-empty-2', type: 'quote', content: '' }]);
    render(<BlockEditor documentId={emptyQuoteDoc2} initialBlocks={[{ id: 'q-empty-2', type: 'quote', content: '' }]} />);

    const emptyQuoteEl2 = document.querySelector('[data-block-quote-id="q-empty-2"] [contenteditable="true"]') as HTMLElement;
    act(() => {
      fireEvent.keyDown(emptyQuoteEl2, { key: 'Backspace' });
    });
    expect(getDocBlocks(emptyQuoteDoc2)[0]?.type).toBe('paragraph');
  });

  it('30. [Day 4] 提示块 (CalloutBlock) 图标选择、5 色基调切换、拆分与空块退出', () => {
    const docId = 'doc-callout';
    const initial: BlockNode[] = [
      {
        id: 'cal-1',
        type: 'callout',
        content: '注意系统部署环境',
        properties: { icon: '💡', tone: 'neutral' },
      },
    ];
    registerTestDoc(docId, initial);
    render(<BlockEditor documentId={docId} initialBlocks={initial} />);

    const calloutWrapper = document.querySelector('[data-block-callout-id="cal-1"]');
    expect(calloutWrapper).toBeInTheDocument();
    expect(calloutWrapper?.getAttribute('data-callout-tone')).toBe('neutral');

    // 30a: 打开色调选择器切换为 warning
    const toneBtn = screen.getByRole('button', { name: '切换提示色调' });
    act(() => {
      fireEvent.click(toneBtn);
    });
    const warningToneBtn = screen.getByRole('button', { name: /警告黄/ });
    act(() => {
      fireEvent.click(warningToneBtn);
    });
    expect(getDocBlocks(docId)[0]?.properties?.tone).toBe('warning');

    // 30b: 打开预设图标选择器切换为 🔥
    const iconBtn = screen.getByRole('button', { name: /更换图标/ });
    act(() => {
      fireEvent.click(iconBtn);
    });
    const fireEmojiBtn = screen.getByRole('button', { name: '🔥' });
    act(() => {
      fireEvent.click(fireEmojiBtn);
    });
    expect(getDocBlocks(docId)[0]?.properties?.icon).toBe('🔥');

    // 30c: 非空提示块回车拆分（继承相同的图标与色调）
    const calloutTextEl = screen.getByText('注意系统部署环境');
    setCaretPosition(calloutTextEl, 4); // 注意系统 | 部署环境
    act(() => {
      fireEvent.keyDown(calloutTextEl, { key: 'Enter' });
    });
    const splitCallouts = getDocBlocks(docId);
    expect(splitCallouts.length).toBe(2);
    expect(splitCallouts[0]?.content).toBe('注意系统');
    expect(splitCallouts[1]?.type).toBe('callout');
    expect(splitCallouts[1]?.content).toBe('部署环境');
    expect(splitCallouts[1]?.properties?.icon).toBe('🔥');
    expect(splitCallouts[1]?.properties?.tone).toBe('warning');

    // 30d: 空提示块回车退出降级为普通段落
    const emptyCalDoc = 'doc-cal-empty';
    registerTestDoc(emptyCalDoc, [{ id: 'cal-empty', type: 'callout', content: '', properties: { icon: '💡', tone: 'info' } }]);
    render(<BlockEditor documentId={emptyCalDoc} initialBlocks={[{ id: 'cal-empty', type: 'callout', content: '', properties: { icon: '💡', tone: 'info' } }]} />);
    const emptyCalTextEl = document.querySelector('[data-block-callout-id="cal-empty"] [contenteditable="true"]') as HTMLElement;
    act(() => {
      fireEvent.keyDown(emptyCalTextEl, { key: 'Enter' });
    });
    expect(getDocBlocks(emptyCalDoc)[0]?.type).toBe('paragraph');
  });

  it('31. [Day 4] 容器隔离：在 Code / Callout 下方块按 Backspace 严格禁止文本合入容器', () => {
    const docId = 'doc-container-iso';
    const initial: BlockNode[] = [
      { id: 'c-code', type: 'code', content: 'const a = 1;', properties: { language: 'javascript', wrap: false } },
      { id: 'p-below', type: 'paragraph', content: '段落文本' },
    ];
    registerTestDoc(docId, initial);
    render(<BlockEditor documentId={docId} initialBlocks={initial} />);

    const pEl = screen.getByText('段落文本');
    setCaretPosition(pEl, 0);

    // 在段落块首按 Backspace
    act(() => {
      fireEvent.keyDown(pEl, { key: 'Backspace' });
    });

    // 容器隔离保障：代码块内容绝不被串入“段落文本”，两块独立存在
    const blocksAfter = getDocBlocks(docId);
    expect(blocksAfter.length).toBe(2);
    expect(blocksAfter[0]?.type).toBe('code');
    expect(blocksAfter[0]?.content).toBe('const a = 1;');
    expect(blocksAfter[1]?.type).toBe('paragraph');
    expect(blocksAfter[1]?.content).toBe('段落文本');
  });

  it('32. [Day 4] DocumentPage 级 Code / Quote / Callout 类型切换与撤销重做 (Undo/Redo)', () => {
    const pageId = 'doc-undo-day4';
    const initial: BlockNode[] = [
      { id: 'blk-switch', type: 'paragraph', content: '待转换核心内容' },
    ];
    registerTestDoc(pageId, initial);
    useWorkspaceStore.setState({ activePageId: pageId });
    render(<DocumentPage />);

    // 切换类型为 code
    const typeTrigger = screen.getByRole('button', { name: '切换块类型或操作' });
    act(() => {
      fireEvent.click(typeTrigger);
    });
    const codeOpt = screen.getByRole('button', { name: /代码块/ });
    act(() => {
      fireEvent.click(codeOpt);
    });

    expect(getDocBlocks(pageId)[0]?.type).toBe('code');
    expect(getDocBlocks(pageId)[0]?.properties?.language).toBe('javascript');

    // 按 Ctrl+Z 撤销类型切换
    const textarea = screen.getByLabelText('代码编辑区');
    act(() => {
      fireEvent.keyDown(textarea, { key: 'z', ctrlKey: true });
    });
    expect(getDocBlocks(pageId)[0]?.type).toBe('paragraph');
    expect(getDocBlocks(pageId)[0]?.properties).toBeUndefined();

    // 按 Ctrl+Y 重做恢复为 code
    const pEl = screen.getByText('待转换核心内容');
    act(() => {
      fireEvent.keyDown(pEl, { key: 'y', ctrlKey: true });
    });
    expect(getDocBlocks(pageId)[0]?.type).toBe('code');
  });
});
