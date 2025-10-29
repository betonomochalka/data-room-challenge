import dotenv from 'dotenv';

dotenv.config();

const requiredEnvVars = [
  'DATABASE_URL',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
  'ALLOWED_ORIGINS',
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

export const config = {
  databaseUrl: process.env.DATABASE_URL!,
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY!,
  allowedOrigins: process.env.ALLOWED_ORIGINS!,
  port: process.env.PORT || '3001',
  nodeEnv: process.env.NODE_ENV || 'development',
};
