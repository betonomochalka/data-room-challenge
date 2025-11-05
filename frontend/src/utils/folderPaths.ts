import { Folder } from '@/types';

/**
 * URL-encode a folder name for use in paths
 * This handles special characters and spaces
 */
export function encodeFolderName(name: string): string {
  return encodeURIComponent(name);
}

/**
 * Decode a folder name from a URL path
 */
export function decodeFolderName(encoded: string): string {
  return decodeURIComponent(encoded);
}

/**
 * Build a path string from an array of folder names
 * Example: ['Documents', 'Projects'] -> 'Documents/Projects'
 */
export function buildPathFromNames(names: string[]): string {
  return names.map(encodeFolderName).join('/');
}

/**
 * Parse a path string into an array of folder names
 * Example: 'Documents/Projects' -> ['Documents', 'Projects']
 */
export function parsePathToNames(path: string): string[] {
  if (!path || path === '/') return [];
  return path.split('/').map(decodeFolderName).filter(Boolean);
}

/**
 * Build a path from root to a folder given its ID
 * Returns the path string (e.g., 'Documents/Projects')
 */
export function buildPathFromFolderId(
  folderId: string | null,
  allFolders: Folder[]
): string {
  if (!folderId) return '';
  
  const foldersMap = new Map<string, Folder>();
  allFolders.forEach(folder => {
    foldersMap.set(folder.id, folder);
  });
  
  const path: string[] = [];
  const visited = new Set<string>();
  const MAX_DEPTH = 100;
  
  let currentId: string | null = folderId;
  let depth = 0;
  
  while (currentId && depth < MAX_DEPTH) {
    if (visited.has(currentId)) break;
    visited.add(currentId);
    
    const folder = foldersMap.get(currentId);
    if (!folder) break;
    
    path.unshift(folder.name);
    
    if (folder.parentId) {
      currentId = folder.parentId;
    } else {
      break;
    }
    
    depth++;
  }
  
  return buildPathFromNames(path);
}

/**
 * Resolve a path string to a folder ID by finding the matching folder
 * Returns the folder ID or null if not found
 */
export function resolvePathToFolderId(
  path: string,
  allFolders: Folder[]
): string | null {
  if (!path || path === '/') return null;
  
  const pathNames = parsePathToNames(path);
  if (pathNames.length === 0) return null;
  
  const foldersMap = new Map<string, Folder>();
  const foldersByName = new Map<string, Folder[]>();
  
  allFolders.forEach(folder => {
    foldersMap.set(folder.id, folder);
    
    // Group folders by name for quick lookup
    if (!foldersByName.has(folder.name)) {
      foldersByName.set(folder.name, []);
    }
    foldersByName.get(folder.name)!.push(folder);
  });
  
  // Start with root-level folders (those with no parentId)
  let candidates = allFolders.filter(f => !f.parentId);
  
  // Traverse the path
  for (let i = 0; i < pathNames.length; i++) {
    const targetName = pathNames[i];
    const matchingFolders = candidates.filter(f => f.name === targetName);
    
    if (matchingFolders.length === 0) {
      // Path not found
      return null;
    }
    
    if (i === pathNames.length - 1) {
      // Last segment - return the first match (or handle duplicates if needed)
      return matchingFolders[0].id;
    }
    
    // Not the last segment - continue with children
    candidates = matchingFolders
      .flatMap(folder => {
        return allFolders.filter(child => child.parentId === folder.id);
      });
    
    if (candidates.length === 0) {
      // Path not found
      return null;
    }
  }
  
  return null;
}

/**
 * Build the full URL path for a folder
 * Example: 'Documents/Projects' -> '/folders/Documents/Projects'
 */
export function buildFolderUrl(path: string): string {
  if (!path || path === '/') return '/';
  return `/folders/${path}`;
}

/**
 * Build the full URL path for a folder given its ID
 */
export function buildFolderUrlFromId(
  folderId: string | null,
  allFolders: Folder[]
): string {
  const path = buildPathFromFolderId(folderId, allFolders);
  return buildFolderUrl(path);
}

