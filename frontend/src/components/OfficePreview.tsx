import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, FileText } from 'lucide-react';

interface OfficePreviewProps {
  fileUrl: string;
  mimeType: string;
  className?: string;
  width?: number;
  height?: number;
}

export const OfficePreview: React.FC<OfficePreviewProps> = ({ 
  fileUrl, 
  mimeType,
  className = '', 
  width = 128, 
  height = 128 
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [viewerType, setViewerType] = useState<'office' | 'google'>('office');
  const isExcel = mimeType.includes('spreadsheet') || mimeType.includes('excel');
  const Icon = isExcel ? FileSpreadsheet : FileText;
  const color = isExcel ? 'text-green-500' : 'text-blue-500';

  // Try Microsoft Office Online viewer first
  const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
  
  // Fallback to Google Docs viewer
  const googleViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`;

  const viewerUrl = viewerType === 'office' ? officeViewerUrl : googleViewerUrl;

  useEffect(() => {
    // Reset loading state when viewer type changes
    setLoading(true);
    setError(false);
  }, [viewerType]);

  const handleIframeLoad = () => {
    setLoading(false);
  };

  const handleIframeError = () => {
    if (viewerType === 'office') {
      // Try Google Docs viewer as fallback
      setViewerType('google');
      setLoading(true);
    } else {
      // Both viewers failed, show icon
      setError(true);
      setLoading(false);
    }
  };

  // Add timeout to detect if viewer is stuck loading
  useEffect(() => {
    if (loading) {
      const timeout = setTimeout(() => {
        if (loading) {
          if (viewerType === 'office') {
            setViewerType('google');
          } else {
            setError(true);
            setLoading(false);
          }
        }
      }, 5000); // 5 second timeout

      return () => clearTimeout(timeout);
    }
  }, [loading, viewerType]);

  if (error) {
    // Fallback to icon if both viewers fail
    return (
      <div className={`flex items-center justify-center bg-muted overflow-hidden ${className}`} style={{ width, height }}>
        <div className="flex flex-col items-center justify-center p-4">
          <Icon className={`h-16 w-16 ${color}`} />
          <p className="text-xs text-muted-foreground mt-2 text-center">
            {isExcel ? 'Excel' : 'Word'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center bg-muted overflow-hidden relative ${className}`} style={{ width, height }}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted z-10">
          <Icon className={`h-16 w-16 ${color} animate-pulse`} />
        </div>
      )}
      <iframe
        src={viewerUrl}
        onLoad={handleIframeLoad}
        onError={handleIframeError}
        className={`w-full h-full border-0 ${loading ? 'opacity-0' : 'opacity-100'} transition-opacity`}
        style={{ width, height, minHeight: height }}
        title={`${isExcel ? 'Excel' : 'Word'} preview`}
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        allow="fullscreen"
      />
    </div>
  );
};

