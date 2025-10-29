import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AuthenticatedRequest } from '../types';
import { createError } from './errorHandler';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config';

export { AuthenticatedRequest };

// Initialize Supabase client for token verification
const supabaseUrl = config.supabaseUrl;
const supabaseServiceKey = config.supabaseServiceKey;

// Add a check for missing environment variables
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ [Auth] Missing Supabase URL or Service Key. Check environment variables.');
  throw new Error('Authentication service is not configured.');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      throw createError('Access token required', 401);
    }

    // Verify Supabase JWT token
    if (!supabase) {
      throw createError('Authentication service not configured', 500);
    }

    const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);

    if (error || !supabaseUser) {
      console.error('❌ [Auth] Supabase token verification failed:', error);
      throw createError('Invalid or expired token', 401);
    }

    // Find or create user in our database
    let user = await prisma.user.findUnique({
      where: { email: supabaseUser.email! },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // If user doesn't exist in our DB, create them
    if (!user) {
      console.log('📝 [Auth] Creating new user in database:', supabaseUser.email);
      user = await prisma.user.create({
        data: {
          email: supabaseUser.email!,
          name: supabaseUser.user_metadata?.full_name || supabaseUser.email!.split('@')[0],
          // No password needed for OAuth users
        },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }

    req.user = user;
    next();
  } catch (error: any) {
    // Catch generic auth errors from Supabase or other issues
    next(createError(error.message || 'Authentication failed', 401));
  }
};
