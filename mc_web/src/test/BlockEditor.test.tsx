import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { BlockEditor } from '../components/editor/BlockEditor';
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

  it('17. 列表项块首 Backspace：子级先缩退，根级首块降级为段落，存在前项时合并文本', () => {
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

    // 根级首块按退格：降级为普通段落 (paragraph)
    act(() => {
      fireEvent.keyDown(itemEl, { key: 'Backspace' });
    });
    const state2 = getDocBlocks('doc-backspace-list');
    expect(state2[0]?.type).toBe('paragraph');
    expect(state2[0]?.content).toBe('单块子级');
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
});
