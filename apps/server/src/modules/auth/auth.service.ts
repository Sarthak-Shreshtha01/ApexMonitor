import argon2 from 'argon2';
import { config } from '@config';
import { getRedis } from '@infrastructure/redis';
import { AuthRepository } from './auth.repository';
import crypto from 'crypto';
import { UserService } from '@modules/users/user.service';
import { signToken, verifyToken } from '@shared/auth/tokens';
import { cacheValidatedKey, readCachedKey } from './key-cache';

type OAuthProvider = 'google' | 'github';
type OAuthMode = 'login' | 'register';

export class AuthService {
  private repo = new AuthRepository();
  private userService = new UserService();

  async validateApiKey(rawKey: string): Promise<string> {
    const redis = getRedis();

    // 1. Cache (named by sha256 of the key; evicted on revoke, see key-cache.ts)
    const cached = await readCachedKey<{ projectId: string }>(redis, 'api', rawKey);
    if (cached?.projectId) return cached.projectId;

    // 2. DB Lookup by prefix
    const keyRecord = await this.repo.findKeyByPrefix(rawKey.substring(0, 10));
    if (!keyRecord) throw new Error('UNAUTHORIZED');

    // 3. Verify Argon2id Hash (cite: 1043-1048)
    const isValid = await argon2.verify(keyRecord.key_hash, rawKey + config.ARGON2_PEPPER);
    if (!isValid) throw new Error('UNAUTHORIZED');

    // 4. Cache, unless the key was revoked while we were verifying it
    const cachedOk = await cacheValidatedKey(redis, 'api', rawKey, keyRecord.id, { projectId: keyRecord.project_id });
    if (!cachedOk) throw new Error('UNAUTHORIZED');
    this.repo.updateLastUsed(keyRecord.id); // Fire and forget

    return keyRecord.project_id;
  }

  async generateApiKey(projectId: string, label?: string): Promise<string> {
    const raw = crypto.randomBytes(32).toString('base64url');
    const key = `proj_${raw}`;
    const prefix = key.substring(0, 10);

    const hash = await argon2.hash(key + config.ARGON2_PEPPER, {
      type: argon2.argon2id,
      memoryCost: 65536,  // 64 MB
      timeCost: 3,
      parallelism: 4,
    });

    // We need to add this insert method to our repo
    await this.repo.insertKey({ projectId, keyPrefix: prefix, keyHash: hash, label });
    
    return key;  // Shown to user exactly once
  }

  async generateRumWriteKey(projectId: string, label?: string, allowedOrigins?: string[]): Promise<string> {
    const raw = crypto.randomBytes(32).toString('base64url');
    const key = `rum_${raw}`;
    const prefix = key.substring(0, 10);

    const hash = await argon2.hash(key + config.ARGON2_PEPPER, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    await this.repo.insertRumKey({ projectId, keyPrefix: prefix, keyHash: hash, label, allowedOrigins });
    return key;
  }

  async validateRumWriteKey(rawKey: string, origin: string): Promise<string> {
    const redis = getRedis();

    // The origin allow-list is cached with the key and checked on every request,
    // so a cache hit from one site doesn't open the key to every other site.
    const cached = await readCachedKey<{ projectId: string; allowedOrigins: string[] }>(redis, 'rum', rawKey);
    if (cached?.projectId) {
      this.assertOriginAllowed(cached.allowedOrigins ?? [], origin);
      return cached.projectId;
    }

    const keyRecord = await this.repo.findRumKeyByPrefix(rawKey.substring(0, 10));
    if (!keyRecord) throw new Error('UNAUTHORIZED');

    const isValid = await argon2.verify(keyRecord.key_hash, rawKey + config.ARGON2_PEPPER);
    if (!isValid) throw new Error('UNAUTHORIZED');

    const allowedOrigins: string[] = Array.isArray(keyRecord.allowed_origins) ? keyRecord.allowed_origins : [];
    this.assertOriginAllowed(allowedOrigins, origin);

    const cachedOk = await cacheValidatedKey(redis, 'rum', rawKey, keyRecord.id, { projectId: keyRecord.project_id, allowedOrigins });
    if (!cachedOk) throw new Error('UNAUTHORIZED');
    this.repo.updateRumLastUsed(keyRecord.id);

    return keyRecord.project_id;
  }

  private assertOriginAllowed(allowedOrigins: string[], origin: string): void {
    if (allowedOrigins.length === 0 || !origin) return;
    const normalizedOrigin = origin.toLowerCase();
    if (!allowedOrigins.some((value) => value.toLowerCase() === normalizedOrigin)) {
      throw new Error('ORIGIN_NOT_ALLOWED');
    }
  }

  async login(email: string, password: string) {
    return this.userService.login({ email, password });
  }

  async refreshSession(refreshToken: string) {
    return this.userService.refreshSession(refreshToken);
  }

  async assertProjectOwner(projectId: string, userId: string): Promise<void> {
    const member = await this.repo.getProjectMember(projectId, userId);
    if (!member || member.role !== 'owner') {
      throw new Error('PROJECT_ACCESS_DENIED');
    }
  }

  getFrontendUrl(): string {
    return config.FRONTEND_URL;
  }

  async buildOAuthAuthorizationUrl(provider: OAuthProvider, mode: OAuthMode): Promise<string> {
    const state = this.signOAuthState(provider, mode);

    if (provider === 'google') {
      if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_REDIRECT_URI) {
        throw new Error('OAUTH_NOT_CONFIGURED');
      }

      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      url.searchParams.set('client_id', config.GOOGLE_CLIENT_ID);
      url.searchParams.set('redirect_uri', config.GOOGLE_REDIRECT_URI);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', 'openid email profile');
      url.searchParams.set('access_type', 'offline');
      url.searchParams.set('prompt', 'consent');
      url.searchParams.set('state', state);
      return url.toString();
    }

    if (provider === 'github') {
      if (!config.GITHUB_CLIENT_ID || !config.GITHUB_REDIRECT_URI) {
        throw new Error('OAUTH_NOT_CONFIGURED');
      }

      const url = new URL('https://github.com/login/oauth/authorize');
      url.searchParams.set('client_id', config.GITHUB_CLIENT_ID);
      url.searchParams.set('redirect_uri', config.GITHUB_REDIRECT_URI);
      url.searchParams.set('scope', 'read:user user:email');
      url.searchParams.set('state', state);
      return url.toString();
    }

    throw new Error('UNSUPPORTED_PROVIDER');
  }

  async handleOAuthCallback(provider: OAuthProvider, code: string, state: string) {
    this.verifyOAuthState(provider, state);

    if (provider === 'google') {
      if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET || !config.GOOGLE_REDIRECT_URI) {
        throw new Error('OAUTH_NOT_CONFIGURED');
      }

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: config.GOOGLE_CLIENT_ID,
          client_secret: config.GOOGLE_CLIENT_SECRET,
          redirect_uri: config.GOOGLE_REDIRECT_URI,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error('OAUTH_EXCHANGE_FAILED');
      }

      const tokenJson = await tokenResponse.json() as { access_token?: string };
      if (!tokenJson.access_token) {
        throw new Error('OAUTH_EXCHANGE_FAILED');
      }

      const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      });

      if (!profileResponse.ok) {
        throw new Error('OAUTH_EXCHANGE_FAILED');
      }

      const profile = await profileResponse.json() as { email?: string; name?: string; locale?: string };
      if (!profile.email) {
        throw new Error('OAUTH_EMAIL_UNAVAILABLE');
      }

      return this.userService.loginOrRegisterOAuthUser({
        email: profile.email,
        name: profile.name || profile.email.split('@')[0],
        timezone: profile.locale,
      });
    }

    if (provider === 'github') {
      if (!config.GITHUB_CLIENT_ID || !config.GITHUB_CLIENT_SECRET || !config.GITHUB_REDIRECT_URI) {
        throw new Error('OAUTH_NOT_CONFIGURED');
      }

      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          code,
          client_id: config.GITHUB_CLIENT_ID,
          client_secret: config.GITHUB_CLIENT_SECRET,
          redirect_uri: config.GITHUB_REDIRECT_URI,
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error('OAUTH_EXCHANGE_FAILED');
      }

      const tokenJson = await tokenResponse.json() as { access_token?: string };
      if (!tokenJson.access_token) {
        throw new Error('OAUTH_EXCHANGE_FAILED');
      }

      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${tokenJson.access_token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'ApexMonitor',
        },
      });

      const emailResponse = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${tokenJson.access_token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'ApexMonitor',
        },
      });

      if (!userResponse.ok || !emailResponse.ok) {
        throw new Error('OAUTH_EXCHANGE_FAILED');
      }

      const userJson = await userResponse.json() as { name?: string; login?: string };
      const emails = await emailResponse.json() as Array<{ email: string; primary: boolean; verified: boolean }>;
      const preferredEmail = emails.find((entry) => entry.primary && entry.verified)?.email || emails.find((entry) => entry.verified)?.email;

      if (!preferredEmail) {
        throw new Error('OAUTH_EMAIL_UNAVAILABLE');
      }

      return this.userService.loginOrRegisterOAuthUser({
        email: preferredEmail,
        name: userJson.name || userJson.login || preferredEmail.split('@')[0],
      });
    }

    throw new Error('UNSUPPORTED_PROVIDER');
  }

  private signOAuthState(provider: OAuthProvider, mode: OAuthMode): string {
    return signToken('oauth_state', {
      provider,
      mode,
      nonce: crypto.randomBytes(8).toString('hex'),
    });
  }

  private verifyOAuthState(provider: OAuthProvider, state: string): void {
    try {
      const payload = verifyToken('oauth_state', state) as { provider?: string };
      if (payload.provider !== provider) {
        throw new Error('INVALID_OAUTH_STATE');
      }
    } catch {
      throw new Error('INVALID_OAUTH_STATE');
    }
  }

}