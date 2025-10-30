import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import { getErrorMessage } from '../lib/errorMessages';

interface GoogleDriveStatus {
  connected: boolean;
  userInfo?: {
    email: string;
    name: string;
    picture?: string;
  };
}

export function useGoogleDrive() {
  const queryClient = useQueryClient();

  // Query to get Google Drive connection status
  const statusQuery = useQuery<GoogleDriveStatus>({
    queryKey: ['googleDrive', 'status'],
    queryFn: async () => {
      const response = await api.get('/google-drive/status');
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true, // Refetch when user returns to the tab
  });

  // Mutation to connect Google Drive
  const connectMutation = useMutation({
    mutationFn: async () => {
      const response = await api.get('/google-drive/auth');
      return response.data.data.authUrl;
    },
    onSuccess: (authUrl: string) => {
      // Redirect to Google OAuth
      window.location.href = authUrl;
    },
    onError: (error: unknown) => {
      const errorMessage = getErrorMessage(error);
      toast.error(errorMessage);
    },
  });

  // Mutation to disconnect Google Drive
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await api.delete('/google-drive/disconnect');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['googleDrive'] });
      toast.success('Google Drive disconnected successfully');
    },
    onError: (error: unknown) => {
      const errorMessage = getErrorMessage(error);
      toast.error(errorMessage);
    },
  });

  return {
    status: statusQuery.data,
    isLoading: statusQuery.isLoading,
    isConnected: statusQuery.data?.connected || false,
    connect: connectMutation.mutate,
    disconnect: disconnectMutation.mutate,
    isConnecting: connectMutation.isPending,
    isDisconnecting: disconnectMutation.isPending,
    refetchStatus: statusQuery.refetch,
  };
}

