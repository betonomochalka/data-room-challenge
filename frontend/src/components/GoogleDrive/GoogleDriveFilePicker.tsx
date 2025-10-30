import React, { useState, useMemo } from 'react';
import { Cloud, FileIcon, Search, Loader2, Download } from 'lucide-react';
import { Button } from '../ui/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/Dialog';
import { Input } from '../ui/Input';
import { Checkbox } from '../ui/Checkbox';
import { useGoogleDriveFiles } from '../../hooks/useGoogleDriveFiles';
import { formatBytes } from '../../lib/utils';
import { isValidFileType } from '@/utils/fileValidation';

interface GoogleDriveFilePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dataRoomId?: string;
  folderId?: string;
  onImportSuccess?: () => void;
}

export const GoogleDriveFilePicker: React.FC<GoogleDriveFilePickerProps> = ({
  open,
  onOpenChange,
  dataRoomId,
  folderId,
  onImportSuccess,
}) => {
  const { files, isLoading, importFiles, isImporting } = useGoogleDriveFiles(open);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const filteredFiles = useMemo(() => {
    let filtered = files.filter(file => isValidFileType(file.mimeType, file.name));
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(file => file.name.toLowerCase().includes(query));
    }
    
    return filtered;
  }, [files, searchQuery]);

  const handleToggleFile = (fileId: string) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedFiles.size === filteredFiles.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(filteredFiles.map(f => f.id)));
    }
  };

  const handleImport = async () => {
    if (selectedFiles.size === 0) return;

    importFiles(
      {
        fileIds: Array.from(selectedFiles),
        dataRoomId,
        folderId,
      },
      {
        onSuccess: () => {
          setSelectedFiles(new Set());
          setSearchQuery('');
          onOpenChange(false);
          onImportSuccess?.();
        },
      }
    );
  };

  const handleClose = () => {
    if (!isImporting) {
      setSelectedFiles(new Set());
      setSearchQuery('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Import from Google Drive
          </DialogTitle>
          <DialogDescription>
            Select files from your Google Drive to import
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Select All */}
          {filteredFiles.length > 0 && (
            <div className="flex items-center gap-2 px-1">
              <Checkbox
                id="select-all"
                checked={selectedFiles.size === filteredFiles.length && filteredFiles.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <label
                htmlFor="select-all"
                className="text-sm font-medium cursor-pointer select-none"
              >
                Select all ({filteredFiles.length} {filteredFiles.length === 1 ? 'file' : 'files'})
              </label>
            </div>
          )}

          {/* Files List */}
          <div className="flex-1 border rounded-md overflow-y-auto" style={{ maxHeight: '400px' }}>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Cloud className="h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  {searchQuery ? 'No files found matching your search' : 'No files found in your Google Drive'}
                </p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredFiles.map((file) => (
                  <div
                    key={file.id}
                    className={`flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors ${
                      selectedFiles.has(file.id) ? 'bg-gray-100 dark:bg-gray-800' : ''
                    }`}
                    onClick={() => handleToggleFile(file.id)}
                  >
                    <Checkbox
                      checked={selectedFiles.has(file.id)}
                      onCheckedChange={() => handleToggleFile(file.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    {file.iconLink ? (
                      <img src={file.iconLink} alt="" className="h-5 w-5" />
                    ) : (
                      <FileIcon className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {file.size && formatBytes(parseInt(file.size))}
                        {file.modifiedTime && ` • Modified ${new Date(file.modifiedTime).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isImporting}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={selectedFiles.size === 0 || isImporting}
          >
            {isImporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Import {selectedFiles.size > 0 && `(${selectedFiles.size})`}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

