import { useState, useRef } from 'react';
import { useDataRoomMutations } from './useDataRoomMutations';

interface RenameItem {
  id: string;
  name: string;
  type: 'folder' | 'file';
}

/**
 * Hook to manage item (folder/file) rename workflow
 * Handles dialog state, new name input, and submission
 */
export const useItemRename = (dataRoomId?: string, folderId?: string) => {
  const [isOpen, setIsOpen] = useState(false);
  const [item, setItem] = useState<RenameItem | null>(null);
  const [newName, setNewName] = useState('');
  const { renameFolderMutation, renameFileMutation } = useDataRoomMutations({ dataRoomId, folderId });
  const submitStartTimeRef = useRef<number | null>(null);
  const minLoadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const open = (itemToRename: RenameItem) => {
    setItem(itemToRename);
    setNewName(itemToRename.name);
    setIsOpen(true);
    submitStartTimeRef.current = null;
    if (minLoadingTimeoutRef.current) {
      clearTimeout(minLoadingTimeoutRef.current);
      minLoadingTimeoutRef.current = null;
    }
  };
  
  const close = () => {
    setIsOpen(false);
    setItem(null);
    setNewName('');
    submitStartTimeRef.current = null;
    if (minLoadingTimeoutRef.current) {
      clearTimeout(minLoadingTimeoutRef.current);
      minLoadingTimeoutRef.current = null;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!item || !newName.trim()) return;

    submitStartTimeRef.current = Date.now();

    // Track mutation completion - ensure minimum 700ms loading time
    const onMutationComplete = () => {
      const elapsed = Date.now() - (submitStartTimeRef.current || 0);
      const remainingTime = Math.max(0, 700 - elapsed);

      minLoadingTimeoutRef.current = setTimeout(() => {
        close();
        submitStartTimeRef.current = null;
        minLoadingTimeoutRef.current = null;
      }, remainingTime);
    };

    if (item.type === 'folder') {
      renameFolderMutation.mutate(
        { id: item.id, name: newName },
        {
          onSettled: onMutationComplete,
        }
      );
    } else {
      renameFileMutation.mutate(
        { id: item.id, name: newName },
        {
          onSettled: onMutationComplete,
        }
      );
    }
  };

  return {
    isOpen,
    item,
    newName,
    setNewName,
    open,
    close,
    handleSubmit,
    isPending: renameFolderMutation.isPending || renameFileMutation.isPending,
  };
};

