import {
  DocumentIcon,
  PhotoIcon,
  VideoCameraIcon,
  MusicalNoteIcon,
  DocumentChartBarIcon,
  CodeBracketIcon,
  ArchiveBoxIcon,
  DocumentTextIcon,
  FolderIcon,
} from '@heroicons/react/24/outline';
import { ComponentType, SVGProps } from 'react';

// Helper function to get file icon from heroicons based on MIME type
export const getFileIconHeroicons = (
  mimeType: string | null | undefined,
  fileName: string
): ComponentType<SVGProps<SVGSVGElement>> => {
  const extension = fileName.toLowerCase().split('.').pop() || '';
  const mime = mimeType || '';

  // PDF
  if (mime === 'application/pdf' || extension === 'pdf') {
    return DocumentIcon;
  }

  // Images
  if (
    mime.startsWith('image/') ||
    ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'].includes(extension)
  ) {
    return PhotoIcon;
  }

  // Videos
  if (
    mime.startsWith('video/') ||
    ['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv'].includes(extension)
  ) {
    return VideoCameraIcon;
  }

  // Audio
  if (
    mime.startsWith('audio/') ||
    ['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(extension)
  ) {
    return MusicalNoteIcon;
  }

  // Spreadsheets
  if (
    mime.includes('spreadsheet') ||
    mime.includes('excel') ||
    ['xlsx', 'xls', 'csv'].includes(extension)
  ) {
    return DocumentChartBarIcon;
  }

  // Documents (Word, etc.)
  if (
    mime.includes('document') ||
    mime.includes('word') ||
    ['doc', 'docx', 'txt', 'rtf'].includes(extension)
  ) {
    return DocumentTextIcon;
  }

  // Code files
  if (
    [
      'js',
      'ts',
      'jsx',
      'tsx',
      'py',
      'java',
      'cpp',
      'c',
      'html',
      'css',
      'json',
      'xml',
      'yml',
      'yaml',
      'sh',
      'sql',
    ].includes(extension)
  ) {
    return CodeBracketIcon;
  }

  // Archives
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(extension)) {
    return ArchiveBoxIcon;
  }

  // Default
  return DocumentIcon;
};

// Folder icon
export { FolderIcon };

