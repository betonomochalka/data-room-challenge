import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import { getErrorMessage, SUCCESS_MESSAGES, LOADING_MESSAGES } from '../lib/errorMessages';
import { ApiResponse, DataRoom, Folder, File as FileType } from '../types/index';

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
      queryClient.invalidateQueries({ queryKey: ['files', dataRoomId, folderId] });
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
    onMutate: async (name: string) => {
      const queryKey = folderId ? ['folder', folderId] : ['dataRoom', dataRoomId];
      await queryClient.cancelQueries({ queryKey });

      const previousData = queryClient.getQueryData<ApiResponse<DataRoom | { folder: Folder, children: Folder[] }>>(queryKey);

      if (previousData) {
        queryClient.setQueryData<ApiResponse<DataRoom | { folder: Folder, children: Folder[] }>>(queryKey, oldData => {
          if (!oldData || !oldData.data || !dataRoomId) return oldData;
          
          const newFolder: Folder = {
            id: 'temp-id',
            name,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            dataRoomId: dataRoomId,
            parentId: folderId || null,
          };

          let updatedData;

          if ('folder' in oldData.data) { // Folder view
            updatedData = {
              ...oldData,
              data: {
                ...oldData.data,
                children: [...oldData.data.children, newFolder]
              }
            };
          } else { // DataRoom view
            updatedData = {
              ...oldData,
              data: {
                ...oldData.data,
                folders: [...(oldData.data as DataRoom).folders || [], newFolder]
              }
            };
          }
          return updatedData;
        });
      }
      return { previousData };
    },
    onSuccess: () => {
      toast.success(SUCCESS_MESSAGES.FOLDER_CREATED);
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        const queryKey = folderId ? ['folder', folderId] : ['dataRoom', dataRoomId];
        queryClient.setQueryData(queryKey, context.previousData);
      }
      toast.error(getErrorMessage(err));
    },
    onSettled: () => {
      invalidateQueries();
    },
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
    onSuccess: () => {
      toast.success(SUCCESS_MESSAGES.FOLDER_DELETED);
      invalidateQueries();
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error));
    },
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
    onSuccess: () => {
      toast.success(SUCCESS_MESSAGES.FILE_DELETED);
      invalidateQueries();
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error));
    },
  });

  const renameFolderMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const response = await api.patch(`/folders/${id}/rename`, { name });
      return response.data;
    },
    onMutate: async ({ id, name }) => {
      const queryKey = folderId ? ['folder', folderId] : ['dataRoom', dataRoomId];
      await queryClient.cancelQueries({ queryKey });
      
      const previousData = queryClient.getQueryData<ApiResponse<DataRoom | { folder: Folder, children: Folder[] }>>(queryKey);
      
      if (previousData) {
        queryClient.setQueryData<ApiResponse<DataRoom | { folder: Folder, children: Folder[] }>>(queryKey, oldData => {
          if (!oldData || !oldData.data) return oldData;

          let updatedData;

          if ('folder' in oldData.data) { // Folder view
            updatedData = {
              ...oldData,
              data: {
                ...oldData.data,
                children: oldData.data.children.map(f => f.id === id ? { ...f, name } : f)
              }
            };
          } else { // DataRoom view
            updatedData = {
              ...oldData,
              data: {
                ...oldData.data,
                folders: (oldData.data as DataRoom).folders?.map(f => f.id === id ? { ...f, name } : f)
              }
            };
          }
          return updatedData;
        });
      }
      return { previousData };
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        const queryKey = folderId ? ['folder', folderId] : ['dataRoom', dataRoomId];
        queryClient.setQueryData(queryKey, context.previousData);
      }
      toast.error(getErrorMessage(err));
    },
    onSettled: () => {
      invalidateQueries();
    },
  });

  const renameFileMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const response = await api.put(`/files/${id}`, { name });
      return response.data;
    },
    onMutate: async ({ id, name }) => {
      const queryKey = folderId ? ['folder', folderId] : ['dataRoom', dataRoomId];
      await queryClient.cancelQueries({ queryKey });

      const previousData = queryClient.getQueryData<ApiResponse<any>>(queryKey);

      if (previousData) {
        queryClient.setQueryData<ApiResponse<any>>(queryKey, oldData => {
          if (!oldData || !oldData.data) return oldData;

          const files = 'files' in oldData.data ? oldData.data.files : oldData.data.dataRoom?.files;
          const updatedFiles = files.map((f: any) => f.id === id ? { ...f, name } : f);

          let updatedData;
          if ('files' in oldData.data) {
            updatedData = { ...oldData, data: { ...oldData.data, files: updatedFiles } };
          } else {
            updatedData = { ...oldData, data: { ...oldData.data, dataRoom: { ...oldData.data.dataRoom, files: updatedFiles } } };
          }
          
          return updatedData;
        });
      }
      return { previousData };
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        const queryKey = folderId ? ['folder', folderId] : ['dataRoom', dataRoomId];
        queryClient.setQueryData(queryKey, context.previousData);
      }
      toast.error(getErrorMessage(err));
    },
    onSettled: () => {
      invalidateQueries();
    },
  });

  const uploadFileMutation = useMutation({
    mutationFn: async ({ file, name, folderId }: { file: File; name: string; folderId: string | null }) => {
      const toastId = toast.loading(LOADING_MESSAGES.UPLOADING_FILE);
      
      try {
        const maxSize = 100 * 1024 * 1024; // 100MB in bytes
        if (file.size && file.size > maxSize) {
          throw new Error(`File size exceeds 100MB limit. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB. Please compress the file or upload a smaller file.`);
        }

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
        
        toast.dismiss(toastId);
        return response.data.data;
      } catch (error) {
        toast.dismiss(toastId);
        throw error;
      }
    },
    onMutate: async ({ file, name }) => {
      const queryKey = folderId ? ['folder', folderId] : ['dataRoom', dataRoomId];
      await queryClient.cancelQueries({ queryKey });

      const previousData = queryClient.getQueryData<ApiResponse<DataRoom | { folder: Folder, files: FileType[] }>>(queryKey);
      
      if (previousData) {
        queryClient.setQueryData<ApiResponse<DataRoom | { folder: Folder, files: FileType[] }>>(queryKey, oldData => {
          if (!oldData || !oldData.data || !dataRoomId) return oldData;
          
          const newFile: FileType = {
            id: 'temp-id',
            name,
            fileSize: file.size,
            mimeType: file.type,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            folderId: folderId!,
          };

          let updatedData;

          if ('folder' in oldData.data) { // Folder view
            updatedData = {
              ...oldData,
              data: {
                ...oldData.data,
                files: [...(oldData.data.files || []), newFile]
              }
            };
          } else { // DataRoom view
            // The optimistic update for the data room view is complex and the current
            // implementation is incorrect as DataRoom does not have a `files` property.
            // We will rely on query invalidation to update the view.
            updatedData = oldData;
          }
          return updatedData;
        });
      }
      return { previousData };
    },
    onSuccess: () => {
      toast.success(SUCCESS_MESSAGES.FILE_UPLOADED);
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        const queryKey = folderId ? ['folder', folderId] : ['dataRoom', dataRoomId];
        queryClient.setQueryData(queryKey, context.previousData);
      }
      toast.error(getErrorMessage(err));
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

