import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult, query } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../types';
import prisma from '../lib/prisma';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Validation middleware
const validateFolderCreation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Folder name is required.')
    .isLength({ min: 1, max: 100 }).withMessage('Folder name must be between 1 and 100 characters.'),
  body('parentId')
    .optional({ nullable: true })
    .isUUID().withMessage('Invalid parent folder ID.'),
  body('dataRoomId')
    .isUUID().withMessage('Invalid data room ID.'),
];

const validateFolderRename = [
  body('name')
    .trim()
    .notEmpty().withMessage('New folder name is required.')
    .isLength({ min: 1, max: 100 }).withMessage('Folder name must be between 1 and 100 characters.'),
];

const validateFolderMove = [
  body('newParentId')
    .optional({ nullable: true })
    .isUUID().withMessage('Invalid new parent folder ID.'),
];


// Get all folders for a data room
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { dataRoomId } = req.query;

  if (!dataRoomId) {
    throw createError('Data room ID is required', 400);
  }

  const folders = await prisma.folder.findMany({
    where: {
      dataRoomId: dataRoomId as string,
      dataRoom: {
        ownerId: req.user!.id,
      },
    },
    orderBy: {
      name: 'asc'
    }
  });

  res.json({
    success: true,
    data: {
      folders
    },
  });
}));


// Get folder contents
router.get('/:id/contents', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { includeFiles = 'true' } = req.query;

  // Verify folder exists and user has access
  const folder = await prisma.folder.findFirst({
    where: {
      id,
      dataRoom: {
        ownerId: req.user!.id,
      },
    },
    include: {
      dataRoom: {
        select: { id: true, name: true },
      },
    },
  });

  if (!folder) {
    // Check if the folder exists at all, to differentiate between not found and not authorized
    const folderExists = await prisma.folder.findUnique({ where: { id } });
    if (folderExists) {
      throw createError('You are not authorized to access this folder', 403);
    }
    throw createError('Folder not found', 404);
  }

  // Get folder contents
  const [children, files] = await Promise.all([
    prisma.folder.findMany({
      where: { parentId: id },
      include: {
        _count: {
          select: {
            children: true,
            files: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    }),
    includeFiles === 'true' ? prisma.file.findMany({
      where: { folderId: id },
      orderBy: { name: 'asc' },
    }) : [],
  ]);

  res.json({
    success: true,
    data: {
      folder: {
        id: folder.id,
        name: folder.name,
        parentId: folder.parentId,
        dataRoomId: folder.dataRoomId,
        dataRoom: folder.dataRoom,
        createdAt: folder.createdAt,
        updatedAt: folder.updatedAt,
      },
      children,
      files,
    },
  });
}));

// Get folder tree (for navigation)
router.get('/:id/tree', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  // Verify folder exists and user has access
  const folder = await prisma.folder.findFirst({
    where: {
      id,
      dataRoom: {
        ownerId: req.user!.id,
      },
    },
    include: {
      dataRoom: {
        select: { id: true, name: true },
      },
    },
  });

  if (!folder) {
    throw createError('Folder not found', 404);
  }

  // Build breadcrumb path
  const buildBreadcrumb = async (folderId: string): Promise<any[]> => {
    const currentFolder = await prisma.folder.findUnique({
      where: { id: folderId },
      select: {
        id: true,
        name: true,
        parentId: true,
      },
    });

    if (!currentFolder) return [];

    const breadcrumb = [currentFolder];
    
    if (currentFolder.parentId) {
      const parentBreadcrumb = await buildBreadcrumb(currentFolder.parentId);
      breadcrumb.unshift(...parentBreadcrumb);
    }

    return breadcrumb;
  };

  const breadcrumb = await buildBreadcrumb(id);

  res.json({
    success: true,
    data: {
      currentFolder: {
        id: folder.id,
        name: folder.name,
        parentId: folder.parentId,
        dataRoomId: folder.dataRoomId,
        dataRoom: folder.dataRoom,
      },
      breadcrumb,
    },
  });
}));

// Create a new folder
router.post('/', validateFolderCreation, asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, parentId, dataRoomId } = req.body;
  const userId = req.user!.id;

  // Verify data room exists and belongs to user
  const dataRoom = await prisma.dataRoom.findFirst({
    where: {
      id: dataRoomId,
      ownerId: userId,
    },
  });

  if (!dataRoom) {
    throw createError('Data room not found', 404);
  }

  // If parentId is provided, verify parent folder exists and belongs to same data room
  if (parentId) {
    const parentFolder = await prisma.folder.findFirst({
      where: {
        id: parentId,
        dataRoomId,
      },
    });

    if (!parentFolder) {
      throw createError('Parent folder not found', 404);
    }
  }

  // Check if folder with same name already exists in the same location
  const existingFolder = await prisma.folder.findFirst({
    where: {
      name,
      parentId: parentId || null,
      dataRoomId,
    },
  });

  if (existingFolder) {
    throw createError('Folder with this name already exists in this location', 409);
  }

  const folder = await prisma.folder.create({
    data: {
      name,
      parentId: parentId || null,
      dataRoomId,
      userId: userId,
    },
    include: {
      _count: {
        select: {
          children: true,
          files: true,
        },
      },
    },
  });

  return res.status(201).json({
    success: true,
    data: folder,
    message: 'Folder created successfully',
  });
}));

// Update folder (rename)
router.patch('/:id/rename', validateFolderRename, asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const { name } = req.body;

  // Verify folder exists and user has access
  const folder = await prisma.folder.findFirst({
    where: {
      id,
      dataRoom: {
        ownerId: req.user!.id,
      },
    },
  });

  if (!folder) {
    return next(createError('Folder not found', 404));
  }

  // Check if new name conflicts with existing folder in same location
  if (name && name !== folder.name) {
    const conflictingFolder = await prisma.folder.findFirst({
      where: {
        name,
        parentId: folder.parentId,
        dataRoomId: folder.dataRoomId,
        id: { not: id },
      },
    });

    if (conflictingFolder) {
      throw createError('Folder with this name already exists in this location', 409);
    }
  }

  const updatedFolder = await prisma.folder.update({
    where: { id },
    data: {
      ...(name && { name }),
    },
    include: {
      _count: {
        select: {
          children: true,
          files: true,
        },
      },
    },
  });

  return res.status(200).json(updatedFolder);
}));

// Move folder
router.patch('/:id/move', validateFolderMove, asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const { newParentId } = req.body;

  // Verify folder exists and user has access
  const folder = await prisma.folder.findFirst({
    where: {
      id,
      dataRoom: {
        ownerId: req.user!.id,
      },
    },
  });

  if (!folder) {
    return next(createError('Folder not found', 404));
  }

  // If newParentId is provided, verify new parent folder exists and belongs to same data room
  if (newParentId) {
    const newParentFolder = await prisma.folder.findFirst({
      where: {
        id: newParentId,
        dataRoomId: folder.dataRoomId,
      },
    });

    if (!newParentFolder) {
      return next(createError('New parent folder not found', 404));
    }
  }

  const movedFolder = await prisma.folder.update({
    where: { id },
    data: {
      parentId: newParentId || null,
    },
    include: {
      _count: {
        select: {
          children: true,
          files: true,
        },
      },
    },
  });

  return res.status(200).json(movedFolder);
}));

// Delete folder
router.delete('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const { id } = req.params;

  // Verify folder exists and user has access
  const folder = await prisma.folder.findFirst({
    where: {
      id,
      dataRoom: {
        ownerId: req.user!.id,
      },
    },
  });

  if (!folder) {
    return next(createError('Folder not found', 404));
  }

  // Delete folder (cascade will handle children and files)
  await prisma.folder.delete({
    where: { id },
  });

  return res.json({
    success: true,
    message: 'Folder deleted successfully',
  });
}));

export { router as folderRoutes };
