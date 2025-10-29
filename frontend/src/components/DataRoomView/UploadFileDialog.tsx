import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';

interface UploadFileDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  onFileNameChange: (name: string) => void;
  onFileSelect: (file: File) => void;
  onSubmit: (e: React.FormEvent) => void;
  isPending: boolean;
  selectedFile: File | null;
}

export const UploadFileDialog: React.FC<UploadFileDialogProps> = ({
  isOpen,
  onOpenChange,
  fileName,
  onFileNameChange,
  onFileSelect,
  onSubmit,
  isPending,
  selectedFile,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload PDF File</DialogTitle>
          <DialogDescription>Select a PDF file to upload</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file-upload">PDF File</Label>
            <Input
              id="file-upload"
              type="file"
              accept=".pdf,application/pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  onFileSelect(file);
                  onFileNameChange(file.name.replace('.pdf', ''));
                }
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="file-name">File Name</Label>
            <Input
              id="file-name"
              placeholder="File Name"
              value={fileName}
              onChange={(e) => onFileNameChange(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !selectedFile}>
              {isPending ? 'Uploading...' : 'Upload'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

