// Test setup file
import { PrismaClient } from '@prisma/client';

// Mock environment variables for tests
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
process.env.NODE_ENV = 'test';

// Global test timeout
jest.setTimeout(30000);

// Clean up after all tests
afterAll(async () => {
  const prisma = new PrismaClient();
  await prisma.$disconnect();
});
