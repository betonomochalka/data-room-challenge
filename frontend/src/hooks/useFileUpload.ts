import { useState, useRef } from 'react';
import { toast } from '../lib/toast';
import { useDataRoomMutations } from './useDataRoomMutations';
import { SUCCESS_MESSAGES } from '@/lib/errorMessages';
import { isValidFileType, MAX_FILE_SIZE, validateFileSize, ALLOWED_EXTENSIONS } from '@/utils/fileValidation';
import { Folder, File as FileType } from '@/types';

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
  folders?: Folder[],
  existingFiles?: FileType[]
) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [isUploading, setIsUploading] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const { uploadFileMutation } = useDataRoomMutations({ dataRoomId, folderId });
  const uploadCountRef = useRef({ success: 0, failure: 0, total: 0 });
  const uploadStatusRef = useRef<Map<string, 'pending' | 'success' | 'error'>>(new Map());

  const open = () => setIsOpen(true);
  
  const close = () => {
    setIsOpen(false);
    setSelectedFiles([]);
    setUploadProgress({});
    setIsUploading(false);
    setCompletedCount(0);
    uploadCountRef.current = { success: 0, failure: 0, total: 0 };
    uploadStatusRef.current.clear();
  };

  const handleFilesSelect = (files: File[]) => {
    const validFiles: SelectedFile[] = [];
    const invalidFiles: string[] = [];
    const invalidTypeFiles: string[] = [];

    files.forEach((file) => {
      const isValidType = isValidFileType(file.type, file.name);
      const sizeValidation = validateFileSize(file.size);

      if (!isValidType) {
        invalidTypeFiles.push(file.name);
      } else if (!sizeValidation.valid) {
        invalidFiles.push(file.name);
      } else {
        // Remove extension from name for cleaner display
        const extensionPattern = new RegExp(`\\.(${ALLOWED_EXTENSIONS.join('|')})$`, 'i');
        const nameWithoutExt = file.name.replace(extensionPattern, '');
        validFiles.push({
          file,
          name: nameWithoutExt || file.name,
        });
      }
    });

    if (invalidTypeFiles.length > 0) {
      toast.error(
        `${invalidTypeFiles.length} file(s) have invalid type. Only JPG, PNG, PDF, XLSX, and DOCX files are allowed: ${invalidTypeFiles.join(', ')}`
      );
    }

    if (invalidFiles.length > 0) {
      toast.error(
        `${invalidFiles.length} file(s) are too large. Maximum size is ${(MAX_FILE_SIZE / (1024 * 1024)).toFixed(1)}MB per file: ${invalidFiles.join(', ')}`
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

    // Reset counters and set uploading state
    uploadCountRef.current = { success: 0, failure: 0, total: selectedFiles.length };
    uploadStatusRef.current.clear();
    setIsUploading(true);
    setCompletedCount(0);

    // Initialize upload progress for all files
    const initialProgress: { [key: string]: number } = {};
    selectedFiles.forEach((selectedFile, index) => {
      const fileKey = `${selectedFile.file.name}-${index}`;
      initialProgress[fileKey] = 0;
      uploadStatusRef.current.set(fileKey, 'pending');
    });
    setUploadProgress(initialProgress);

    const handleUploadComplete = (fileKey: string, success: boolean) => {
      // Mark this file as completed
      uploadStatusRef.current.set(fileKey, success ? 'success' : 'error');
      
      if (success) {
        uploadCountRef.current.success++;
      } else {
        uploadCountRef.current.failure++;
      }

      const { success: totalSuccess, failure: totalFailure, total } = uploadCountRef.current;
      const completed = totalSuccess + totalFailure;
      
      // Update progress to 100% for completed files
      setUploadProgress((prev) => ({
        ...prev,
        [fileKey]: 100,
      }));
      
      // Update completed count
      setCompletedCount(completed);
      
      if (completed === total) {
        setIsUploading(false);
        if (total === 1) {
          if (totalSuccess === 1) {
            toast.success(SUCCESS_MESSAGES.FILE_UPLOADED);
          }
        } else {
          if (totalSuccess > 0 && totalFailure === 0) {
            toast.success(`Successfully uploaded ${totalSuccess} file${totalSuccess > 1 ? 's' : ''}`);
          } else if (totalSuccess > 0 && totalFailure > 0) {
            toast.warning(`Uploaded ${totalSuccess} file${totalSuccess > 1 ? 's' : ''}, ${totalFailure} failed`);
          } else if (totalFailure > 0) {
            toast.error(`Failed to upload ${totalFailure} file${totalFailure > 1 ? 's' : ''}`);
          }
        }
        
        setTimeout(() => {
          close();
        }, 1500);
      }
    };

    // Upload each file with proper tracking using mutateAsync for reliable callback execution
    selectedFiles.forEach(async (selectedFile, index) => {
      const fileKey = `${selectedFile.file.name}-${index}`;
      
      // Set initial uploading state (not 0, but a small value to show it's starting)
      setUploadProgress((prev) => ({
        ...prev,
        [fileKey]: prev[fileKey] ?? 0,
      }));
      
      try {
        await uploadFileMutation.mutateAsync({
          file: selectedFile.file,
          name: selectedFile.name,
          folderId: folderId || null,
        });
        handleUploadComplete(fileKey, true);
      } catch (error) {
        handleUploadComplete(fileKey, false);
      }
    });
  };

  return {
    isOpen,
    selectedFiles,
    uploadProgress,
    completedCount,
    open,
    close,
    handleFilesSelect,
    handleFileNameChange,
    handleFileRemove,
    handleSubmit,
    isPending: isUploading,
  };
};

