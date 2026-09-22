import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useWorkspaceStore } from '../../../store/useWorkspaceStore';
import { PROPERTY_TYPE_ICONS } from './TableHeader';
import { BlockEditor } from '../BlockEditor';
import { formatCreatedTime } from '../../../utils/databaseUtils';
import { X, Trash2, Check, ExternalLink } from 'lucide-react';
import { DateCellEditor } from './editors/DateCellEditor';
import { UrlCellEditor } from './editors/UrlCellEditor';
import { SelectCellEditor } from './editors/SelectCellEditor';
import { MultiSelectCellEditor } from './editors/MultiSelectCellEditor';

export interface DatabaseRowDetailProps {
  databaseId: string;
  rowId: string;
  onClose: () => void;
}

export const DatabaseRowDetail: React.FC<DatabaseRowDetailProps> = ({
  databaseId,
  rowId,
  onClose,
}) => {
  const database = useWorkspaceStore((state) => state.databases[databaseId]);
  const row = database?.rows[rowId];
  const updateDatabaseCell = useWorkspaceStore((state) => state.updateDatabaseCell);
  const updateDatabaseRowBlocks = useWorkspaceStore((state) => state.updateDatabaseRowBlocks);
  const deleteDatabaseRow = useWorkspaceStore((state) => state.deleteDatabaseRow);
  const addDatabaseSelectOption = useWorkspaceStore((state) => state.addDatabaseSelectOption);

  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [editingPropId, setEditingPropId] = useState<string | null>(null);

  const titlePropId =
    database?.propertyOrder.find((pid) => database.properties[pid]?.type === 'title') ||
    database?.propertyOrder[0] ||
    'prop-title';

  const titleValue = String(row?.cells[titlePropId] || '');

  // 背景隔离：给背景元素设置 inert 并在卸载时移除
  useEffect(() => {
    const dialogOverlay = overlayRef.current;
    const isolatedElements: HTMLElement[] = [];

    // 1. 查找外部的表格容器设置 inert
    const tableContainers = document.querySelectorAll<HTMLElement>(
      '[data-testid="database-table-container"], [data-testid="database-table"]'
    );
    tableContainers.forEach((el) => {
      if (!el.contains(dialogOverlay) && !el.hasAttribute('inert')) {
        el.setAttribute('inert', '');
        isolatedElements.push(el);
      }
    });

    // 2. 隔离 overlay 的兄弟节点（若其渲染在某个容器内部）
    if (dialogOverlay?.parentElement) {
      Array.from(dialogOverlay.parentElement.children).forEach((child) => {
        if (child !== dialogOverlay && child instanceof HTMLElement) {
          if (!child.hasAttribute('inert')) {
            child.setAttribute('inert', '');
            isolatedElements.push(child);
          }
        }
      });
    }

    return () => {
      isolatedElements.forEach((el) => {
        el.removeAttribute('inert');
      });
    };
  }, []);

  // 键盘 Escape 退出与焦点陷阱
  useEffect(() => {
    // 初次挂载聚焦标题输入框
    titleInputRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      // Tab 焦点循环锁定在 dialog 内部
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;

        const firstElement = focusables[0];
        const lastElement = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement || !dialogRef.current.contains(document.activeElement)) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement || !dialogRef.current.contains(document.activeElement)) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateDatabaseCell(databaseId, rowId, titlePropId, e.target.value);
  };

  const handleDelete = () => {
    deleteDatabaseRow(databaseId, rowId);
    onClose();
  };

  const handleCreateOption = useCallback(
    async (propertyId: string, name: string) => {
      const optId = `opt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newOpt = { id: optId, name: name.trim(), color: 'blue' };
      addDatabaseSelectOption(databaseId, propertyId, newOpt);
      return newOpt;
    },
    [databaseId, addDatabaseSelectOption]
  );

  if (!database || !row) return null;

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="row-detail-title"
      data-testid="database-row-detail-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-100"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        className="bg-white dark:bg-[#1e1e20] border border-border-light dark:border-border-dark rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden select-text animate-in zoom-in-95 duration-100"
      >
        {/* 顶部工具条 */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border-light/60 dark:border-border-dark/60 bg-neutral-50/50 dark:bg-neutral-900/30">
          <div className="flex items-center gap-2 text-xs text-text-muted-light dark:text-text-muted-dark font-medium">
            <span>{database.icon || '📊'}</span>
            <span>{database.title}</span>
            <span>/</span>
            <span className="text-text-primary-light dark:text-text-primary-dark font-semibold truncate max-w-[240px]">
              {titleValue || '未命名行'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              data-testid="row-detail-delete-btn"
              onClick={handleDelete}
              className="p-1.5 text-text-muted-light hover:text-red-600 dark:hover:text-red-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
              title="删除行"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              data-testid="row-detail-close-btn"
              onClick={onClose}
              className="p-1.5 text-text-muted-light hover:text-text-primary-light dark:hover:text-text-primary-dark hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
              title="关闭"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 主内容滚动区 */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
          {/* 行主标题输入 */}
          <div>
            <input
              ref={titleInputRef}
              id="row-detail-title"
              data-testid="row-detail-title-input"
              type="text"
              value={titleValue}
              onChange={handleTitleChange}
              placeholder="未命名"
              className="w-full text-2xl font-bold bg-transparent text-text-primary-light dark:text-text-primary-dark outline-none placeholder:text-text-muted-light/60 dark:placeholder:text-text-muted-dark/60 border-b border-transparent focus:border-border-light dark:focus:border-border-dark pb-1"
            />
          </div>

          {/* 属性列表面板 */}
          <div className="space-y-2 text-xs">
            <div className="text-[11px] font-semibold text-text-muted-light dark:text-text-muted-dark uppercase tracking-wider mb-2">
              属性
            </div>

            <div className="grid grid-cols-[140px_1fr] gap-y-2 items-center">
              {database.propertyOrder.map((propId) => {
                const prop = database.properties[propId];
                if (!prop) return null;
                const Icon = PROPERTY_TYPE_ICONS[prop.type];
                const cellVal = row.cells[propId];

                // 渲染属性值控件
                const renderPropertyValue = () => {
                  if (prop.type === 'title') {
                    return (
                      <span className="text-text-primary-light dark:text-text-primary-dark font-medium">
                        {titleValue || '-'}
                      </span>
                    );
                  }

                  if (prop.type === 'createdTime') {
                    return (
                      <span
                        data-testid="row-detail-created-time"
                        className="text-text-muted-light dark:text-text-muted-dark font-mono"
                      >
                        {formatCreatedTime(row.createdAt)}
                      </span>
                    );
                  }

                  if (prop.type === 'checkbox') {
                    return (
                      <button
                        type="button"
                        data-testid={`row-detail-checkbox-${propId}`}
                        onClick={() =>
                          updateDatabaseCell(databaseId, rowId, propId, !cellVal)
                        }
                        className="flex items-center gap-2 cursor-pointer w-fit"
                      >
                        <span
                          className={`w-4 h-4 rounded flex items-center justify-center border text-[10px] transition-colors ${
                            cellVal
                              ? 'bg-blue-600 border-blue-600 text-white'
                              : 'border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800'
                          }`}
                        >
                          {cellVal ? <Check className="w-3 h-3 stroke-[3]" /> : null}
                        </span>
                        <span className="text-text-secondary-light dark:text-text-secondary-dark">
                          {cellVal ? '已勾选' : '未勾选'}
                        </span>
                      </button>
                    );
                  }

                  if (prop.type === 'date') {
                    if (editingPropId === propId) {
                      return (
                        <div className="w-48">
                          <DateCellEditor
                            value={typeof cellVal === 'string' ? cellVal : null}
                            onCommit={(val) => {
                              updateDatabaseCell(databaseId, rowId, propId, val);
                              setEditingPropId(null);
                            }}
                            onCancel={() => setEditingPropId(null)}
                          />
                        </div>
                      );
                    }
                    return (
                      <button
                        type="button"
                        data-testid={`row-detail-date-${propId}`}
                        onClick={() => setEditingPropId(propId)}
                        aria-label={`编辑日期 ${prop.name}`}
                        className="cursor-pointer text-left hover:bg-neutral-100 dark:hover:bg-neutral-800/60 px-2 py-1 rounded w-fit text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {cellVal ? String(cellVal) : <span className="text-text-muted-light dark:text-text-muted-dark italic">空日期</span>}
                      </button>
                    );
                  }

                  if (prop.type === 'url') {
                    if (editingPropId === propId) {
                      return (
                        <div className="w-64">
                          <UrlCellEditor
                            value={typeof cellVal === 'string' ? cellVal : null}
                            onCommit={(val) => {
                              updateDatabaseCell(databaseId, rowId, propId, val);
                              setEditingPropId(null);
                            }}
                            onCancel={() => setEditingPropId(null)}
                          />
                        </div>
                      );
                    }
                    return (
                      <div className="flex items-center gap-2 group">
                        <button
                          type="button"
                          data-testid={`row-detail-url-${propId}`}
                          onClick={() => setEditingPropId(propId)}
                          aria-label={`编辑链接 ${prop.name}`}
                          className="cursor-pointer text-left hover:bg-neutral-100 dark:hover:bg-neutral-800/60 px-2 py-1 rounded text-blue-600 dark:text-blue-400 truncate max-w-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          {cellVal ? String(cellVal) : <span className="text-text-muted-light dark:text-text-muted-dark italic">空链接</span>}
                        </button>
                        {cellVal ? (
                          <a
                            href={String(cellVal)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-text-muted-light hover:text-blue-600 dark:hover:text-blue-400 p-1 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            title="在新窗口打开"
                            aria-label="在新窗口打开链接"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        ) : null}
                      </div>
                    );
                  }

                  if (prop.type === 'select') {
                    return (
                      <div className="relative w-fit">
                        <button
                          type="button"
                          data-testid={`row-detail-select-${propId}`}
                          onClick={() => setEditingPropId(propId)}
                          aria-label={`编辑单选 ${prop.name}`}
                          className="cursor-pointer text-left focus:outline-none focus:ring-1 focus:ring-blue-500 rounded"
                        >
                          {cellVal ? (
                            (() => {
                              const opt = prop.options?.find(
                                (o) => o.id === cellVal || o.name === cellVal
                              );
                              const color = opt?.color || '#3b82f6';
                              return (
                                <span
                                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                                  style={{
                                    backgroundColor: `${color}20`,
                                    color,
                                  }}
                                >
                                  {opt?.name || String(cellVal)}
                                </span>
                              );
                            })()
                          ) : (
                            <span className="text-text-muted-light dark:text-text-muted-dark italic hover:bg-neutral-100 dark:hover:bg-neutral-800 px-2 py-1 rounded inline-block">
                              空标签
                            </span>
                          )}
                        </button>

                        {editingPropId === propId && (
                          <SelectCellEditor
                            value={cellVal as string | null}
                            options={prop.options || []}
                            onCommit={(val) => {
                              updateDatabaseCell(databaseId, rowId, propId, val);
                              setEditingPropId(null);
                            }}
                            onCancel={() => setEditingPropId(null)}
                            onCreateOption={(name) => handleCreateOption(propId, name)}
                          />
                        )}
                      </div>
                    );
                  }

                  if (prop.type === 'multiSelect') {
                    const values = Array.isArray(cellVal) ? cellVal : [];
                    return (
                      <div className="relative w-fit">
                        <button
                          type="button"
                          data-testid={`row-detail-multiselect-${propId}`}
                          onClick={() => setEditingPropId(propId)}
                          aria-label={`编辑多选 ${prop.name}`}
                          className="cursor-pointer text-left flex flex-wrap gap-1 items-center focus:outline-none focus:ring-1 focus:ring-blue-500 rounded p-0.5"
                        >
                          {values.length > 0 ? (
                            values.map((v, i) => {
                              const opt = prop.options?.find(
                                (o) => o.id === v || o.name === v
                              );
                              const color = opt?.color || '#3b82f6';
                              return (
                                <span
                                  key={i}
                                  className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium"
                                  style={{
                                    backgroundColor: `${color}20`,
                                    color,
                                  }}
                                >
                                  {opt?.name || String(v)}
                                </span>
                              );
                            })
                          ) : (
                            <span className="text-text-muted-light dark:text-text-muted-dark italic hover:bg-neutral-100 dark:hover:bg-neutral-800 px-2 py-1 rounded inline-block">
                              空多选
                            </span>
                          )}
                        </button>

                        {editingPropId === propId && (
                          <MultiSelectCellEditor
                            value={values}
                            options={prop.options || []}
                            onCommit={(val) => {
                              updateDatabaseCell(databaseId, rowId, propId, val);
                              setEditingPropId(null);
                            }}
                            onCancel={() => setEditingPropId(null)}
                            onCreateOption={(name) => handleCreateOption(propId, name)}
                          />
                        )}
                      </div>
                    );
                  }

                  // 普通 text / number
                  return (
                    <input
                      type={prop.type === 'number' ? 'number' : 'text'}
                      data-testid={`row-detail-input-${propId}`}
                      value={cellVal !== undefined && cellVal !== null ? String(cellVal) : ''}
                      placeholder="空"
                      onChange={(e) => {
                        const nextVal =
                          prop.type === 'number'
                            ? e.target.value === ''
                              ? null
                              : parseFloat(e.target.value)
                            : e.target.value;
                        updateDatabaseCell(databaseId, rowId, propId, nextVal);
                      }}
                      className="bg-transparent text-text-primary-light dark:text-text-primary-dark hover:bg-neutral-100 dark:hover:bg-neutral-800/60 px-2 py-0.5 rounded outline-none focus:bg-white dark:focus:bg-neutral-800 focus:ring-1 focus:ring-blue-500 w-64"
                    />
                  );
                };

                return (
                  <React.Fragment key={propId}>
                    <div className="flex items-center gap-1.5 text-text-muted-light dark:text-text-muted-dark py-1">
                      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{prop.name}</span>
                    </div>
                    <div className="py-1">{renderPropertyValue()}</div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          <hr className="border-border-light/60 dark:border-border-dark/60" />

          {/* Row as Page 正文富文本块编辑区 */}
          <div>
            <div className="text-[11px] font-semibold text-text-muted-light dark:text-text-muted-dark uppercase tracking-wider mb-2">
              页面正文
            </div>
            <div
              data-testid="row-detail-blocks-editor"
              className="min-h-[220px] rounded-lg border border-border-light/40 dark:border-border-dark/40 p-4 bg-neutral-50/20 dark:bg-neutral-900/10"
            >
              <BlockEditor
                blocks={row.blocks || []}
                onChange={(newBlocks) =>
                  updateDatabaseRowBlocks(databaseId, rowId, newBlocks)
                }
                className="mt-0 min-h-[180px] pb-8"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
