import crypto from 'crypto';
import argon2 from 'argon2';
import { config } from '@config';
import { UserService } from '@modules/users/user.service';
import { CreateKeyInput, ListKeysQuery } from './dto/keys.dto';
import { KeysRepository } from './keys.repository';

export class KeysService {
  private usersService = new UserService();
  private repository = new KeysRepository();

  async list(userId: string, query: ListKeysQuery) {
    const projects = await this.usersService.listProjects(userId);

    const allowedProjectIds = query.projectId
      ? projects.filter((project) => project.id === query.projectId).map((project) => project.id)
      : projects.map((project) => project.id);

    if (allowedProjectIds.length === 0) {
      throw new Error('PROJECT_ACCESS_DENIED');
    }

    const keys = await this.repository.listByProjectIds(allowedProjectIds);
    return { keys };
  }

  async create(userId: string, input: CreateKeyInput) {
    await this.assertProjectAccess(userId, input.projectId);

    const random = crypto.randomBytes(24).toString('base64url');
    const plaintextKey = `pk_live_${random}`;
    const prefix = plaintextKey.substring(0, 10);

    const hash = await argon2.hash(plaintextKey + config.ARGON2_PEPPER, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    const createdId = await this.repository.insertKey({
      projectId: input.projectId,
      keyPrefix: prefix,
      keyHash: hash,
      label: input.label,
    });

    return {
      keyId: createdId,
      keyPrefix: prefix,
      plaintextKey,
      label: input.label,
      projectId: input.projectId,
    };
  }

  async revoke(userId: string, projectId: string, keyId: number) {
    await this.assertProjectAccess(userId, projectId);
    const revoked = await this.repository.revokeKey(projectId, keyId);

    if (!revoked) {
      throw new Error('KEY_NOT_FOUND');
    }
  }

  private async assertProjectAccess(userId: string, projectId: string): Promise<void> {
    const projects = await this.usersService.listProjects(userId);
    const hasAccess = projects.some((project) => project.id === projectId);

    if (!hasAccess) {
      throw new Error('PROJECT_ACCESS_DENIED');
    }
  }
}
