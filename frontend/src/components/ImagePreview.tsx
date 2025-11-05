import React, { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';

interface ImagePreviewProps {
  fileUrl: string;
  className?: string;
  width?: number;
  height?: number;
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({ 
  fileUrl, 
  className = '', 
  width = 128, 
  height = 128 
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const handleLoad = () => {
    setLoading(false);
    setError(false);
  };

  const handleError = () => {
    setError(true);
    setLoading(false);
  };

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-muted ${className}`} style={{ width, height }}>
        <ImageIcon className="h-16 w-16 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center bg-muted overflow-hidden ${className}`} style={{ width, height }}>
      {loading && (
        <div className="flex items-center justify-center">
          <ImageIcon className="h-16 w-16 text-muted-foreground animate-pulse" />
        </div>
      )}
      <img
        src={fileUrl}
        alt="Preview"
        onLoad={handleLoad}
        onError={handleError}
        className={`${loading ? 'hidden' : 'block'} w-full h-full object-contain`}
        style={{ maxWidth: width, maxHeight: height }}
      />
    </div>
  );
};


