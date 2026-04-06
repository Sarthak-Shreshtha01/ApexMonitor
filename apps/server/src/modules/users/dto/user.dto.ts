import { z } from 'zod';

export const RegisterDto = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(100),
  name: z.string().min(2).max(100),
});

export const LoginDto = z.object({
  email: z.string().email(),
  password: z.string(),
});

export type RegisterRequest = z.infer<typeof RegisterDto>;
export type LoginRequest = z.infer<typeof LoginDto>;