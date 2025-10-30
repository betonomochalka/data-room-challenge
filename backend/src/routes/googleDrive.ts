import { Router, Response, NextFunction } from 'express';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth';
import { googleDriveService } from '../services/googleDrive';
import { uploadFile } from '../utils/supabase';
import prisma from '../lib/prisma';
import { validateFileType } from '../utils/fileValidation';
import { checkNameConflicts } from '../utils/conflictChecker';
import { File } from '@prisma/client';

const router = Router();

/**
 * GET /api/google-drive/auth
 * Get the Google OAuth URL for user to authorize
 */
router.get('/auth', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id;
  
  if (!userId) {
    return next(createError('User not authenticated', 401));
  }
  
  // Pass userId in state parameter for callback
  const authUrl = googleDriveService.getAuthUrl(userId);
  
  res.status(200).json({
    success: true,
    data: { authUrl },
  });
}));

/**
 * GET /api/google-drive/callback
 * Handle OAuth callback from Google (no auth middleware - uses state parameter)
 */
router.get('/callback', asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const { code, state, error, error_description } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  // Log the full callback URL and query parameters for debugging
  console.log('[Google Drive OAuth] Callback received:', {
    url: req.url,
    query: req.query,
    hasCode: !!code,
    hasState: !!state,
    error,
    error_description,
  });

  // Check if Google returned an error
  if (error) {
    console.error('[Google Drive OAuth] Google returned error:', { error, error_description });
    return res.redirect(`${frontendUrl}?google_drive=error&reason=${error}&details=${encodeURIComponent(error_description as string || '')}`);
  }

  if (!code || typeof code !== 'string') {
    return res.redirect(`${frontendUrl}?google_drive=error&reason=no_code`);
  }

  if (!state || typeof state !== 'string') {
    return res.redirect(`${frontendUrl}?google_drive=error&reason=no_state`);
  }

  // Extract userId from state parameter
  const userId = state;

  try {
    await googleDriveService.handleOAuthCallback(code, userId);
    
    // Redirect back to frontend with success
    res.redirect(`${frontendUrl}?google_drive=connected`);
  } catch (error: any) {
    console.error('[Google Drive OAuth] Callback route error:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    
    // Include error details in redirect for debugging (remove in production if needed)
    const errorReason = error.message?.includes('redirect_uri_mismatch') 
      ? 'redirect_uri_mismatch' 
      : 'callback_failed';
    res.redirect(`${frontendUrl}?google_drive=error&reason=${errorReason}`);
  }
}));

/**
 * GET /api/google-drive/status
 * Check if user has connected Google Drive
 */
router.get('/status', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id;

  if (!userId) {
    return next(createError('User not authenticated', 401));
  }

  const isConnected = await googleDriveService.isConnected(userId);
  
  let userInfo = null;
  if (isConnected) {
    try {
      userInfo = await googleDriveService.getUserInfo(userId);
    } catch (error) {
      // Token might be invalid, ignore error
      console.error('Error fetching Google user info:', error);
    }
  }

  res.status(200).json({
    success: true,
    data: {
      connected: isConnected,
      userInfo,
    },
  });
}));

/**
 * DELETE /api/google-drive/disconnect
 * Disconnect Google Drive
 */
router.delete('/disconnect', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id;

  if (!userId) {
    return next(createError('User not authenticated', 401));
  }

  await googleDriveService.disconnect(userId);

  res.status(200).json({
    success: true,
    message: 'Google Drive disconnected successfully',
  });
}));

/**
 * GET /api/google-drive/files
 * List files from user's Google Drive
 */
router.get('/files', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id;
  const { pageSize, pageToken, query } = req.query;

  if (!userId) {
    return next(createError('User not authenticated', 401));
  }

  try {
    const result = await googleDriveService.listFiles(
      userId,
      pageSize ? parseInt(pageSize as string, 10) : 50,
      pageToken as string | undefined,
      query as string | undefined
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error listing Google Drive files:', error);
    if (error.message?.includes('authenticate')) {
      return next(createError(error.message, 401));
    }
    return next(createError('Failed to fetch Google Drive files', 500));
  }
}));

/**
 * POST /api/google-drive/import
 * Import a file from Google Drive to the data room
 */
router.post('/import', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id;
  const { fileId, dataRoomId, folderId, fileName } = req.body;

  if (!userId) {
    return next(createError('User not authenticated', 401));
  }

  if (!fileId) {
    return next(createError('fileId is required', 400));
  }

  if (!dataRoomId) {
    return next(createError('dataRoomId is required', 400));
  }

  try {
    // Download file from Google Drive
    const { fileName: originalFileName, mimeType, buffer, size } = await googleDriveService.downloadFile(userId, fileId);
    
    const finalName = fileName || originalFileName;

    // Validate file type
    const validation = validateFileType(mimeType, finalName);
    if (!validation.valid) {
      return next(createError(validation.error || 'Invalid file type', 400));
    }

    // Check for name conflicts
    const conflicts = await checkNameConflicts(finalName, dataRoomId, folderId || null);
    if (conflicts.folderConflict) {
      return next(createError('A folder with this name already exists in this location', 409));
    }
    if (conflicts.fileConflict) {
      return next(createError('A file with this name already exists in this location', 409));
    }

    // Upload to Supabase storage
    const filePath = await uploadFile(buffer, finalName, `uploads/${userId}`, mimeType);

    // Create file record in database
    const newFile = await prisma.file.create({
      data: {
        name: finalName,
        dataRoomId,
        folderId: folderId || null,
        userId,
        fileSize: BigInt(size),
        mimeType,
        filePath,
      },
    });

    res.status(201).json({
      success: true,
      data: newFile,
    });
  } catch (error: any) {
    console.error('Error importing file from Google Drive:', error);
    if (error.message?.includes('authenticate')) {
      return next(createError(error.message, 401));
    }
    return next(createError('Failed to import file from Google Drive', 500));
  }
}));

/**
 * POST /api/google-drive/import-multiple
 * Import multiple files from Google Drive to the data room
 */
router.post('/import-multiple', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id;
  const { fileIds, dataRoomId, folderId } = req.body;

  if (!userId) {
    return next(createError('User not authenticated', 401));
  }

  if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
    return next(createError('fileIds array is required', 400));
  }

  if (!dataRoomId) {
    return next(createError('dataRoomId is required', 400));
  }

  const results: {
    success: File[];
    failed: Array<{ fileId: string; fileName?: string; reason: string }>;
  } = {
    success: [],
    failed: [],
  };

  // Import files sequentially to avoid overwhelming the API
  for (const fileId of fileIds) {
    try {
      // Download file from Google Drive
      const { fileName, mimeType, buffer, size } = await googleDriveService.downloadFile(userId, fileId);

      // Validate file type
      const validation = validateFileType(mimeType, fileName);
      if (!validation.valid) {
        results.failed.push({ fileId, fileName, reason: validation.error || 'Invalid file type' });
        continue;
      }

      // Check for conflicts
      const conflicts = await checkNameConflicts(fileName, dataRoomId, folderId || null);
      if (conflicts.folderConflict) {
        results.failed.push({ fileId, fileName, reason: 'Folder with same name exists' });
        continue;
      }
      if (conflicts.fileConflict) {
        results.failed.push({ fileId, fileName, reason: 'File with same name exists' });
        continue;
      }

      // Upload to Supabase storage
      const filePath = await uploadFile(buffer, fileName, `uploads/${userId}`, mimeType);

      // Create file record in database
      const newFile = await prisma.file.create({
        data: {
          name: fileName,
          dataRoomId,
          folderId: folderId || null,
          userId,
          fileSize: BigInt(size),
          mimeType,
          filePath,
        },
      });

      results.success.push(newFile);
    } catch (error: any) {
      console.error(`Error importing file ${fileId}:`, error);
      results.failed.push({ fileId, reason: error.message || 'Import failed' });
    }
  }

  res.status(200).json({
    success: true,
    data: results,
  });
}));

export default router;

