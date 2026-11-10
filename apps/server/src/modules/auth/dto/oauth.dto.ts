import { z } from 'zod';

/** Body of POST /auth/oauth/exchange. Codes are 32 random bytes, base64url (43 chars). */
export const OAuthExchangeDto = z.object({
  code: z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'Invalid login code'),
});

export type OAuthExchangeInput = z.infer<typeof OAuthExchangeDto>;
