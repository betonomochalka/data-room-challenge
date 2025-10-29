import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';
import prisma from '../lib/prisma';
import { uploadFile, deleteFile as deleteSupabaseFile, getSignedUrl } from '../utils/supabase';

const router = Router();
const MAX_FILE_SIZE = 4.5 * 1024 * 1024; // 4.5MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE }
});

router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { dataRoomId, folderId } = req.query;
    const userId = req.user?.id;

    if (!dataRoomId && !folderId) {
        return next(createError('Either dataRoomId or folderId is required', 400));
    }

    const where: {
        userId: string | undefined;
        dataRoomId?: string;
        folderId?: string;
    } = { userId };

    if (folderId) {
        where.folderId = folderId as string;
    } else if (dataRoomId) {
        where.dataRoomId = dataRoomId as string;
    }

    const files = await prisma.file.findMany({
        where,
        orderBy: {
            createdAt: 'desc',
        },
    });

    res.status(200).json({
        success: true,
        data: files,
    });
}));

router.get('/:id/view', asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const userId = req.user?.id;

    const file = await prisma.file.findFirst({
        where: { id, userId },
    });

    if (!file) {
        return next(createError('File not found', 404));
    }

    if (!file.filePath) {
        return next(createError('File path not available', 500));
    }

    const signedUrl = await getSignedUrl(file.filePath);
    res.redirect(signedUrl);
}));

router.put('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const userId = req.user?.id;
    const { name } = req.body;

    if (!name) {
        return next(createError('Name is required', 400));
    }

    const file = await prisma.file.findFirst({
        where: { id, userId },
    });

    if (!file) {
        return next(createError('File not found', 404));
    }

    const updatedFile = await prisma.file.update({
        where: { id },
        data: { name },
    });

    res.status(200).json({
        success: true,
        data: updatedFile,
    });
}));

router.post(
  '/upload',
  upload.single('file'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (req.file === undefined && (req as any).multerError) {
      if ((req as any).multerError.code === 'LIMIT_FILE_SIZE') {
        return next(createError('File is too large. Maximum size is 4.5MB.', 413));
      }
    }

    const userId = req.user?.id;
    const { dataRoomId, folderId, name } = req.body;
    const file = req.file;

    if (!userId) {
        return next(createError('User not authenticated', 401));
    }

    if (!file) {
      return next(createError('No file uploaded', 400));
    }

    if (!dataRoomId) {
        return next(createError('dataRoomId is required', 400));
    }

    try {
      const finalName = name || file.originalname;
      const filePath = await uploadFile(file.buffer, finalName, `uploads/${userId}`);

      const newFile = await prisma.file.create({
        data: {
          name: finalName,
          dataRoomId,
          folderId: folderId || null,
          userId,
          fileSize: BigInt(file.size),
          mimeType: file.mimetype,
          filePath,
        },
      });

      res.status(201).json(newFile);
    } catch (error) {
      console.error('File upload error:', error);
      next(createError('Failed to upload file', 500));
    }
  })
);

router.delete('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const userId = req.user?.id;

  const file = await prisma.file.findFirst({
    where: { id, userId },
  });

  if (!file) {
    return next(createError('File not found', 404));
  }

  if (file.filePath) {
      await deleteSupabaseFile(file.filePath);
  }

  await prisma.file.delete({
    where: { id },
  });

  res.status(204).send();
}));

export default router;
