import React, { useState } from 'react';
import { Folder, Edit, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../ui/Card';
import { DataRoomItem } from './columns';
import { ItemActions } from './ItemActions';
import { formatDate } from '../../lib/utils';

interface FoldersGridProps {
  folders: DataRoomItem[];
  dataRoomId: string;
  onRename: (item: DataRoomItem) => void;
  onDelete: (item: DataRoomItem) => void;
}

export const FoldersGrid: React.FC<FoldersGridProps> = ({
  folders,
  dataRoomId,
  onRename,
  onDelete,
}) => {
  const navigate = useNavigate();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: DataRoomItem | null }>({ x: 0, y: 0, item: null });

  const handleContextMenu = (e: React.MouseEvent, item: DataRoomItem) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  };

  const closeContextMenu = () => {
    setContextMenu({ x: 0, y: 0, item: null });
  };

  if (folders.length === 0) {
    return null;
  }

  return (
    <div onMouseLeave={closeContextMenu}>
      <h2 className="text-lg font-semibold mb-3">Folders</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {folders.map((folder) => (
          <div key={folder.id} onContextMenu={(e) => handleContextMenu(e, folder)}>
            <Card
              className="hover:shadow-md transition-shadow"
            >
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <div 
                    className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                    onClick={() => navigate(`/data-rooms/${dataRoomId}/folders/${folder.id}`)}
                  >
                    <Folder className="h-8 w-8 text-blue-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <h3 className="font-medium truncate">{folder.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        Modified {formatDate(folder.updatedAt)}
                      </p>
                    </div>
                  </div>
                  <ItemActions
                    item={folder}
                    onRename={() => onRename(folder)}
                    onDelete={() => onDelete(folder)}
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

