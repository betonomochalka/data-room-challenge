import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import { getErrorMessage, SUCCESS_MESSAGES } from '../lib/errorMessages';
import { File, FolderWithChildren } from '@/types';

interface UseDataRoomMutationsProps {
  dataRoomId?: string;
  folderId?: string;
}

/**
 * Custom hook for data room mutations (create, update, delete)
 */
export const useDataRoomMutations = ({ dataRoomId, folderId }: UseDataRoomMutationsProps) => {
  const queryClient = useQueryClient();

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['dataRoom', dataRoomId] });
    queryClient.invalidateQueries({ queryKey: ['allFolders', dataRoomId] });
    queryClient.invalidateQueries({ queryKey: ['allFiles', dataRoomId] });
    if (folderId) {
      queryClient.invalidateQueries({ queryKey: ['folder', folderId] });
    }
  };

  const createFolderMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await api.post('/folders', {
        name,
        dataRoomId,
        parentId: folderId || null,
      });
      return response.data.data;
    },
    onMutate: async (newFolderName: string) => {
      const viewQueryKey = folderId ? ['folder', folderId] : ['dataRoom', dataRoomId];
      
      await queryClient.cancelQueries({ queryKey: ['allFolders', dataRoomId] });
      await queryClient.cancelQueries({ queryKey: viewQueryKey, exact: false });

      const previousFolders = queryClient.getQueryData(['allFolders', dataRoomId]);
      const previousView = queryClient.getQueryData(viewQueryKey);
      
      const optimisticFolder: Partial<FolderWithChildren> & { id: string, isOptimistic: boolean } = {
        id: generateTemporaryId(),
        name: newFolderName,
        dataRoomId: dataRoomId,
        parentId: folderId || null,
        children: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isOptimistic: true,
      };

      // Update allFolders query
      queryClient.setQueryData(['allFolders', dataRoomId], (old: any) =>
        old ? { 
          ...old, 
          data: { 
            ...old.data, 
            folders: [...(old.data.folders || []).filter((f: any) => f != null), optimisticFolder] 
          } 
        } : { data: { folders: [optimisticFolder] } }
      );

      // Update dataRoom/folder view query
      queryClient.setQueryData(viewQueryKey, (old: any) => {
        if (!old) return old;
        const newFolders = folderId 
          ? [...(old.data.children || []).filter((f: any) => f != null), optimisticFolder] 
          : [...(old.data.folders || []).filter((f: any) => f != null), optimisticFolder];
        
        const updatedData = folderId
          ? { ...old.data, children: newFolders }
          : { ...old.data, folders: newFolders };

        return { ...old, data: updatedData };
      });

      return { previousFolders, previousView, optimisticFolder };
    },
    onSuccess: (savedFolder, variables, context) => {
      toast.success(SUCCESS_MESSAGES.FOLDER_CREATED);
      queryClient.setQueryData(['allFolders', dataRoomId], (old: any) => {
        if (!old || !old.data || !old.data.folders) return old;
        const newFolders = old.data.folders
          .filter((folder: FolderWithChildren) => folder != null)
          .map((folder: FolderWithChildren) => 
            folder.id === context?.optimisticFolder.id ? savedFolder : folder
          );
        return { ...old, data: { ...old.data, folders: newFolders } };
      });
    },
    onError: (err, variables, context) => {
      toast.error(getErrorMessage(err));
      if (context?.previousFolders) {
        queryClient.setQueryData(['allFolders', dataRoomId], context.previousFolders);
      }
      if (context?.previousView) {
        const viewQueryKey = folderId ? ['folder', folderId] : ['dataRoom', dataRoomId];
        queryClient.setQueryData(viewQueryKey, context.previousView);
      }
    },
    onSettled: () => {
      invalidateQueries();
    }
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (folderIdToDelete: string) => {
      try {
        await api.delete(`/folders/${folderIdToDelete}`);
        return { id: folderIdToDelete };
      } catch (error: any) {
        throw error;
      }
    },
    onMutate: async (folderIdToDelete: string) => {
      await queryClient.cancelQueries({ queryKey: ['allFolders', dataRoomId] });

      const previousFolders = queryClient.getQueryData(['allFolders', dataRoomId]);

      queryClient.setQueryData(['allFolders', dataRoomId], (old: any) => {
        if (!old || !old.data || !old.data.folders) return old;
        const newFolders = old.data.folders.filter((folder: FolderWithChildren) => folder != null && folder.id !== folderIdToDelete);
        return { ...old, data: { ...old.data, folders: newFolders } };
      });

      return { previousFolders };
    },
    onSuccess: () => {
      toast.success(SUCCESS_MESSAGES.FOLDER_DELETED);
    },
    onError: (err, variables, context) => {
      toast.error(getErrorMessage(err));
      if (context?.previousFolders) {
        queryClient.setQueryData(['allFolders', dataRoomId], context.previousFolders);
      }
    },
    onSettled: () => {
      invalidateQueries();
    }
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: string) => {
      try {
        await api.delete(`/files/${fileId}`);
        return { id: fileId };
      } catch (error: any) {
        throw error;
      }
    },
    onMutate: async (fileId: string) => {
      await queryClient.cancelQueries({ queryKey: ['allFiles', dataRoomId] });

      const previousFiles = queryClient.getQueryData(['allFiles', dataRoomId]);

      queryClient.setQueryData(['allFiles', dataRoomId], (old: any) => {
        if (!old || !old.data) return old;
        const newFiles = old.data.filter((file: File) => file != null && file.id !== fileId);
        return { ...old, data: newFiles };
      });

      return { previousFiles };
    },
    onSuccess: () => {
      toast.success(SUCCESS_MESSAGES.FILE_DELETED);
    },
    onError: (err, variables, context) => {
      toast.error(getErrorMessage(err));
      if (context?.previousFiles) {
        queryClient.setQueryData(['allFiles', dataRoomId], context.previousFiles);
      }
    },
    onSettled: () => {
      invalidateQueries();
    }
  });

  const renameFolderMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const response = await api.patch(`/folders/${id}/rename`, { name });
      return response.data;
    },
    onMutate: async ({ id, name }: { id: string; name: string }) => {
      const viewQueryKey = folderId ? ['folder', folderId] : ['dataRoom', dataRoomId];
      
      await queryClient.cancelQueries({ queryKey: ['allFolders', dataRoomId] });
      await queryClient.cancelQueries({ queryKey: viewQueryKey });

      const previousFolders = queryClient.getQueryData(['allFolders', dataRoomId]);
      const previousView = queryClient.getQueryData(viewQueryKey);

      // Update allFolders cache
      queryClient.setQueryData(['allFolders', dataRoomId], (old: any) => {
        if (!old || !old.data || !old.data.folders) return old;
        const newFolders = old.data.folders
          .filter((folder: FolderWithChildren) => folder != null)
          .map((folder: FolderWithChildren) =>
            folder.id === id ? { ...folder, name } : folder
          );
        return { ...old, data: { ...old.data, folders: newFolders } };
      });

      // Update folder view cache (for FolderView) or dataRoom cache (for DataRoomRoot)
      queryClient.setQueryData(viewQueryKey, (old: any) => {
        if (!old || !old.data) return old;
        
        // For folder view, update children array
        if (folderId && old.data.children) {
          const newChildren = old.data.children
            .filter((folder: FolderWithChildren) => folder != null)
            .map((folder: FolderWithChildren) =>
              folder.id === id ? { ...folder, name } : folder
            );
          return { ...old, data: { ...old.data, children: newChildren } };
        }
        
        // For data room root, update folders array
        if (!folderId && old.data.folders) {
          const newFolders = old.data.folders
            .filter((folder: FolderWithChildren) => folder != null)
            .map((folder: FolderWithChildren) =>
              folder.id === id ? { ...folder, name } : folder
            );
          return { ...old, data: { ...old.data, folders: newFolders } };
        }
        
        return old;
      });

      return { previousFolders, previousView };
    },
    onSuccess: () => {
      toast.success(SUCCESS_MESSAGES.FOLDER_RENAMED);
      invalidateQueries();
    },
    onError: (err, variables, context) => {
      toast.error(getErrorMessage(err));
      if (context?.previousFolders) {
        queryClient.setQueryData(['allFolders', dataRoomId], context.previousFolders);
      }
      if (context?.previousView) {
        const viewQueryKey = folderId ? ['folder', folderId] : ['dataRoom', dataRoomId];
        queryClient.setQueryData(viewQueryKey, context.previousView);
      }
    },
  });

  const renameFileMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const response = await api.put(`/files/${id}`, { name });
      return response.data;
    },
    onMutate: async ({ id, name }: { id: string; name: string }) => {
      const viewQueryKey = folderId ? ['folder', folderId] : ['dataRoom', dataRoomId];
      
      await queryClient.cancelQueries({ queryKey: ['allFiles', dataRoomId] });
      await queryClient.cancelQueries({ queryKey: viewQueryKey });

      const previousFiles = queryClient.getQueryData(['allFiles', dataRoomId]);
      const previousView = queryClient.getQueryData(viewQueryKey);

      // Update allFiles cache
      queryClient.setQueryData(['allFiles', dataRoomId], (old: any) => {
        if (!old || !old.data) return old;
        const newFiles = old.data
          .filter((file: File) => file != null)
          .map((file: File) =>
            file.id === id ? { ...file, name } : file
          );
        return { ...old, data: newFiles };
      });

      // Update folder view cache (for FolderView) or dataRoom cache (for DataRoomRoot)
      queryClient.setQueryData(viewQueryKey, (old: any) => {
        if (!old || !old.data) return old;
        
        // For folder view, update files array
        if (folderId && old.data.files) {
          const newFiles = old.data.files
            .filter((file: File) => file != null)
            .map((file: File) =>
              file.id === id ? { ...file, name } : file
            );
          return { ...old, data: { ...old.data, files: newFiles } };
        }
        
        // For data room root (files are in allFiles query, not in dataRoom query)
        // so no need to update here, but still return old to be safe
        return old;
      });

      return { previousFiles, previousView };
    },
    onSuccess: () => {
      toast.success(SUCCESS_MESSAGES.FILE_RENAMED);
      invalidateQueries();
    },
    onError: (err, variables, context) => {
      toast.error(getErrorMessage(err));
      if (context?.previousFiles) {
        queryClient.setQueryData(['allFiles', dataRoomId], context.previousFiles);
      }
      if (context?.previousView) {
        const viewQueryKey = folderId ? ['folder', folderId] : ['dataRoom', dataRoomId];
        queryClient.setQueryData(viewQueryKey, context.previousView);
      }
    },
  });

  const uploadFileMutation = useMutation({
    mutationFn: async ({ file, name, folderId }: { file: globalThis.File; name: string; folderId: string | null }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', name);
      if (folderId) {
        formData.append('folderId', folderId);
      }
      formData.append('dataRoomId', dataRoomId as string);
      
      const response = await api.post('/files/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      return response.data.data;
    },
    onMutate: async (newFile: { file: globalThis.File; name: string; folderId: string | null }) => {
      await queryClient.cancelQueries({ queryKey: ['allFiles', dataRoomId] });

      const previousFiles = queryClient.getQueryData(['allFiles', dataRoomId]);

      const optimisticFile: Partial<File> & { id: string, isOptimistic: boolean } = {
        id: generateTemporaryId(),
        name: newFile.name,
        fileSize: newFile.file.size,
        mimeType: newFile.file.type,
        folderId: newFile.folderId || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isOptimistic: true,
      };

      queryClient.setQueryData(['allFiles', dataRoomId], (old: any) => 
        old ? { ...old, data: [...(old.data || []).filter((f: any) => f != null), optimisticFile] } : { data: [optimisticFile] }
      );

      return { previousFiles, optimisticFile };
    },
    onSuccess: (savedFile, variables, context) => {
      queryClient.setQueryData(['allFiles', dataRoomId], (old: any) => {
        if (!old || !old.data) return old;
        const newData = old.data
          .filter((file: File) => file != null)
          .map((file: File) => 
            file.id === context?.optimisticFile.id ? savedFile : file
          );
        return { ...old, data: newData };
      });
    },
    onError: (err, variables, context) => {
      toast.error(getErrorMessage(err));
      if (context?.previousFiles) {
        queryClient.setQueryData(['allFiles', dataRoomId], context.previousFiles);
      }
    },
    onSettled: () => {
      invalidateQueries();
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

// Helper to generate a temporary ID
const generateTemporaryId = () => `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

