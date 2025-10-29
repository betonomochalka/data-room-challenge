import { useState } from 'react';
import { toast } from '../lib/toast';
import { useDataRoomMutations } from './useDataRoomMutations';

/**
 * Hook to manage folder creation workflow
 * Handles dialog state, folder name input, and submission
 */
export const useCreateFolder = (dataRoomId?: string, folderId?: string) => {
  const [isOpen, setIsOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const { createFolderMutation } = useDataRoomMutations({ dataRoomId, folderId });

  const open = () => setIsOpen(true);
  
  const close = () => {
    setIsOpen(false);
    setFolderName('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) {
      toast.error('Please enter a folder name');
      return;
    }
    
    createFolderMutation.mutate(folderName, {
      onSuccess: () => {
        close();
      }
    });
  };

  return {
    isOpen,
    folderName,
    setFolderName,
    open,
    close,
    handleSubmit,
    isPending: createFolderMutation.isPending,
  };
};

