import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DataTable } from '@/components/DataTable';
import {
  DataRoomLayout,
  DataRoomItem,
  getColumns,
  FoldersGrid,
  FilesGrid,
} from '@/components/DataRoomView';
import { 
  useDataRoomData, 
  useDebounce, 
  useCreateFolder,
  useFileUpload,
  useItemRename,
  useBreadcrumbs,
  useGoogleDrive,
} from '@/hooks';
import { useFileViewer } from '@/hooks/useFileViewer';
import { useDataRoomMutations } from '@/hooks/useDataRoomMutations';
import { EmptyState } from '@/components/DataRoomView/EmptyState';
import {
  CreateFolderDialog,
  UploadFileDialog,
  RenameDialog,
} from '@/components/Dialogs';
import { GoogleDriveFilePicker } from '@/components/GoogleDrive';
import { fileTreeEvents } from '@/lib/events';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { DataRoom } from '@/types';
import { resolvePathToFolderId, buildFolderUrlFromId } from '@/utils/folderPaths';

type ViewMode = 'grid' | 'list';

export function FolderView() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    // Default to 'list' on mobile, 'grid' on desktop
    if (typeof window !== 'undefined') {
      return window.matchMedia('(min-width: 768px)').matches ? 'grid' : 'list';
    }
    return 'grid';
  });
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [isGoogleDrivePickerOpen, setIsGoogleDrivePickerOpen] = useState(false);
  const { isConnected } = useGoogleDrive();

  // Fetch user's Data Room automatically
  const { data: dataRoomResponse } = useQuery<{ success: boolean; data: DataRoom }>({
    queryKey: ['dataRooms'],
    queryFn: async () => {
      const response = await api.get('/data-rooms', {
        params: {
          // Slim payload: only request essential fields
          fields: 'id,name',
        },
      });
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const dataRoomId = dataRoomResponse?.data?.id;

  // Extract path from URL and resolve to folder ID
  const folderPath = useMemo(() => {
    // Safety check: ensure location and pathname exist
    if (!location || !location.pathname) return '';
    // Remove '/folders' prefix and any leading/trailing slashes
    const match = location.pathname.match(/^\/folders\/(.+)$/);
    return match ? match[1] : '';
  }, [location]);

  // Fetch all folders for path resolution - enable via useDataRoomData but trigger in background
  // This allows path resolution while deferring the query load
  const {
    folderQuery,
    foldersQuery,
    filesQuery,
  } = useDataRoomData({ 
    dataRoomId, 
    folderId: undefined, // Will be resolved after allFolders loads
    enableAllFolders: true // Enable for path resolution
  });

  // Resolve path to folder ID using allFolders (from foldersQuery)
  const allFolders = useMemo(() => {
    return foldersQuery.data?.data?.folders || [];
  }, [foldersQuery.data?.data?.folders]);

  const folderId = useMemo(() => {
    if (!folderPath) return undefined;
    return resolvePathToFolderId(folderPath, allFolders) || undefined;
  }, [folderPath, allFolders]);

  // After folderId is resolved, fetch folder contents
  const {
    folderQuery: resolvedFolderQuery,
    foldersQuery: resolvedFoldersQuery,
    filesQuery: resolvedFilesQuery,
  } = useDataRoomData({ 
    dataRoomId, 
    folderId, // Now use resolved folderId
    enableAllFolders: false // Already have it from above
  });

  // Use resolved queries if folderId is available, otherwise use initial queries
  const effectiveFolderQuery = folderId ? resolvedFolderQuery : folderQuery;
  const effectiveFoldersQuery = folderId ? resolvedFoldersQuery : foldersQuery;
  const effectiveFilesQuery = folderId ? resolvedFilesQuery : filesQuery;

  // Use allFolders from foldersQuery (always available when at root, or from effectiveFoldersQuery when in folder)
  const effectiveAllFolders = useMemo(() => {
    return effectiveFoldersQuery.data?.data?.folders || allFolders;
  }, [effectiveFoldersQuery.data?.data?.folders, allFolders]);

  // Prefetch allFolders in background after folder loads (for navigation)
  useEffect(() => {
    if (dataRoomId && effectiveFolderQuery?.data && !foldersQuery.data) {
      // Trigger prefetch after folder loads
      const timer = setTimeout(() => {
        queryClient.prefetchQuery({
          queryKey: ['allFolders', dataRoomId],
          queryFn: async () => {
            const response = await api.get('/folders', { 
              params: { 
                dataRoomId,
                fields: 'id,name,parentId,dataRoomId,createdAt,updatedAt',
              },
            });
            return response.data;
          },
          staleTime: 5 * 60 * 1000,
        });
      }, 500); // Wait 500ms after folder loads
      
      return () => clearTimeout(timer);
    }
  }, [dataRoomId, effectiveFolderQuery?.data, foldersQuery.data, queryClient]);

  const { handleFileView } = useFileViewer();
  const createFolder = useCreateFolder(dataRoomId, folderId);
  const uploadFile = useFileUpload(
    dataRoomId,
    folderId,
    effectiveFolderQuery?.data?.data.children,
    effectiveFolderQuery?.data?.data.files
  );
  const renameItem = useItemRename(dataRoomId, folderId);
  const { deleteFolderMutation, deleteFileMutation } = useDataRoomMutations({ dataRoomId, folderId });
  
  const [itemToDelete, setItemToDelete] = useState<DataRoomItem | null>(null);

  const handleDelete = useCallback((item: DataRoomItem) => {
    setItemToDelete(item);
  }, []);
  
  const filteredFolders = useMemo(
    () =>
      effectiveFolderQuery?.data?.data.children
        ?.filter((folder: any) => folder != null && folder.name.toLowerCase().includes(debouncedSearch.toLowerCase())) || [],
    [effectiveFolderQuery?.data, debouncedSearch]
  );

  const filteredFiles = useMemo(
    () =>
      effectiveFolderQuery?.data?.data.files
        ?.filter((file: any) => file != null && file.name.toLowerCase().includes(debouncedSearch.toLowerCase())) || [],
    [effectiveFolderQuery?.data, debouncedSearch]
  );

  const items = useMemo(() => {
    const combinedItems: DataRoomItem[] = [
      ...filteredFolders.map((folder: any) => ({ ...folder, type: 'folder' as const, size: null })),
      ...filteredFiles.map((file: any) => ({ ...file, type: 'file' as const, size: Number(file.fileSize) || 0 })),
    ];
    return combinedItems.sort((a, b) => {
      if (a.type === 'folder' && b.type === 'file') return -1;
      if (a.type === 'file' && b.type === 'folder') return 1;

      return a.name.localeCompare(b.name);
    });
  }, [filteredFolders, filteredFiles]);

  const handleFileClick = useCallback((item: DataRoomItem) => {
    if (item.type === 'file') {
      handleFileView(item);
    }
  }, [handleFileView]);

  const handleFolderClick = useCallback((item: DataRoomItem) => {
    if (item.type === 'folder') {
      const folderUrl = buildFolderUrlFromId(item.id, effectiveAllFolders);
      navigate(folderUrl);
    }
  }, [navigate, effectiveAllFolders]);

  const handleRename = useCallback((item: DataRoomItem) => {
    renameItem.open({ id: item.id, name: item.name, type: item.type });
  }, [renameItem]);

  useEffect(() => {
    const unsubscribeRename = fileTreeEvents.subscribe('renameItem', handleRename);
    const unsubscribeDelete = fileTreeEvents.subscribe('deleteItem', handleDelete);

    return () => {
      unsubscribeRename();
      unsubscribeDelete();
    };
  }, [handleRename, handleDelete]);

  const handleBackClick = useCallback(() => {
    const parentId = effectiveFolderQuery?.data?.data.parentId;
    if (parentId) {
      const parentUrl = buildFolderUrlFromId(parentId, effectiveAllFolders);
      navigate(parentUrl);
    } else {
      navigate('/');
    }
  }, [navigate, effectiveFolderQuery?.data?.data, effectiveAllFolders]);

  const columns = useMemo(
    () => getColumns(handleFileClick, handleRename, handleDelete, handleFolderClick),
    [handleFileClick, handleRename, handleDelete, handleFolderClick]
  );

  const isLoading = effectiveFolderQuery?.isLoading || effectiveFilesQuery?.isLoading || (!folderId && foldersQuery.isLoading);

  const breadcrumbs = useBreadcrumbs({
    dataRoomId: dataRoomId!,
    currentFolderId: folderId,
    currentFolderName: effectiveFolderQuery?.data?.data.name,
    currentFolderParentId: effectiveFolderQuery?.data?.data.parentId,
    allFolders: effectiveAllFolders,
  });

  const handleGoogleDriveImport = () => {
    setIsGoogleDrivePickerOpen(true);
  };

  const handleGoogleDriveImportSuccess = useCallback(() => {
    // Batch query invalidations with a delay to avoid rate limiting
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['folder', folderId], exact: false });
      queryClient.invalidateQueries({ queryKey: ['allFolders', dataRoomId], exact: false });
      queryClient.invalidateQueries({ queryKey: ['allFiles', dataRoomId], exact: false });
    }, 500);
  }, [queryClient, dataRoomId, folderId]);

  const onConfirmDelete = (confirm: boolean) => {
    if (confirm && itemToDelete) {
      if (itemToDelete.type === 'folder') {
        deleteFolderMutation.mutate(itemToDelete.id);
      } else {
        deleteFileMutation.mutate(itemToDelete.id);
      }
    }
    setItemToDelete(null);
  };
  
  if (effectiveFolderQuery?.isError || (!folderId && foldersQuery.isError) || effectiveFilesQuery?.isError || !dataRoomId) {
    return <div>Error loading folder data.</div>;
  }

  return (
    <>
      <DataRoomLayout
        title={effectiveFolderQuery?.data?.data.name || 'Folder'}
        items={items}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isLoading={isLoading}
        onCreateFolder={createFolder.open}
        onUpload={uploadFile.open}
        itemToDelete={itemToDelete}
        onConfirmDelete={onConfirmDelete}
        onBackClick={handleBackClick}
        breadcrumbs={breadcrumbs}
        onImportFromGoogleDrive={handleGoogleDriveImport}
        showGoogleDriveButton={isConnected}
      >
        {items.length === 0 ? (
          <EmptyState 
            isSearching={!!debouncedSearch.trim()} 
            searchQuery={debouncedSearch}
            isInFolder={true}
            onCreateFolder={createFolder.open}
            onUploadFile={uploadFile.open}
            onClearSearch={() => setSearchQuery('')}
          />
        ) : viewMode === 'grid' ? (
          <>
            <FoldersGrid
              folders={items.filter((item): item is Extract<DataRoomItem, { type: 'folder' }> => item.type === 'folder')}
              onRename={handleRename}
              onDelete={handleDelete}
              onView={handleFolderClick}
            />
            <FilesGrid
              files={items.filter((item): item is Extract<DataRoomItem, { type: 'file' }> => item.type === 'file')}
              onRename={handleRename}
              onDelete={handleDelete}
              onView={handleFileClick}
            />
          </>
        ) : (
          <DataTable
            columns={columns}
            data={items}
            onView={handleFileClick}
            onRename={handleRename}
            onDelete={handleDelete}
          />
        )}
      </DataRoomLayout>

      <CreateFolderDialog
        isOpen={createFolder.isOpen}
        onOpenChange={(open) => !open && createFolder.close()}
        folderName={createFolder.folderName}
        onFolderNameChange={createFolder.setFolderName}
        onSubmit={createFolder.handleSubmit}
        isPending={createFolder.isPending}
      />
      <UploadFileDialog
        isOpen={uploadFile.isOpen}
        onOpenChange={(open) => !open && uploadFile.close()}
        selectedFiles={uploadFile.selectedFiles}
        onFilesSelect={uploadFile.handleFilesSelect}
        onFileNameChange={uploadFile.handleFileNameChange}
        onFileRemove={uploadFile.handleFileRemove}
        onSubmit={uploadFile.handleSubmit}
        isPending={uploadFile.isPending}
        uploadProgress={uploadFile.uploadProgress}
        completedCount={uploadFile.completedCount}
      />
      <RenameDialog
        isOpen={renameItem.isOpen}
        onOpenChange={(open) => !open && renameItem.close()}
        itemType={renameItem.item?.type || null}
        newName={renameItem.newName}
        onNewNameChange={renameItem.setNewName}
        onSubmit={renameItem.handleSubmit}
        isPending={renameItem.isPending}
      />
      <GoogleDriveFilePicker
        open={isGoogleDrivePickerOpen}
        onOpenChange={setIsGoogleDrivePickerOpen}
        dataRoomId={dataRoomId}
        folderId={folderId}
        onImportSuccess={handleGoogleDriveImportSuccess}
      />
    </>
  );
}
