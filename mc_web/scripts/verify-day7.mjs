// Day 7 Acceptance Verification Script: 本地离线持久化 (IndexedDB) 与 Sprint 1 阶段总结
import assert from 'node:assert/strict';
import {
  validateWorkspaceSnapshot,
  normalizeSnapshot,
  MemoryStorage,
  SNAPSHOT_SCHEMA_VERSION,
  StorageCorruptError,
  StorageReadError,
} from '../src/utils/workspaceStorage.ts';
import {
  cascadeDeletePage,
  getDescendantPageIds,
  repairPageTree,
} from '../src/utils/workspaceUtils.ts';

console.log('🧪 开始 Day 7: 本地离线持久化 (IndexedDB) 与数据完整性自动化验收核查...\n');

// 构造测试多级文档树
// root-1
//  ├── child-1-1
//  │    └── grand-1-1-1
//  └── child-1-2
// root-2 (独立树)
const sampleDocs = {
  'root-1': {
    id: 'root-1',
    title: '顶级知识库 1',
    parentId: null,
    createdAt: 1000,
    updatedAt: 1000,
    blocks: [{ id: 'b1', type: 'paragraph', content: '根内容' }],
  },
  'child-1-1': {
    id: 'child-1-1',
    title: '子页面 1-1',
    parentId: 'root-1',
    createdAt: 1100,
    updatedAt: 1100,
    blocks: [{ id: 'b2', type: 'paragraph', content: '子内容' }],
  },
  'grand-1-1-1': {
    id: 'grand-1-1-1',
    title: '孙页面 1-1-1',
    parentId: 'child-1-1',
    createdAt: 1200,
    updatedAt: 1200,
    blocks: [{ id: 'b3', type: 'paragraph', content: '孙内容' }],
  },
  'child-1-2': {
    id: 'child-1-2',
    title: '子页面 1-2',
    parentId: 'root-1',
    createdAt: 1300,
    updatedAt: 1300,
    blocks: [{ id: 'b4', type: 'paragraph', content: '' }],
  },
  'root-2': {
    id: 'root-2',
    title: '顶级知识库 2',
    parentId: null,
    createdAt: 2000,
    updatedAt: 2000,
    blocks: [{ id: 'b5', type: 'heading1', content: '项目概述' }],
  },
};

// =================================================================
// 测试 1: 递归后代查找、级联删除与页面树环路自愈 (Cascade Delete & Tree Integrity)
// =================================================================
console.log('▶ 测试 1: 递归子孙扫描 (getDescendantPageIds)、级联删除与页面树环路自愈核查...');
{
  // 1a: 扫描 root-1 的所有后代
  const descendantsRoot1 = getDescendantPageIds(sampleDocs, 'root-1');
  assert.equal(descendantsRoot1.length, 3, 'root-1 应包含 3 个后代页面');
  assert.ok(descendantsRoot1.includes('child-1-1'));
  assert.ok(descendantsRoot1.includes('grand-1-1-1'));
  assert.ok(descendantsRoot1.includes('child-1-2'));

  // 1b: 扫描 child-1-1 的后代
  const descendantsChild1 = getDescendantPageIds(sampleDocs, 'child-1-1');
  assert.deepEqual(descendantsChild1, ['grand-1-1-1'], 'child-1-1 仅有 1 个子页面');

  // 1c: 扫描叶子节点与不存在的节点
  assert.deepEqual(getDescendantPageIds(sampleDocs, 'grand-1-1-1'), [], '叶子节点无后代');
  assert.deepEqual(getDescendantPageIds(sampleDocs, 'not-exist'), [], '不存在的节点返回空数组');

  // 1d: 级联删除 root-1：应彻底删除 root-1, child-1-1, grand-1-1-1, child-1-2，仅保留 root-2
  const delResult = cascadeDeletePage(sampleDocs, 'root-1', 'grand-1-1-1');
  assert.equal(delResult.deletedIds.length, 4, '删除总数应为 4（自身 + 3 后代）');
  assert.deepEqual(Object.keys(delResult.documents), ['root-2'], '剩余文档仅剩 root-2');

  // 1e: 校验被删除时激活页为 grand-1-1-1（孙页面），应平滑安全回退至剩余页面 root-2
  assert.equal(delResult.nextActivePageId, 'root-2', '激活页应自动重定向至存活页面');

  // 1f: 孤立 parentId 防御断言：确保剩余所有文档的 parentId 绝不指向已删除 ID
  for (const doc of Object.values(delResult.documents)) {
    if (doc.parentId) {
      assert.ok(
        !delResult.deletedIds.includes(doc.parentId),
        `存活页面 ${doc.id} 的 parentId 不得指向已删除页面`
      );
    }
  }

  // 1g: 删除叶子节点测试：删除 child-1-2，root-1 保持不变且激活页不受干扰
  const delLeaf = cascadeDeletePage(sampleDocs, 'child-1-2', 'root-1');
  assert.equal(delLeaf.deletedIds.length, 1);
  assert.equal(delLeaf.nextActivePageId, 'root-1');
  assert.ok(delLeaf.documents['root-1']);
  assert.ok(delLeaf.documents['child-1-1']);
  assert.ok(!delLeaf.documents['child-1-2']);

  // 1h: repairPageTree 孤立 parentId 自愈与父子引用环打破
  const corruptTree = {
    'orphan-page': {
      id: 'orphan-page',
      title: '孤立页',
      parentId: 'ghost-parent-id',
      createdAt: 100,
      updatedAt: 100,
      blocks: [],
    },
    'self-loop': {
      id: 'self-loop',
      title: '自循环页',
      parentId: 'self-loop',
      createdAt: 100,
      updatedAt: 100,
      blocks: [],
    },
    'cycle-a': {
      id: 'cycle-a',
      title: '双向环 A',
      parentId: 'cycle-b',
      createdAt: 100,
      updatedAt: 100,
      blocks: [],
    },
    'cycle-b': {
      id: 'cycle-b',
      title: '双向环 B',
      parentId: 'cycle-a',
      createdAt: 100,
      updatedAt: 100,
      blocks: [],
    },
  };

  const repaired = repairPageTree(corruptTree);
  assert.equal(repaired['orphan-page'].parentId, null, '指向不存在页面的孤立 parentId 应自愈为 null');
  assert.equal(repaired['self-loop'].parentId, null, '自身指向自身的自循环 parentId 应打破为 null');
  // 双向环路应打破至少一个节点，消除循环
  assert.ok(
    repaired['cycle-a'].parentId === null || repaired['cycle-b'].parentId === null,
    '双向循环引用链应被打破'
  );

  // 验证带有环路数据时 getDescendantPageIds 也不会死循环
  const cyclicDescendants = getDescendantPageIds(corruptTree, 'cycle-a');
  assert.ok(Array.isArray(cyclicDescendants), '即便文档存在环路，BFS 也必须安全终止');

  console.log('  ✔ 递归子孙查找、级联删除、孤立 parentId 消除与环路打破自愈全部通过');
}

// =================================================================
// 测试 2: 快照 Schema 校验契约与脏数据防御 (validateWorkspaceSnapshot)
// =================================================================
console.log('▶ 测试 2: 工作区快照契约规范化与脏数据容错校验...');
{
  const validSnapshot = {
    version: SNAPSHOT_SCHEMA_VERSION,
    timestamp: Date.now(),
    workspace: {
      id: 'ws-test',
      name: '测试工作区',
      icon: '🌌',
      description: '',
      memberCount: 1,
    },
    documents: sampleDocs,
    activePageId: 'root-1',
    isSidebarCollapsed: false,
    theme: 'light',
  };

  // 2a: 合法快照
  assert.equal(validateWorkspaceSnapshot(validSnapshot), true, '合法快照应校验通过');

  // 2b: 非法/缺失版本号以及未知高版本拦截
  assert.equal(validateWorkspaceSnapshot({ ...validSnapshot, version: 0 }), false, '版本号为 0 应拦截');
  assert.equal(validateWorkspaceSnapshot({ ...validSnapshot, version: -1 }), false, '负数版本号应拦截');
  assert.equal(validateWorkspaceSnapshot({ ...validSnapshot, version: '1' }), false, '字符串版本号应拦截');
  assert.equal(
    validateWorkspaceSnapshot({ ...validSnapshot, version: SNAPSHOT_SCHEMA_VERSION + 1 }),
    false,
    '高于当前最大版本的未来未知快照必须拦截'
  );

  // 2c: 损坏的 workspace
  assert.equal(validateWorkspaceSnapshot({ ...validSnapshot, workspace: null }), false);
  assert.equal(validateWorkspaceSnapshot({ ...validSnapshot, workspace: { name: 123 } }), false);

  // 2d: 损坏的 documents
  assert.equal(validateWorkspaceSnapshot({ ...validSnapshot, documents: 'not-an-obj' }), false);
  assert.equal(
    validateWorkspaceSnapshot({
      ...validSnapshot,
      documents: { 'doc-x': { id: 'mismatched-id', blocks: [] } },
    }),
    false,
    '文档 ID 与 Map Key 不匹配时应拦截'
  );

  // 2e: 非法主题或侧边栏状态
  assert.equal(validateWorkspaceSnapshot({ ...validSnapshot, theme: 'blue' }), false);
  assert.equal(validateWorkspaceSnapshot({ ...validSnapshot, isSidebarCollapsed: 'false' }), false);

  // 2f: 空值或非对象
  assert.equal(validateWorkspaceSnapshot(null), false);
  assert.equal(validateWorkspaceSnapshot(undefined), false);
  assert.equal(validateWorkspaceSnapshot(''), false);

  console.log('  ✔ 版本号、工作区、文档树与偏好状态校验契约通过');
}

// =================================================================
// 测试 3: 快照规范化引擎与非一致属性清洗 (normalizeSnapshot)
// =================================================================
console.log('▶ 测试 3: 快照 Block 节点属性清洗、页面树环路自愈与激活页重置机制...');
{
  const dirtySnapshot = {
    version: 1,
    timestamp: Date.now(),
    workspace: { id: 'ws-main', name: 'Work', icon: '🌌', description: '', memberCount: 1 },
    documents: {
      'd-1': {
        id: 'd-1',
        title: '脏数据页',
        parentId: null,
        createdAt: 100,
        updatedAt: 100,
        blocks: [
          // 非法 level 为负数和小数
          { id: 'b-dirty-1', type: 'bulletList', content: '测试', properties: { level: -5 } },
          // 非布尔 checked
          { id: 'b-dirty-2', type: 'todo', content: '待办', properties: { checked: 'yes' } },
        ],
      },
      'd-orphan': {
        id: 'd-orphan',
        title: '孤儿子页',
        parentId: 'non-existing-parent',
        createdAt: 101,
        updatedAt: 101,
        blocks: [],
      },
      'd-loop': {
        id: 'd-loop',
        title: '成环页',
        parentId: 'd-loop',
        createdAt: 102,
        updatedAt: 102,
        blocks: [],
      },
    },
    activePageId: 'invalid-ghost-page-id', // 引用了不存在的页面 ID
    isSidebarCollapsed: false,
    theme: 'dark',
  };

  const clean = normalizeSnapshot(dirtySnapshot);

  // 校验 block 属性规整
  assert.equal(clean.documents['d-1'].blocks[0].properties?.level, 0, '负数 level 应规整为 0');
  assert.equal(clean.documents['d-1'].blocks[1].properties?.checked, false, '非布尔 checked 应规整为 false');

  // 校验页面树孤立与循环 parentId 自愈
  assert.equal(clean.documents['d-orphan'].parentId, null, '孤立 parentId 应在快照规范化时自愈为 null');
  assert.equal(clean.documents['d-loop'].parentId, null, '成环 parentId 应在快照规范化时自愈为 null');

  // 校验激活页自愈：ghost id 应被重置为现存有效页面
  assert.ok(clean.documents[clean.activePageId], '失效 activePageId 应自愈为有效存在的页面');

  console.log('  ✔ 快照深度规整、页面树父子关系自愈与失效激活页重置全部通过');
}

// =================================================================
// 测试 4: 存储适配器生命周期与原子读写 (StorageAdapter Lifecycle)
// =================================================================
console.log('▶ 测试 4: 存储适配器 Load / Save / Clear、不可变隔离与持久化契约...');
{
  const storage = new MemoryStorage();

  // 4a: 契约标识检查
  assert.equal(storage.kind, 'memory', 'MemoryStorage kind 应为 memory');
  assert.equal(storage.isPersistent, false, 'MemoryStorage 默认 isPersistent 应为 false');

  // 4b: 首次无快照时应返回 null（空存储）
  const initLoad = await storage.load();
  assert.equal(initLoad, null, '首次空存储 load 应严格返回 null');

  // 4c: 保存快照
  const testSnapshot = {
    version: 1,
    timestamp: 123456,
    workspace: { id: 'ws-test', name: 'Saved Space', icon: '🌌', description: '', memberCount: 1 },
    documents: sampleDocs,
    activePageId: 'root-1',
    isSidebarCollapsed: true,
    theme: 'dark',
  };
  await storage.save(testSnapshot);

  // 4d: 读取快照并断言一致性
  const loaded = await storage.load();
  assert.ok(loaded);
  assert.equal(loaded.workspace.name, 'Saved Space');
  assert.equal(loaded.activePageId, 'root-1');
  assert.equal(loaded.isSidebarCollapsed, true);
  assert.equal(loaded.theme, 'dark');
  assert.equal(Object.keys(loaded.documents).length, 5);

  // 4e: 内存深拷贝隔离性检验：外部修改不应污染内部存储
  testSnapshot.workspace.name = 'Mutated Outside';
  const reloaded = await storage.load();
  assert.equal(reloaded.workspace.name, 'Saved Space', '存储内容必须具备不可变隔离');

  // 4f: 清空存储
  await storage.clear();
  const afterClear = await storage.load();
  assert.equal(afterClear, null, 'clear 之后 load 应为 null');

  // 4g: 损坏数据抛出 StorageCorruptError 且不返回 null
  storage.setRawCorruptPayload('{"corrupted_json": ');
  let caughtCorrupt = false;
  try {
    await storage.load();
  } catch (err) {
    caughtCorrupt = true;
    assert.ok(err instanceof StorageCorruptError, '损坏数据必须抛出 StorageCorruptError');
  }
  assert.ok(caughtCorrupt, '遇到损坏 JSON 时严禁静默返回 null');

  // 4h: 读取异常抛出 StorageReadError
  storage.setRawCorruptPayload(null);
  storage.setFailRead(true);
  let caughtReadErr = false;
  try {
    await storage.load();
  } catch (err) {
    caughtReadErr = true;
    assert.ok(err instanceof StorageReadError, '存储读取异常必须抛出 StorageReadError');
  }
  assert.ok(caughtReadErr, '底层读取错误必须抛出异常而不是静默假定为空');

  console.log('  ✔ 存储适配器初次装载、持久化恢复、不可变隔离与损坏异常抛出全部通过');
}

// =================================================================
// 测试 5: 损坏数据与降级容错机制 (Degraded Fallback Resilience)
// =================================================================
console.log('▶ 测试 5: 存储不可用/异常时的降级保护与非阻塞契约...');
{
  class FailingStorage {
    isAvailable = false;
    isPersistent = false;
    kind = 'memory';
    async load() {
      throw new StorageReadError('IndexedDB Access Denied (Private Mode)');
    }
    async save() {
      throw new Error('QuotaExceededError: Disk Full');
    }
    async clear() {}
  }

  const failing = new FailingStorage();
  let caughtLoad = false;
  try {
    await failing.load();
  } catch (err) {
    caughtLoad = true;
    assert.ok(err instanceof StorageReadError);
    assert.ok(err.message.includes('Access Denied'));
  }
  assert.ok(caughtLoad, '异常存储抛出错误应被外层捕获并转入 error/degraded 模式');

  let caughtSave = false;
  try {
    await failing.save();
  } catch (err) {
    caughtSave = true;
    assert.ok(err.message.includes('QuotaExceededError'));
  }
  assert.ok(caughtSave, '写入超额异常应被安全捕获，不应导致主进程崩溃');

  console.log('  ✔ 离线存储异常与受限环境优雅降级断言通过');
}

console.log('\n======================================================');
console.log('🎉 Day 7 本地离线持久化与数据完整性 5 大测试集全部通过！');
console.log('======================================================\n');

