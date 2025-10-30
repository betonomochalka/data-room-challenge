/**
 * Shared conflict checking utilities
 * Centralizes folder/file name conflict checking logic
 */

import prisma from '../lib/prisma';
import { createError } from '../middleware/errorHandler';

export interface ConflictCheckOptions {
  excludeFileId?: string;
  excludeFolderId?: string;
}

export interface ConflictResult {
  folderConflict: boolean;
  fileConflict: boolean;
  conflictingFolder?: { id: string; name: string };
  conflictingFile?: { id: string; name: string };
}

/**
 * Check for name conflicts in a specific location
 */
export async function checkNameConflicts(
  name: string,
  dataRoomId: string,
  folderId: string | null,
  options: ConflictCheckOptions = {}
): Promise<ConflictResult> {
  const { excludeFileId, excludeFolderId } = options;

  const [conflictingFolder, conflictingFile] = await Promise.all([
    prisma.folder.findFirst({
      where: {
        name,
        parentId: folderId,
        dataRoomId,
        ...(excludeFolderId && { id: { not: excludeFolderId } }),
      },
      select: {
        id: true,
        name: true,
      },
    }),
    prisma.file.findFirst({
      where: {
        name,
        folderId: folderId,
        dataRoomId,
        ...(excludeFileId && { id: { not: excludeFileId } }),
      },
      select: {
        id: true,
        name: true,
      },
    }),
  ]);

  return {
    folderConflict: !!conflictingFolder,
    fileConflict: !!conflictingFile,
    conflictingFolder: conflictingFolder || undefined,
    conflictingFile: conflictingFile || undefined,
  };
}

/**
 * Check for conflicts and throw appropriate errors
 */
export async function checkAndThrowConflicts(
  name: string,
  dataRoomId: string,
  folderId: string | null,
  options: ConflictCheckOptions = {}
): Promise<void> {
  const conflicts = await checkNameConflicts(name, dataRoomId, folderId, options);

  if (conflicts.folderConflict) {
    throw createError('A folder with this name already exists in this location', 409);
  }

  if (conflicts.fileConflict) {
    throw createError('A file with this name already exists in this location', 409);
  }
}

