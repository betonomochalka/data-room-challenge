import React, { useState, useMemo, useRef } from 'react';
import { DataRoomItem } from '@/components/DataRoomView';
import { ChevronRight, ChevronDown, Folder, File as FileIcon, Edit, Trash2 } from 'lucide-react';
import { useFileViewer, useDataRoomData } from '@/hooks';
import { useParams, useNavigate } from 'react-router-dom';
import { fileTreeEvents } from '@/lib/events';

interface TreeNodeProps {
  item: DataRoomItem;
  level: number;
}

const TreeNode: React.FC<TreeNodeProps> = ({ item, level }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const { handleFileView } = useFileViewer();
  const { id: dataRoomId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const triggerRef = useRef<HTMLDivElement>(null);

  const isFolder = item.type === 'folder';

  const { folderQuery } = useDataRoomData({
    dataRoomId: dataRoomId,
    folderId: isFolder && isOpen ? item.id : undefined,
  });
  const { data: contents, isLoading } = folderQuery || {};

  const children = useMemo(() => {
    if (!contents?.data) return [];
    const folders = contents.data.children || [];
    const files = contents.data.files || [];
    
    const combined: DataRoomItem[] = [
      ...folders.map((f: any) => ({ ...f, type: 'folder' as const, size: null })),
      ...files.map((f: any) => ({ ...f, type: 'file' as const, size: Number(f.fileSize) || 0 })),
    ];

    return combined.sort((a, b) => {
      if (a.type === 'folder' && b.type === 'file') return -1;
      if (a.type === 'file' && b.type === 'folder') return 1;
      return a.name.localeCompare(b.name);
    });
  }, [contents]);

  const handleFileClick = () => {
    if (item.type === 'file') {
      handleFileView(item.id);
    }
  };

  const handleFolderNavigation = () => {
    navigate(`/data-rooms/${dataRoomId}/folders/${item.id}`);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  return (
    <div>
      <div
        ref={triggerRef}
        className="flex items-center p-1 cursor-pointer hover:bg-muted rounded relative"
        style={{ paddingLeft: `${level * 20}px` }}
        onContextMenu={handleContextMenu}
      >
        <div onClick={() => setIsOpen(!isOpen)} className="flex-shrink-0">
          {isFolder && (
            isOpen ? <ChevronDown className="h-4 w-4 mr-1" /> : <ChevronRight className="h-4 w-4 mr-1" />
          )}
        </div>
        <div 
          onClick={isFolder ? handleFolderNavigation : handleFileClick}
          className="flex items-center flex-grow"
        >
          {isFolder ? (
            <Folder className="h-4 w-4 mr-2" />
          ) : (
            <FileIcon className="h-4 w-4 mr-2" style={{ marginLeft: isFolder ? 0 : '1.25rem' }} />
          )}
          <span>{item.name}</span>
        </div>
      </div>

      {/* Context Menu */}
      {showContextMenu && (
        <div
          className="fixed z-50"
          style={{
            left: `${contextMenuPos.x}px`,
            top: `${contextMenuPos.y}px`,
          }}
          onClick={() => setShowContextMenu(false)}
          onMouseLeave={() => setShowContextMenu(false)}
        >
          <div className="bg-popover border border-border rounded-md shadow-md p-1">
            {item.type === 'file' && (
              <>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFileClick();
                    setShowContextMenu(false);
                  }}
                  className="flex items-center px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded"
                >
                  <FileIcon className="h-4 w-4 mr-2" />
                  <span>View</span>
                </div>
                <div className="h-px bg-border my-1" />
              </>
            )}
            <div
              onClick={(e) => {
                e.stopPropagation();
                fileTreeEvents.publish('renameItem', item);
                setShowContextMenu(false);
              }}
              className="flex items-center px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded"
            >
              <Edit className="h-4 w-4 mr-2" />
              <span>Rename</span>
            </div>
            <div className="h-px bg-border my-1" />
            <div
              onClick={(e) => {
                e.stopPropagation();
                fileTreeEvents.publish('deleteItem', item);
                setShowContextMenu(false);
              }}
              className="flex items-center px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              <span>Delete</span>
            </div>
          </div>
        </div>
      )}

      {isFolder && isOpen && (
        isLoading ? <div style={{ paddingLeft: `${(level + 1) * 20}px` }}>Loading...</div> :
        <div>
          {children.map((child) => (
            <TreeNode
              key={child.id}
              item={child}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default TreeNode;
