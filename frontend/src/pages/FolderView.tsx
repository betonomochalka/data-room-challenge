import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import { useQueryClient } from '@tanstack/react-query';

type ViewMode = 'grid' | 'list';

export function FolderView() {
  const { id, folderId } = useParams<{ id: string; folderId: string }>();
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

  const {
    folderQuery,
    foldersQuery,
    filesQuery,
  } = useDataRoomData({ dataRoomId: id, folderId });

  const { handleFileView } = useFileViewer();
  const createFolder = useCreateFolder(id, folderId);
  const uploadFile = useFileUpload(
    id,
    folderId,
    folderQuery?.data?.data.children,
    folderQuery?.data?.data.files
  );
  const renameItem = useItemRename(id, folderId);
  const { deleteFolderMutation, deleteFileMutation } = useDataRoomMutations({ dataRoomId: id, folderId });
  
  const [itemToDelete, setItemToDelete] = useState<DataRoomItem | null>(null);

  const handleDelete = useCallback((item: DataRoomItem) => {
    setItemToDelete(item);
  }, []);
  
  const filteredFolders = useMemo(
    () =>
      folderQuery?.data?.data.children
        ?.filter((folder: any) => folder != null && folder.name.toLowerCase().includes(debouncedSearch.toLowerCase())) || [],
    [folderQuery?.data, debouncedSearch]
  );

  const filteredFiles = useMemo(
    () =>
      folderQuery?.data?.data.files
        ?.filter((file: any) => file != null && file.name.toLowerCase().includes(debouncedSearch.toLowerCase())) || [],
    [folderQuery?.data, debouncedSearch]
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
      navigate(`/data-rooms/${id}/folders/${item.id}`);
    }
  }, [navigate, id]);

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
    const parentId = folderQuery?.data?.data.parentId;
    if (parentId) {
      navigate(`/data-rooms/${id}/folders/${parentId}`);
    } else {
      navigate(`/data-rooms/${id}`);
    }
  }, [navigate, id, folderQuery?.data?.data]);

  const columns = useMemo(
    () => getColumns(handleFileClick, handleRename, handleDelete, handleFolderClick),
    [handleFileClick, handleRename, handleDelete, handleFolderClick]
  );

  const isLoading = folderQuery?.isLoading || foldersQuery.isLoading || filesQuery.isLoading;

  const breadcrumbs = useBreadcrumbs({
    dataRoomId: id!,
    currentFolderId: folderId,
    currentFolderName: folderQuery?.data?.data.name,
    currentFolderParentId: folderQuery?.data?.data.parentId,
    allFolders: foldersQuery?.data?.data?.folders || [],
  });

  const handleGoogleDriveImport = () => {
    setIsGoogleDrivePickerOpen(true);
  };

  const handleGoogleDriveImportSuccess = useCallback(() => {
    // Batch query invalidations with a delay to avoid rate limiting
    // React Query batches these automatically, but we add a delay to prevent immediate refetch
    setTimeout(() => {
      // Batch all invalidations together - React Query will handle batching
      queryClient.invalidateQueries({ queryKey: ['folder', folderId], exact: false });
      queryClient.invalidateQueries({ queryKey: ['allFolders', id], exact: false });
      queryClient.invalidateQueries({ queryKey: ['allFiles', id], exact: false });
    }, 500);
  }, [queryClient, id, folderId]);

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
  
  if (folderQuery?.isError || foldersQuery.isError || filesQuery.isError) {
    return <div>Error loading folder data.</div>;
  }

  return (
    <>
      <DataRoomLayout
        title={folderQuery?.data?.data.name || 'Folder'}
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
        dataRoomId={id}
        folderId={folderId}
        onImportSuccess={handleGoogleDriveImportSuccess}
      />
    </>
  );
}

