import argon2 from 'argon2';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '@config';
import { UserProjectRecord, UserRepository } from './user.repository';
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

export interface UserProjectSummary {
  id: string;
  name: string;
  ownerUserId: string;
  role: string;
  plan: string;
  rateLimitRpm: number;
  logRetentionDays: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface ProjectMember {
  userId: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
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

    const defaultProjectId = this.generateProjectId();
    const defaultProjectName = this.buildDefaultProjectName(data.name);

    await this.repo.createUserWithDefaultProject({
      id: userId,
      email: data.email,
      passwordHash: hash,
      name: data.name,
      defaultProjectId,
      defaultProjectName,
    });

    return this.buildAuthResult({ id: userId, email: data.email, name: data.name });
  }

  async login(data: LoginRequest): Promise<AuthResult> {
    const user = await this.repo.findByEmail(data.email);
    if (!user) throw new Error('INVALID_CREDENTIALS');

    const isValid = await argon2.verify(user.password_hash, data.password + config.ARGON2_PEPPER);
    if (!isValid) throw new Error('INVALID_CREDENTIALS');

    return this.buildAuthResult({ id: user.id, email: user.email, name: user.name });
  }

  async listProjects(userId: string): Promise<UserProjectSummary[]> {
    const records = await this.repo.listProjectsByUserId(userId);
    return records.map((record) => this.mapProjectRecord(record));
  }

  async createProject(userId: string, name: string): Promise<UserProjectSummary> {
    const projectId = this.generateProjectId();
    const normalizedName = name.trim();
    await this.repo.createProjectForUser(userId, projectId, normalizedName);

    const projects = await this.repo.listProjectsByUserId(userId);
    const created = projects.find((project) => project.id === projectId);

    if (!created) {
      throw new Error('PROJECT_CREATE_FAILED');
    }

    return this.mapProjectRecord(created);
  }

  async refreshSession(rawRefreshToken: string): Promise<AuthResult> {
    const payload = this.verifyRefreshToken(rawRefreshToken);
    const user = await this.repo.findByEmail(payload.email);

    if (!user || user.id !== payload.sub) {
      throw new Error('INVALID_REFRESH_TOKEN');
    }

    return this.buildAuthResult({ id: user.id, email: user.email, name: user.name });
  }

  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.repo.findById(userId);
    if (!user) throw new Error('USER_NOT_FOUND');

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.created_at,
    };
  }

  async updateProfile(userId: string, name: string, email: string): Promise<UserProfile> {
    const existing = await this.repo.findByEmail(email);
    if (existing && existing.id !== userId) {
      throw new Error('EMAIL_IN_USE');
    }

    const user = await this.repo.updateProfile(userId, name, email);
    if (!user) throw new Error('USER_NOT_FOUND');

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.created_at,
    };
  }

  async listProjectMembers(userId: string, projectId: string): Promise<ProjectMember[]> {
    // Check if user has access to project
    const projects = await this.repo.listProjectsByUserId(userId);
    if (!projects.find(p => p.id === projectId)) {
      throw new Error('PROJECT_ACCESS_DENIED');
    }

    const members = await this.repo.listProjectMembers(projectId);
    return members.map(m => ({
      userId: m.user_id,
      name: m.name,
      email: m.email,
      role: m.role,
      createdAt: m.created_at,
    }));
  }

  async addProjectMember(userId: string, projectId: string, memberEmail: string, role: string): Promise<ProjectMember> {
    // Check if user is project owner
    const projects = await this.repo.listProjectsByUserId(userId);
    const project = projects.find(p => p.id === projectId);
    if (!project || project.role !== 'owner') {
      throw new Error('PROJECT_ACCESS_DENIED');
    }

    // Check if member exists
    const member = await this.repo.findByEmail(memberEmail);
    if (!member) {
      throw new Error('USER_NOT_FOUND');
    }

    // Add member to project
    await this.repo.addProjectMember(projectId, member.id, role);

    const result = await this.repo.getProjectMember(projectId, member.id);
    return {
      userId: result.user_id,
      name: result.name,
      email: result.email,
      role: result.role,
      createdAt: result.created_at,
    };
  }

  async updateMemberRole(userId: string, projectId: string, memberId: string, role: string): Promise<ProjectMember> {
    // Check if user is project owner
    const projects = await this.repo.listProjectsByUserId(userId);
    const project = projects.find(p => p.id === projectId);
    if (!project || project.role !== 'owner') {
      throw new Error('PROJECT_ACCESS_DENIED');
    }

    // Update member role
    await this.repo.updateMemberRole(projectId, memberId, role);

    const result = await this.repo.getProjectMember(projectId, memberId);
    return {
      userId: result.user_id,
      name: result.name,
      email: result.email,
      role: result.role,
      createdAt: result.created_at,
    };
  }

  async removeMember(userId: string, projectId: string, memberId: string): Promise<void> {
    // Check if user is project owner
    const projects = await this.repo.listProjectsByUserId(userId);
    const project = projects.find(p => p.id === projectId);
    if (!project || project.role !== 'owner') {
      throw new Error('PROJECT_ACCESS_DENIED');
    }

    // Don't allow removing the last owner
    const members = await this.repo.listProjectMembers(projectId);
    const owners = members.filter(m => m.role === 'owner');
    if (owners.length === 1 && owners[0].user_id === memberId) {
      throw new Error('CANNOT_REMOVE_LAST_OWNER');
    }

    await this.repo.removeMember(projectId, memberId);
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

  private generateProjectId(): string {
    return `proj_${crypto.randomBytes(12).toString('hex')}`;
  }

  private buildDefaultProjectName(userName: string): string {
    const cleanName = userName.trim();
    if (!cleanName) return 'My First Project';
    return `${cleanName.split(' ')[0]}'s Project`;
  }

  private mapProjectRecord(record: UserProjectRecord): UserProjectSummary {
    return {
      id: record.id,
      name: record.name,
      ownerUserId: record.owner_user_id,
      role: record.role,
      plan: record.plan,
      rateLimitRpm: record.rate_limit_rpm,
      logRetentionDays: record.log_retention_days,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }
}