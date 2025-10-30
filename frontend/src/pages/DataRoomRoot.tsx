import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { DataTable } from '@/components/DataTable';
import {
  DataRoomLayout,
  FoldersGrid,
  FilesGrid,
  DataRoomItem,
  getColumns,
} from '@/components/DataRoomView';
import { 
  useDataRoomData, 
  useDebounce, 
  useFileViewer,
  useCreateFolder,
  useFileUpload,
  useItemRename,
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
  const uploadFile = useFileUpload(id, undefined, foldersQuery.data?.data);
  const renameItem = useItemRename(id);
  const { deleteFolderMutation, deleteFileMutation } = useDataRoomMutations({ dataRoomId: id });
  
  const [itemToDelete, setItemToDelete] = useState<DataRoomItem | null>(null);

  const handleDelete = useCallback((item: DataRoomItem) => {
    setItemToDelete(item);
  }, []);

  const filteredFolders = useMemo(
    () =>
      foldersQuery.data?.data.folders?.filter((folder: any) =>
        !folder.parentId && folder.name.toLowerCase().includes(debouncedSearch.toLowerCase())
      ) || [],
    [foldersQuery.data, debouncedSearch]
  );

  const filteredFiles = useMemo(
    () =>
      filesQuery.data?.data?.filter((file: any) =>
        !file.folderId && file.name.toLowerCase().includes(debouncedSearch.toLowerCase())
      ) || [],
    [filesQuery.data, debouncedSearch]
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
      handleFileView(item.id);
    }
  }, [handleFileView]);

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

  const columns = useMemo(
    () => getColumns(handleFileClick, handleRename, handleDelete),
    [handleFileClick, handleRename, handleDelete]
  );

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
              folders={items.filter((item): item is Extract<DataRoomItem, { type: 'folder' }> => item.type === 'folder')}
              dataRoomId={id!}
              onRename={handleRename}
              onDelete={handleDelete}
            />
            <FilesGrid
              files={items.filter((item): item is Extract<DataRoomItem, { type: 'file' }> => item.type === 'file')}
              folders={foldersQuery.data?.data || []}
              isSearching={!!debouncedSearch.trim()}
              searchQuery={debouncedSearch}
              onView={handleFileClick}
              onRename={handleRename}
              onDelete={handleDelete}
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
        selectedFile={uploadFile.selectedFile}
        fileName={uploadFile.fileName}
        onFileNameChange={uploadFile.setFileName}
        onFileSelect={uploadFile.handleFileSelect}
        onSubmit={uploadFile.handleSubmit}
        isPending={uploadFile.isPending}
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

