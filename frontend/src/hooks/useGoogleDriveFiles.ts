import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import { getErrorMessage } from '../lib/errorMessages';

interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  iconLink?: string;
}

interface GoogleDriveFilesResponse {
  files: GoogleDriveFile[];
  nextPageToken?: string;
}

export function useGoogleDriveFiles(enabled: boolean = true) {
  // Query to list Google Drive files
  const filesQuery = useQuery<GoogleDriveFilesResponse>({
    queryKey: ['googleDrive', 'files'],
    queryFn: async () => {
      const response = await api.get('/google-drive/files', {
        params: {
          pageSize: 50,
          // Backend already filters out folders and trashed files
        }
      });
      return response.data.data;
    },
    enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Mutation to import files from Google Drive
  const importFilesMutation = useMutation({
    mutationFn: async ({ 
      fileIds, 
      dataRoomId, 
      folderId 
    }: { 
      fileIds: string[]; 
      dataRoomId?: string; 
      folderId?: string;
    }) => {
      const response = await api.post('/google-drive/import-multiple', {
        fileIds,
        dataRoomId,
        folderId,
      });
      return response.data.data;
    },
    onSuccess: (data) => {
      const count = data.success?.length || 0;
      const failed = data.failed?.length || 0;
      if (count > 0) {
        toast.success(`Successfully imported ${count} file${count !== 1 ? 's' : ''} from Google Drive`);
      }
      if (failed > 0) {
        toast.error(`Failed to import ${failed} file${failed !== 1 ? 's' : ''}`);
      }
    },
    onError: (error: unknown) => {
      const errorMessage = getErrorMessage(error);
      toast.error(errorMessage);
    },
  });

  return {
    files: filesQuery.data?.files || [],
    isLoading: filesQuery.isLoading,
    error: filesQuery.error,
    refetch: filesQuery.refetch,
    importFiles: importFilesMutation.mutate,
    isImporting: importFilesMutation.isPending,
    nextPageToken: filesQuery.data?.nextPageToken,
  };
}

