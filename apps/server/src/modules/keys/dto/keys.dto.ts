import { z } from 'zod';

export const ListKeysQueryDto = z.object({
  projectId: z.string().min(1).optional(),
});

export const KeysStatsQueryDto = z.object({
  projectId: z.string().min(1).optional(),
  timeframe: z.enum(['1h', '6h', '24h', '7d', '30d']).optional().default('24h'),
});

export const CreateKeyDto = z.object({
  projectId: z.string().min(1),
  label: z.string().trim().min(1).max(100),
});

export const RevokeKeyQueryDto = z.object({
  projectId: z.string().min(1),
});

export type ListKeysQuery = z.infer<typeof ListKeysQueryDto>;
export type KeysStatsQuery = z.infer<typeof KeysStatsQueryDto>;
export type CreateKeyInput = z.infer<typeof CreateKeyDto>;
export type RevokeKeyQuery = z.infer<typeof RevokeKeyQueryDto>;
