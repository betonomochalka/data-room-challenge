import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../types';

// Define mocks at the top level
const mockGetUser = jest.fn();
const mockPrismaUser = {
  findUnique: jest.fn(),
  create: jest.fn(),
};

// Use jest.doMock for dependencies that need to be mocked before the module under test is imported
jest.doMock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

jest.doMock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    user: mockPrismaUser,
  },
}));

jest.doMock('../errorHandler', () => ({
  createError: jest.fn((message, status) => {
    const error = new Error(message);
    (error as any).status = status;
    return error;
  }),
}));

describe('Auth Middleware - authenticateToken', () => {
  let authenticateToken: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
  let createError: jest.Mock;
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;
  let nextFn: NextFunction;

  beforeEach(async () => {
    // Reset all mocks before each test
    jest.resetModules();
    mockGetUser.mockReset();
    mockPrismaUser.findUnique.mockReset();
    mockPrismaUser.create.mockReset();

    // Dynamically import the module to get the fresh instance with mocks
    const authModule = await import('../auth');
    authenticateToken = authModule.authenticateToken;
    const errorHandlerModule = await import('../errorHandler');
    createError = errorHandlerModule.createError as jest.Mock;
    
    mockReq = {
      headers: {},
    };
    mockRes = {};
    nextFn = jest.fn();
  });

  it('should call next with 401 error if no token is provided', async () => {
    await authenticateToken(mockReq as AuthenticatedRequest, mockRes as Response, nextFn);
    expect(nextFn).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
    expect(createError).toHaveBeenCalledWith('Access token required', 401);
  });

  it('should call next with 401 error if token is invalid', async () => {
    mockReq.headers = { authorization: 'Bearer invalidtoken' };
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid token' },
    });

    await authenticateToken(mockReq as AuthenticatedRequest, mockRes as Response, nextFn);
    expect(nextFn).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
    expect(createError).toHaveBeenCalledWith('Invalid or expired token', 401);
  });

  it('should attach user to request and call next if token is valid and user exists', async () => {
    const mockUser = { id: '1', email: 'test@example.com', name: 'Test User' };
    mockReq.headers = { authorization: 'Bearer validtoken' };

    mockGetUser.mockResolvedValue({
      data: { user: { id: 'supabase-123', email: 'test@example.com' } },
      error: null,
    });
    mockPrismaUser.findUnique.mockResolvedValue(mockUser);

    await authenticateToken(mockReq as AuthenticatedRequest, mockRes as Response, nextFn);

    expect(mockReq.user).toEqual(mockUser);
    expect(nextFn).toHaveBeenCalledWith();
  });

  it('should create a new user, attach to request, and call next if token is valid but user does not exist', async () => {
    const supabaseUser = { id: 'supabase-123', email: 'new@example.com', user_metadata: { full_name: 'New User' } };
    const createdUser = { id: '2', email: 'new@example.com', name: 'New User' };
    mockReq.headers = { authorization: 'Bearer validtoken_newuser' };

    mockGetUser.mockResolvedValue({
      data: { user: supabaseUser },
      error: null,
    });
    mockPrismaUser.findUnique.mockResolvedValue(null);
    mockPrismaUser.create.mockResolvedValue(createdUser);

    await authenticateToken(mockReq as AuthenticatedRequest, mockRes as Response, nextFn);

    expect(mockPrismaUser.create).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        email: supabaseUser.email,
        name: supabaseUser.user_metadata.full_name,
      }
    }));
    expect(mockReq.user).toEqual(createdUser);
    expect(nextFn).toHaveBeenCalledWith();
  });
});


