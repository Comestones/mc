import type { DocumentItem } from '../types/document.ts';
import type { WorkspaceMeta } from '../types/workspace.ts';
import { normalizeBlock } from './blockUtils.ts';
import { repairPageTree } from './workspaceUtils.ts';

export const SNAPSHOT_SCHEMA_VERSION = 1;
export const DB_NAME = 'mc_workspace_db';
export const DB_VERSION = 1;
export const STORE_NAME = 'workspace_snapshots';
export const SNAPSHOT_KEY = 'active_workspace';

export class StorageReadError extends Error {
  public readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.cause = cause;
    this.name = 'StorageReadError';
  }
}

export class StorageCorruptError extends Error {
  public readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.cause = cause;
    this.name = 'StorageCorruptError';
  }
}

export interface WorkspaceSnapshot {
  version: number;
  timestamp: number;
  workspace: WorkspaceMeta;
  documents: Record<string, DocumentItem>;
  activePageId: string;
  isSidebarCollapsed: boolean;
  theme: 'light' | 'dark';
}

export interface StorageAdapter {
  readonly isAvailable: boolean;
  readonly isPersistent: boolean;
  readonly kind: 'indexeddb' | 'memory';
  load(): Promise<WorkspaceSnapshot | null>;
  save(snapshot: WorkspaceSnapshot): Promise<void>;
  clear(): Promise<void>;
}

/**
 * 校验快照结构与版本完整性
 */
export function validateWorkspaceSnapshot(
  data: unknown
): data is WorkspaceSnapshot {
  if (!data || typeof data !== 'object') return false;
  const s = data as Partial<WorkspaceSnapshot>;

  // 1. 版本号校验（必须为有限正整数，且不得超过当前支持的最大 schema 版本）
  if (
    typeof s.version !== 'number' ||
    s.version < 1 ||
    s.version > SNAPSHOT_SCHEMA_VERSION
  ) {
    return false;
  }

  // 2. 工作区元信息
  if (
    !s.workspace ||
    typeof s.workspace !== 'object' ||
    typeof s.workspace.id !== 'string' ||
    typeof s.workspace.name !== 'string'
  ) {
    return false;
  }

  // 3. 文档集合
  if (!s.documents || typeof s.documents !== 'object') return false;
  for (const [docId, doc] of Object.entries(s.documents)) {
    if (!doc || typeof doc !== 'object') return false;
    if (doc.id !== docId || !Array.isArray(doc.blocks)) return false;
  }

  // 4. 当前激活页
  if (typeof s.activePageId !== 'string') return false;

  // 5. 偏好状态
  if (s.theme !== 'light' && s.theme !== 'dark') return false;
  if (typeof s.isSidebarCollapsed !== 'boolean') return false;

  return true;
}

/**
 * 规整并深度清洗快照中的文档数据（对各 Block 节点调用统一规范化引擎，修复页面树父子关系）
 */
export function normalizeSnapshot(snapshot: WorkspaceSnapshot): WorkspaceSnapshot {
  const normalizedDocs: Record<string, DocumentItem> = {};
  for (const [id, doc] of Object.entries(snapshot.documents)) {
    normalizedDocs[id] = {
      ...doc,
      blocks: (doc.blocks || []).map(normalizeBlock),
    };
  }

  // 修复页面树引用完整性（孤立 parentId 与循环引用自愈）
  const repairedDocs = repairPageTree(normalizedDocs);

  // 若激活页面不存在于文档集中，自动重置为首个可用页面
  let safeActiveId = snapshot.activePageId;
  const docKeys = Object.keys(repairedDocs);
  if (!repairedDocs[safeActiveId] && docKeys.length > 0) {
    safeActiveId = docKeys[0];
  }

  return {
    ...snapshot,
    documents: repairedDocs,
    activePageId: safeActiveId,
  };
}

/**
 * 内存存储适配器（测试环境与无可用 IndexedDB 时的优雅降级实现）
 */
export class MemoryStorage implements StorageAdapter {
  public readonly isAvailable = true;
  public readonly isPersistent: boolean;
  public readonly kind = 'memory' as const;
  private currentSnapshot: WorkspaceSnapshot | null = null;
  private rawCorruptPayload: unknown = null;
  private shouldFailRead = false;

  constructor(
    initialSnapshot?: WorkspaceSnapshot | null,
    options?: { isPersistent?: boolean }
  ) {
    this.isPersistent = options?.isPersistent ?? false;
    if (initialSnapshot) {
      this.currentSnapshot = JSON.parse(JSON.stringify(initialSnapshot));
    }
  }

  /**
   * 测试辅助：模拟存储了损坏的原始载荷
   */
  setRawCorruptPayload(raw: unknown) {
    this.rawCorruptPayload = raw;
  }

  /**
   * 测试辅助：模拟底层读取异常
   */
  setFailRead(fail: boolean) {
    this.shouldFailRead = fail;
  }

  async load(): Promise<WorkspaceSnapshot | null> {
    if (this.shouldFailRead) {
      throw new StorageReadError('Memory read failed: simulated storage error');
    }
    if (this.rawCorruptPayload !== null) {
      const raw = this.rawCorruptPayload;
      try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (validateWorkspaceSnapshot(parsed)) {
          return normalizeSnapshot(parsed);
        } else {
          throw new StorageCorruptError('Memory snapshot validation failed: invalid schema');
        }
      } catch (e: any) {
        if (e instanceof StorageCorruptError) throw e;
        throw new StorageCorruptError('Memory failed to parse snapshot JSON', e);
      }
    }
    if (!this.currentSnapshot) return null;
    return JSON.parse(JSON.stringify(this.currentSnapshot));
  }

  async save(snapshot: WorkspaceSnapshot): Promise<void> {
    if (!validateWorkspaceSnapshot(snapshot)) {
      throw new Error('Invalid workspace snapshot schema');
    }
    this.currentSnapshot = JSON.parse(JSON.stringify(snapshot));
    this.rawCorruptPayload = null;
  }

  async clear(): Promise<void> {
    this.currentSnapshot = null;
    this.rawCorruptPayload = null;
  }
}

/**
 * 原生 IndexedDB 异步封装实现
 */
export class IndexedDBStorage implements StorageAdapter {
  private customFactory?: IDBFactory;
  public readonly isPersistent = true;
  public readonly kind = 'indexeddb' as const;

  constructor(customFactory?: IDBFactory) {
    this.customFactory = customFactory;
  }

  get isAvailable(): boolean {
    const factory =
      this.customFactory ||
      (typeof window !== 'undefined' ? window.indexedDB : undefined);
    return !!factory;
  }

  private getFactory(): IDBFactory {
    const factory =
      this.customFactory ||
      (typeof window !== 'undefined' ? window.indexedDB : undefined);
    if (!factory) {
      throw new StorageReadError('IndexedDB is not available in current environment');
    }
    return factory;
  }

  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      let factory: IDBFactory;
      try {
        factory = this.getFactory();
      } catch (e) {
        return reject(e);
      }
      const request = factory.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(new StorageReadError('Failed to open IndexedDB database', request.error));
      };
    });
  }

  async load(): Promise<WorkspaceSnapshot | null> {
    if (!this.isAvailable) {
      throw new StorageReadError('IndexedDB is not available');
    }

    let db: IDBDatabase;
    try {
      db = await this.openDB();
    } catch (err: any) {
      if (err instanceof StorageReadError || err instanceof StorageCorruptError) throw err;
      throw new StorageReadError('Failed to open database for reading', err);
    }

    return new Promise<WorkspaceSnapshot | null>((resolve, reject) => {
      let tx: IDBTransaction;
      try {
        tx = db.transaction(STORE_NAME, 'readonly');
      } catch (err: any) {
        return reject(new StorageReadError('Failed to start read transaction', err));
      }
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(SNAPSHOT_KEY);

      req.onsuccess = () => {
        const raw = req.result;
        if (raw === undefined || raw === null) {
          resolve(null);
          return;
        }

        try {
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (validateWorkspaceSnapshot(parsed)) {
            resolve(normalizeSnapshot(parsed));
          } else {
            reject(
              new StorageCorruptError(
                'IndexedDB snapshot schema validation failed: incompatible or corrupted schema'
              )
            );
          }
        } catch (e: any) {
          reject(new StorageCorruptError('Failed to parse snapshot JSON in IndexedDB', e));
        }
      };

      req.onerror = () => {
        reject(new StorageReadError('Failed to read from IndexedDB', req.error));
      };

      tx.onabort = () => {
        reject(new StorageReadError('IndexedDB read transaction aborted', tx.error));
      };
    });
  }

  async save(snapshot: WorkspaceSnapshot): Promise<void> {
    if (!this.isAvailable) {
      throw new StorageReadError('IndexedDB is not available');
    }

    if (!validateWorkspaceSnapshot(snapshot)) {
      throw new Error('Cannot save invalid workspace snapshot schema');
    }

    const normalized = normalizeSnapshot(snapshot);
    let db: IDBDatabase;
    try {
      db = await this.openDB();
    } catch (err: any) {
      if (err instanceof StorageReadError || err instanceof StorageCorruptError) throw err;
      throw new StorageReadError('Failed to open database for writing', err);
    }

    return new Promise<void>((resolve, reject) => {
      let tx: IDBTransaction;
      try {
        tx = db.transaction(STORE_NAME, 'readwrite');
      } catch (err: any) {
        return reject(new StorageReadError('Failed to start write transaction', err));
      }
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(normalized, SNAPSHOT_KEY);

      req.onsuccess = () => {
        resolve();
      };

      req.onerror = () => {
        reject(new StorageReadError('Failed to write to IndexedDB', req.error));
      };

      tx.onabort = () => {
        reject(new StorageReadError('IndexedDB transaction aborted', tx.error));
      };
    });
  }

  async clear(): Promise<void> {
    if (!this.isAvailable) return;

    try {
      const db = await this.openDB();
      return await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(SNAPSHOT_KEY);

        req.onsuccess = () => resolve();
        req.onerror = () => reject(new StorageReadError('Failed to delete snapshot', req.error));
      });
    } catch (err) {
      console.warn('[IndexedDBStorage] Clear operation failed:', err);
    }
  }
}

/**
 * 统一存储构造器
 */
export function createWorkspaceStorage(options?: {
  customFactory?: IDBFactory;
  forceMemory?: boolean;
}): StorageAdapter {
  if (options?.forceMemory) {
    return new MemoryStorage();
  }

  const idb = new IndexedDBStorage(options?.customFactory);
  if (idb.isAvailable) {
    return idb;
  }

  return new MemoryStorage();
}
