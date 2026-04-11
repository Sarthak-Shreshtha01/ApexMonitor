import { z } from 'zod';

export const RumTimeframeSchema = z.enum(['1h', '6h', '24h', '7d', '30d']).default('24h');

export const RumQueryDto = z.object({
  projectId: z.string().regex(/^proj_[A-Za-z0-9_-]{16,}$/),
  timeframe: RumTimeframeSchema.optional().default('24h'),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type RumQuery = z.infer<typeof RumQueryDto>;
