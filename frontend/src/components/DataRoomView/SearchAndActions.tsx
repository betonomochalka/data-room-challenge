import React from 'react';
import { Plus, Upload, List, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/ToggleGroup';

interface SearchAndActionsProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  onCreateFolder: () => void;
  onUploadFile?: () => void;
  showUploadButton: boolean;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
}

export const SearchAndActions: React.FC<SearchAndActionsProps> = ({
  searchValue,
  onSearchChange,
  onCreateFolder,
  onUploadFile,
  showUploadButton,
  viewMode,
  onViewModeChange,
}) => {
  return (
    <div className="flex flex-col md:flex-row justify-between items-center my-6 gap-4">
      <div className="w-full md:w-1/2 lg:w-1/3">
        <Input
          type="search"
          placeholder="Search in this folder..."
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full"
        />
      </div>
      <div className="flex items-center gap-2">
        <ToggleGroup 
          type="single" 
          value={viewMode} 
          onValueChange={(value: 'grid' | 'list') => {
            if (value) onViewModeChange(value);
          }}
          aria-label="View mode"
        >
          <ToggleGroupItem value="grid" aria-label="Grid view">
            <LayoutGrid className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label="List view">
            <List className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>

        <Button variant="outline" onClick={onCreateFolder}>
          <Plus className="mr-2 h-4 w-4" />
          New Folder
        </Button>
        {showUploadButton && onUploadFile && (
          <Button onClick={onUploadFile}>
            <Upload className="mr-2 h-4 w-4" />
            Upload File
          </Button>
        )}
      </div>
    </div>
  );
};

