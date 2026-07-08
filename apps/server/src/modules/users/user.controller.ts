import { Request, Response, NextFunction } from 'express';
import { UserService } from './user.service';
import { RegisterDto, LoginDto, UpdateProfileDto } from './dto/user.dto';
import { serializeCookie } from '@shared/utils/cookie.utils';
import { auditLogService } from '@shared/services/audit-log.service';

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.setHeader('Set-Cookie', [
    serializeCookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAgeSeconds: COOKIE_MAX_AGE_SECONDS,
    }),
  ]);

  res.setHeader('X-Access-Token', accessToken);
}

function clearAuthCookies(res: Response): void {
  res.setHeader('Set-Cookie', [
    serializeCookie('refresh_token', '', {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAgeSeconds: 0,
    }),
  ]);
}

export class UserController {
  private service = new UserService();

  public register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = RegisterDto.parse(req.body);
      const result = await this.service.register(data);
      setAuthCookies(res, result.accessToken, result.refreshToken);
      void auditLogService.recordSafe({
        actorUserId: result.user.id,
        action: 'user.registered',
        resourceType: 'user',
        resourceId: result.user.id,
        metadata: { email: result.user.email },
        ipAddress: req.ip,
        userAgent: req.get('user-agent') ?? null,
      });
      res.status(201).json(result);
    } catch (error: any) {
      if (error.message === 'EMAIL_IN_USE') return res.status(409).json({ error: error.message });
      next(error);
    }
  };

  public login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = LoginDto.parse(req.body);
      const result = await this.service.login(data);
      setAuthCookies(res, result.accessToken, result.refreshToken);
      void auditLogService.recordSafe({
        actorUserId: result.user.id,
        action: 'user.logged_in',
        resourceType: 'user_session',
        resourceId: result.user.id,
        metadata: { email: result.user.email },
        ipAddress: req.ip,
        userAgent: req.get('user-agent') ?? null,
      });
      res.status(200).json(result);
    } catch (error: any) {
      if (error.message === 'INVALID_CREDENTIALS') return res.status(401).json({ error: error.message });
      next(error);
    }
  };

  public logout = async (req: Request, res: Response): Promise<void> => {
    void auditLogService.recordSafe({
      actorUserId: req.user?.id ?? null,
      action: 'auth.logout',
      resourceType: 'user_session',
      resourceId: req.user?.id ?? null,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? null,
    });
    clearAuthCookies(res);
    res.status(204).send();
  };

  public getProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'UNAUTHORIZED' });
        return;
      }

      const profile = await this.service.getProfile(userId);
      res.status(200).json({ profile });
    } catch (error: any) {
      if (error.message === 'USER_NOT_FOUND') return res.status(404).json({ error: error.message });
      next(error);
    }
  };

  public updateProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'UNAUTHORIZED' });
        return;
      }

      const payload = UpdateProfileDto.parse(req.body);
      const profile = await this.service.updateProfile(
        userId,
        payload.name,
        payload.email,
        payload.company,
        payload.jobTitle,
        payload.timezone,
      );
      void auditLogService.recordSafe({
        actorUserId: userId,
        action: 'user.profile_updated',
        resourceType: 'user',
        resourceId: userId,
        metadata: { email: profile.email },
        ipAddress: req.ip,
        userAgent: req.get('user-agent') ?? null,
      });
      res.status(200).json({ profile });
    } catch (error: any) {
      if (error.message === 'EMAIL_IN_USE') return res.status(409).json({ error: error.message });
      if (error.message === 'USER_NOT_FOUND') return res.status(404).json({ error: error.message });
      next(error);
    }
  };

  public listProjectMembers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'UNAUTHORIZED' });
        return;
      }

      const projectId = req.params.projectId as string;
      const members = await this.service.listProjectMembers(userId, projectId);
      void auditLogService.recordSafe({
        actorUserId: userId,
        projectId,
        action: 'project.members_listed',
        resourceType: 'project',
        resourceId: projectId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') ?? null,
      });
      res.status(200).json({ members });
    } catch (error: any) {
      if (error.message === 'PROJECT_ACCESS_DENIED') return res.status(403).json({ error: error.message });
      next(error);
    }
  };

  public addProjectMember = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'UNAUTHORIZED' });
        return;
      }

      const projectId = req.params.projectId as string;
      const { email, role } = req.body;

      if (!email || !role) {
        res.status(400).json({ error: 'MISSING_FIELDS' });
        return;
      }

      const member = await this.service.addProjectMember(userId, projectId, email, role);
      void auditLogService.recordSafe({
        actorUserId: userId,
        projectId,
        action: 'project.member_added',
        resourceType: 'project_member',
        resourceId: member.userId,
        metadata: { email, role },
        ipAddress: req.ip,
        userAgent: req.get('user-agent') ?? null,
      });
      res.status(201).json({ member });
    } catch (error: any) {
      if (error.message === 'PROJECT_ACCESS_DENIED') return res.status(403).json({ error: error.message });
      if (error.message === 'USER_NOT_FOUND') return res.status(404).json({ error: error.message });
      next(error);
    }
  };

  public updateMemberRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'UNAUTHORIZED' });
        return;
      }

      const projectId = req.params.projectId as string;
      const memberId = req.params.memberId as string;
      const { role } = req.body;

      if (!role) {
        res.status(400).json({ error: 'MISSING_FIELDS' });
        return;
      }

      const member = await this.service.updateMemberRole(userId, projectId, memberId, role);
      void auditLogService.recordSafe({
        actorUserId: userId,
        projectId,
        action: 'project.member_role_updated',
        resourceType: 'project_member',
        resourceId: memberId,
        metadata: { role },
        ipAddress: req.ip,
        userAgent: req.get('user-agent') ?? null,
      });
      res.status(200).json({ member });
    } catch (error: any) {
      if (error.message === 'PROJECT_ACCESS_DENIED') return res.status(403).json({ error: error.message });
      next(error);
    }
  };

  public removeMember = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'UNAUTHORIZED' });
        return;
      }

      const projectId = req.params.projectId as string;
      const memberId = req.params.memberId as string;

      await this.service.removeMember(userId, projectId, memberId);
      void auditLogService.recordSafe({
        actorUserId: userId,
        projectId,
        action: 'project.member_removed',
        resourceType: 'project_member',
        resourceId: memberId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') ?? null,
      });
      res.status(204).send();
    } catch (error: any) {
      if (error.message === 'PROJECT_ACCESS_DENIED') return res.status(403).json({ error: error.message });
      if (error.message === 'CANNOT_REMOVE_LAST_OWNER') return res.status(400).json({ error: error.message });
      next(error);
    }
  };
}