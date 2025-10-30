import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataRoomItem } from './columns';
import { getColumns } from './columns';
import DataRoomItemView from './DataRoomItemView';
import { useFileViewer } from '@/hooks';
import { DataTable } from '@/components/DataTable';

interface ItemRendererProps {
  items: DataRoomItem[];
  viewMode: 'grid' | 'list';
  onRename: (item: DataRoomItem) => void;
  onDelete: (item: DataRoomItem) => void;
  dataRoomId: string;
}

export const ItemRenderer: React.FC<ItemRendererProps> = ({ items, viewMode, onRename, onDelete, dataRoomId }) => {
  const { handleFileView } = useFileViewer();
  const navigate = useNavigate();

  const handleView = useCallback((item: DataRoomItem) => {
    if (item.type === 'folder') {
      navigate(`/data-rooms/${dataRoomId}/folders/${item.id}`);
    } else {
      handleFileView(item);
    }
  }, [navigate, handleFileView, dataRoomId]);

  if (viewMode === 'list') {
    const columns = getColumns(handleView, onRename, onDelete, handleView);
    return <DataTable columns={columns} data={items} onView={handleView} onRename={onRename} onDelete={onDelete} />;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {items.map((item) => (
        <DataRoomItemView
          key={item.id}
          item={item}
          onRename={onRename}
          onDelete={onDelete}
          onView={handleView}
          isGrid={true}
        />
      ))}
    </div>
  );
};
