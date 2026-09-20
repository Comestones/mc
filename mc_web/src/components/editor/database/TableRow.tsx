import React from 'react';
import { useWorkspaceStore } from '../../../store/useWorkspaceStore';
import { TableCell } from './TableCell';
import { cn } from '../../../utils/cn';

export interface TableRowProps {
  databaseId: string;
  rowId: string;
  rowIndex: number;
  propertyOrder: string[];
  focusedCell: { rowIndex: number; colIndex: number } | null;
  editingCell: { rowIndex: number; colIndex: number } | null;
  onFocusCell: (rowIndex: number, colIndex: number) => void;
  onStartEdit: (rowIndex: number, colIndex: number) => void;
  onStopEdit: () => void;
  onNavigate: (direction: 'up' | 'down' | 'left' | 'right' | 'next' | 'prev') => void;
}

export const TableRow: React.FC<TableRowProps> = ({
  databaseId,
  rowId,
  rowIndex,
  propertyOrder,
  focusedCell,
  editingCell,
  onFocusCell,
  onStartEdit,
  onStopEdit,
  onNavigate,
}) => {
  const row = useWorkspaceStore(
    (state) => state.databases[databaseId]?.rows[rowId]
  );

  if (!row) return null;

  return (
    <tr
      role="row"
      data-row-id={rowId}
      data-row-index={rowIndex}
      className={cn(
        'border-b border-border-light/60 dark:border-border-dark/60 transition-colors',
        'hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30',
        rowIndex % 2 === 1 ? 'bg-neutral-50/20 dark:bg-neutral-900/10' : 'bg-transparent'
      )}
    >
      {propertyOrder.map((propId, colIndex) => {
        const isFocused =
          focusedCell?.rowIndex === rowIndex && focusedCell?.colIndex === colIndex;
        const isEditing =
          editingCell?.rowIndex === rowIndex && editingCell?.colIndex === colIndex;
        const isRovingTabStop = focusedCell
          ? isFocused
          : rowIndex === 0 && colIndex === 0;

        return (
          <TableCell
            key={propId}
            databaseId={databaseId}
            rowId={rowId}
            propertyId={propId}
            rowIndex={rowIndex}
            colIndex={colIndex}
            isFocused={isFocused}
            isRovingTabStop={isRovingTabStop}
            isEditing={isEditing}
            onFocusCell={onFocusCell}
            onStartEdit={onStartEdit}
            onStopEdit={onStopEdit}
            onNavigate={onNavigate}
          />
        );
      })}
      <td className="border-b border-border-light/60 dark:border-border-dark/60" />
    </tr>
  );
};
