import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult, query } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../types';
import prisma from '../lib/prisma';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Validation middleware for creating/updating a data room
const validateDataRoom = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Data room name cannot be empty.')
    .isLength({ min: 3, max: 100 })
    .withMessage('Name must be between 3 and 100 characters.'),
];

// Get all data rooms for the authenticated user
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const dataRooms = await prisma.dataRoom.findMany({
    where: { ownerId: req.user!.id },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { folders: true, files: true },
      },
    },
  });
  res.status(200).json({
    success: true,
    data: dataRooms,
  });
}));

// Create a new data room
router.post('/', validateDataRoom, asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name } = req.body;
  const userId = req.user!.id;

  const existingDataRoom = await prisma.dataRoom.findFirst({
    where: { name, ownerId: userId },
  });

  if (existingDataRoom) {
    return next(createError('A data room with this name already exists.', 409));
  }

  const newDataRoom = await prisma.dataRoom.create({
    data: { name, ownerId: userId },
  });
  res.status(201).json({
    success: true,
    data: newDataRoom,
  });
}));

// Get a single data room by ID
router.get('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const dataRoom = await prisma.dataRoom.findFirst({
    where: { id, ownerId: req.user!.id },
    include: {
      folders: {
        where: { parentId: null }, // Only root folders
      },
      files: {
        where: { folderId: null }, // Only root files
      },
    },
  });

  if (!dataRoom) {
    return next(createError('Data room not found', 404));
  }
  res.status(200).json({
    success: true,
    data: dataRoom,
  });
}));

// Update a data room
router.put('/:id', validateDataRoom, asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const { name } = req.body;
  const userId = req.user!.id;

  const dataRoom = await prisma.dataRoom.findFirst({
    where: { id, ownerId: userId },
  });

  if (!dataRoom) {
    return next(createError('Data room not found', 404));
  }

  const updatedDataRoom = await prisma.dataRoom.update({
    where: { id },
    data: { name },
  });
  res.status(200).json({
    success: true,
    data: updatedDataRoom,
  });
}));

// Delete a data room
router.delete('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const dataRoom = await prisma.dataRoom.findFirst({
    where: { id, ownerId: userId },
  });

  if (!dataRoom) {
    return next(createError('Data room not found', 404));
  }

  await prisma.dataRoom.delete({ where: { id } });
  res.status(200).json({ success: true });
}));

export { router as dataRoomRoutes };
