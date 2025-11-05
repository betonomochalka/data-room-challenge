import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import { getErrorMessage, SUCCESS_MESSAGES } from '../lib/errorMessages';
import {
  addFolderToCache,
  addFileToCache,
} from '../utils/cacheHelpers';
import { Folder, File as FileType } from '../types';

interface UseDataRoomMutationsProps {
  dataRoomId?: string;
  folderId?: string;
}

/**
 * Custom hook for data room mutations (create, update, delete)
 */
export const useDataRoomMutations = ({ dataRoomId, folderId }: UseDataRoomMutationsProps) => {
  const queryClient = useQueryClient();

  const createFolderMutation = useMutation({
    mutationFn: async (name: string) => {
      performance.mark('folder-create-start');
      try {
        const response = await api.post('/folders', {
          name,
          dataRoomId,
          parentId: folderId || null,
        });
        const parentId = folderId || null;
        const newFolder = response.data.data as Folder;
        return { folder: newFolder, parentId };
      } finally {
        performance.mark('folder-create-end');
        performance.measure('folder-create', 'folder-create-start', 'folder-create-end');
        if (process.env.NODE_ENV === 'development') {
          const measure = performance.getEntriesByName('folder-create', 'measure')[0];
          if (measure) {
            console.log(`[Performance] folder-create: ${measure.duration.toFixed(2)}ms`);
          }
        }
      }
    },
    onSuccess: (data, _variables) => {
      toast.success(SUCCESS_MESSAGES.FOLDER_CREATED);
      
      // Surgical cache update - add folder to parent cache
      if (dataRoomId) {
        addFolderToCache(queryClient, dataRoomId, data.parentId, data.folder);
      }
      
      // Mark queries as stale and refetch active queries
      // Surgical cache updates above handle immediate UI updates
      // Refetch ensures data consistency across all components (including FileTree)
      queryClient.invalidateQueries({ 
        queryKey: ['folder'], 
        exact: false,
      });
      queryClient.invalidateQueries({ 
        queryKey: ['dataRoom'], 
        exact: false,
      });
      queryClient.invalidateQueries({ 
        queryKey: ['dataRooms'],
      });
      // Invalidate allFolders and allFiles queries used by FileTree
      queryClient.invalidateQueries({ 
        queryKey: ['allFolders'],
      });
      queryClient.invalidateQueries({ 
        queryKey: ['allFiles'],
      });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (folderIdToDelete: string) => {
      performance.mark('folder-delete-start');
      try {
        // Fetch folder info before deletion to get parent ID for cache update
        const folderResponse = await api.get(`/folders/${folderIdToDelete}/contents`);
        const parentId = folderResponse.data?.data?.folder?.parentId || null;
        await api.delete(`/folders/${folderIdToDelete}`);
        return { id: folderIdToDelete, parentId };
      } finally {
        performance.mark('folder-delete-end');
        performance.measure('folder-delete', 'folder-delete-start', 'folder-delete-end');
        if (process.env.NODE_ENV === 'development') {
          const measure = performance.getEntriesByName('folder-delete', 'measure')[0];
          if (measure) {
            console.log(`[Performance] folder-delete: ${measure.duration.toFixed(2)}ms`);
          }
        }
      }
    },
    onMutate: async (folderIdToDelete: string) => {
      // Cancel outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['folder'], exact: false });
      await queryClient.cancelQueries({ queryKey: ['dataRoom'], exact: false });
      await queryClient.cancelQueries({ queryKey: ['allFolders'] });

      // Get current folder data to determine parentId
      // Try to get from allFolders cache first (more reliable)
      let parentId: string | null = null;
      if (dataRoomId) {
        const allFoldersData = queryClient.getQueryData(['allFolders', dataRoomId]) as any;
        const folder = allFoldersData?.data?.folders?.find((f: Folder) => f.id === folderIdToDelete);
        if (folder?.parentId !== undefined) {
          parentId = folder.parentId;
        }
      }
      
      // Fallback: try to get from folder query if exists
      if (parentId === null) {
        const folderQuery = queryClient.getQueryData(['folder', folderIdToDelete]) as any;
        parentId = folderQuery?.data?.data?.parentId || null;
      }

      // Optimistically update active view cache (currently open folder/dataRoom)
      if (parentId) {
        queryClient.setQueryData(['folder', parentId], (oldData: any) => {
          if (!oldData?.data?.data) return oldData;
          return {
            ...oldData,
            data: {
              ...oldData.data.data,
              children: (oldData.data.data.children || []).filter(
                (f: Folder) => f.id !== folderIdToDelete
              ),
            },
          };
        });
      } else if (dataRoomId) {
        queryClient.setQueryData(['dataRoom', dataRoomId], (oldData: any) => {
          if (!oldData?.data?.data) return oldData;
          return {
            ...oldData,
            data: {
              ...oldData.data.data,
              folders: (oldData.data.data.folders || []).filter(
                (f: Folder) => f.id !== folderIdToDelete
              ),
            },
          };
        });
      }

      // Optimistically update allFolders list cache (for FileTree)
      if (dataRoomId) {
        queryClient.setQueryData(['allFolders', dataRoomId], (oldData: any) => {
          if (!oldData || !oldData.data) return oldData;
          return {
            ...oldData,
            data: {
              ...oldData.data,
              folders: (oldData.data.folders || []).filter(
                (f: Folder) => f != null && f.id !== folderIdToDelete
              ),
            },
          };
        });
      }

      return { parentId };
    },
    onSuccess: (data, _variables, context) => {
      toast.success(SUCCESS_MESSAGES.FOLDER_DELETED);
      
      // Optimistic update already handled in onMutate - state is already correct
      // Mark inactive queries as stale, then optionally refetch active queries for fresh data
      if (context?.parentId !== undefined && dataRoomId) {
        const viewQueryKey = context.parentId ? ['folder', context.parentId] : ['dataRoom', dataRoomId];
        queryClient.invalidateQueries({ 
          queryKey: viewQueryKey,
          refetchType: 'inactive', // Mark inactive queries as stale, don't refetch yet
        });
        
        // Optionally refetch active queries to keep data fresh without flooding network
        queryClient.refetchQueries({ 
          queryKey: viewQueryKey,
          type: 'active', // Only refetch currently active queries
        });
      }
    },
    onError: (err, _variables, context) => {
      toast.error(getErrorMessage(err));
      
      // Rollback optimistic update on error
      if (context?.parentId !== undefined && dataRoomId) {
        // Refetch the parent folder/dataRoom to restore correct state
        const viewQueryKey = context.parentId ? ['folder', context.parentId] : ['dataRoom', dataRoomId];
        queryClient.invalidateQueries({ 
          queryKey: viewQueryKey,
        });
        // Refetch allFolders to restore correct state
        queryClient.invalidateQueries({ 
          queryKey: ['allFolders', dataRoomId],
        });
      }
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: string) => {
      performance.mark('file-delete-start');
      try {
        await api.delete(`/files/${fileId}`);
        return { id: fileId };
      } finally {
        performance.mark('file-delete-end');
        performance.measure('file-delete', 'file-delete-start', 'file-delete-end');
        if (process.env.NODE_ENV === 'development') {
          const measure = performance.getEntriesByName('file-delete', 'measure')[0];
          if (measure) {
            console.log(`[Performance] file-delete: ${measure.duration.toFixed(2)}ms`);
          }
        }
      }
    },
    onMutate: async (fileId: string) => {
      // Cancel outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['folder'], exact: false });
      await queryClient.cancelQueries({ queryKey: ['dataRoom'], exact: false });
      await queryClient.cancelQueries({ queryKey: ['allFiles'] });

      // Get current file data to determine folderId
      // Try to find file in cache to get folderId
      let fileFolderId: string | null = folderId || null;
      
      // Try to get from allFiles cache
      if (dataRoomId) {
        const allFilesData = queryClient.getQueryData(['allFiles', dataRoomId]) as any;
        const file = allFilesData?.data?.find((f: FileType) => f.id === fileId);
        if (file?.folderId !== undefined) {
          fileFolderId = file.folderId;
        }
      }

      // Optimistically update active view cache (currently open folder/dataRoom)
      if (fileFolderId) {
        queryClient.setQueryData(['folder', fileFolderId], (oldData: any) => {
          if (!oldData?.data?.data) return oldData;
          return {
            ...oldData,
            data: {
              ...oldData.data.data,
              files: (oldData.data.data.files || []).filter(
                (f: FileType) => f.id !== fileId
              ),
            },
          };
        });
      } else if (dataRoomId) {
        queryClient.setQueryData(['dataRoom', dataRoomId], (oldData: any) => {
          if (!oldData?.data?.data) return oldData;
          return {
            ...oldData,
            data: {
              ...oldData.data.data,
              files: (oldData.data.data.files || []).filter(
                (f: FileType) => f.id !== fileId
              ),
            },
          };
        });
      }

      // Optimistically update allFiles list cache (for FileTree)
      if (dataRoomId) {
        queryClient.setQueryData(['allFiles', dataRoomId], (oldData: any) => {
          if (!oldData || !oldData.data) return oldData;
          return {
            ...oldData,
            data: (oldData.data || []).filter(
              (f: FileType) => f != null && f.id !== fileId
            ),
          };
        });
      }

      return { folderId: fileFolderId };
    },
    onSuccess: (data, _variables, context) => {
      toast.success(SUCCESS_MESSAGES.FILE_DELETED);
      
      // Optimistic update already handled in onMutate - state is already correct
      // Mark inactive queries as stale, then optionally refetch active queries for fresh data
      if (context?.folderId !== undefined && dataRoomId) {
        const viewQueryKey = context.folderId ? ['folder', context.folderId] : ['dataRoom', dataRoomId];
        queryClient.invalidateQueries({ 
          queryKey: viewQueryKey,
          refetchType: 'inactive', // Mark inactive queries as stale, don't refetch yet
        });
        
        // Optionally refetch active queries to keep data fresh without flooding network
        queryClient.refetchQueries({ 
          queryKey: viewQueryKey,
          type: 'active', // Only refetch currently active queries
        });
      }
    },
    onError: (err, _variables, context) => {
      toast.error(getErrorMessage(err));
      
      // Rollback optimistic update on error
      if (context?.folderId !== undefined && dataRoomId) {
        // Refetch the folder/dataRoom to restore correct state
        const viewQueryKey = context.folderId ? ['folder', context.folderId] : ['dataRoom', dataRoomId];
        queryClient.invalidateQueries({ 
          queryKey: viewQueryKey,
        });
        // Refetch allFiles to restore correct state
        queryClient.invalidateQueries({ 
          queryKey: ['allFiles', dataRoomId],
        });
      }
    },
  });

  const renameFolderMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      performance.mark('folder-rename-start');
      try {
        const response = await api.patch(`/folders/${id}/rename`, { name });
        // Backend returns { success: true, data: { id, name, parentId, dataRoomId } }
        const updatedFolder = response.data.data;
        const parentId = updatedFolder.parentId || null;
        return { id: updatedFolder.id, name: updatedFolder.name, parentId, dataRoomId: updatedFolder.dataRoomId };
      } finally {
        performance.mark('folder-rename-end');
        performance.measure('folder-rename', 'folder-rename-start', 'folder-rename-end');
        if (process.env.NODE_ENV === 'development') {
          const measure = performance.getEntriesByName('folder-rename', 'measure')[0];
          if (measure) {
            console.log(`[Performance] folder-rename: ${measure.duration.toFixed(2)}ms`);
          }
        }
      }
    },
    onMutate: async ({ id, name }: { id: string; name: string }) => {
      // Cancel outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['folder'], exact: false });
      await queryClient.cancelQueries({ queryKey: ['dataRoom'], exact: false });
      await queryClient.cancelQueries({ queryKey: ['allFolders'] });

      // Get current folder data to determine parentId
      // Try to get from allFolders cache first (more reliable)
      let parentId: string | null = null;
      if (dataRoomId) {
        const allFoldersData = queryClient.getQueryData(['allFolders', dataRoomId]) as any;
        const folder = allFoldersData?.data?.folders?.find((f: Folder) => f.id === id);
        if (folder?.parentId !== undefined) {
          parentId = folder.parentId;
        }
      }
      
      // Fallback: try to get from folder query if exists
      if (parentId === null) {
        const folderQuery = queryClient.getQueryData(['folder', id]) as any;
        parentId = folderQuery?.data?.data?.parentId || null;
      }

      // Snapshot previous values for rollback
      const previousFolder = parentId 
        ? queryClient.getQueryData(['folder', parentId])
        : queryClient.getQueryData(['dataRoom', dataRoomId]);
      const previousAllFolders = queryClient.getQueryData(['allFolders', dataRoomId]);

      // Optimistically update active view cache (currently open folder/dataRoom)
      if (parentId) {
        queryClient.setQueryData(['folder', parentId], (oldData: any) => {
          if (!oldData?.data?.data) return oldData;
          return {
            ...oldData,
            data: {
              ...oldData.data.data,
              children: (oldData.data.data.children || []).map((f: Folder) =>
                f.id === id ? { ...f, name } : f
              ),
            },
          };
        });
      } else if (dataRoomId) {
        queryClient.setQueryData(['dataRoom', dataRoomId], (oldData: any) => {
          if (!oldData?.data?.data) return oldData;
          return {
            ...oldData,
            data: {
              ...oldData.data.data,
              folders: (oldData.data.data.folders || []).map((f: Folder) =>
                f.id === id ? { ...f, name } : f
              ),
            },
          };
        });
      }

      // Also update the folder's own query if it's currently being viewed
      queryClient.setQueryData(['folder', id], (oldData: any) => {
        if (!oldData?.data?.data) return oldData;
        return {
          ...oldData,
          data: {
            ...oldData.data.data,
            name,
          },
        };
      });

      // Optimistically update allFolders list cache (for FileTree)
      if (dataRoomId) {
        queryClient.setQueryData(['allFolders', dataRoomId], (oldData: any) => {
          if (!oldData || !oldData.data) return oldData;
          return {
            ...oldData,
            data: {
              ...oldData.data,
              folders: (oldData.data.folders || []).map((f: Folder) =>
                f.id === id ? { ...f, name } : f
              ),
            },
          };
        });
      }

      return { parentId, previousFolder, previousAllFolders };
    },
    onSuccess: (data, _variables, context) => {
      toast.success(SUCCESS_MESSAGES.FOLDER_RENAMED);
      
      // Merge server response back into cache - use context.parentId from onMutate
      // This ensures we update the same cache keys that were optimistically updated
      const viewQueryKey = context?.parentId ? ['folder', context.parentId] : ['dataRoom', dataRoomId];
      
      // Update active view cache with server response (already updated optimistically)
      queryClient.setQueryData(viewQueryKey, (oldData: any) => {
        if (!oldData?.data?.data) return oldData;
        return {
          ...oldData,
          data: {
            ...oldData.data.data,
            children: context?.parentId 
              ? (oldData.data.data.children || []).map((f: Folder) =>
                  f.id === data.id ? { ...f, name: data.name } : f
                )
              : oldData.data.data.children,
            folders: !context?.parentId && dataRoomId
              ? (oldData.data.data.folders || []).map((f: Folder) =>
                  f.id === data.id ? { ...f, name: data.name } : f
                )
              : oldData.data.data.folders,
          },
        };
      });

      // Also update the folder's own query if it's currently being viewed
      queryClient.setQueryData(['folder', data.id], (oldData: any) => {
        if (!oldData?.data?.data) return oldData;
        return {
          ...oldData,
          data: {
            ...oldData.data.data,
            name: data.name,
          },
        };
      });
      
      // Update allFolders list cache with server response
      if (dataRoomId) {
        queryClient.setQueryData(['allFolders', dataRoomId], (oldData: any) => {
          if (!oldData || !oldData.data) return oldData;
          return {
            ...oldData,
            data: {
              ...oldData.data,
              folders: (oldData.data.folders || []).map((f: Folder) =>
                f.id === data.id ? { ...f, name: data.name } : f
              ),
            },
          };
        });
      }

      // Refetch active queries to ensure UI updates immediately (after cache updates)
      // Invalidate first to mark queries as stale, then refetch
      queryClient.invalidateQueries({ queryKey: viewQueryKey });
      queryClient.invalidateQueries({ queryKey: ['folder', data.id] });
      queryClient.invalidateQueries({ queryKey: ['allFolders', dataRoomId] });
      
      // Then refetch active queries to get fresh data
      queryClient.refetchQueries({ queryKey: ['allFolders', dataRoomId], type: 'active' });
      queryClient.refetchQueries({ queryKey: viewQueryKey, type: 'active' });
    },
    onError: (err, _variables, context) => {
      toast.error(getErrorMessage(err));
      
      // Rollback optimistic update on error
      if (context?.parentId !== undefined && dataRoomId) {
        // Restore previous values
        if (context.previousFolder) {
          const viewQueryKey = context.parentId ? ['folder', context.parentId] : ['dataRoom', dataRoomId];
          queryClient.setQueryData(viewQueryKey, context.previousFolder);
        }
        if (context.previousAllFolders) {
          queryClient.setQueryData(['allFolders', dataRoomId], context.previousAllFolders);
        }
      }
    },
  });

  const renameFileMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      performance.mark('file-rename-start');
      try {
        const response = await api.put(`/files/${id}`, { name });
        // Backend returns { success: true, data: { id, name, folderId, dataRoomId } }
        const updatedFile = response.data.data;
        return { id: updatedFile.id, name: updatedFile.name, folderId: updatedFile.folderId, dataRoomId: updatedFile.dataRoomId };
      } finally {
        performance.mark('file-rename-end');
        performance.measure('file-rename', 'file-rename-start', 'file-rename-end');
        if (process.env.NODE_ENV === 'development') {
          const measure = performance.getEntriesByName('file-rename', 'measure')[0];
          if (measure) {
            console.log(`[Performance] file-rename: ${measure.duration.toFixed(2)}ms`);
          }
        }
      }
    },
    onMutate: async ({ id, name }: { id: string; name: string }) => {
      // Cancel outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['folder'], exact: false });
      await queryClient.cancelQueries({ queryKey: ['dataRoom'], exact: false });
      await queryClient.cancelQueries({ queryKey: ['allFiles'] });

      // Get current file data to determine folderId
      // Try to find file in cache to get folderId
      let fileFolderId: string | null = folderId || null;
      
      // Try to get from allFiles cache
      if (dataRoomId) {
        const allFilesData = queryClient.getQueryData(['allFiles', dataRoomId]) as any;
        const file = allFilesData?.data?.find((f: FileType) => f.id === id);
        if (file?.folderId !== undefined) {
          fileFolderId = file.folderId;
        }
      }

      // Snapshot previous values for rollback
      const previousView = fileFolderId 
        ? queryClient.getQueryData(['folder', fileFolderId])
        : queryClient.getQueryData(['dataRoom', dataRoomId]);
      const previousAllFiles = queryClient.getQueryData(['allFiles', dataRoomId]);

      // Optimistically update active view cache (currently open folder/dataRoom)
      if (fileFolderId) {
        queryClient.setQueryData(['folder', fileFolderId], (oldData: any) => {
          if (!oldData?.data?.data) return oldData;
          return {
            ...oldData,
            data: {
              ...oldData.data.data,
              files: (oldData.data.data.files || []).map((f: FileType) =>
                f.id === id ? { ...f, name } : f
              ),
            },
          };
        });
      } else if (dataRoomId) {
        queryClient.setQueryData(['dataRoom', dataRoomId], (oldData: any) => {
          if (!oldData?.data?.data) return oldData;
          return {
            ...oldData,
            data: {
              ...oldData.data.data,
              files: (oldData.data.data.files || []).map((f: FileType) =>
                f.id === id ? { ...f, name } : f
              ),
            },
          };
        });
      }

      // Optimistically update allFiles list cache (for FileTree)
      if (dataRoomId) {
        queryClient.setQueryData(['allFiles', dataRoomId], (oldData: any) => {
          if (!oldData || !oldData.data) return oldData;
          return {
            ...oldData,
            data: (oldData.data || []).map((f: FileType) =>
              f.id === id ? { ...f, name } : f
            ),
          };
        });
      }

      return { folderId: fileFolderId, previousView, previousAllFiles };
    },
    onSuccess: (data, _variables, context) => {
      toast.success(SUCCESS_MESSAGES.FILE_RENAMED);
      
      // Merge server response back into cache - use context.folderId from onMutate
      // This ensures we update the same cache keys that were optimistically updated
      const viewQueryKey = context?.folderId ? ['folder', context.folderId] : ['dataRoom', dataRoomId];
      
      // Update active view cache with server response (already updated optimistically)
      queryClient.setQueryData(viewQueryKey, (oldData: any) => {
        if (!oldData?.data?.data) return oldData;
        return {
          ...oldData,
          data: {
            ...oldData.data.data,
            files: (oldData.data.data.files || []).map((f: FileType) =>
              f.id === data.id ? { ...f, name: data.name } : f
            ),
          },
        };
      });

      // Update allFiles list cache with server response
      if (dataRoomId) {
        queryClient.setQueryData(['allFiles', dataRoomId], (oldData: any) => {
          if (!oldData || !oldData.data) return oldData;
          return {
            ...oldData,
            data: (oldData.data || []).map((f: FileType) =>
              f.id === data.id ? { ...f, name: data.name } : f
            ),
          };
        });
      }

      // Refetch active queries to ensure UI updates immediately (after cache updates)
      // Invalidate first to mark queries as stale, then refetch
      queryClient.invalidateQueries({ queryKey: viewQueryKey });
      queryClient.invalidateQueries({ queryKey: ['allFiles', dataRoomId] });
      
      // Then refetch active queries to get fresh data
      queryClient.refetchQueries({ queryKey: ['allFiles', dataRoomId], type: 'active' });
      queryClient.refetchQueries({ queryKey: viewQueryKey, type: 'active' });
    },
    onError: (err, _variables, context) => {
      toast.error(getErrorMessage(err));
      
      // Rollback optimistic update on error
      if (context?.folderId !== undefined && dataRoomId) {
        // Restore previous values
        if (context.previousView) {
          const viewQueryKey = context.folderId ? ['folder', context.folderId] : ['dataRoom', dataRoomId];
          queryClient.setQueryData(viewQueryKey, context.previousView);
        }
        if (context.previousAllFiles) {
          queryClient.setQueryData(['allFiles', dataRoomId], context.previousAllFiles);
        }
      }
    },
  });

  const uploadFileMutation = useMutation({
    mutationFn: async ({ file, name, folderId: uploadFolderId }: { file: globalThis.File; name: string; folderId: string | null }) => {
      performance.mark('file-upload-start');
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', name);
        if (uploadFolderId) {
          formData.append('folderId', uploadFolderId);
        }
        formData.append('dataRoomId', dataRoomId as string);
        
        const response = await api.post('/files/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        
        const newFile = response.data.data as FileType;
        return { file: newFile, folderId: uploadFolderId };
      } finally {
        performance.mark('file-upload-end');
        performance.measure('file-upload', 'file-upload-start', 'file-upload-end');
        if (process.env.NODE_ENV === 'development') {
          const measure = performance.getEntriesByName('file-upload', 'measure')[0];
          if (measure) {
            console.log(`[Performance] file-upload: ${measure.duration.toFixed(2)}ms`);
          }
        }
      }
    },
    onSuccess: (data) => {
      // Surgical cache update - add file to cache
      if (dataRoomId) {
        addFileToCache(queryClient, dataRoomId, data.folderId, data.file);
      }
      
      // Mark queries as stale and refetch active queries
      // Surgical cache updates above handle immediate UI updates
      // Refetch ensures data consistency across all components (including FileTree)
      queryClient.invalidateQueries({ 
        queryKey: ['folder'], 
        exact: false,
      });
      queryClient.invalidateQueries({ 
        queryKey: ['dataRoom'], 
        exact: false,
      });
      queryClient.invalidateQueries({ 
        queryKey: ['dataRooms'],
      });
      // Invalidate allFolders and allFiles queries used by FileTree
      queryClient.invalidateQueries({ 
        queryKey: ['allFolders'],
      });
      queryClient.invalidateQueries({ 
        queryKey: ['allFiles'],
      });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  return {
    createFolderMutation,
    deleteFolderMutation,
    deleteFileMutation,
    renameFolderMutation,
    renameFileMutation,
    uploadFileMutation,
  };
};

