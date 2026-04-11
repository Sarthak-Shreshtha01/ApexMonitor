import argon2 from 'argon2';
import { config } from '@config';
import { getRedis } from '@infrastructure/redis';
import { AuthRepository } from './auth.repository';
import crypto from 'crypto';
import { UserService } from '@modules/users/user.service';

export class AuthService {
  private repo = new AuthRepository();
  private userService = new UserService();

  async validateApiKey(rawKey: string): Promise<string> {
    const redis = getRedis();
    const prefix = rawKey.substring(0, 10);
    
    // 1. Check Redis Cache first (cite: 1054)
    const cachedProjectId = await redis.get(`api_key_cache:${rawKey}`);
    if (cachedProjectId) return cachedProjectId;

    // 2. DB Lookup by prefix
    const keyRecord = await this.repo.findKeyByPrefix(prefix);
    if (!keyRecord) throw new Error('UNAUTHORIZED');

    // 3. Verify Argon2id Hash (cite: 1043-1048)
    const isValid = await argon2.verify(keyRecord.key_hash, rawKey + config.ARGON2_PEPPER);
    if (!isValid) throw new Error('UNAUTHORIZED');

    // 4. Cache & Background Update
    await redis.setex(`api_key_cache:${rawKey}`, 300, keyRecord.project_id);
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
    const cacheKey = `rum_key_cache:${rawKey}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return cached;
    }

    const prefix = rawKey.substring(0, 10);
    const keyRecord = await this.repo.findRumKeyByPrefix(prefix);
    if (!keyRecord) throw new Error('UNAUTHORIZED');

    const isValid = await argon2.verify(keyRecord.key_hash, rawKey + config.ARGON2_PEPPER);
    if (!isValid) throw new Error('UNAUTHORIZED');

    const allowedOrigins = Array.isArray(keyRecord.allowed_origins) ? keyRecord.allowed_origins : [];
    if (allowedOrigins.length > 0 && origin) {
      const normalizedOrigin = origin.toLowerCase();
      const isAllowed = allowedOrigins.some((value: string) => value.toLowerCase() === normalizedOrigin);
      if (!isAllowed) {
        throw new Error('ORIGIN_NOT_ALLOWED');
      }
    }

    await redis.setex(cacheKey, 300, keyRecord.project_id);
    this.repo.updateRumLastUsed(keyRecord.id);

    return keyRecord.project_id;
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

}