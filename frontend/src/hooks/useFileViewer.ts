import { useCallback } from 'react';
import { getFileUrl } from '@/lib/api';
import { toast } from '@/lib/toast';
import { DataRoomItem } from '@/components/DataRoomView';

export const useFileViewer = () => {
  const handleFileView = useCallback(async (item: DataRoomItem | string) => {
    try {
      // Support both old API (just fileId) and new API (full item)
      const fileId = typeof item === 'string' ? item : item.id;
      const mimeType = typeof item === 'string' ? null : (item.type === 'file' ? item.mimeType : null);
      const fileName = typeof item === 'string' ? null : item.name;

      const response = await getFileUrl(fileId);
      if (!response.request.responseURL) {
        toast.error('Could not get file view URL.');
        return;
      }

      const fileUrl = response.request.responseURL;

      // Check if it's an Office file (DOCX, XLSX)
      const isOffice = mimeType && (
        mimeType.includes('spreadsheet') ||
        mimeType.includes('excel') ||
        mimeType.includes('word') ||
        mimeType.includes('document') ||
        fileName?.toLowerCase().endsWith('.docx') ||
        fileName?.toLowerCase().endsWith('.xlsx')
      );

      // For Office files, force download instead of opening in browser
      if (isOffice) {
        const link = document.createElement('a');
        link.href = fileUrl;
        link.download = fileName || 'file';
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // For PDFs and images, open in new tab
        window.open(fileUrl, '_blank');
      }
    } catch (error: any) {
      console.error('Error fetching file view URL:', error);
      if (error.response?.status === 401) {
        toast.error('You are not authorized to view this file.');
      } else {
        toast.error('Failed to open file. Please try again.');
      }
    }
  }, []);

  return { handleFileView };
};
