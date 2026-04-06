type SameSite = 'lax' | 'strict' | 'none';

export interface CookieOptions {
  maxAgeSeconds?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: SameSite;
  path?: string;
}

export function parseCookieHeader(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};

  return cookieHeader.split(';').reduce<Record<string, string>>((acc, part) => {
    const [rawName, ...rawValueParts] = part.trim().split('=');
    if (!rawName) return acc;

    acc[decodeURIComponent(rawName)] = decodeURIComponent(rawValueParts.join('=') || '');
    return acc;
  }, {});
}

export function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
  const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];

  if (options.maxAgeSeconds !== undefined) {
    parts.push(`Max-Age=${Math.floor(options.maxAgeSeconds)}`);
  }

  parts.push(`Path=${options.path ?? '/'}`);
  parts.push(`SameSite=${capitalizeSameSite(options.sameSite ?? 'lax')}`);

  if (options.httpOnly !== false) {
    parts.push('HttpOnly');
  }

  if (options.secure) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

function capitalizeSameSite(value: SameSite): 'Lax' | 'Strict' | 'None' {
  switch (value) {
    case 'strict':
      return 'Strict';
    case 'none':
      return 'None';
    default:
      return 'Lax';
  }
}
