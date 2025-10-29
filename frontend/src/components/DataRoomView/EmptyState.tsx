import React from 'react';
import { Folder, Search, Plus, Upload } from 'lucide-react';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';

interface EmptyStateProps {
  isSearching: boolean;
  searchQuery: string;
  isInFolder: boolean;
  onCreateFolder: () => void;
  onUploadFile?: () => void;
  onClearSearch: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  isSearching,
  searchQuery,
  isInFolder,
  onCreateFolder,
  onUploadFile,
  onClearSearch,
}) => {
  return (
    <Card>
      <CardContent className="p-12 text-center">
        {isSearching ? (
          <>
            <Search className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No results found</h3>
            <p className="text-muted-foreground mb-6">
              No files or folders match "{searchQuery}"
            </p>
            <Button variant="outline" onClick={onClearSearch}>
              Clear Search
            </Button>
          </>
        ) : (
          <>
            <Folder className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No files or folders yet</h3>
            <p className="text-muted-foreground mb-6">
              {isInFolder 
                ? 'Upload files or create folders to get started'
                : 'Create folders to organize your documents'}
            </p>
            <div className="flex gap-4 justify-center">
              <Button onClick={onCreateFolder}>
                <Plus className="mr-2 h-4 w-4" />
                Create Folder
              </Button>
              {isInFolder && onUploadFile && (
                <Button variant="outline" onClick={onUploadFile}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload File
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

