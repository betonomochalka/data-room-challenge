import { useState } from 'react';
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

  const open = (itemToRename: RenameItem) => {
    setItem(itemToRename);
    setNewName(itemToRename.name);
    setIsOpen(true);
  };
  
  const close = () => {
    setIsOpen(false);
    setItem(null);
    setNewName('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!item || !newName.trim()) return;

    if (item.type === 'folder') {
      renameFolderMutation.mutate(
        { id: item.id, name: newName },
        { onSuccess: close }
      );
    } else {
      renameFileMutation.mutate(
        { id: item.id, name: newName },
        { onSuccess: close }
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

