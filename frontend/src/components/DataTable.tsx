import * as React from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  SortingState,
  Row,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { DataRoomItem } from './DataRoomView';
import { Eye, Edit, Trash2 } from 'lucide-react';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  onView: (item: TData) => void;
  onRename: (item: TData) => void;
  onDelete: (item: TData) => void;
}

export function DataTable<TData extends DataRoomItem, TValue>({
  columns,
  data,
  onView,
  onRename,
  onDelete,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [contextMenu, setContextMenu] = React.useState<{ x: number; y: number; item: TData | null }>({ x: 0, y: 0, item: null });

  const handleContextMenu = (e: React.MouseEvent, row: Row<TData>) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, item: row.original });
  };

  const closeContextMenu = () => {
    setContextMenu({ x: 0, y: 0, item: null });
  };

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
  });

  return (
    <div className="rounded-md border" onMouseLeave={closeContextMenu}>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                return (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && 'selected'}
                onContextMenu={(e) => handleContextMenu(e, row)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {contextMenu.item && (
        <div
          className="fixed z-50 bg-popover border border-border rounded-md shadow-md p-1"
          style={{
            top: contextMenu.y,
            left: contextMenu.x,
          }}
          onClick={closeContextMenu}
        >
          {contextMenu.item.type === 'file' && (
            <div
              onClick={() => onView(contextMenu.item!)}
              className="flex items-center px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded"
            >
              <Eye className="h-4 w-4 mr-2" />
              <span>View</span>
            </div>
          )}
          {contextMenu.item.type === 'file' && <div className="h-px bg-border my-1" />}
          <div
            onClick={() => onRename(contextMenu.item!)}
            className="flex items-center px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded"
          >
            <Edit className="h-4 w-4 mr-2" />
            <span>Rename</span>
          </div>
          <div className="h-px bg-border my-1" />
          <div
            onClick={() => onDelete(contextMenu.item!)}
            className="flex items-center px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            <span>Delete</span>
          </div>
        </div>
      )}
    </div>
  );
}
