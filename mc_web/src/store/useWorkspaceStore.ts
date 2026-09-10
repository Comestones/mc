import { create } from 'zustand';
import { DocumentItem, BreadcrumbItem, BlockNode } from '../types/document';
import { WorkspaceMeta } from '../types/workspace';

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
    setWorkspaceName: (name: string) =>
      set((state) => ({ workspace: { ...state.workspace, name } })),

    documents: INITIAL_PAGES,
    activePageId: 'welcome-page',
    setActivePage: (id: string) => set({ activePageId: id }),

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
              blocks,
              updatedAt: Date.now(),
            }
          }
        };
      });
    },

    deletePage: (id: string) => {
      set((state) => {
        const newDocs = { ...state.documents };
        delete newDocs[id];
        // 如果删除了当前激活页，跳转到剩余的第一个页面
        const remainingKeys = Object.keys(newDocs);
        const nextActiveId = state.activePageId === id ? (remainingKeys[0] || '') : state.activePageId;
        return {
          documents: newDocs,
          activePageId: nextActiveId,
        };
      });
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
    },

    getBreadcrumbs: (id: string): BreadcrumbItem[] => {
      const docs = get().documents;
      const crumbs: BreadcrumbItem[] = [];
      let currentId: string | null = id;

      while (currentId && docs[currentId]) {
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
    toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
    setSidebarCollapsed: (collapsed: boolean) => set({ isSidebarCollapsed: collapsed }),

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
    },
  };
});
