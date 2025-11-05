import { useMemo } from 'react';
import { BreadcrumbItem } from '@/components/ui/Breadcrumb';
import { Folder } from '@/types';
import { buildFolderUrlFromId } from '@/utils/folderPaths';

interface UseBreadcrumbsProps {
  dataRoomId: string;
  dataRoomName?: string;
  currentFolderId?: string;
  currentFolderName?: string;
  currentFolderParentId?: string | null;
  allFolders?: Folder[];
}

/**
 * Hook to build breadcrumb navigation for data rooms and folders
 */
export const useBreadcrumbs = ({
  dataRoomId,
  dataRoomName,
  currentFolderId,
  currentFolderName,
  currentFolderParentId,
  allFolders = [],
}: UseBreadcrumbsProps): BreadcrumbItem[] => {
  return useMemo(() => {
    const breadcrumbs: BreadcrumbItem[] = [];

    // Always start with the data room root
    breadcrumbs.push({
      id: dataRoomId,
      name: dataRoomName || 'Data Room',
      path: '/',
    });

    // If we're in a folder, build the path from root to current folder
    if (currentFolderId && allFolders.length > 0) {
      const path: Folder[] = [];
      const visited = new Set<string>(); // Prevent infinite loops
      const MAX_DEPTH = 100; // Safety limit for very deep hierarchies
      
      // Build path from current folder to root
      const findFolder = (folderId: string): Folder | undefined => {
        return allFolders.find(f => f.id === folderId);
      };
      
      let currentFolderId_temp = currentFolderId;
      let folder = findFolder(currentFolderId_temp);
      let depth = 0;
      
      while (folder && depth < MAX_DEPTH) {
        // Check for circular reference
        if (visited.has(folder.id)) {
          break;
        }
        
        visited.add(folder.id);
        path.unshift(folder);
        depth++;
        
        if (folder.parentId) {
          currentFolderId_temp = folder.parentId;
          folder = findFolder(currentFolderId_temp);
        } else {
          break;
        }
      }

      // Convert path to breadcrumb items with paths instead of IDs
      path.forEach(folder => {
        breadcrumbs.push({
          id: folder.id,
          name: folder.name,
          path: buildFolderUrlFromId(folder.id, allFolders),
        });
      });
    } else if (currentFolderId && currentFolderName) {
      // Fallback: if we don't have all folders, just show the current folder
      breadcrumbs.push({
        id: currentFolderId,
        name: currentFolderName,
        path: buildFolderUrlFromId(currentFolderId, allFolders),
      });
    }

    return breadcrumbs;
  }, [dataRoomId, dataRoomName, currentFolderId, currentFolderName, allFolders]);
};

