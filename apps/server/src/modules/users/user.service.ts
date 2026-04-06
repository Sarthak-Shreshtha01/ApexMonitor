import argon2 from 'argon2';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '@config';
import { UserRepository } from './user.repository';
import { RegisterRequest, LoginRequest } from './dto/user.dto';

export class UserService {
  private repo = new UserRepository();

  async register(data: RegisterRequest): Promise<{ user: any; token: string }> {
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

    const token = this.generateToken(userId, data.email);
    return { user: { id: userId, email: data.email, name: data.name }, token };
  }

  async login(data: LoginRequest): Promise<{ user: any; token: string }> {
    const user = await this.repo.findByEmail(data.email);
    if (!user) throw new Error('INVALID_CREDENTIALS');

    const isValid = await argon2.verify(user.password_hash, data.password + config.ARGON2_PEPPER);
    if (!isValid) throw new Error('INVALID_CREDENTIALS');

    const token = this.generateToken(user.id, user.email);
    return { user: { id: user.id, email: user.email, name: user.name }, token };
  }

  private generateToken(userId: string, email: string): string {
    return jwt.sign({ sub: userId, email }, config.JWT_SECRET, { expiresIn: '7d' });
  }
}