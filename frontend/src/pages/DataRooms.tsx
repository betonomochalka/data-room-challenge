import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, FolderOpen, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/Dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../components/ui/AlertDialog';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Skeleton } from '../components/ui/Skeleton';
import { GoogleDriveStatus } from '../components/GoogleDrive';
import { formatDate } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { DataRoom } from '../types';
import { toast } from '../lib/toast';
import { getErrorMessage, SUCCESS_MESSAGES } from '../lib/errorMessages';

export const DataRooms: React.FC = () => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newDataRoomName, setNewDataRoomName] = useState('');
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: dataRooms, isLoading } = useQuery<DataRoom[]>({
    queryKey: ['dataRooms'],
    queryFn: async (): Promise<DataRoom[]> => {
      if (!user) {
        return [];
      }

      const response = await api.get('/data-rooms');
      return response.data.data || [];
    },
    enabled: !!user, // Only run when user is available
    staleTime: 5 * 60 * 1000, // 5 minutes - data rooms don't change often
    gcTime: 10 * 60 * 1000, // 10 minutes cache time (replaces cacheTime)
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!user) throw new Error('User not authenticated');

      const response = await api.post('/data-rooms', { name });
      return response.data.data;
    },
    // Optimistic update: Add immediately to UI
    onMutate: async (name: string) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['dataRooms'] });

      // Snapshot previous value
      const previousDataRooms = queryClient.getQueryData<DataRoom[]>(['dataRooms']);

      // Optimistically update with temporary data room
      const tempDataRoom: DataRoom = {
        id: `temp-${Date.now()}`, // Temporary ID
        name,
        ownerId: user?.id || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      queryClient.setQueryData<DataRoom[]>(['dataRooms'], (old = []) => [tempDataRoom, ...old]);

      // Return context with snapshot
      return { previousDataRooms };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dataRooms'] });
      setIsCreateDialogOpen(false);
      setNewDataRoomName('');
      toast.success(SUCCESS_MESSAGES.DATA_ROOM_CREATED);
    },
    // On error, rollback to previous state
    onError: (error: unknown, name: string, context: any) => {
      console.error('❌ Data room creation failed:', getErrorMessage(error));
      if (context?.previousDataRooms) {
        queryClient.setQueryData(['dataRooms'], context.previousDataRooms);
      }

      const errorMessage = getErrorMessage(error);
      toast.error(errorMessage);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('User not authenticated');

      const response = await api.delete(`/data-rooms/${id}`);
      return response.data;
    },
    // Optimistic update: Remove immediately from UI
    onMutate: async (id: string) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['dataRooms'] });

      // Snapshot previous value
      const previousDataRooms = queryClient.getQueryData<DataRoom[]>(['dataRooms']);

      // Optimistically remove from UI
      queryClient.setQueryData<DataRoom[]>(['dataRooms'], (old = []) =>
        old.filter(dataRoom => dataRoom.id !== id)
      );

      // Return context with snapshot
      return { previousDataRooms };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dataRooms'] });
      toast.success(SUCCESS_MESSAGES.DATA_ROOM_DELETED);
    },
    // On error, rollback to previous state
    onError: (error: unknown, id: string, context: any) => {
      if (context?.previousDataRooms) {
        queryClient.setQueryData(['dataRooms'], context.previousDataRooms);
      }

      const errorMessage = getErrorMessage(error);
      toast.error(errorMessage);
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newDataRoomName.trim()) {
      createMutation.mutate(newDataRoomName);
    } else {
      toast.error('Name is required');
    }
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  // Prefetch data room data on hover
  const handleDataRoomHover = (dataRoomId: string) => {
    queryClient.prefetchQuery({
      queryKey: ['dataRoom', dataRoomId],
      queryFn: async () => {
        const response = await api.get(`/data-rooms/${dataRoomId}`);
        return response.data;
      },
      staleTime: 2 * 60 * 1000, // 2 minutes
    });

    // Also prefetch folders for this data room
    queryClient.prefetchQuery({
      queryKey: ['folders', dataRoomId],
      queryFn: async () => {
        const response = await api.get(`/data-rooms/${dataRoomId}`);
        return response.data;
      },
      staleTime: 2 * 60 * 1000, // 2 minutes
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Main content */}
        <div className="flex-1">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold">Data Rooms</h1>
              <p className="text-muted-foreground mt-1">
                Manage your secure document repositories
              </p>
            </div>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Data Room
            </Button>
          </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton className="h-6 w-3/4" />
                </div>
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <Skeleton className="h-4 w-20" />
                  <div className="flex gap-2">
                    <Skeleton className="h-9 w-16" />
                    <Skeleton className="h-9 w-9" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : dataRooms && dataRooms.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {dataRooms.map((dataRoom) => (
            <Card
              key={dataRoom.id}
              className="hover:shadow-lg transition-shadow"
              onMouseEnter={() => {
                if (!dataRoom.id.startsWith('temp-')) {
                  handleDataRoomHover(dataRoom.id);
                }
              }}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderOpen className="h-5 w-5 text-primary" />
                  {dataRoom.name}
                </CardTitle>
                <CardDescription>
                  Created {formatDate(dataRoom.createdAt)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    {dataRoom._count?.folders ?? 0} {dataRoom._count?.folders === 1 ? 'folder' : 'folders'}
                  </span>
                  <div className="flex gap-2">
                    {/* Don't allow opening data rooms with temporary IDs */}
                    {dataRoom.id.startsWith('temp-') ? (
                      <Button variant="outline" size="sm" disabled>
                        Creating...
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/data-rooms/${dataRoom.id}`}>
                          Open
                        </Link>
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={dataRoom.id.startsWith('temp-')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete this data room and all of its contents.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(dataRoom.id)}>
                            Continue
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderOpen className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Data Rooms Yet</h3>
            <p className="text-muted-foreground mb-4">Create your first data room to get started</p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Data Room
            </Button>
          </CardContent>
        </Card>
      )}
        </div>

        {/* Sidebar - Google Drive Status */}
        <aside className="lg:w-80 w-full">
          <GoogleDriveStatus />
        </aside>
      </div>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Data Room</DialogTitle>
            <DialogDescription>
              Enter a name for your new data room
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="Data Room Name"
                value={newDataRoomName}
                onChange={(e) => setNewDataRoomName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DataRooms;

