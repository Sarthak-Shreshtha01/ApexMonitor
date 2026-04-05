import { z } from 'zod';

export const TIMEFRAMES = ['1h', '6h', '24h', '7d', '30d'] as const;

export const MetricsQueryDto = z.object({
  projectId: z.string(),
  timeframe: z.enum(TIMEFRAMES).default('24h'),
  endpoint:  z.string().optional(),
  method:    z.enum(['GET','POST','PUT','DELETE','PATCH']).optional(),
  page:      z.coerce.number().int().positive().default(1),
  limit:     z.coerce.number().int().min(1).max(200).default(50),
});

export type MetricsQuery = z.infer<typeof MetricsQueryDto>;