import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ChevronRightIcon,
  ChevronDownIcon,
  FolderIcon,
  EllipsisVerticalIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import { useDataRoomData } from '@/hooks';
import { DataRoomItem } from '@/components/DataRoomView';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { DataRoom } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useFileViewer } from '@/hooks/useFileViewer';
import { useDataRoomMutations } from '@/hooks/useDataRoomMutations';
import { getFileIconHeroicons, FolderIcon as FolderIconHeroicons } from '@/utils/fileIconsHeroicons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { resolvePathToFolderId, buildFolderUrlFromId } from '@/utils/folderPaths';
import { cn } from '@/lib/utils';

interface TreeNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  data: DataRoomItem;
  children?: TreeNode[];
  parentId?: string | null;
}

interface TreeNodeComponentProps {
  node: TreeNode;
  level: number;
  isOpen: boolean;
  onToggle: (nodeId: string) => void;
  onNodeClick: (node: TreeNode) => void;
  openFolders: Set<string>;
  currentFolderId?: string | null;
  renameFolderMutation: any;
  renameFileMutation: any;
  deleteFolderMutation: any;
  deleteFileMutation: any;
  handleFileView: (item: DataRoomItem) => void;
  onRename: (node: TreeNode) => void;
  onDelete: (node: TreeNode) => void;
  isLast?: boolean;
  parentPath?: boolean[];
}

const TreeNodeComponent: React.FC<TreeNodeComponentProps> = ({
  node,
  level,
  isOpen,
  onToggle,
  onNodeClick,
  openFolders,
  currentFolderId,
  renameFolderMutation,
  renameFileMutation,
  deleteFolderMutation,
  deleteFileMutation,
  handleFileView,
  onRename,
  onDelete,
  isLast = false,
  parentPath = [],
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(node.name);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const isFolder = node.type === 'folder';
  const Icon = isFolder
    ? FolderIconHeroicons
    : getFileIconHeroicons(
        node.data.type === 'file' ? node.data.mimeType : null,
        node.name
      );
  const isCurrentFolder = currentFolderId === node.id;
  const hasChildren = node.children && node.children.length > 0;

  // Handle rename
  const handleRenameSubmit = useCallback(() => {
    try {
      if (newName.trim() && newName !== node.name) {
        if (isFolder) {
          renameFolderMutation.mutate(
            { id: node.id, name: newName.trim() },
            {
              onError: (error: any) => {
                // API issues
                if (error?.response) {
                  console.error('[API Error] Failed to rename folder:', {
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    data: error.response?.data,
                    folderId: node.id,
                    newName: newName.trim(),
                  });
                } else {
                  // Unexpected errors
                  console.error('[Unexpected Error] Failed to rename folder:', {
                    error,
                    folderId: node.id,
                    newName: newName.trim(),
                  });
                }
              },
            }
          );
        } else {
          renameFileMutation.mutate(
            { id: node.id, name: newName.trim() },
            {
              onError: (error: any) => {
                // API issues
                if (error?.response) {
                  console.error('[API Error] Failed to rename file:', {
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    data: error.response?.data,
                    fileId: node.id,
                    newName: newName.trim(),
                  });
                } else {
                  // Unexpected errors
                  console.error('[Unexpected Error] Failed to rename file:', {
                    error,
                    fileId: node.id,
                    newName: newName.trim(),
                  });
                }
              },
            }
          );
        }
      }
      setIsRenaming(false);
      setNewName(node.name);
    } catch (error) {
      // Unexpected errors
      console.error('[Unexpected Error] Error in handleRenameSubmit:', error);
      setIsRenaming(false);
      setNewName(node.name);
    }
  }, [newName, node.name, node.id, isFolder, renameFolderMutation, renameFileMutation]);

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleRenameSubmit();
      } else if (e.key === 'Escape') {
        setIsRenaming(false);
        setNewName(node.name);
      }
    },
    [handleRenameSubmit, node.name]
  );

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isRenaming) return;
      // Don't handle click if clicking on the menu button or dropdown menu
      const target = e.target as HTMLElement;
      const isDropdownClick = 
        target.closest('[data-radix-dropdown-menu-trigger]') ||
        target.closest('[data-radix-dropdown-menu-content]') ||
        target.closest('[data-radix-dropdown-menu-item]') ||
        target.closest('button[aria-haspopup="menu"]') ||
        target.closest('.dropdown-menu-trigger');
      
      if (isDropdownClick) {
        return;
      }
      if (isFolder) {
        onToggle(node.id);
        onNodeClick(node);
      } else {
        handleFileView(node.data);
      }
    },
    [isFolder, isRenaming, node, onToggle, onNodeClick, handleFileView]
  );

  const handleRename = useCallback(() => {
    try {
      setIsRenaming(true);
      setNewName(node.name);
    } catch (error) {
      // Error handled silently
    }
  }, [node.name]);

  const handleDelete = useCallback(() => {
    try {
      if (isFolder) {
        deleteFolderMutation.mutate(node.id, {
          onError: (error: any) => {
            // API issues
            if (error?.response) {
              console.error('[API Error] Failed to delete folder:', {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                folderId: node.id,
                folderName: node.name,
              });
            } else {
              // Unexpected errors
              console.error('[Unexpected Error] Failed to delete folder:', {
                error,
                folderId: node.id,
                folderName: node.name,
              });
            }
          },
        });
      } else {
        deleteFileMutation.mutate(node.id, {
          onError: (error: any) => {
            // API issues
            if (error?.response) {
              console.error('[API Error] Failed to delete file:', {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                fileId: node.id,
                fileName: node.name,
              });
            } else {
              // Unexpected errors
              console.error('[Unexpected Error] Failed to delete file:', {
                error,
                fileId: node.id,
                fileName: node.name,
              });
            }
          },
        });
      }
    } catch (error) {
      // Unexpected errors
      console.error('[Unexpected Error] Error in handleDelete:', error);
    }
  }, [isFolder, node.id, node.name, deleteFolderMutation, deleteFileMutation]);

  const handleView = useCallback(() => {
    try {
      if (!isFolder) {
        handleFileView(node.data);
      }
    } catch (error: any) {
      // API issues
      if (error?.response) {
        console.error('[API Error] Failed to view file:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          fileId: node.id,
          fileName: node.name,
        });
      } else {
        // Unexpected errors
        console.error('[Unexpected Error] Failed to view file:', {
          error,
          fileId: node.id,
          fileName: node.name,
        });
      }
    }
  }, [isFolder, node.data, node.id, node.name, handleFileView]);

  // Calculate indent for tree lines
  const indent = level * 20;
  const currentPath = [...parentPath, !isLast];

  return (
    <div className="relative">
      <div
        className={cn(
          'group flex items-center gap-1 px-2 py-1 rounded hover:bg-muted transition-colors cursor-pointer relative z-10',
          isCurrentFolder && 'bg-muted'
        )}
        style={{ paddingLeft: `${indent + 8}px` }}
        onMouseEnter={() => {
          setIsHovered(true);
        }}
        onMouseLeave={(e) => {
          const relatedTarget = e.relatedTarget as HTMLElement | null;
          // Don't hide if dropdown is open or mouse is moving to dropdown area
          if (!isDropdownOpen && relatedTarget && relatedTarget.closest && 
              !relatedTarget.closest('[data-radix-dropdown-menu-content]') && 
              !relatedTarget.closest('.dropdown-menu-trigger')) {
            setIsHovered(false);
          } else if (!isDropdownOpen && !relatedTarget) {
            // If relatedTarget is null and dropdown is closed, hide
            setIsHovered(false);
          }
        }}
        onClick={handleClick}
      >
        {/* Vertical indent guides */}
        {level > 0 && (
          <>
            {/* Vertical guide lines for each level of nesting */}
            {Array.from({ length: level }).map((_, idx) => {
              return (
                <div
                  key={idx}
                  className="absolute border-l border-border/20"
                  style={{
                    left: `${idx * 20 + 4}px`,
                    top: 0,
                    bottom: 0,
                    width: '1px',
                    pointerEvents: 'none',
                  }}
                />
              );
            })}
          </>
        )}

        {/* Chevron for folders */}
        {isFolder ? (
          <button
            className="flex-shrink-0 w-4 h-4 flex items-center justify-center hover:bg-background rounded"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.id);
            }}
          >
            {isOpen ? (
              <ChevronDownIcon className="h-4 w-4 text-foreground" />
            ) : (
              <ChevronRightIcon className="h-4 w-4 text-foreground" />
            )}
          </button>
        ) : (
          <div className="w-4 h-4 flex-shrink-0" />
        )}

        {/* Icon */}
        <Icon className="h-4 w-4 text-foreground flex-shrink-0" />

        {/* Name */}
        {isRenaming ? (
          <input
            ref={renameInputRef}
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={handleRenameKeyDown}
            className="flex-1 min-w-0 px-1 py-0.5 text-sm bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="flex-1 min-w-0 text-sm text-foreground truncate" title={node.name}>
            {node.name}
          </span>
        )}

        {/* Three dots menu - always reserve space to prevent layout shift */}
        <div 
          className="flex-shrink-0 w-6 flex items-center justify-center"
          onClick={(e) => {
            e.stopPropagation();
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
          onMouseEnter={() => {
            if (!isRenaming) {
              setIsHovered(true);
            }
          }}
          onMouseLeave={(e) => {
            // Only hide if dropdown is not open and mouse is not moving to dropdown content
            const relatedTarget = e.relatedTarget as HTMLElement | null;
            if (!isDropdownOpen && relatedTarget && relatedTarget.closest && 
                !relatedTarget.closest('[data-radix-dropdown-menu-content]')) {
              setIsHovered(false);
            } else if (!isDropdownOpen && !relatedTarget) {
              // If relatedTarget is null and dropdown is closed, hide
              setIsHovered(false);
            }
          }}
        >
          {(isHovered || isDropdownOpen) && !isRenaming && (
            <DropdownMenu open={isDropdownOpen} onOpenChange={(open) => {
              setIsDropdownOpen(open);
              // Keep hovered state when dropdown opens
              if (open) {
                setIsHovered(true);
              } else {
                // When closing, check if we should hide
                setTimeout(() => {
                  if (!isHovered) {
                    setIsHovered(false);
                  }
                }, 100);
              }
            }}>
              <DropdownMenuTrigger asChild>
                <button
                  className="dropdown-menu-trigger p-0.5 hover:bg-background rounded w-5 h-5 flex items-center justify-center"
                >
                  <EllipsisVerticalIcon className="h-3 w-3 text-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="end" 
                onClick={(e) => {
                  e.stopPropagation();
                }}
                onMouseEnter={() => {
                  setIsHovered(true);
                }}
                onMouseLeave={(e) => {
                  const relatedTarget = e.relatedTarget as HTMLElement | null;
                  // Only hide if mouse is not moving to another dropdown element
                  if (relatedTarget && relatedTarget.closest) {
                    if (!relatedTarget.closest('[data-radix-dropdown-menu-content]') && 
                        !relatedTarget.closest('.dropdown-menu-trigger')) {
                      setIsHovered(false);
                    }
                  } else {
                    // If relatedTarget is null, hide
                    setIsHovered(false);
                  }
                }}
              >
                {!isFolder && (
                  <DropdownMenuItem onClick={handleView}>
                    <EyeIcon className="mr-2 h-4 w-4" />
                    View
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleRename}>
                  <PencilIcon className="mr-2 h-4 w-4" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                  <TrashIcon className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Children */}
      {isFolder && isOpen && hasChildren && (
        <div className="relative">
          {node.children!.map((child, index) => (
            <TreeNodeComponent
              key={child.id}
              node={child}
              level={level + 1}
              isOpen={openFolders.has(child.id)}
              onToggle={onToggle}
              onNodeClick={onNodeClick}
              openFolders={openFolders}
              currentFolderId={currentFolderId}
              renameFolderMutation={renameFolderMutation}
              renameFileMutation={renameFileMutation}
              deleteFolderMutation={deleteFolderMutation}
              deleteFileMutation={deleteFileMutation}
              handleFileView={handleFileView}
              onRename={handleRename}
              onDelete={handleDelete}
              isLast={index === node.children!.length - 1}
              parentPath={currentPath}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const FileTree: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { handleFileView } = useFileViewer();
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
  
  // Fetch user's Data Room automatically
  const { data: dataRoomResponse } = useQuery<{ success: boolean; data: DataRoom }>({
    queryKey: ['dataRooms'],
    queryFn: async () => {
      try {
      const response = await api.get('/data-rooms');
      return response.data;
      } catch (error: any) {
        // API issues
        if (error?.response) {
          console.error('[API Error] Failed to fetch data rooms:', {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
          });
          // Auth issues (401/403)
          if (error.response?.status === 401 || error.response?.status === 403) {
            console.error('[Auth Error] Unauthorized access to data rooms:', {
              status: error.response?.status,
              message: error.response?.data?.message || 'Authentication required',
            });
          }
        } else {
          // Unexpected errors
          console.error('[Unexpected Error] Failed to fetch data rooms:', error);
        }
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const dataRoomId = dataRoomResponse?.data?.id;
  const { foldersQuery, filesQuery } = useDataRoomData({ 
    dataRoomId,
    enableAllFolders: true,  // Enable when FileTree mounts
    enableAllFiles: true     // Enable when FileTree mounts
  });
  const { renameFolderMutation, renameFileMutation, deleteFolderMutation, deleteFileMutation } =
    useDataRoomMutations({ dataRoomId });

  // Handle query errors
  useEffect(() => {
    if (foldersQuery.isError && foldersQuery.error) {
      const error: any = foldersQuery.error;
      // API issues
      if (error?.response) {
        console.error('[API Error] Failed to fetch folders:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          dataRoomId,
        });
        // Auth issues (401/403)
        if (error.response?.status === 401 || error.response?.status === 403) {
          console.error('[Auth Error] Unauthorized access to folders:', {
            status: error.response?.status,
            message: error.response?.data?.message || 'Authentication required',
          });
        }
      } else {
        // Unexpected errors
        console.error('[Unexpected Error] Failed to fetch folders:', error);
      }
    }
  }, [foldersQuery.isError, foldersQuery.error, dataRoomId]);

  useEffect(() => {
    if (filesQuery.isError && filesQuery.error) {
      const error: any = filesQuery.error;
      // API issues
      if (error?.response) {
        console.error('[API Error] Failed to fetch files:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          dataRoomId,
        });
        // Auth issues (401/403)
        if (error.response?.status === 401 || error.response?.status === 403) {
          console.error('[Auth Error] Unauthorized access to files:', {
            status: error.response?.status,
            message: error.response?.data?.message || 'Authentication required',
          });
        }
      } else {
        // Unexpected errors
        console.error('[Unexpected Error] Failed to fetch files:', error);
      }
    }
  }, [filesQuery.isError, filesQuery.error, dataRoomId]);

  // Get current folder path from URL and resolve to folder ID
  const folderPath = useMemo(() => {
    // Safety check: ensure location and pathname exist
    if (!location || !location.pathname) return '';
    const match = location.pathname.match(/^\/folders\/(.+)$/);
    return match ? match[1] : '';
  }, [location?.pathname]);

  const folders = useMemo(() => {
    return foldersQuery.data?.data?.folders || [];
  }, [foldersQuery.data?.data?.folders]);

  const currentFolderId = useMemo(() => {
    if (!folderPath) return null;
    return resolvePathToFolderId(folderPath, folders) || null;
  }, [folderPath, folders]);

  // Build tree structure
  const treeData = useMemo(() => {
    if (!foldersQuery.data?.data?.folders || !filesQuery.data?.data) {
      return null;
    }

    const folders = foldersQuery.data.data.folders;
    const files = filesQuery.data.data;

    // Create maps for quick lookup
    const foldersMap = new Map<string, any>();
    folders.forEach((folder: any) => {
      foldersMap.set(folder.id, folder);
    });

    const filesByFolderId = new Map<string, any[]>();
    files.forEach((file: any) => {
      if (file && file.folderId) {
        if (!filesByFolderId.has(file.folderId)) {
          filesByFolderId.set(file.folderId, []);
        }
        filesByFolderId.get(file.folderId)!.push(file);
      }
    });

    // Recursive function to build tree nodes
    const buildTreeNode = (folderId: string | null): TreeNode[] => {
      const children: TreeNode[] = [];

      // Add folders
      folders.forEach((folder: any) => {
        if (folder.parentId === folderId) {
          const folderChildren = buildTreeNode(folder.id);
          
          // Add files in this folder
          const folderFiles = filesByFolderId.get(folder.id) || [];
          folderFiles.forEach((file: any) => {
            folderChildren.push({
              id: file.id,
              name: file.name,
              type: 'file',
              data: { ...file, type: 'file', size: Number(file.fileSize) || 0 } as DataRoomItem,
              parentId: folder.id,
            });
          });

          children.push({
            id: folder.id,
            name: folder.name,
            type: 'folder',
            data: { ...folder, type: 'folder', size: null } as DataRoomItem,
            children: folderChildren.length > 0 ? folderChildren : undefined,
            parentId: folderId,
          });
        }
      });

      // Add root-level files
      if (folderId === null) {
        const rootFiles = files.filter((file: any) => !file.folderId);
        rootFiles.forEach((file: any) => {
          children.push({
            id: file.id,
            name: file.name,
            type: 'file',
            data: { ...file, type: 'file', size: Number(file.fileSize) || 0 } as DataRoomItem,
            parentId: null,
          });
        });
      }

      // Sort: folders first, then files, both alphabetically
      return children.sort((a, b) => {
        if (a.type === 'folder' && b.type === 'file') return -1;
        if (a.type === 'file' && b.type === 'folder') return 1;
        return a.name.localeCompare(b.name);
      });
    };

    const rootChildren = buildTreeNode(null);
    return rootChildren;
  }, [foldersQuery.data, filesQuery.data]);

  // Get root folder name
  const rootFolderName = useMemo(() => {
    try {
      if (!user) {
        // Auth issues - user not authenticated (could be Supabase session issue)
        console.error('[Auth Error] User is not authenticated');
        return 'Data Room';
      }
      if (user?.name) {
        const cleanedName = user.name.replace(/\s*\([^)]*\)\s*$/, '').trim();
        return `Data Room (${cleanedName})`;
      }
      return 'Data Room';
    } catch (error: any) {
      // Unexpected errors or Supabase issues
      if (error?.message?.includes('supabase') || error?.code?.includes('SUPABASE')) {
        console.error('[Supabase Error] Error getting user data:', {
          error,
          message: error.message,
          code: error.code,
        });
      } else {
        console.error('[Unexpected Error] Error getting root folder name:', error);
      }
      return 'Data Room';
    }
  }, [user]);

  // Auto-open folders when navigating to them
  useEffect(() => {
    if (currentFolderId && foldersQuery.data?.data?.folders) {
      const folders = foldersQuery.data.data.folders;
      const pathToFolder: string[] = [];

      // Build path from root to current folder
      let currentId: string | null = currentFolderId;
      const visited = new Set<string>();
      const MAX_DEPTH = 100;

      while (currentId && visited.size < MAX_DEPTH) {
        if (visited.has(currentId)) break;
        visited.add(currentId);
        pathToFolder.unshift(currentId);

        // Store currentId in a local variable to avoid closure issues
        const searchId = currentId;
        const folder = folders.find((f: any) => f.id === searchId);
        if (folder && folder.parentId) {
          currentId = folder.parentId;
        } else {
          break;
        }
      }

      // Open all folders in the path
      setOpenFolders((prev) => {
        const newSet = new Set(prev);
        pathToFolder.forEach((id) => newSet.add(id));
        return newSet;
      });
    }
  }, [currentFolderId, foldersQuery.data]);

  const handleToggle = useCallback((nodeId: string) => {
    setOpenFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
    } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  }, []);

  const handleNodeClick = useCallback(
    (node: TreeNode) => {
      if (node.type === 'folder') {
        const folderUrl = buildFolderUrlFromId(node.id, folders);
        navigate(folderUrl);
      }
    },
    [navigate, folders]
  );

  const handleRename = useCallback((node: TreeNode) => {
    // Handled in TreeNodeComponent
  }, []);

  const handleDelete = useCallback((node: TreeNode) => {
    // Handled in TreeNodeComponent
  }, []);

  if (foldersQuery.isLoading || filesQuery.isLoading || !dataRoomId) {
    return <div className="p-4 text-sm text-foreground">Loading...</div>;
  }

  if (!treeData) {
    return <div className="p-4 text-sm text-foreground">No data</div>;
  }

  return (
    <div className="w-full">
      {/* Root folder */}
      <div className="flex items-center gap-2 px-2 py-2 mb-2 rounded hover:bg-muted transition-colors cursor-pointer group">
        <FolderIcon className="h-5 w-5 text-foreground flex-shrink-0" />
        <span className="font-semibold text-sm text-foreground truncate flex-1" title={rootFolderName}>
          {rootFolderName}
        </span>
      </div>

      {/* Tree */}
      <div className="relative">
        {treeData.map((node, index) => (
          <TreeNodeComponent
            key={node.id}
            node={node}
            level={0}
            isOpen={openFolders.has(node.id)}
            onToggle={handleToggle}
            onNodeClick={handleNodeClick}
            openFolders={openFolders}
            currentFolderId={currentFolderId}
            renameFolderMutation={renameFolderMutation}
            renameFileMutation={renameFileMutation}
            deleteFolderMutation={deleteFolderMutation}
            deleteFileMutation={deleteFileMutation}
            handleFileView={handleFileView}
            onRename={handleRename}
            onDelete={handleDelete}
            isLast={index === treeData.length - 1}
            parentPath={[]}
          />
        ))}
      </div>
    </div>
  );
};

export default FileTree;
