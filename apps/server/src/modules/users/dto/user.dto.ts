import { z } from 'zod';

export const RegisterDto = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(100),
  name: z.string().min(2).max(100),
  company: z.string().trim().max(120).optional(),
  jobTitle: z.string().trim().max(120).optional(),
  timezone: z.string().trim().max(64).optional(),
});

export const LoginDto = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const UpdateProfileDto = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().email().max(255),
  company: z.string().trim().max(120).optional(),
  jobTitle: z.string().trim().max(120).optional(),
  timezone: z.string().trim().max(64).optional(),
});

export type RegisterRequest = z.infer<typeof RegisterDto>;
export type LoginRequest = z.infer<typeof LoginDto>;