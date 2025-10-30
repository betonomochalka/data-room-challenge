import React, { useState } from 'react';
import { FileText, Edit, Trash2, Eye } from 'lucide-react';
import { Card, CardContent } from '../ui/Card';
import { Folder as FolderType } from '../../types';
import { formatDate, formatBytes } from '../../lib/utils';
import { DataRoomItem } from './columns';
import { ItemActions } from './ItemActions';

interface FilesGridProps {
  files: DataRoomItem[];
  folders: FolderType[];
  isSearching: boolean;
  searchQuery: string;
  onView: (item: DataRoomItem) => void;
  onRename: (item: DataRoomItem) => void;
  onDelete: (item: DataRoomItem) => void;
}

export const FilesGrid: React.FC<FilesGridProps> = ({
  files,
  folders,
  isSearching,
  searchQuery,
  onView,
  onRename,
  onDelete,
}) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: DataRoomItem | null }>({ x: 0, y: 0, item: null });

  const handleContextMenu = (e: React.MouseEvent, item: DataRoomItem) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  };

  const closeContextMenu = () => {
    setContextMenu({ x: 0, y: 0, item: null });
  };

  if (files.length === 0) {
    return null;
  }

  return (
    <div onMouseLeave={closeContextMenu}>
      <h2 className="text-xl font-semibold mb-4">Files</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {files.map((file) => (
          <div key={file.id} onContextMenu={(e) => handleContextMenu(e, file)}>
            <Card className="hover:shadow-xl transition-shadow">
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <div 
                  className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                  onClick={() => onView(file)}
                >
                  <FileText className="h-8 w-8 text-gray-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <h3 className="font-medium truncate">{file.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {file.size ? formatBytes(file.size) : 'Unknown size'} · {formatDate(file.createdAt)}
                      {isSearching && searchQuery.trim() && file.type === 'file' && folders.find(f => f.id === file.folderId) && (
                        <span className="ml-2 text-blue-600">in {folders.find(f => f.id === file.folderId)?.name}</span>
                      )}
                    </p>
                  </div>
                </div>
                <ItemActions
                  item={file}
                  onView={() => onView(file)}
                  onRename={() => onRename(file)}
                  onDelete={() => onDelete(file)}
                />
              </div>
            </CardContent>
          </Card>
          </div>
        ))}
      </div>
      {contextMenu.item && (
        <div
          className="fixed z-50 bg-popover border border-border rounded-md shadow-md p-1"
          style={{
            top: contextMenu.y,
            left: contextMenu.x,
          }}
          onClick={closeContextMenu}
        >
          <div
            onClick={() => onView(contextMenu.item!)}
            className="flex items-center px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded"
          >
            <Eye className="h-4 w-4 mr-2" />
            <span>View</span>
          </div>
          <div className="h-px bg-border my-1" />
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
};

