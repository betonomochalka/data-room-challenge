import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { FileText } from 'lucide-react';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFPreviewProps {
  fileUrl: string;
  className?: string;
  width?: number;
  height?: number;
}

export const PDFPreview: React.FC<PDFPreviewProps> = ({ 
  fileUrl, 
  className = '', 
  width = 128, 
  height = 128 
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const onDocumentLoadSuccess = () => {
    setLoading(false);
    setError(false);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error('Error loading PDF:', error);
    setError(true);
    setLoading(false);
  };

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-muted ${className}`} style={{ width, height }}>
        <FileText className="h-16 w-16 text-red-500" />
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center bg-muted overflow-hidden ${className}`} style={{ width, height }}>
      {loading && (
        <div className="flex items-center justify-center">
          <FileText className="h-16 w-16 text-red-500 animate-pulse" />
        </div>
      )}
      <Document
        file={fileUrl}
        onLoadSuccess={onDocumentLoadSuccess}
        onLoadError={onDocumentLoadError}
        loading={null}
        error={null}
        className="flex items-center justify-center"
      >
        <Page
          pageNumber={1}
          width={width}
          height={height}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          className="pdf-preview-page"
        />
      </Document>
    </div>
  );
};

