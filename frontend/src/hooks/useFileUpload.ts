import { useState } from 'react';
import { toast } from '../lib/toast';
import { useDataRoomMutations } from './useDataRoomMutations';
import { SUCCESS_MESSAGES } from '@/lib/errorMessages';

interface SelectedFile {
  file: File;
  name: string;
}

/**
 * Hook to manage file upload workflow
 * Handles dialog state, file selection, and upload submission
 * Supports bulk upload of multiple files
 */
export const useFileUpload = (
  dataRoomId?: string,
  folderId?: string,
  folders?: any[],
  existingFiles?: any[]
) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const { uploadFileMutation } = useDataRoomMutations({ dataRoomId, folderId });

  const open = () => setIsOpen(true);
  
  const close = () => {
    setIsOpen(false);
    setSelectedFiles([]);
    setUploadProgress({});
  };

  const handleFilesSelect = (files: File[]) => {
    const MAX_FILE_SIZE = 4.5 * 1024 * 1024; // 4.5MB in bytes
    const validFiles: SelectedFile[] = [];
    const invalidFiles: string[] = [];

    files.forEach((file) => {
      if (file.size > MAX_FILE_SIZE) {
        invalidFiles.push(file.name);
      } else {
        validFiles.push({
          file,
          name: file.name.replace('.pdf', ''),
        });
      }
    });

    if (invalidFiles.length > 0) {
      toast.error(
        `${invalidFiles.length} file(s) are too large. Maximum size is 4.5MB per file: ${invalidFiles.join(', ')}`
      );
    }

    if (validFiles.length > 0) {
      setSelectedFiles((prev) => [...prev, ...validFiles]);
    }
  };

  const handleFileNameChange = (index: number, name: string) => {
    setSelectedFiles((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], name };
      return updated;
    });
  };

  const handleFileRemove = (index: number) => {
    setSelectedFiles((prev) => {
      const updated = [...prev];
      updated.splice(index, 1);
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedFiles.length === 0) {
      toast.error('Please select at least one file');
      return;
    }

    // Validate all files have names
    const filesWithoutNames = selectedFiles.filter((f) => !f.name.trim());
    if (filesWithoutNames.length > 0) {
      toast.error('Please enter names for all files');
      return;
    }

    // Check for duplicate names within selected files
    const selectedFileNames = selectedFiles.map((f) => f.name.trim().toLowerCase());
    const duplicatesInSelection = selectedFileNames.filter(
      (name, index) => selectedFileNames.indexOf(name) !== index
    );
    if (duplicatesInSelection.length > 0) {
      const uniqueDuplicates = Array.from(new Set(duplicatesInSelection));
      toast.error(`Duplicate file names in selection: ${uniqueDuplicates.join(', ')}`);
      return;
    }

    // Check for duplicate names against existing files and folders
    const existingItemNames = new Set<string>();
    if (existingFiles) {
      existingFiles.forEach((file) => {
        if (file.name) {
          existingItemNames.add(file.name.trim().toLowerCase());
        }
      });
    }
    if (folders) {
      folders.forEach((folder) => {
        if (folder.name) {
          existingItemNames.add(folder.name.trim().toLowerCase());
        }
      });
    }

    const duplicatesWithExisting = selectedFiles.filter((f) =>
      existingItemNames.has(f.name.trim().toLowerCase())
    );
    if (duplicatesWithExisting.length > 0) {
      const duplicateNames = duplicatesWithExisting.map((f) => f.name).join(', ');
      toast.error(`File names already exist in this folder: ${duplicateNames}`);
      return;
    }

    let successCount = 0;
    let failureCount = 0;
    const totalFiles = selectedFiles.length;

    const handleUploadComplete = () => {
      if (successCount + failureCount === totalFiles) {
        if (totalFiles === 1) {
          if (successCount === 1) {
            toast.success(SUCCESS_MESSAGES.FILE_UPLOADED);
          }
        } else {
          if (successCount > 0 && failureCount === 0) {
            toast.success(`Successfully uploaded ${successCount} file${successCount > 1 ? 's' : ''}`);
          } else if (successCount > 0 && failureCount > 0) {
            toast.warning(`Uploaded ${successCount} file${successCount > 1 ? 's' : ''}, ${failureCount} failed`);
          } else if (failureCount > 0) {
            toast.error(`Failed to upload ${failureCount} file${failureCount > 1 ? 's' : ''}`);
          }
        }
        
        setTimeout(() => {
          close();
        }, 1500);
      }
    };

    selectedFiles.forEach((selectedFile) => {
      uploadFileMutation.mutate({
        file: selectedFile.file,
        name: selectedFile.name,
        folderId: folderId || null,
      }, {
        onSuccess: () => {
          successCount++;
          handleUploadComplete();
        },
        onError: () => {
          failureCount++;
          handleUploadComplete();
        },
      });
    });
  };

  return {
    isOpen,
    selectedFiles,
    uploadProgress,
    open,
    close,
    handleFilesSelect,
    handleFileNameChange,
    handleFileRemove,
    handleSubmit,
    isPending: uploadFileMutation.isPending,
  };
};

