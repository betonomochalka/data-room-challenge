import { useQuery } from '@tanstack/react-query';
import { ApiResponse, DataRoom, FolderWithChildren, File } from '../types/index';
import { api } from '../lib/api';

interface UseDataRoomDataProps {
  dataRoomId?: string;
  folderId?: string;
}

type DataRoomContents = DataRoom & {
  folders: FolderWithChildren[];
  files: File[];
};

/**
 * Custom hook for fetching data room and folder contents in a consolidated manner.
 */
export const useDataRoomData = ({ dataRoomId, folderId }: UseDataRoomDataProps) => {
  const isValidDataRoomId = dataRoomId && !dataRoomId.startsWith('temp-');
  const isValidFolderId = !folderId || !folderId.startsWith('temp-');
  const isValidId = isValidDataRoomId && isValidFolderId;

  const dataQuery = useQuery<ApiResponse<DataRoomContents | any>>({
    queryKey: folderId ? ['folder', folderId] : ['dataRoom', dataRoomId],
    queryFn: async () => {
      const url = folderId 
        ? `/folders/${folderId}/contents` 
        : `/data-rooms/${dataRoomId}`;
      const response = await api.get(url);
      return response.data;
    },
    enabled: !!isValidId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000,   // 5 minutes cache
  });

  // Fetch ALL files from entire data room (for search and file tree)
  // This is kept separate as it serves a different purpose and we don't want to load it on every view.
  const filesQuery = useQuery({
    queryKey: ['allFiles', dataRoomId],
    queryFn: async () => {
      const response = await api.get('/files', { params: { dataRoomId } });
      return response.data;
    },
    enabled: !!isValidId,
    staleTime: 5 * 60 * 1000, // 5 minutes - this data is less likely to change frequently
    gcTime: 10 * 60 * 1000,  // 10 minutes cache
  });

  const foldersQuery = useQuery({
    queryKey: ['allFolders', dataRoomId],
    queryFn: async () => {
      const response = await api.get('/folders', { params: { dataRoomId } });
      return response.data;
    },
    enabled: !!isValidId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,  // 10 minutes cache
  });

  return {
    data: dataQuery.data?.data,
    isLoading: dataQuery.isLoading,
    isError: dataQuery.isError,
    error: dataQuery.error,
    filesQuery,
    foldersQuery,
    folderQuery: folderId ? dataQuery : undefined,
    dataRoomQuery: !folderId ? dataQuery : undefined,
  };
};

