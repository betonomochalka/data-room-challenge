import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  DataRoomLayout,
  DataRoomItem,
  ItemRenderer,
  FoldersGrid,
  FilesGrid,
} from '@/components/DataRoomView';
import { 
  useDataRoomData,
  useDebounce, 
  useCreateFolder,
  useFileUpload,
  useItemRename,
  useFileViewer,
  useBreadcrumbs,
  useGoogleDrive,
} from '@/hooks';
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
import { buildFolderUrlFromId } from '@/utils/folderPaths';
import { toast } from '@/lib/toast';

type ViewMode = 'grid' | 'list';

export function DataRoomRoot() {
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
  const { isConnected, refetchStatus } = useGoogleDrive();
  const [searchParams, setSearchParams] = useSearchParams();

  // Handle Google Drive OAuth callback
  useEffect(() => {
    const googleDriveStatus = searchParams.get('google_drive');
    if (googleDriveStatus === 'connected') {
      // Refetch Google Drive status to update UI
      refetchStatus();
      toast.success('Google Drive connected successfully!');
      // Remove the query parameter from URL
      searchParams.delete('google_drive');
      setSearchParams(searchParams, { replace: true });
    } else if (googleDriveStatus === 'error') {
      const reason = searchParams.get('reason');
      console.error('Google Drive connection error:', reason);
      toast.error(`Failed to connect Google Drive: ${reason || 'Unknown error'}`);
      // Remove the query parameters from URL
      searchParams.delete('google_drive');
      searchParams.delete('reason');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, refetchStatus]);

  // Fetch user's Data Room automatically
  const { data: dataRoomResponse, isLoading: isDataRoomLoading } = useQuery<{ success: boolean; data: DataRoom }>({
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
  
  // Enable allFolders/allFiles only when search is active OR prefetch in background after render
  const hasSearchQuery = !!debouncedSearch.trim();
  
  const {
    dataRoomQuery,
    foldersQuery,
    filesQuery,
  } = useDataRoomData({ 
    dataRoomId,
    enableAllFolders: hasSearchQuery, // Enable when searching
    enableAllFiles: hasSearchQuery    // Enable when searching
  });

  // Prefetch allFolders/allFiles in background after initial render (for navigation/search)
  useEffect(() => {
    if (dataRoomId && dataRoomQuery?.data) {
      // Prefetch after a short delay to not block initial render
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
        queryClient.prefetchQuery({
          queryKey: ['allFiles', dataRoomId],
          queryFn: async () => {
            const response = await api.get('/files', { 
              params: { 
                dataRoomId,
                fields: 'id,name,mimeType,fileSize,folderId,createdAt,updatedAt',
              },
            });
            return response.data;
          },
          staleTime: 5 * 60 * 1000,
        });
      }, 1000); // Wait 1s after initial render
      
      return () => clearTimeout(timer);
    }
  }, [dataRoomId, dataRoomQuery?.data, queryClient]);

  const { handleFileView } = useFileViewer();
  const createFolder = useCreateFolder(dataRoomId);
  const { deleteFolderMutation, deleteFileMutation } = useDataRoomMutations({ dataRoomId });
  
  const [itemToDelete, setItemToDelete] = useState<DataRoomItem | null>(null);

  const handleDelete = useCallback((item: DataRoomItem) => {
    setItemToDelete(item);
  }, []);

  // Use root data from dataRoomQuery for initial display, fallback to allFolders/allFiles for search
  const rootData = dataRoomQuery?.data?.data; // dataRoomQuery.data is ApiResponse, so access .data.data
  const rootFolders = useMemo(
    () => rootData?.folders || foldersQuery.data?.data?.folders?.filter((f: any) => !f.parentId) || [],
    [rootData?.folders, foldersQuery.data]
  );

  const rootFiles = useMemo(
    () => rootData?.files || filesQuery.data?.data?.filter((file: any) => {
      if (file == null) return false;
      return file.folderId === undefined || file.folderId === null;
    }) || [],
    [rootData?.files, filesQuery.data]
  );

  const uploadFile = useFileUpload(dataRoomId, undefined, rootFolders, rootFiles);
  const renameItem = useItemRename(dataRoomId);

  // For search: use allFolders/allFiles; for display: use root data
  const foldersToSearch = hasSearchQuery && foldersQuery.data?.data?.folders 
    ? foldersQuery.data.data.folders 
    : rootFolders;
  const filesToSearch = hasSearchQuery && filesQuery.data?.data 
    ? filesQuery.data.data 
    : rootFiles;

  const filteredFolders = useMemo(
    () =>
      foldersToSearch
        ?.filter((folder: any) => {
          if (folder == null || folder.name == null) return false;
          if (hasSearchQuery) {
            // When searching, filter all folders
            return folder.name.toLowerCase().includes(debouncedSearch.toLowerCase());
          } else {
            // When not searching, only show root folders
            return !folder.parentId;
          }
        })
        .map((folder: any) => ({ ...folder, type: 'folder' as const, size: null })) || [],
    [foldersToSearch, debouncedSearch, hasSearchQuery]
  );

  const filteredFiles = useMemo(
    () =>
      filesToSearch
        ?.filter((file: any) => {
          if (file == null || file.name == null) return false;
          if (hasSearchQuery) {
            // When searching, filter all files
            return file.name.toLowerCase().includes(debouncedSearch.toLowerCase());
          } else {
            // When not searching, only show root files
            return file.folderId === undefined || file.folderId === null;
          }
        })
        .map((file: any) => ({ ...file, type: 'file' as const, size: Number(file.fileSize) || 0 })) || [],
    [filesToSearch, debouncedSearch, hasSearchQuery]
  );
  
  const items = useMemo(() => {
    const combinedItems: DataRoomItem[] = [...filteredFolders, ...filteredFiles];
    return combinedItems.sort((a, b) => {
        if (a.type === 'folder' && b.type === 'file') return -1;
        if (a.type === 'file' && b.type === 'folder') return 1;
        
        return a.name.localeCompare(b.name);
    });
  }, [filteredFolders, filteredFiles]);

  // Get allFolders for navigation (from cache if available, otherwise use root folders)
  const allFolders = useMemo(() => {
    return foldersQuery.data?.data?.folders || rootFolders;
  }, [foldersQuery.data?.data?.folders, rootFolders]);

  const handleView = useCallback((item: DataRoomItem) => {
    if (item.type === 'folder') {
      const folderUrl = buildFolderUrlFromId(item.id, allFolders);
      navigate(folderUrl);
    } else {
      handleFileView(item);
    }
  }, [navigate, handleFileView, allFolders]);

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

  const isLoading = isDataRoomLoading || dataRoomQuery?.isLoading || (hasSearchQuery && (foldersQuery.isLoading || filesQuery.isLoading));

  const breadcrumbs = useBreadcrumbs({
    dataRoomId: dataRoomId!,
    dataRoomName: dataRoomResponse?.data?.name,
  });

  const handleGoogleDriveImport = () => {
    setIsGoogleDrivePickerOpen(true);
  };

  const handleGoogleDriveImportSuccess = useCallback(() => {
    // Batch query invalidations with a delay to avoid rate limiting
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['dataRoom', dataRoomId], exact: false });
      queryClient.invalidateQueries({ queryKey: ['allFolders', dataRoomId], exact: false });
      queryClient.invalidateQueries({ queryKey: ['allFiles', dataRoomId], exact: false });
    }, 500);
  }, [queryClient, dataRoomId]);

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

  if (dataRoomQuery?.isError || (hasSearchQuery && (foldersQuery.isError || filesQuery.isError)) || (isDataRoomLoading === false && !dataRoomId)) {
    return <div>Error loading data room</div>;
  }
  
  return (
    <>
      <DataRoomLayout
        title={dataRoomResponse?.data?.name || 'Data Room'}
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
        breadcrumbs={breadcrumbs}
        onImportFromGoogleDrive={handleGoogleDriveImport}
        showGoogleDriveButton={isConnected}
      >
        {items.length === 0 ? (
          <EmptyState 
            isSearching={!!debouncedSearch.trim()} 
            searchQuery={debouncedSearch}
            isInFolder={false}
            onCreateFolder={createFolder.open}
            onUploadFile={uploadFile.open}
            onClearSearch={() => setSearchQuery('')}
          />
        ) : viewMode === 'grid' ? (
          <>
            <FoldersGrid
              folders={filteredFolders}
              onRename={handleRename}
              onDelete={handleDelete}
              onView={handleView}
            />
            <FilesGrid
              files={filteredFiles}
              onRename={handleRename}
              onDelete={handleDelete}
              onView={handleView}
            />
          </>
        ) : (
          <ItemRenderer
            items={items}
            viewMode={viewMode}
            onRename={handleRename}
            onDelete={handleDelete}
            dataRoomId={dataRoomId!}
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
        onImportSuccess={handleGoogleDriveImportSuccess}
      />
    </>
  );
}

