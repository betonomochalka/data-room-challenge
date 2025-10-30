import React, { useState, useEffect } from 'react';
import { DataRoomItem } from '.';
import { Folder, FileText } from 'lucide-react';
import { ItemActions } from './ItemActions';
import { PDFPreview } from '../PDFPreview';
import { getFileUrl } from '@/lib/api';

interface DataRoomItemViewProps {
  item: DataRoomItem;
  onRename: (item: DataRoomItem) => void;
  onDelete: (item: DataRoomItem) => void;
  onView: (item: DataRoomItem) => void;
  isGrid: boolean;
}

const DataRoomItemView: React.FC<DataRoomItemViewProps> = React.memo(({ item, onRename, onDelete, onView, isGrid }) => {
  const isFolder = item.type === 'folder';
  const Icon = isFolder ? Folder : FileText;
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // Check if file is PDF
  const isPDF = !isFolder && item.type === 'file' && (
    item.mimeType?.includes('pdf') || 
    item.name?.toLowerCase().endsWith('.pdf')
  );

  useEffect(() => {
    // Fetch PDF URL for preview
    if (isPDF && item.id) {
      getFileUrl(item.id)
        .then((response) => {
          // The API redirects to the signed URL, but axios follows it
          // We need to get the actual URL from the response
          if (response.request?.responseURL) {
            setPdfUrl(response.request.responseURL);
          }
        })
        .catch((error) => {
          console.error('Failed to fetch PDF URL:', error);
        });
    }
  }, [isPDF, item.id]);

  const handleDoubleClick = () => {
    onView(item);
  };

  if (isGrid) {
    return (
      <div 
        onDoubleClick={handleDoubleClick} 
        className="cursor-pointer p-2 rounded-lg hover:bg-accent transition-colors border border-transparent hover:border-border"
      >
        <div className="flex items-center justify-center h-32 bg-muted rounded-md overflow-hidden relative group">
          {isPDF && pdfUrl ? (
            <PDFPreview 
              fileUrl={pdfUrl} 
              width={128} 
              height={128}
              className="w-full h-full"
            />
          ) : (
            <Icon 
              className={`h-16 w-16 transition-colors ${
                isFolder 
                  ? 'text-yellow-500' 
                  : 'text-red-500'
              }`} 
            />
          )}
        </div>
        <div className="mt-2 flex items-center justify-between gap-1">
          <span className="text-sm font-medium truncate flex-1" title={item.name}>
            {item.name}
          </span>
          <ItemActions item={item} onRename={() => onRename(item)} onDelete={() => onDelete(item)} />
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="flex items-center gap-2 p-2">
      <Icon 
        className={`h-4 w-4 flex-shrink-0 ${
          isFolder ? 'text-yellow-500' : 'text-red-500'
        }`} 
      />
      <span className="text-sm truncate flex-1">{item.name}</span>
    </div>
  );
});

export default DataRoomItemView;
