import { z } from 'zod';

export const LogEntrySchema = z.object({
  method:     z.enum(['GET','POST','PUT','DELETE','PATCH','OPTIONS']),
  endpoint:   z.string().min(1).max(512),
  statusCode: z.number().int().min(100).max(599),
  latencyMs:  z.number().int().min(0).max(300_000),
  ip:         z.string().max(64).default('0.0.0.0'),
  userAgent:  z.string().max(512).optional().default(''),
  timestamp:  z.string().datetime(), // Must be ISO 8601 UTC
  tags:       z.array(z.string().max(50)).max(10).optional().default([]),
});

export const IngestBatchDto = z.object({
  projectId:  z.string().regex(/^proj_[A-Za-z0-9_-]{16,}/),
  sdkVersion: z.string().regex(/^\d+\.\d+\.\d+$/).default('1.0.0'),
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
  logs:       z.array(LogEntrySchema).min(1).max(500),
});

export type IngestBatch = z.infer<typeof IngestBatchDto>;
export type LogEntry    = z.infer<typeof LogEntrySchema>;