import { z } from 'zod';

export const InsightsQueryDto = z.object({
  projectId: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type InsightsQuery = z.infer<typeof InsightsQueryDto>;
