import { z } from 'zod';

const STATUS_CLASSES = ['2xx', '3xx', '4xx', '5xx'] as const;

export const TracesQueryDto = z.object({
  projectId: z.string().min(1),
  statusClass: z.enum(STATUS_CLASSES).optional(),
  search: z.string().trim().min(1).max(256).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const TraceDetailQueryDto = z.object({
  projectId: z.string().min(1),
});

export type TracesQuery = z.infer<typeof TracesQueryDto>;
export type TraceDetailQuery = z.infer<typeof TraceDetailQueryDto>;
