import { 
  FileText, 
  Image, 
  Video, 
  Music, 
  FileSpreadsheet,
  FileCode,
  Archive,
  FileIcon,
  type LucideIcon
} from 'lucide-react';

// Helper function to get file icon and color based on MIME type
// This matches the logic used in DataRoomItemView
export const getFileIconAndColor = (mimeType: string | null | undefined, fileName: string): { Icon: LucideIcon; color: string } => {
  const extension = fileName.toLowerCase().split('.').pop() || '';
  const mime = mimeType || '';
  
  // PDF
  if (mime === 'application/pdf' || extension === 'pdf') {
    return { Icon: FileText, color: 'text-foreground' };
  }
  
  // Images
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'].includes(extension)) {
    return { Icon: Image, color: 'text-foreground' };
  }
  
  // Videos
  if (mime.startsWith('video/') || ['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv'].includes(extension)) {
    return { Icon: Video, color: 'text-foreground' };
  }
  
  // Audio
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(extension)) {
    return { Icon: Music, color: 'text-foreground' };
  }
  
  // Spreadsheets
  if (
    mime.includes('spreadsheet') || 
    mime.includes('excel') ||
    ['xlsx', 'xls', 'csv'].includes(extension)
  ) {
    return { Icon: FileSpreadsheet, color: 'text-foreground' };
  }
  
  // Documents (Word, etc.)
  if (
    mime.includes('document') || 
    mime.includes('word') ||
    ['doc', 'docx', 'txt', 'rtf'].includes(extension)
  ) {
    return { Icon: FileText, color: 'text-foreground' };
  }
  
  // Code files
  if (
    ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'html', 'css', 'json', 'xml', 'yml', 'yaml', 'sh', 'sql'].includes(extension)
  ) {
    return { Icon: FileCode, color: 'text-foreground' };
  }
  
  // Archives
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(extension)) {
    return { Icon: Archive, color: 'text-foreground' };
  }
  
  // Default
  return { Icon: FileIcon, color: 'text-muted-foreground' };
};

