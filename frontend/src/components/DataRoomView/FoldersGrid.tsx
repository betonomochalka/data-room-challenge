import React from 'react';
import { DataRoomItem } from './columns';
import DataRoomItemView from './DataRoomItemView';

interface FoldersGridProps {
  folders: Extract<DataRoomItem, { type: 'folder' }>[];
  onRename: (item: DataRoomItem) => void;
  onDelete: (item: DataRoomItem) => void;
  onView: (item: DataRoomItem) => void;
}

export const FoldersGrid: React.FC<FoldersGridProps> = ({ folders, onRename, onDelete, onView }) => {
  if (folders.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold mb-4">Folders</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {folders.map((folder) => (
          <DataRoomItemView
            key={folder.id}
            item={folder}
            onRename={onRename}
            onDelete={onDelete}
            onView={onView}
            isGrid={true}
          />
        ))}
      </div>
    </div>
  );
};

