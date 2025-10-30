import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { FileText, X } from 'lucide-react';

interface SelectedFile {
  file: File;
  name: string;
}

interface UploadFileDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedFiles: SelectedFile[];
  onFilesSelect: (files: File[]) => void;
  onFileNameChange: (index: number, name: string) => void;
  onFileRemove: (index: number) => void;
  onSubmit: (e: React.FormEvent) => void;
  isPending: boolean;
  uploadProgress?: { [key: string]: number };
  completedCount?: number;
}

export const UploadFileDialog: React.FC<UploadFileDialogProps> = ({
  isOpen,
  onOpenChange,
  selectedFiles,
  onFilesSelect,
  onFileNameChange,
  onFileRemove,
  onSubmit,
  isPending,
  uploadProgress = {},
  completedCount = 0,
}) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onFilesSelect(files);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Files</DialogTitle>
          <DialogDescription>Select one or more files to upload (JPG, PNG, PDF, XLSX, DOCX)</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file-upload">Files</Label>
            <Input
              id="file-upload"
              type="file"
              accept=".jpg,.jpeg,.png,.pdf,.xlsx,.docx,image/jpeg,image/png,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              multiple
              className="file:text-primary"
              onChange={handleFileChange}
            />
            <p className="text-sm text-muted-foreground">
              You can select multiple files at once (JPG, PNG, PDF, XLSX, DOCX only)
            </p>
          </div>

          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <Label>Selected Files ({selectedFiles.length})</Label>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {selectedFiles.map((selectedFile, index) => {
                  const fileKey = `${selectedFile.file.name}-${index}`;
                  const progress = uploadProgress[fileKey];
                  const isUploading = progress !== undefined && progress < 100;
                  
                  return (
                    <div
                      key={fileKey}
                      className="flex items-center gap-3 p-3 border rounded-md bg-card"
                    >
                      <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0 space-y-1">
                        <Input
                          placeholder="File Name"
                          value={selectedFile.name}
                          onChange={(e) => onFileNameChange(index, e.target.value)}
                          className="h-8 text-sm"
                          disabled={isUploading}
                        />
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="truncate">{selectedFile.file.name}</span>
                          <span className="flex-shrink-0">({formatFileSize(selectedFile.file.size)})</span>
                        </div>
                        {isUploading && progress !== undefined && (
                          <div className="w-full bg-secondary rounded-full h-1.5">
                            <div
                              className="bg-primary h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onFileRemove(index)}
                        disabled={isUploading}
                        className="flex-shrink-0 h-8 w-8 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || selectedFiles.length === 0}>
              {isPending ? `Uploading... (${completedCount}/${selectedFiles.length})` : `Upload ${selectedFiles.length} ${selectedFiles.length === 1 ? 'File' : 'Files'}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

