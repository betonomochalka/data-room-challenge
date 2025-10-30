import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
} from '@/hooks';
import { useDataRoomMutations } from '@/hooks/useDataRoomMutations';
import { EmptyState } from '@/components/DataRoomView/EmptyState';
import {
  CreateFolderDialog,
  UploadFileDialog,
  RenameDialog,
} from '@/components/Dialogs';
import { fileTreeEvents } from '@/lib/events';

type ViewMode = 'grid' | 'list';

export function DataRoomRoot() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    // Default to 'list' on mobile, 'grid' on desktop
    if (typeof window !== 'undefined') {
      return window.matchMedia('(min-width: 768px)').matches ? 'grid' : 'list';
    }
    return 'grid';
  });
  const debouncedSearch = useDebounce(searchQuery, 300);

  const {
    dataRoomQuery,
    foldersQuery,
    filesQuery,
  } = useDataRoomData({ dataRoomId: id });

  const { handleFileView } = useFileViewer();
  const createFolder = useCreateFolder(id);
  const { deleteFolderMutation, deleteFileMutation } = useDataRoomMutations({ dataRoomId: id });
  
  const [itemToDelete, setItemToDelete] = useState<DataRoomItem | null>(null);

  const handleDelete = useCallback((item: DataRoomItem) => {
    setItemToDelete(item);
  }, []);

  // Get root-level folders and files for duplicate validation (without search filter)
  const rootFolders = useMemo(
    () => foldersQuery.data?.data.folders?.filter((folder: any) => !folder.parentId) || [],
    [foldersQuery.data]
  );

  const rootFiles = useMemo(
    () => filesQuery.data?.data?.filter((file: any) => !file.folderId) || [],
    [filesQuery.data]
  );

  const uploadFile = useFileUpload(id, undefined, rootFolders, rootFiles);
  const renameItem = useItemRename(id);

  const filteredFolders = useMemo(
    () =>
      foldersQuery.data?.data.folders
        ?.filter((folder: any) => folder != null && !folder.parentId && folder.name.toLowerCase().includes(debouncedSearch.toLowerCase()))
        .map((folder: any) => ({ ...folder, type: 'folder' as const, size: null })) || [],
    [foldersQuery.data, debouncedSearch]
  );

  const filteredFiles = useMemo(
    () =>
      filesQuery.data?.data
        ?.filter((file: any) => file != null && !file.folderId && file.name.toLowerCase().includes(debouncedSearch.toLowerCase()))
        .map((file: any) => ({ ...file, type: 'file' as const, size: Number(file.fileSize) || 0 })) || [],
    [filesQuery.data, debouncedSearch]
  );
  
  const items = useMemo(() => {
    const combinedItems: DataRoomItem[] = [...filteredFolders, ...filteredFiles];
    return combinedItems.sort((a, b) => {
        if (a.type === 'folder' && b.type === 'file') return -1;
        if (a.type === 'file' && b.type === 'folder') return 1;
        
        return a.name.localeCompare(b.name);
    });
  }, [filteredFolders, filteredFiles]);

  const handleView = useCallback((item: DataRoomItem) => {
    if (item.type === 'folder') {
      navigate(`/data-rooms/${id}/folders/${item.id}`);
    } else {
      handleFileView(item.id);
    }
  }, [navigate, handleFileView, id]);

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

  const isLoading = dataRoomQuery?.isLoading || foldersQuery.isLoading || filesQuery.isLoading;

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

  if (foldersQuery.isError || filesQuery.isError) {
    return <div>Error: {foldersQuery.error?.message || filesQuery.error?.message}</div>;
  }
  
  return (
    <>
      <DataRoomLayout
        title={dataRoomQuery?.data?.data.name || 'Data Room'}
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
            dataRoomId={id!}
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
    </>
  );
}

