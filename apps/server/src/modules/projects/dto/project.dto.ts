import { z } from 'zod';

export const CreateProjectDto = z.object({
  name: z.string().trim().min(2).max(100),
});

export type CreateProjectRequest = z.infer<typeof CreateProjectDto>;
