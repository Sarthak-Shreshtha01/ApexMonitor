import { z } from 'zod';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as const;
const STATUS_CLASSES = ['2xx', '3xx', '4xx', '5xx'] as const;

export const LogsQueryDto = z.object({
  projectId: z.string().min(1),
  method: z.enum(METHODS).optional(),
  statusClass: z.enum(STATUS_CLASSES).optional(),
  endpoint: z.string().trim().min(1).max(512).optional(),
  search: z.string().trim().min(1).max(256).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
});

export type LogsQuery = z.infer<typeof LogsQueryDto>;
