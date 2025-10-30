import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/AlertDialog';
import { DataRoomItem } from '@/components/DataRoomView/columns';
import { Header } from '@/components/Header';
import { SearchAndActions } from '@/components/DataRoomView/SearchAndActions';
import { Breadcrumb, BreadcrumbItem } from '@/components/ui/Breadcrumb';

interface DataRoomLayoutProps {
  title: string;
  items: DataRoomItem[];
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isLoading: boolean;
  onCreateFolder: () => void;
  onUpload: () => void;
  itemToDelete: DataRoomItem | null;
  onConfirmDelete: (confirm: boolean) => void;
  children: React.ReactNode;
  onBackClick?: () => void;
  breadcrumbs?: BreadcrumbItem[];
  onImportFromGoogleDrive?: () => void;
  showGoogleDriveButton?: boolean;
}

export const DataRoomLayout: React.FC<DataRoomLayoutProps> = ({
  title,
  items,
  viewMode,
  onViewModeChange,
  searchQuery,
  onSearchChange,
  isLoading,
  onCreateFolder,
  onUpload,
  itemToDelete,
  onConfirmDelete,
  children,
  onBackClick,
  breadcrumbs,
  onImportFromGoogleDrive,
  showGoogleDriveButton = false,
}) => {
  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      <div className="container mx-auto px-4 py-4 md:py-6 border-b">
        <Header title={title} onBackClick={onBackClick} />
        {breadcrumbs && breadcrumbs.length > 0 && (
          <div className="mt-3 mb-2">
            <Breadcrumb items={breadcrumbs} />
          </div>
        )}
        <SearchAndActions
          searchValue={searchQuery}
          onSearchChange={onSearchChange}
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          onUploadFile={onUpload}
          showUploadButton={true}
          onCreateFolder={onCreateFolder}
          onImportFromGoogleDrive={onImportFromGoogleDrive}
          showGoogleDriveButton={showGoogleDriveButton}
        />
      </div>

      <div className="flex-1 overflow-auto">
        <div className="container mx-auto px-4 py-6">
          {isLoading ? <p>Loading...</p> : children}
        </div>
      </div>

      {itemToDelete && (
        <AlertDialog open onOpenChange={(open) => !open && onConfirmDelete(false)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the item "{itemToDelete.name}".
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => onConfirmDelete(false)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => onConfirmDelete(true)}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
};
