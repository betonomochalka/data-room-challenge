import { useState } from 'react';
import { toast } from '../lib/toast';
import { useDataRoomMutations } from './useDataRoomMutations';

/**
 * Hook to manage file upload workflow
 * Handles dialog state, file selection, and upload submission
 */
export const useFileUpload = (dataRoomId?: string, folderId?: string, folders?: any[]) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const { uploadFileMutation } = useDataRoomMutations({ dataRoomId, folderId });

  const open = () => setIsOpen(true);
  
  const close = () => {
    setIsOpen(false);
    setSelectedFile(null);
    setFileName('');
  };

  const handleFileSelect = (file: File) => {
    const MAX_FILE_SIZE = 4.5 * 1024 * 1024; // 4.5MB in bytes
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File is too large. Maximum size is 4.5MB.');
      return;
    }
    setSelectedFile(file);
    setFileName(file.name.replace('.pdf', ''));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !fileName.trim()) {
      toast.error('Please select a file and enter a name');
      return;
    }

    uploadFileMutation.mutate(
      { file: selectedFile, name: fileName, folderId: folderId || null },
      {
        onSuccess: () => {
          close();
        },
      }
    );
  };

  return {
    isOpen,
    selectedFile,
    fileName,
    setFileName,
    open,
    close,
    handleFileSelect,
    handleSubmit,
    isPending: uploadFileMutation.isPending,
  };
};

