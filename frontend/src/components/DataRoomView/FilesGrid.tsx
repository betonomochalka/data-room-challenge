import React from 'react';
import { DataRoomItem } from './columns';
import DataRoomItemView from './DataRoomItemView';

interface FilesGridProps {
  files: Extract<DataRoomItem, { type: 'file' }>[];
  onRename: (item: DataRoomItem) => void;
  onDelete: (item: DataRoomItem) => void;
  onView: (item: DataRoomItem) => void;
}

export const FilesGrid: React.FC<FilesGridProps> = ({ files, onRename, onDelete, onView }) => {
  if (files.length === 0) {
    return null;
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Files</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {files.map((file) => (
          <DataRoomItemView
            key={file.id}
            item={file}
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

