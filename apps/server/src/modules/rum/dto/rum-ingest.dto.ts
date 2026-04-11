import { z } from 'zod';

const MetricValueSchema = z.number().min(0).max(600_000);

export const RumEventSchema = z.object({
  type: z.enum(['page_view', 'web_vital', 'heartbeat']).default('page_view'),
  path: z.string().min(1).max(1024),
  referrer: z.string().max(2048).optional().default(''),
  timestamp: z.string().datetime(),
  sessionId: z.string().max(128).optional(),
  visitorId: z.string().max(128).optional(),
  ttfbMs: MetricValueSchema.optional(),
  fcpMs: MetricValueSchema.optional(),
  lcpMs: MetricValueSchema.optional(),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional().default({}),
});

export const RumIngestBatchDto = z.object({
  sdkVersion: z.string().regex(/^\d+\.\d+\.\d+$/).default('1.0.0'),
  events: z.array(RumEventSchema).min(1).max(200),
});

export type RumEventInput = z.infer<typeof RumEventSchema>;
export type RumIngestBatch = z.infer<typeof RumIngestBatchDto>;

export type RumEnrichedEvent = {
  eventId: string;
  projectId: string;
  type: 'page_view' | 'web_vital' | 'heartbeat';
  path: string;
  referrerSource: string;
  sessionHash: string;
  visitorHash: string;
  ttfbMs: number | null;
  fcpMs: number | null;
  lcpMs: number | null;
  browserName: string;
  osName: string;
  deviceType: 'mobile' | 'desktop' | 'tablet' | 'bot' | 'unknown';
  countryCode: string;
  regionCode: string;
  timestamp: string;
  sdkVersion: string;
};
