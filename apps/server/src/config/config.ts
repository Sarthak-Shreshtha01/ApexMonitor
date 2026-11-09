import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// 1. Resolve the optional .env file at the repository root
const envPath = path.resolve(__dirname, '../../../../.env');

// 2. Load it when present (local development). Containers, CI and tests provide
//    variables through the environment instead; values already set are never overridden.
//    Tests never read .env so they are deterministic regardless of local files.
if (process.env.NODE_ENV !== 'test' && fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

// 4. Validate with Zod
const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  
  MONGO_URI: z.string().url(),
  PG_URI: z.string().url(),
  REDIS_URL: z.string().url(),
  RABBITMQ_URL: z.string().url(),
  
  JWT_SECRET: z.string().min(32),
  // Optional dedicated key for refresh tokens; when unset a key is derived from JWT_SECRET.
  JWT_REFRESH_SECRET: z.string().min(32).optional(),
  ARGON2_PEPPER: z.string().min(32),
  CORS_ORIGINS: z.string().transform(s => s.split(',')),
  
  RATE_LIMIT_RPM: z.coerce.number().int().positive().default(60000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  API_BASE_URL: z.string().url().default('http://localhost:3000'),
  FRONTEND_URL: z.string().url().default('http://localhost:3001'),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_REDIRECT_URI: z.string().url().optional(),

  // PhonePe Configs (with defaults for sandbox testing)
});

const parsed = ConfigSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

export const config = parsed.data;
export type Config = z.infer<typeof ConfigSchema>;