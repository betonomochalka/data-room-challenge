import React, { useState, useEffect, useRef } from 'react';
import { DataRoomItem } from '.';
import { Folder } from 'lucide-react';
import { ItemActions } from './ItemActions';
import { PDFPreview } from '../PDFPreview';
import { ImagePreview } from '../ImagePreview';
import { getFileUrl } from '@/lib/api';
import { getFileIconAndColor } from '@/utils/fileIcons';

interface DataRoomItemViewProps {
  item: DataRoomItem;
  onRename: (item: DataRoomItem) => void;
  onDelete: (item: DataRoomItem) => void;
  onView: (item: DataRoomItem) => void;
  isGrid: boolean;
}

const DataRoomItemView: React.FC<DataRoomItemViewProps> = React.memo(({ item, onRename, onDelete, onView, isGrid }) => {
  const isFolder = item.type === 'folder';
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);

  // Get appropriate icon and color for files
  const { Icon, color } = isFolder 
    ? { Icon: Folder, color: 'text-foreground' }
    : getFileIconAndColor(item.mimeType, item.name);

  // Determine file type for preview
  const isPDF = !isFolder && item.type === 'file' && (
    item.mimeType?.includes('pdf') || 
    item.name?.toLowerCase().endsWith('.pdf')
  );

  const isImage = !isFolder && item.type === 'file' && (
    item.mimeType?.startsWith('image/') || 
    ['png', 'jpg', 'jpeg'].includes(item.name?.toLowerCase().split('.').pop() || '')
  );

  // Office files (DOCX, XLSX) don't have previews - they just show icons
  const needsPreview = isPDF || isImage;

  // Use Intersection Observer to only fetch when item is visible
  useEffect(() => {
    if (!isGrid || !needsPreview || hasFetched || !itemRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasFetched) {
            setIsVisible(true);
            setHasFetched(true);
          }
        });
      },
      {
        rootMargin: '50px', // Start loading 50px before item is visible
        threshold: 0.1,
      }
    );

    observer.observe(itemRef.current);

    return () => {
      observer.disconnect();
    };
  }, [isGrid, needsPreview, hasFetched]);

  // Fetch file URL only when item becomes visible
  useEffect(() => {
    if (isVisible && needsPreview && item.id && !fileUrl) {
      getFileUrl(item.id)
        .then((response) => {
          // The API redirects to the signed URL, but axios follows it
          // We need to get the actual URL from the response
          if (response.request?.responseURL) {
            setFileUrl(response.request.responseURL);
          }
        })
        .catch((error) => {
          // Silently fail - don't spam console with errors
          // Preview will just show icon instead
        });
    }
  }, [isVisible, needsPreview, item.id, fileUrl]);

  const handleDoubleClick = () => {
    onView(item);
  };

  if (isGrid) {
    return (
      <div 
        ref={itemRef}
        onDoubleClick={handleDoubleClick} 
        className="cursor-pointer p-2 rounded-lg hover:bg-muted transition-colors border border-transparent hover:border-border"
      >
        <div className="flex items-center justify-center h-32 bg-muted rounded-md overflow-hidden relative group">
          {isPDF && fileUrl ? (
            <PDFPreview 
              fileUrl={fileUrl} 
              width={128} 
              height={128}
              className="w-full h-full"
            />
          ) : isImage && fileUrl ? (
            <ImagePreview 
              fileUrl={fileUrl} 
              width={128} 
              height={128}
              className="w-full h-full"
            />
          ) : (
            <Icon className={`h-16 w-16 transition-colors ${color}`} />
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
      <Icon className={`h-4 w-4 flex-shrink-0 ${color}`} />
      <span className="text-sm truncate flex-1">{item.name}</span>
    </div>
  );
});

export default DataRoomItemView;
