import { QueryClient } from '@tanstack/react-query';
import { Folder, File as FileType } from '@/types';

/**
 * Surgical cache update helpers for React Query
 * These update cache directly instead of invalidating and refetching
 */

export function updateFolderCache(
  queryClient: QueryClient,
  folderId: string | null,
  updater: (oldData: any) => any
) {
  if (folderId) {
    queryClient.setQueryData(['folder', folderId], updater);
  }
}

export function addFolderToCache(
  queryClient: QueryClient,
  dataRoomId: string,
  parentId: string | null,
  newFolder: Folder
) {
  // Update parent folder query if exists
  if (parentId) {
    queryClient.setQueryData(['folder', parentId], (oldData: any) => {
      if (!oldData?.data?.data) return oldData;
      return {
        ...oldData,
        data: {
          ...oldData.data.data,
          children: [...(oldData.data.data.children || []), newFolder],
        },
      };
    });
  }

  // Update root data room query if creating root folder
  if (!parentId) {
    queryClient.setQueryData(['dataRoom', dataRoomId], (oldData: any) => {
      if (!oldData?.data?.data) return oldData;
      return {
        ...oldData,
        data: {
          ...oldData.data.data,
          folders: [...(oldData.data.data.folders || []), newFolder],
        },
      };
    });
  }
  
  // Mark queries as stale and refetch active queries
  // Cache updates above handle immediate UI updates
  if (parentId) {
    queryClient.invalidateQueries({ 
      queryKey: ['folder', parentId],
    });
  } else {
    queryClient.invalidateQueries({ 
      queryKey: ['dataRoom', dataRoomId],
    });
  }
}

export function removeFolderFromCache(
  queryClient: QueryClient,
  dataRoomId: string,
  parentId: string | null,
  folderId: string
) {
  // Update parent folder query if exists
  if (parentId) {
    queryClient.setQueryData(['folder', parentId], (oldData: any) => {
      if (!oldData?.data?.data) return oldData;
      return {
        ...oldData,
        data: {
          ...oldData.data.data,
          children: (oldData.data.data.children || []).filter(
            (f: Folder) => f.id !== folderId
          ),
        },
      };
    });
  }

  // Update root data room query if deleting root folder
  if (!parentId) {
    queryClient.setQueryData(['dataRoom', dataRoomId], (oldData: any) => {
      if (!oldData?.data?.data) return oldData;
      return {
        ...oldData,
        data: {
          ...oldData.data.data,
          folders: (oldData.data.data.folders || []).filter(
            (f: Folder) => f.id !== folderId
          ),
        },
      };
    });
  }
  
  // Mark queries as stale and refetch active queries
  if (parentId) {
    queryClient.invalidateQueries({ 
      queryKey: ['folder', parentId],
    });
  } else {
    queryClient.invalidateQueries({ 
      queryKey: ['dataRoom', dataRoomId],
    });
  }
  
  // Invalidate the deleted folder's query if it exists
  queryClient.invalidateQueries({ 
    queryKey: ['folder', folderId],
  });
}

export function updateFolderInCache(
  queryClient: QueryClient,
  folderId: string,
  parentId: string | null,
  updatedFolder: Folder
) {
  // Update the folder's own query
  queryClient.setQueryData(['folder', folderId], (oldData: any) => {
    if (!oldData?.data?.data) return oldData;
    return {
      ...oldData,
      data: {
        ...oldData.data.data,
        ...updatedFolder,
      },
    };
  });

  // Update parent folder query if exists
  if (parentId) {
    queryClient.setQueryData(['folder', parentId], (oldData: any) => {
      if (!oldData?.data?.data) return oldData;
      return {
        ...oldData,
        data: {
          ...oldData.data.data,
          children: (oldData.data.data.children || []).map((f: Folder) =>
            f.id === folderId ? updatedFolder : f
          ),
        },
      };
    });
  } else {
    // Update root data room query if renaming root folder
    queryClient.setQueryData(['dataRoom', updatedFolder.dataRoomId], (oldData: any) => {
      if (!oldData?.data?.data) return oldData;
      return {
        ...oldData,
        data: {
          ...oldData.data.data,
          folders: (oldData.data.data.folders || []).map((f: Folder) =>
            f.id === folderId ? updatedFolder : f
          ),
        },
      };
    });
  }
  
  // Mark queries as stale and refetch active queries
  queryClient.invalidateQueries({ 
    queryKey: ['folder', folderId],
  });
  if (parentId) {
    queryClient.invalidateQueries({ 
      queryKey: ['folder', parentId],
    });
  } else {
    queryClient.invalidateQueries({ 
      queryKey: ['dataRoom', updatedFolder.dataRoomId],
    });
  }
}

export function addFileToCache(
  queryClient: QueryClient,
  dataRoomId: string,
  folderId: string | null,
  newFile: FileType
) {
  // Update folder query if file is in a folder
  if (folderId) {
    queryClient.setQueryData(['folder', folderId], (oldData: any) => {
      if (!oldData?.data?.data) return oldData;
      return {
        ...oldData,
        data: {
          ...oldData.data.data,
          files: [...(oldData.data.data.files || []), newFile],
        },
      };
    });
  }

  // Update root data room query if uploading to root
  if (!folderId) {
    queryClient.setQueryData(['dataRoom', dataRoomId], (oldData: any) => {
      if (!oldData?.data?.data) return oldData;
      return {
        ...oldData,
        data: {
          ...oldData.data.data,
          files: [...(oldData.data.data.files || []), newFile],
        },
      };
    });
  }
  
  // Mark queries as stale and refetch active queries
  if (folderId) {
    queryClient.invalidateQueries({ 
      queryKey: ['folder', folderId],
    });
  } else {
    queryClient.invalidateQueries({ 
      queryKey: ['dataRoom', dataRoomId],
    });
  }
}

export function removeFileFromCache(
  queryClient: QueryClient,
  dataRoomId: string,
  folderId: string | null,
  fileId: string
) {
  // Update folder query if file is in a folder
  if (folderId) {
    queryClient.setQueryData(['folder', folderId], (oldData: any) => {
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

  // Update root data room query if deleting root file
  if (!folderId) {
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
  
  // Mark queries as stale and refetch active queries
  if (folderId) {
    queryClient.invalidateQueries({ 
      queryKey: ['folder', folderId],
    });
  } else {
    queryClient.invalidateQueries({ 
      queryKey: ['dataRoom', dataRoomId],
    });
  }
}

export function updateFileInCache(
  queryClient: QueryClient,
  fileId: string,
  folderId: string | null,
  updatedFile: FileType,
  dataRoomId?: string
) {
  // Update folder query if file is in a folder
  if (folderId) {
    queryClient.setQueryData(['folder', folderId], (oldData: any) => {
      if (!oldData?.data?.data) return oldData;
      return {
        ...oldData,
        data: {
          ...oldData.data.data,
          files: (oldData.data.data.files || []).map((f: FileType) =>
            f.id === fileId ? updatedFile : f
          ),
        },
      };
    });
  }

  // Update root data room query if file is at root
  // Use dataRoomId parameter if provided, otherwise try to get from file.folder
  const fileDataRoomId = dataRoomId || updatedFile.folder?.dataRoomId;
  if (!folderId && fileDataRoomId) {
    queryClient.setQueryData(['dataRoom', fileDataRoomId], (oldData: any) => {
      if (!oldData?.data?.data) return oldData;
      return {
        ...oldData,
        data: {
          ...oldData.data.data,
          files: (oldData.data.data.files || []).map((f: FileType) =>
            f.id === fileId ? updatedFile : f
          ),
        },
      };
    });
  }
  
  // Mark queries as stale and refetch active queries
  if (folderId) {
    queryClient.invalidateQueries({ 
      queryKey: ['folder', folderId],
    });
  } else if (fileDataRoomId) {
    queryClient.invalidateQueries({ 
      queryKey: ['dataRoom', fileDataRoomId],
    });
  }
}

