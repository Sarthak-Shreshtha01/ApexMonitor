import argon2 from 'argon2';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '@config';
import { UserRepository } from './user.repository';
import { RegisterRequest, LoginRequest } from './dto/user.dto';

interface AuthUser {
  id: string;
  email: string;
  name: string;
}

interface AuthResult {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  token: string;
}

export class UserService {
  private repo = new UserRepository();

  async register(data: RegisterRequest): Promise<AuthResult> {
    const existing = await this.repo.findByEmail(data.email);
    if (existing) throw new Error('EMAIL_IN_USE');

    const userId = `usr_${crypto.randomBytes(16).toString('hex')}`;
    const hash = await argon2.hash(data.password + config.ARGON2_PEPPER, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    await this.repo.createUser(userId, data.email, hash, data.name);

    return this.buildAuthResult({ id: userId, email: data.email, name: data.name });
  }

  async login(data: LoginRequest): Promise<AuthResult> {
    const user = await this.repo.findByEmail(data.email);
    if (!user) throw new Error('INVALID_CREDENTIALS');

    const isValid = await argon2.verify(user.password_hash, data.password + config.ARGON2_PEPPER);
    if (!isValid) throw new Error('INVALID_CREDENTIALS');

    return this.buildAuthResult({ id: user.id, email: user.email, name: user.name });
  }

  async refreshSession(rawRefreshToken: string): Promise<AuthResult> {
    const payload = this.verifyRefreshToken(rawRefreshToken);
    const user = await this.repo.findByEmail(payload.email);

    if (!user || user.id !== payload.sub) {
      throw new Error('INVALID_REFRESH_TOKEN');
    }

    return this.buildAuthResult({ id: user.id, email: user.email, name: user.name });
  }

  private buildAuthResult(user: AuthUser): AuthResult {
    const accessToken = this.generateAccessToken(user.id, user.email);
    const refreshToken = this.generateRefreshToken(user.id, user.email);

    return {
      user,
      accessToken,
      refreshToken,
      token: accessToken,
    };
  }

  private generateAccessToken(userId: string, email: string): string {
    return jwt.sign({ sub: userId, email, tokenType: 'access' }, config.JWT_SECRET, { expiresIn: '15m' });
  }

  private generateRefreshToken(userId: string, email: string): string {
    return jwt.sign({ sub: userId, email, tokenType: 'refresh' }, config.JWT_SECRET, { expiresIn: '30d' });
  }

  private verifyRefreshToken(rawToken: string): { sub: string; email: string; tokenType?: string } {
    const payload = jwt.verify(rawToken, config.JWT_SECRET) as { sub?: string; email?: string; tokenType?: string };

    if (!payload.sub || !payload.email || payload.tokenType !== 'refresh') {
      throw new Error('INVALID_REFRESH_TOKEN');
    }

    return { sub: payload.sub, email: payload.email, tokenType: payload.tokenType };
  }
}