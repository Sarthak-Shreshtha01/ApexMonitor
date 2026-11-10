import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// 1. Resolve the optional .env file at the repository root: the nearest ancestor of this
//    file that holds package-lock.json. Works from src/ (tsx), from the bundled dist/, and
//    finds nothing in a container image without the repo (where env vars are used instead).
//    ENV_FILE overrides the location.
function findRepoEnvFile(): string | null {
  if (process.env.ENV_FILE) return path.resolve(process.env.ENV_FILE);
  let dir = __dirname;
  for (let depth = 0; depth < 8; depth++) {
    if (fs.existsSync(path.join(dir, 'package-lock.json'))) return path.join(dir, '.env');
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
const envPath = findRepoEnvFile();

// 2. Load it when present (local development). Containers, CI and tests provide
//    variables through the environment instead; values already set are never overridden.
//    Tests never read .env so they are deterministic regardless of local files.
if (process.env.NODE_ENV !== 'test' && envPath && fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

/** PhonePe's public test merchant; allowed only outside production. */
export const PHONEPE_SANDBOX_MERCHANT_ID = 'PGTESTPAYUAT';

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
  
  // Apply pending database migrations at startup. Defaults to on outside production.
  DB_AUTO_MIGRATE: z.enum(['true', 'false']).optional().transform((v) => (v === undefined ? undefined : v === 'true')),
  // Longest a SIGTERM/SIGINT shutdown may take before the process exits anyway.
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(25_000),
  RATE_LIMIT_RPM: z.coerce.number().int().positive().default(60000),
  // Per-project RUM events per minute; defaults to 2 × RATE_LIMIT_RPM.
  RUM_RATE_LIMIT_RPM: z.coerce.number().int().positive().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  API_BASE_URL: z.string().url().default('http://localhost:3000'),
  FRONTEND_URL: z.string().url().default('http://localhost:3001'),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_REDIRECT_URI: z.string().url().optional(),

  // PhonePe. Billing is enabled only when merchant id and salt key are both set; there are
  // no built-in sandbox credentials. PHONEPE_ENV picks the gateway endpoint.
  PHONEPE_ENV: z.enum(['sandbox', 'production']).default('sandbox'),
  PHONEPE_MERCHANT_ID: z.string().min(1).optional(),
  PHONEPE_SALT_KEY: z.string().min(1).optional(),
  PHONEPE_SALT_INDEX: z.coerce.number().int().positive().default(1),
})
  .refine((c) => Boolean(c.PHONEPE_MERCHANT_ID) === Boolean(c.PHONEPE_SALT_KEY), {
    message: 'Set both PHONEPE_MERCHANT_ID and PHONEPE_SALT_KEY to enable billing, or neither to disable it',
    path: ['PHONEPE_SALT_KEY'],
  })
  .refine((c) => c.NODE_ENV !== 'production' || !c.PHONEPE_MERCHANT_ID || c.PHONEPE_ENV === 'production', {
    message: 'PHONEPE_ENV must be "production" when billing is enabled with NODE_ENV=production',
    path: ['PHONEPE_ENV'],
  })
  .refine((c) => c.NODE_ENV !== 'production' || c.PHONEPE_MERCHANT_ID !== PHONEPE_SANDBOX_MERCHANT_ID, {
    message: 'The public PhonePe sandbox merchant id cannot be used with NODE_ENV=production',
    path: ['PHONEPE_MERCHANT_ID'],
  });

const parsed = ConfigSchema.transform((c) => ({ ...c, DB_AUTO_MIGRATE: c.DB_AUTO_MIGRATE ?? c.NODE_ENV !== 'production' })).safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

export const config = parsed.data;
export type Config = z.infer<typeof ConfigSchema>;

/** True when PhonePe credentials are configured. */
export const isBillingEnabled = (): boolean => Boolean(config.PHONEPE_MERCHANT_ID && config.PHONEPE_SALT_KEY);