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
  email: z.string().email().max(255),
  // max bounds the argon2 work an unauthenticated caller can trigger
  password: z.string().min(1).max(200),
});

export const UpdateProfileDto = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().email().max(255),
  company: z.string().trim().max(120).optional(),
  jobTitle: z.string().trim().max(120).optional(),
  timezone: z.string().trim().max(64).optional(),
});

/**
 * Project roles. `owner` manages the project (keys, members, alert rules, billing);
 * `developer` is a member with read access to all project data.
 */
export const PROJECT_ROLES = ['owner', 'developer'] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];
const Role = z.enum(PROJECT_ROLES, { message: `role must be one of: ${PROJECT_ROLES.join(', ')}` });

export const AddMemberDto = z.object({
  email: z.string().trim().email().max(255),
  role: Role,
});

export const UpdateMemberRoleDto = z.object({ role: Role });

export type RegisterRequest = z.infer<typeof RegisterDto>;
export type LoginRequest = z.infer<typeof LoginDto>;