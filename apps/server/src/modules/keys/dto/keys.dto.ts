import { z } from 'zod';

export const ListKeysQueryDto = z.object({
  projectId: z.string().min(1).optional(),
});

export const CreateKeyDto = z.object({
  projectId: z.string().min(1),
  label: z.string().trim().min(1).max(100),
});

export const RevokeKeyQueryDto = z.object({
  projectId: z.string().min(1),
});

export type ListKeysQuery = z.infer<typeof ListKeysQueryDto>;
export type CreateKeyInput = z.infer<typeof CreateKeyDto>;
export type RevokeKeyQuery = z.infer<typeof RevokeKeyQueryDto>;
