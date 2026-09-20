import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useWorkspaceStore } from '../../../store/useWorkspaceStore';
import { TableHeader, DEFAULT_COLUMN_WIDTH, MIN_COLUMN_WIDTH, MAX_COLUMN_WIDTH } from './TableHeader';
import { TableRow } from './TableRow';
import { Plus } from 'lucide-react';

const EMPTY_ARRAY: string[] = [];
const EMPTY_OBJ = {};

export interface DatabaseTableProps {
  databaseId: string;
}

export const DatabaseTable: React.FC<DatabaseTableProps> = ({ databaseId }) => {
  const propertyOrder = useWorkspaceStore(
    (state) => state.databases[databaseId]?.propertyOrder || EMPTY_ARRAY
  );
  const rowOrder = useWorkspaceStore(
    (state) => state.databases[databaseId]?.rowOrder || EMPTY_ARRAY
  );
  const properties = useWorkspaceStore(
    (state) => state.databases[databaseId]?.properties || EMPTY_OBJ
  );
  const addDatabaseRow = useWorkspaceStore((state) => state.addDatabaseRow);

  const [focusedCell, setFocusedCell] = useState<{
    rowIndex: number;
    colIndex: number;
  } | null>(null);

  const [editingCell, setEditingCell] = useState<{
    rowIndex: number;
    colIndex: number;
  } | null>(null);

  // 实时调整列宽的临时状态（键为 propId，值为像素宽度）
  const [resizingWidths, setResizingWidths] = useState<Record<string, number>>({});

  const prevRowCountRef = useRef(rowOrder.length);

  // 监听行数增加，自动聚焦到新添加行的标题列
  useEffect(() => {
    if (rowOrder.length > prevRowCountRef.current) {
      const newRowIdx = rowOrder.length - 1;
      const titleColIdx = propertyOrder.findIndex(
        (pid) => properties[pid]?.type === 'title'
      );
      const targetColIdx = titleColIdx >= 0 ? titleColIdx : 0;
      setFocusedCell({ rowIndex: newRowIdx, colIndex: targetColIdx });
    }
    prevRowCountRef.current = rowOrder.length;
  }, [rowOrder.length, propertyOrder, properties]);

  const handleColumnResizing = useCallback((propId: string, width: number | null) => {
    setResizingWidths((prev) => {
      if (width === null) {
        if (!prev[propId]) return prev;
        const next = { ...prev };
        delete next[propId];
        return next;
      }
      return { ...prev, [propId]: width };
    });
  }, []);

  const handleFocusCell = useCallback((rowIndex: number, colIndex: number) => {
    setEditingCell(null);
    setFocusedCell({ rowIndex, colIndex });
  }, []);

  const handleStartEdit = useCallback((rowIndex: number, colIndex: number) => {
    setFocusedCell({ rowIndex, colIndex });
    setEditingCell({ rowIndex, colIndex });
  }, []);

  const handleStopEdit = useCallback(() => {
    setEditingCell(null);
  }, []);

  const handleNavigate = useCallback(
    (direction: 'up' | 'down' | 'left' | 'right' | 'next' | 'prev') => {
      setFocusedCell((prev) => {
        const currentR = prev?.rowIndex ?? 0;
        const currentC = prev?.colIndex ?? 0;
        const numRows = rowOrder.length;
        const numCols = propertyOrder.length;

        if (numRows === 0 || numCols === 0) return null;

        let nextR = currentR;
        let nextC = currentC;

        switch (direction) {
          case 'up':
            nextR = Math.max(0, currentR - 1);
            break;
          case 'down':
            nextR = Math.min(numRows - 1, currentR + 1);
            break;
          case 'left':
            nextC = Math.max(0, currentC - 1);
            break;
          case 'right':
            nextC = Math.min(numCols - 1, currentC + 1);
            break;
          case 'next':
            if (currentC + 1 < numCols) {
              nextC = currentC + 1;
            } else if (currentR + 1 < numRows) {
              nextR = currentR + 1;
              nextC = 0;
            }
            break;
          case 'prev':
            if (currentC - 1 >= 0) {
              nextC = currentC - 1;
            } else if (currentR - 1 >= 0) {
              nextR = currentR - 1;
              nextC = numCols - 1;
            }
            break;
        }

        return { rowIndex: nextR, colIndex: nextC };
      });
      setEditingCell(null);
    },
    [rowOrder.length, propertyOrder.length]
  );

  const handleAddRow = () => {
    const titlePropId =
      propertyOrder.find((pid) => properties[pid]?.type === 'title') ||
      propertyOrder[0];
    addDatabaseRow(databaseId, {
      [titlePropId]: `记录 ${rowOrder.length + 1}`,
    });
  };

  return (
    <div
      role="region"
      aria-label="数据表格"
      className="relative w-full overflow-x-auto overflow-y-auto max-h-[600px] border-t border-border-light dark:border-border-dark"
    >
      <table
        role="grid"
        aria-label="多维数据库表格"
        className="w-full min-w-full text-left text-xs border-collapse table-fixed select-none"
      >
        <colgroup>
          {propertyOrder.map((propId) => {
            const prop = properties[propId];
            const width =
              resizingWidths[propId] ?? prop?.width ?? DEFAULT_COLUMN_WIDTH;
            const clamped = Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, width));
            return <col key={propId} style={{ width: `${clamped}px` }} />;
          })}
          <col style={{ width: '40px' }} />
        </colgroup>

        <TableHeader
          databaseId={databaseId}
          propertyOrder={propertyOrder}
          resizingWidths={resizingWidths}
          onColumnResizing={handleColumnResizing}
        />

        <tbody role="rowgroup">
          {rowOrder.length === 0 ? (
            <tr>
              <td
                colSpan={propertyOrder.length + 1 || 1}
                className="px-4 py-8 text-center text-text-muted-light dark:text-text-muted-dark italic"
              >
                <div className="flex flex-col items-center justify-center gap-2">
                  <span>暂无记录，点击下方按钮开始录入数据</span>
                  <button
                    type="button"
                    data-testid="empty-add-row-btn"
                    onClick={handleAddRow}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    添加首行
                  </button>
                </div>
              </td>
            </tr>
          ) : (
            rowOrder.map((rowId, rowIndex) => (
              <TableRow
                key={rowId}
                databaseId={databaseId}
                rowId={rowId}
                rowIndex={rowIndex}
                propertyOrder={propertyOrder}
                focusedCell={focusedCell}
                editingCell={editingCell}
                onFocusCell={handleFocusCell}
                onStartEdit={handleStartEdit}
                onStopEdit={handleStopEdit}
                onNavigate={handleNavigate}
              />
            ))
          )}
        </tbody>
      </table>

      {/* 底部快速添加行栏 */}
      {rowOrder.length > 0 && (
        <div className="p-1 border-t border-border-light/60 dark:border-border-dark/60 bg-neutral-50/40 dark:bg-neutral-900/20">
          <button
            type="button"
            data-testid="table-bottom-add-row-btn"
            onClick={handleAddRow}
            className="inline-flex items-center gap-1 px-3 py-1 text-xs text-text-muted-light dark:text-text-muted-dark hover:text-text-primary-light dark:hover:text-text-primary-dark hover:bg-neutral-100 dark:hover:bg-neutral-800/60 rounded transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>添加行</span>
          </button>
        </div>
      )}
    </div>
  );
};
