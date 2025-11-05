import { useQuery } from '@tanstack/react-query';
import { ApiResponse, DataRoom, FolderWithChildren, File } from '../types/index';
import { api } from '../lib/api';

interface UseDataRoomDataProps {
  dataRoomId?: string;
  folderId?: string;
  enableAllFolders?: boolean; // Enable allFolders query (for search/tree/navigation)
  enableAllFiles?: boolean;   // Enable allFiles query (for search/tree)
}

type DataRoomContents = DataRoom & {
  folders: FolderWithChildren[];
  files: File[];
};

/**
 * Custom hook for fetching data room and folder contents in a consolidated manner.
 * 
 * Optimizations:
 * - When viewing a folder (folderId provided), foldersQuery is disabled as it's redundant
 *   since folder contents are already fetched via dataQuery
 */
export const useDataRoomData = ({ 
  dataRoomId, 
  folderId,
  enableAllFolders = false,
  enableAllFiles = false 
}: UseDataRoomDataProps) => {
  const isValidId = !!dataRoomId;

  const dataQuery = useQuery<ApiResponse<DataRoomContents | any>>({
    queryKey: folderId ? ['folder', folderId] : ['dataRoom', dataRoomId],
    queryFn: async () => {
      const url = folderId 
        ? `/folders/${folderId}/contents` 
        : `/data-rooms/${dataRoomId}`;
      
      // Performance marks for client-side timing
      const markName = folderId ? `folder-${folderId}-fetch` : `dataroom-${dataRoomId}-fetch`;
      performance.mark(`${markName}-start`);
      
      try {
        const response = await api.get(url, {
          params: {
            // Slim payload: only request essential fields
            fields: 'id,name,parentId,dataRoomId,createdAt,updatedAt,mimeType,fileSize,folderId',
          },
        });
        
        performance.mark(`${markName}-end`);
        performance.measure(
          `${markName}-duration`,
          `${markName}-start`,
          `${markName}-end`
        );
        
        // Log measurement to console in development
        if (process.env.NODE_ENV === 'development') {
          const measure = performance.getEntriesByName(`${markName}-duration`, 'measure')[0];
          if (measure) {
            console.log(`[Performance] ${markName}: ${measure.duration.toFixed(2)}ms`);
          }
        }
        
        return response.data;
      } catch (error) {
        performance.mark(`${markName}-end`);
        performance.measure(
          `${markName}-duration`,
          `${markName}-start`,
          `${markName}-end`
        );
        throw error;
      }
    },
    enabled: isValidId,
    staleTime: folderId ? 2 * 60 * 1000 : 5 * 60 * 1000, // 2 min for folders, 5 min for root data room
    gcTime: folderId ? 5 * 60 * 1000 : 10 * 60 * 1000,   // 5 min for folders, 10 min for root data room
  });

  // Fetch ALL files from entire data room (for search and file tree)
  // Deferred until explicitly enabled (when search is active or file tree is opened)
  const filesQuery = useQuery({
    queryKey: ['allFiles', dataRoomId],
    queryFn: async () => {
      const response = await api.get('/files', { 
        params: { 
          dataRoomId,
          // Slim payload: only request essential fields
          fields: 'id,name,mimeType,fileSize,folderId,createdAt,updatedAt',
        },
      });
      return response.data;
    },
    enabled: isValidId && enableAllFiles, // Only fetch when explicitly enabled
    staleTime: 5 * 60 * 1000, // 5 minutes - this data is less likely to change frequently
    gcTime: 10 * 60 * 1000,  // 10 minutes cache
  });

  // Fetch ALL folders (for navigation, search, and file tree)
  // Deferred until explicitly enabled or when viewing root (for FolderView path resolution)
  const foldersQuery = useQuery({
    queryKey: ['allFolders', dataRoomId],
    queryFn: async () => {
      const response = await api.get('/folders', { 
        params: { 
          dataRoomId,
          // Slim payload: only request essential fields
          fields: 'id,name,parentId,dataRoomId,createdAt,updatedAt',
        },
      });
      return response.data;
    },
    enabled: isValidId && (enableAllFolders || !folderId), // Enable when requested OR when at root (for path resolution)
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

