"use client"

import { ColumnDef, CellContext, HeaderContext } from "@tanstack/react-table"
import { ArrowUpDown, Folder, FileText as PdfIcon, MoreHorizontal, Eye, Edit, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/Button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu"
import { File, Folder as IFolder } from "@/types"
import { formatBytes, formatDate } from "@/lib/utils"

// Merged type for table and grid views
export type DataRoomItem = (IFolder & { type: 'folder', size: null }) | (File & { type: 'file', size: number });

export const getColumns = (
  onView: (item: DataRoomItem) => void,
  onRename: (item: DataRoomItem) => void,
  onDelete: (item: DataRoomItem) => void,
  onFolderClick?: (item: DataRoomItem) => void
): ColumnDef<DataRoomItem>[] => [
  {
    accessorKey: "name",
    header: ({ column }: HeaderContext<DataRoomItem, unknown>) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }: CellContext<DataRoomItem, unknown>) => {
      const item = row.original;
      const isFolder = item.type === 'folder';
      const Icon = isFolder ? Folder : PdfIcon;
      
      const handleClick = () => {
        if (isFolder && onFolderClick) {
          onFolderClick(item);
        } else if (!isFolder) {
          onView(item);
        }
      };
      
      return (
        <div 
          className="flex items-center gap-2 cursor-pointer hover:text-foreground"
          onClick={handleClick}
        >
          <Icon className={`h-4 w-4 ${isFolder ? 'text-yellow-500' : 'text-red-500'}`} />
          <span>{item.name}</span>
        </div>
      );
    },
  },
  {
    accessorKey: "updatedAt",
    header: ({ column }: HeaderContext<DataRoomItem, unknown>) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Date Modified
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }: CellContext<DataRoomItem, unknown>) => {
      return <div>{formatDate(row.original.updatedAt)}</div>;
    },
  },
  {
    accessorKey: "size",
    header: ({ column }: HeaderContext<DataRoomItem, unknown>) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            File Size
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
    cell: ({ row }: CellContext<DataRoomItem, unknown>) => {
      const item = row.original;
      if (item.type === 'folder') {
        return <div className="text-right">-</div>;
      }
      return <div className="text-right">{formatBytes(item.size)}</div>;
    },
  },
  {
    id: "actions",
    cell: ({ row }: CellContext<DataRoomItem, unknown>) => {
      const item = row.original

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {item.type === 'file' && (
              <DropdownMenuItem onClick={() => onView(item)}>
                <Eye className="mr-2 h-4 w-4" />
                View
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onRename(item)}>
              <Edit className="mr-2 h-4 w-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDelete(item)} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
    enableSorting: false,
    enableHiding: false,
  }
]
