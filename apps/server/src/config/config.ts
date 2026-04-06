import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// 1. Reliably resolve the .env file from the root directory
const envPath = path.resolve(__dirname, '../../../../.env');

// 2. Fail fast if the file physically doesn't exist
if (!fs.existsSync(envPath)) {
  console.error(`❌ CRITICAL: .env file missing. Looked in: ${envPath}`);
  process.exit(1);
}

// 3. Load the variables
dotenv.config({ path: envPath });

// 4. Validate with Zod
const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  
  MONGO_URI: z.string().url(),
  PG_URI: z.string().url(),
  REDIS_URL: z.string().url(),
  RABBITMQ_URL: z.string().url(),
  
  JWT_SECRET: z.string().min(32),
  ARGON2_PEPPER: z.string().min(32),
  CORS_ORIGINS: z.string().transform(s => s.split(',')),
  
  RATE_LIMIT_RPM: z.coerce.number().int().positive().default(60000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  API_BASE_URL: z.string().url().default('http://localhost:3000'),

  // PhonePe Configs (with defaults for sandbox testing)
});

const parsed = ConfigSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

export const config = parsed.data;
export type Config = z.infer<typeof ConfigSchema>;