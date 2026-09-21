import { create } from 'zustand';
import { DocumentItem, BreadcrumbItem, BlockNode } from '../types/document';
import { WorkspaceMeta } from '../types/workspace';
import type {
  DatabaseSchema,
  DatabaseProperty,
  DatabaseRow,
  CellValue,
  DatabaseMetaUpdates,
  PropertyType,
  SelectOption,
} from '../types/database';
import { normalizeBlock } from '../utils/blockUtils';
import { cascadeDeletePage } from '../utils/workspaceUtils';
import {
  createDatabase,
  validateDatabaseSchema,
  normalizeDatabaseSchema,
  addProperty,
  updateProperty,
  deleteProperty,
  reorderProperties,
  changePropertyType,
  addSelectOption,
  updateSelectOption,
  deleteSelectOption,
  addRow,
  updateRow,
  updateCell,
  deleteRow,
  reorderRows,
} from '../utils/databaseUtils';
import {
  createWorkspaceStorage,
  StorageAdapter,
  WorkspaceSnapshot,
  SNAPSHOT_SCHEMA_VERSION,
} from '../utils/workspaceStorage';

export type StorageStatus =
  | 'idle'
  | 'loading'
  | 'saved'
  | 'saving'
  | 'error'
  | 'degraded';

interface WorkspaceState {
  // 工作区信息
  workspace: WorkspaceMeta;
  setWorkspaceName: (name: string) => void;

  // 页面文档列表
  documents: Record<string, DocumentItem>;
  activePageId: string;
  setActivePage: (id: string) => void;
  
  // 页面 CRUD
  createPage: (parentId?: string | null, title?: string, icon?: string) => string;
  updatePage: (id: string, updates: Partial<DocumentItem>) => void;
  updateDocumentBlocks: (id: string, blocks: BlockNode[]) => void;
  deletePage: (id: string) => void;
  toggleFavorite: (id: string) => void;
  getBreadcrumbs: (id: string) => BreadcrumbItem[];

  // 搜索与过滤
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;

  // 侧边栏与主题
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;

  // Day 8: 多维数据库数据层
  databases: Record<string, DatabaseSchema>;
  createDatabase: (title?: string, initialProperties?: DatabaseProperty[]) => string;
  updateDatabase: (id: string, updates: DatabaseMetaUpdates) => void;
  deleteDatabase: (id: string) => void;
  addDatabaseProperty: (databaseId: string, property: Omit<DatabaseProperty, 'id'> & { id?: string }) => void;
  updateDatabaseProperty: (databaseId: string, propertyId: string, updates: Partial<DatabaseProperty>) => void;
  changeDatabasePropertyType: (databaseId: string, propertyId: string, newType: PropertyType) => void;
  addDatabaseSelectOption: (databaseId: string, propertyId: string, option: Omit<SelectOption, 'id'> & { id?: string }) => void;
  updateDatabaseSelectOption: (databaseId: string, propertyId: string, optionId: string, updates: Partial<SelectOption>) => void;
  deleteDatabaseSelectOption: (databaseId: string, propertyId: string, optionId: string) => void;
  deleteDatabaseProperty: (databaseId: string, propertyId: string) => void;
  reorderDatabaseProperties: (databaseId: string, newOrder: string[]) => void;
  addDatabaseRow: (databaseId: string, initialCells?: Record<string, CellValue>, atIndex?: number) => void;
  updateDatabaseRow: (databaseId: string, rowId: string, updates: Partial<DatabaseRow>) => void;
  updateDatabaseCell: (databaseId: string, rowId: string, propertyId: string, value: CellValue) => void;
  deleteDatabaseRow: (databaseId: string, rowId: string) => void;
  reorderDatabaseRows: (databaseId: string, newOrder: string[]) => void;
  getDatabase: (id: string) => DatabaseSchema | undefined;

  // Day 7: 本地离线持久化与 Hydration
  isHydrated: boolean;
  storageStatus: StorageStatus;
  storageError: string | null;
  hydrateStore: () => Promise<void>;
  saveToStorage: (immediate?: boolean) => Promise<void>;
  resetStorageToDefault: () => Promise<void>;
  setStorageAdapter: (adapter: StorageAdapter) => void;
}

const INITIAL_PAGES: Record<string, DocumentItem> = {
  'welcome-page': {
    id: 'welcome-page',
    title: '欢迎使用 mc (Modular Collaboration)',
    icon: '🌌',
    coverImage: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1600&auto=format&fit=crop',
    parentId: null,
    isFavorite: true,
    createdAt: Date.now() - 86400000 * 2,
    updatedAt: Date.now() - 3600000,
    blocks: [
      {
        id: 'b-1',
        type: 'heading1',
        content: '🌌 探索下一代自主可控协同知识库',
      },
      {
        id: 'b-2',
        type: 'paragraph',
        content: 'mc 是一个针对个人与团队深度优化的现代知识库。支持树状 Block 块级富文本、原生 CRDT 毫秒级多端协同以及类 Notion 的多维关系型数据库。',
      },
      {
        id: 'b-3',
        type: 'callout',
        content: '💡 提示：点击左侧导航可随时展开子页面，也可以点击右上方按钮切换明暗主题或快速创建新页面！',
        properties: { icon: '💡' }
      },
      {
        id: 'b-4',
        type: 'todo',
        content: '完成 Web 端工作区与侧边栏骨架搭建',
        properties: { checked: true }
      },
      {
        id: 'b-5',
        type: 'todo',
        content: '实现 Block 块级富文本编辑器与 Slash 指令',
        properties: { checked: false }
      },
      {
        id: 'b-6',
        type: 'todo',
        content: '接入 Table / Board 多维数据库视图',
        properties: { checked: false }
      }
    ]
  },
  'quick-start': {
    id: 'quick-start',
    title: '快速上手指南 & 快捷键',
    icon: '⚡',
    parentId: 'welcome-page',
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 7200000,
    blocks: [
      {
        id: 'qs-1',
        type: 'heading2',
        content: '⌨️ 常用快捷键与操作技巧',
      },
      {
        id: 'qs-2',
        type: 'bulletList',
        content: 'Ctrl / Cmd + K : 快速呼出全局搜索与命令面板',
      },
      {
        id: 'qs-3',
        type: 'bulletList',
        content: '输入 / : 呼出块级类型插入菜单 (Slash Commands)',
      },
      {
        id: 'qs-4',
        type: 'bulletList',
        content: 'Ctrl / Cmd + \\ : 快速折叠 / 展开侧边栏',
      }
    ]
  },
  'database-demo': {
    id: 'database-demo',
    title: '多维数据库概念预览 (Table / Board)',
    icon: '📊',
    parentId: null,
    isFavorite: true,
    createdAt: Date.now() - 86400000 * 3,
    updatedAt: Date.now() - 1800000,
    blocks: [
      {
        id: 'db-1',
        type: 'heading2',
        content: '📊 多维结构化数据库',
      },
      {
        id: 'db-2',
        type: 'paragraph',
        content: '支持在同一个数据源上无缝切换表格 (Table)、看板 (Board) 和画廊 (Gallery) 视图。',
      },
      {
        id: 'db-3',
        type: 'database',
        content: '',
        properties: { databaseId: 'demo-db-1' },
      }
    ]
  },
  'architecture-doc': {
    id: 'architecture-doc',
    title: '系统整体架构设计规范',
    icon: '🏗️',
    parentId: null,
    createdAt: Date.now() - 86400000 * 4,
    updatedAt: Date.now() - 86400000,
    blocks: [
      {
        id: 'arch-1',
        type: 'heading2',
        content: '🛠️ 技术栈总览',
      },
      {
        id: 'arch-2',
        type: 'paragraph',
        content: '前端采用 React 19 + TypeScript + Vite + Tailwind CSS，后端基于 Node.js Hocuspocus CRDT 同步管道 + PostgreSQL + S3 兼容存储。',
      }
    ]
  }
};

const INITIAL_DATABASES: Record<string, DatabaseSchema> = {
  'demo-db-1': {
    id: 'demo-db-1',
    title: '项目需求与任务追踪',
    icon: '📋',
    description: '演示多维数据库 Schema 字段结构、行记录与单元格数据',
    properties: {
      'prop-title': { id: 'prop-title', name: '任务标题', type: 'title', width: 220 },
      'prop-status': {
        id: 'prop-status',
        name: '状态',
        type: 'select',
        width: 140,
        options: [
          { id: 'opt-todo', name: '待处理', color: 'gray' },
          { id: 'opt-prog', name: '进行中', color: 'blue' },
          { id: 'opt-done', name: '已完成', color: 'green' },
        ],
      },
      'prop-priority': {
        id: 'prop-priority',
        name: '优先级',
        type: 'select',
        width: 130,
        options: [
          { id: 'p-high', name: '高', color: 'red' },
          { id: 'p-med', name: '中', color: 'orange' },
          { id: 'p-low', name: '低', color: 'green' },
        ],
      },
      'prop-done': { id: 'prop-done', name: '已归档', type: 'checkbox', width: 100 },
    },
    propertyOrder: ['prop-title', 'prop-status', 'prop-priority', 'prop-done'],
    rows: {
      'row-1': {
        id: 'row-1',
        databaseId: 'demo-db-1',
        cells: {
          'prop-title': '多维表格核心数据层 Schema 研发',
          'prop-status': 'opt-done',
          'prop-priority': 'p-high',
          'prop-done': true,
        },
        createdAt: Date.now() - 86400000 * 2,
        updatedAt: Date.now() - 3600000,
      },
      'row-2': {
        id: 'row-2',
        databaseId: 'demo-db-1',
        cells: {
          'prop-title': '页面树与富文本 Block 引擎联动',
          'prop-status': 'opt-prog',
          'prop-priority': 'p-med',
          'prop-done': false,
        },
        createdAt: Date.now() - 86400000,
        updatedAt: Date.now() - 1800000,
      },
    },
    rowOrder: ['row-1', 'row-2'],
    createdAt: Date.now() - 86400000 * 3,
    updatedAt: Date.now() - 1800000,
  },
};

let storageInstance: StorageAdapter = createWorkspaceStorage();
let autoSaveTimer: NodeJS.Timeout | null = null;

function scheduleAutoSave(
  get: () => WorkspaceState,
  set: (partial: Partial<WorkspaceState> | ((state: WorkspaceState) => Partial<WorkspaceState>)) => void,
  immediate = false
) {
  const current = get();
  if (!current.isHydrated) return;
  // 快照损坏或处于异常状态时暂停自动保存，防止覆盖受损数据
  if (current.storageStatus === 'error') return;

  const doSave = async () => {
    const state = get();
    if (state.storageStatus === 'error') return;
    const snapshot: WorkspaceSnapshot = {
      version: SNAPSHOT_SCHEMA_VERSION,
      timestamp: Date.now(),
      workspace: state.workspace,
      documents: state.documents,
      activePageId: state.activePageId,
      isSidebarCollapsed: state.isSidebarCollapsed,
      theme: state.theme,
      databases: state.databases,
    };
    try {
      await storageInstance.save(snapshot);
      if (storageInstance.isPersistent) {
        set({ storageStatus: 'saved', storageError: null });
      } else {
        set({
          storageStatus: 'degraded',
          storageError: '当前处于纯内存降级模式，数据未持久化到本地',
        });
      }
    } catch (err: any) {
      set({
        storageStatus: 'degraded',
        storageError: err?.message || 'Auto-save failed',
      });
    }
  };

  if (immediate) {
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
      autoSaveTimer = null;
    }
    set({ storageStatus: 'saving' });
    doSave();
  } else {
    set({ storageStatus: 'saving' });
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
    }
    autoSaveTimer = setTimeout(() => {
      autoSaveTimer = null;
      doSave();
    }, 500);
  }
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => {
  // 检查系统/存储偏好的初始主题
  const savedTheme = (typeof window !== 'undefined' && localStorage.getItem('mc_theme')) as 'light' | 'dark' | null;
  const initialTheme = savedTheme || 'light';

  return {
    workspace: {
      id: 'ws-main',
      name: 'Comes Workspace',
      icon: '🌌',
      description: '私有协作知识库',
      memberCount: 2,
    },
    setWorkspaceName: (name: string) => {
      set((state) => ({ workspace: { ...state.workspace, name } }));
      scheduleAutoSave(get, set, false);
    },

    documents: INITIAL_PAGES,
    activePageId: 'welcome-page',
    setActivePage: (id: string) => {
      set({ activePageId: id });
      scheduleAutoSave(get, set, false);
    },

    createPage: (parentId: string | null = null, title = '无标题页面', icon = '📄') => {
      const newId = `doc-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      const newPage: DocumentItem = {
        id: newId,
        title,
        icon,
        parentId: parentId || null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        blocks: [
          {
            id: `b-${Date.now()}`,
            type: 'paragraph',
            content: '',
          }
        ]
      };

      set((state) => ({
        documents: { ...state.documents, [newId]: newPage },
        activePageId: newId,
      }));
      scheduleAutoSave(get, set, true);

      return newId;
    },

    updatePage: (id: string, updates: Partial<DocumentItem>) => {
      set((state) => {
        const existing = state.documents[id];
        if (!existing) return state;
        return {
          documents: {
            ...state.documents,
            [id]: {
              ...existing,
              ...updates,
              updatedAt: Date.now(),
            }
          }
        };
      });
      scheduleAutoSave(get, set, false);
    },

    updateDocumentBlocks: (id: string, blocks: BlockNode[]) => {
      set((state) => {
        const existing = state.documents[id];
        if (!existing) return state;
        return {
          documents: {
            ...state.documents,
            [id]: {
              ...existing,
              blocks: blocks.map(normalizeBlock),
              updatedAt: Date.now(),
            }
          }
        };
      });
      scheduleAutoSave(get, set, false);
    },

    deletePage: (id: string) => {
      set((state) => {
        const { documents: nextDocs, nextActivePageId } = cascadeDeletePage(
          state.documents,
          id,
          state.activePageId
        );
        return {
          documents: nextDocs,
          activePageId: nextActivePageId,
        };
      });
      scheduleAutoSave(get, set, true);
    },

    toggleFavorite: (id: string) => {
      set((state) => {
        const doc = state.documents[id];
        if (!doc) return state;
        return {
          documents: {
            ...state.documents,
            [id]: { ...doc, isFavorite: !doc.isFavorite }
          }
        };
      });
      scheduleAutoSave(get, set, false);
    },

    getBreadcrumbs: (id: string): BreadcrumbItem[] => {
      const docs = get().documents;
      const crumbs: BreadcrumbItem[] = [];
      const visited = new Set<string>();
      let currentId: string | null = id;

      while (currentId && docs[currentId] && !visited.has(currentId)) {
        visited.add(currentId);
        const docItem: DocumentItem = docs[currentId];
        crumbs.unshift({
          id: docItem.id,
          title: docItem.title || '无标题页面',
          icon: docItem.icon,
        });
        currentId = docItem.parentId;
      }

      return crumbs;
    },

    searchQuery: '',
    setSearchQuery: (query: string) => set({ searchQuery: query }),
    isSearchOpen: false,
    setIsSearchOpen: (open: boolean) => set({ isSearchOpen: open }),

    isSidebarCollapsed: false,
    toggleSidebar: () => {
      set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed }));
      scheduleAutoSave(get, set, false);
    },
    setSidebarCollapsed: (collapsed: boolean) => {
      set({ isSidebarCollapsed: collapsed });
      scheduleAutoSave(get, set, false);
    },

    theme: initialTheme,
    toggleTheme: () => {
      set((state) => {
        const nextTheme = state.theme === 'light' ? 'dark' : 'light';
        if (typeof window !== 'undefined') {
          localStorage.setItem('mc_theme', nextTheme);
          if (nextTheme === 'dark') {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        }
        return { theme: nextTheme };
      });
      scheduleAutoSave(get, set, false);
    },

    // Day 8: 多维数据库数据层状态与 CRUD 操作
    databases: INITIAL_DATABASES,

    createDatabase: (title = '未命名数据库', initialProperties?: DatabaseProperty[]) => {
      const db = createDatabase(title, initialProperties);
      const safeDb = validateDatabaseSchema(db) ? db : normalizeDatabaseSchema(db);
      set((state) => ({
        databases: {
          ...state.databases,
          [safeDb.id]: safeDb,
        },
      }));
      scheduleAutoSave(get, set, false);
      return safeDb.id;
    },

    updateDatabase: (id: string, updates: DatabaseMetaUpdates) => {
      set((state) => {
        const existing = state.databases[id];
        if (!existing) return state;
        const nextDb: DatabaseSchema = {
          ...existing,
          title: typeof updates.title === 'string' ? updates.title : existing.title,
          icon: updates.icon !== undefined ? updates.icon : existing.icon,
          description: updates.description !== undefined ? updates.description : existing.description,
          updatedAt: Date.now(),
        };
        const safeDb = validateDatabaseSchema(nextDb) ? nextDb : normalizeDatabaseSchema(nextDb);
        return {
          databases: {
            ...state.databases,
            [id]: safeDb,
          },
        };
      });
      scheduleAutoSave(get, set, false);
    },

    deleteDatabase: (id: string) => {
      set((state) => {
        if (!state.databases[id]) return state;
        const nextDbs = { ...state.databases };
        delete nextDbs[id];
        return { databases: nextDbs };
      });
      scheduleAutoSave(get, set, false);
    },

    addDatabaseProperty: (databaseId, property) => {
      set((state) => {
        const db = state.databases[databaseId];
        if (!db) return state;
        const nextDb = addProperty(db, property);
        const safeDb = validateDatabaseSchema(nextDb) ? nextDb : normalizeDatabaseSchema(nextDb);
        return {
          databases: {
            ...state.databases,
            [databaseId]: safeDb,
          },
        };
      });
      scheduleAutoSave(get, set, false);
    },

    updateDatabaseProperty: (databaseId, propertyId, updates) => {
      set((state) => {
        const db = state.databases[databaseId];
        if (!db) return state;
        const nextDb = updateProperty(db, propertyId, updates);
        const safeDb = validateDatabaseSchema(nextDb) ? nextDb : normalizeDatabaseSchema(nextDb);
        return {
          databases: {
            ...state.databases,
            [databaseId]: safeDb,
          },
        };
      });
      scheduleAutoSave(get, set, false);
    },

    changeDatabasePropertyType: (databaseId, propertyId, newType) => {
      set((state) => {
        const db = state.databases[databaseId];
        if (!db) return state;
        const nextDb = changePropertyType(db, propertyId, newType);
        const safeDb = validateDatabaseSchema(nextDb) ? nextDb : normalizeDatabaseSchema(nextDb);
        return {
          databases: {
            ...state.databases,
            [databaseId]: safeDb,
          },
        };
      });
      scheduleAutoSave(get, set, false);
    },

    addDatabaseSelectOption: (databaseId, propertyId, option) => {
      set((state) => {
        const db = state.databases[databaseId];
        if (!db) return state;
        const nextDb = addSelectOption(db, propertyId, option);
        const safeDb = validateDatabaseSchema(nextDb) ? nextDb : normalizeDatabaseSchema(nextDb);
        return {
          databases: {
            ...state.databases,
            [databaseId]: safeDb,
          },
        };
      });
      scheduleAutoSave(get, set, false);
    },

    updateDatabaseSelectOption: (databaseId, propertyId, optionId, updates) => {
      set((state) => {
        const db = state.databases[databaseId];
        if (!db) return state;
        const nextDb = updateSelectOption(db, propertyId, optionId, updates);
        const safeDb = validateDatabaseSchema(nextDb) ? nextDb : normalizeDatabaseSchema(nextDb);
        return {
          databases: {
            ...state.databases,
            [databaseId]: safeDb,
          },
        };
      });
      scheduleAutoSave(get, set, false);
    },

    deleteDatabaseSelectOption: (databaseId, propertyId, optionId) => {
      set((state) => {
        const db = state.databases[databaseId];
        if (!db) return state;
        const nextDb = deleteSelectOption(db, propertyId, optionId);
        const safeDb = validateDatabaseSchema(nextDb) ? nextDb : normalizeDatabaseSchema(nextDb);
        return {
          databases: {
            ...state.databases,
            [databaseId]: safeDb,
          },
        };
      });
      scheduleAutoSave(get, set, false);
    },

    deleteDatabaseProperty: (databaseId, propertyId) => {
      set((state) => {
        const db = state.databases[databaseId];
        if (!db) return state;
        const nextDb = deleteProperty(db, propertyId);
        const safeDb = validateDatabaseSchema(nextDb) ? nextDb : normalizeDatabaseSchema(nextDb);
        return {
          databases: {
            ...state.databases,
            [databaseId]: safeDb,
          },
        };
      });
      scheduleAutoSave(get, set, false);
    },

    reorderDatabaseProperties: (databaseId, newOrder) => {
      set((state) => {
        const db = state.databases[databaseId];
        if (!db) return state;
        const nextDb = reorderProperties(db, newOrder);
        const safeDb = validateDatabaseSchema(nextDb) ? nextDb : normalizeDatabaseSchema(nextDb);
        return {
          databases: {
            ...state.databases,
            [databaseId]: safeDb,
          },
        };
      });
      scheduleAutoSave(get, set, false);
    },

    addDatabaseRow: (databaseId, initialCells, atIndex) => {
      set((state) => {
        const db = state.databases[databaseId];
        if (!db) return state;
        const nextDb = addRow(db, initialCells, atIndex);
        const safeDb = validateDatabaseSchema(nextDb) ? nextDb : normalizeDatabaseSchema(nextDb);
        return {
          databases: {
            ...state.databases,
            [databaseId]: safeDb,
          },
        };
      });
      scheduleAutoSave(get, set, false);
    },

    updateDatabaseRow: (databaseId, rowId, updates) => {
      set((state) => {
        const db = state.databases[databaseId];
        if (!db) return state;
        const nextDb = updateRow(db, rowId, updates);
        const safeDb = validateDatabaseSchema(nextDb) ? nextDb : normalizeDatabaseSchema(nextDb);
        return {
          databases: {
            ...state.databases,
            [databaseId]: safeDb,
          },
        };
      });
      scheduleAutoSave(get, set, false);
    },

    updateDatabaseCell: (databaseId, rowId, propertyId, value) => {
      set((state) => {
        const db = state.databases[databaseId];
        if (!db) return state;
        const nextDb = updateCell(db, rowId, propertyId, value);
        const safeDb = validateDatabaseSchema(nextDb) ? nextDb : normalizeDatabaseSchema(nextDb);
        return {
          databases: {
            ...state.databases,
            [databaseId]: safeDb,
          },
        };
      });
      scheduleAutoSave(get, set, false);
    },

    deleteDatabaseRow: (databaseId, rowId) => {
      set((state) => {
        const db = state.databases[databaseId];
        if (!db) return state;
        const nextDb = deleteRow(db, rowId);
        const safeDb = validateDatabaseSchema(nextDb) ? nextDb : normalizeDatabaseSchema(nextDb);
        return {
          databases: {
            ...state.databases,
            [databaseId]: safeDb,
          },
        };
      });
      scheduleAutoSave(get, set, false);
    },

    reorderDatabaseRows: (databaseId, newOrder) => {
      set((state) => {
        const db = state.databases[databaseId];
        if (!db) return state;
        const nextDb = reorderRows(db, newOrder);
        const safeDb = validateDatabaseSchema(nextDb) ? nextDb : normalizeDatabaseSchema(nextDb);
        return {
          databases: {
            ...state.databases,
            [databaseId]: safeDb,
          },
        };
      });
      scheduleAutoSave(get, set, false);
    },

    getDatabase: (id: string) => {
      return get().databases[id];
    },

    // Day 7: 本地离线持久化状态与操作方法
    isHydrated: false,
    storageStatus: 'idle',
    storageError: null,

    hydrateStore: async () => {
      set({ storageStatus: 'loading' });
      try {
        const snapshot = await storageInstance.load();
        if (snapshot) {
          const isPersistent = storageInstance.isPersistent;
          const rawDatabases = snapshot.databases || {};
          const safeDatabases: Record<string, DatabaseSchema> = {};
          for (const [dbId, db] of Object.entries(rawDatabases)) {
            safeDatabases[dbId] = validateDatabaseSchema(db) ? db : normalizeDatabaseSchema(db);
          }

          set({
            workspace: snapshot.workspace,
            documents: snapshot.documents,
            activePageId: snapshot.activePageId,
            isSidebarCollapsed: snapshot.isSidebarCollapsed,
            theme: snapshot.theme,
            databases: safeDatabases,
            isHydrated: true,
            storageStatus: isPersistent ? 'saved' : 'degraded',
            storageError: isPersistent ? null : '当前处于纯内存降级模式，数据未持久化到本地',
          });

          if (typeof document !== 'undefined') {
            if (snapshot.theme === 'dark') {
              document.documentElement.classList.add('dark');
            } else {
              document.documentElement.classList.remove('dark');
            }
          }
        } else {
          // 纯空存储（首次使用）：初始化落地默认快照
          const current = get();
          const initialSnapshot: WorkspaceSnapshot = {
            version: SNAPSHOT_SCHEMA_VERSION,
            timestamp: Date.now(),
            workspace: current.workspace,
            documents: current.documents,
            activePageId: current.activePageId,
            isSidebarCollapsed: current.isSidebarCollapsed,
            theme: current.theme,
            databases: current.databases,
          };
          try {
            await storageInstance.save(initialSnapshot);
            const isPersistent = storageInstance.isPersistent;
            set({
              isHydrated: true,
              storageStatus: isPersistent ? 'saved' : 'degraded',
              storageError: isPersistent ? null : '当前处于纯内存降级模式，数据未持久化到本地',
            });
          } catch (e: any) {
            set({
              isHydrated: true,
              storageStatus: 'degraded',
              storageError: e?.message || 'Initial save failed',
            });
          }
        }
      } catch (err: any) {
        // 捕获到快照数据损坏 (StorageCorruptError) 或读取错误 (StorageReadError)
        // 严禁在此处保存默认数据覆盖受损或不兼容的原记录！
        console.warn('[hydrateStore] Failed to load workspace snapshot:', err?.message || err);
        set({
          isHydrated: true,
          storageStatus: 'error',
          storageError: err?.message || '本地快照数据损坏或读取失败，已暂停自动保存以防覆盖数据',
        });
      }
    },

    saveToStorage: async (immediate = true) => {
      const state = get();
      if (state.storageStatus === 'error') {
        console.warn('[saveToStorage] Skipped saving while storageStatus is "error"');
        return;
      }

      if (immediate) {
        if (autoSaveTimer) {
          clearTimeout(autoSaveTimer);
          autoSaveTimer = null;
        }
        const snapshot: WorkspaceSnapshot = {
          version: SNAPSHOT_SCHEMA_VERSION,
          timestamp: Date.now(),
          workspace: state.workspace,
          documents: state.documents,
          activePageId: state.activePageId,
          isSidebarCollapsed: state.isSidebarCollapsed,
          theme: state.theme,
          databases: state.databases,
        };
        set({ storageStatus: 'saving' });
        try {
          await storageInstance.save(snapshot);
          if (storageInstance.isPersistent) {
            set({ storageStatus: 'saved', storageError: null });
          } else {
            set({
              storageStatus: 'degraded',
              storageError: '当前处于纯内存降级模式，数据未持久化到本地',
            });
          }
        } catch (e: any) {
          set({
            storageStatus: 'degraded',
            storageError: e?.message || 'Save failed',
          });
        }
      } else {
        scheduleAutoSave(get, set, false);
      }
    },

    resetStorageToDefault: async () => {
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
        autoSaveTimer = null;
      }
      try {
        await storageInstance.clear();
      } catch (err) {
        console.warn('[resetStorageToDefault] Clear failed:', err);
      }
      const current = get();
      const defaultSnapshot: WorkspaceSnapshot = {
        version: SNAPSHOT_SCHEMA_VERSION,
        timestamp: Date.now(),
        workspace: current.workspace,
        documents: current.documents,
        activePageId: current.activePageId,
        isSidebarCollapsed: current.isSidebarCollapsed,
        theme: current.theme,
        databases: current.databases,
      };
      try {
        await storageInstance.save(defaultSnapshot);
        const isPersistent = storageInstance.isPersistent;
        set({
          storageStatus: isPersistent ? 'saved' : 'degraded',
          storageError: isPersistent ? null : '当前处于纯内存降级模式，数据未持久化到本地',
        });
      } catch (e: any) {
        set({
          storageStatus: 'degraded',
          storageError: e?.message || 'Reset save failed',
        });
      }
    },

    setStorageAdapter: (adapter: StorageAdapter) => {
      storageInstance = adapter;
    },
  };
});
