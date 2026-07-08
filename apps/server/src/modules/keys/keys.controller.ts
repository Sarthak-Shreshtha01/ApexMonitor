import { NextFunction, Request, Response } from 'express';
import { CreateKeyDto, KeysStatsQueryDto, ListKeysQueryDto, RevokeKeyQueryDto } from './dto/keys.dto';
import { KeysService } from './keys.service';
import { errorBody, successBody } from '@shared/http/api-contract';
import { auditLogService } from '@shared/services/audit-log.service';

export class KeysController {
  private service = new KeysService();

  stats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json(errorBody(res, 'UNAUTHORIZED', 'Missing JWT Token'));
        return;
      }

      const query = KeysStatsQueryDto.parse(req.query);
      const result = await this.service.stats(userId, query);
      res.status(200).json(successBody(res, result));
    } catch (error) {
      if (error instanceof Error && error.message === 'PROJECT_ACCESS_DENIED') {
        res.status(403).json(errorBody(res, 'FORBIDDEN', 'No access to project keys'));
        return;
      }

      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json(errorBody(res, 'UNAUTHORIZED', 'Missing JWT Token'));
        return;
      }

      const query = ListKeysQueryDto.parse(req.query);
      const result = await this.service.list(userId, query);
      res.status(200).json(successBody(res, result));
    } catch (error) {
      if (error instanceof Error && error.message === 'PROJECT_ACCESS_DENIED') {
        res.status(403).json(errorBody(res, 'FORBIDDEN', 'No access to project keys'));
        return;
      }

      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json(errorBody(res, 'UNAUTHORIZED', 'Missing JWT Token'));
        return;
      }

      const body = CreateKeyDto.parse(req.body);
      const created = await this.service.create(userId, body);

      void auditLogService.recordSafe({
        actorUserId: userId,
        projectId: body.projectId,
        action: 'key.created',
        resourceType: 'api_key',
        resourceId: String(created.keyId),
        metadata: { label: body.label ?? null },
        ipAddress: req.ip,
        userAgent: req.get('user-agent') ?? null,
      });

      res.status(201).json(successBody(res, {
        message: 'Store this key securely. It will not be shown again.',
        ...created,
      }));
    } catch (error) {
      if (error instanceof Error && error.message === 'PROJECT_ACCESS_DENIED') {
        res.status(403).json(errorBody(res, 'FORBIDDEN', 'No access to project keys'));
        return;
      }

      next(error);
    }
  };

  revoke = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json(errorBody(res, 'UNAUTHORIZED', 'Missing JWT Token'));
        return;
      }

      const keyId = Number(req.params.keyId);
      if (!Number.isInteger(keyId) || keyId <= 0) {
        res.status(400).json(errorBody(res, 'VALIDATION_ERROR', 'Invalid key id'));
        return;
      }

      const query = RevokeKeyQueryDto.parse(req.query);
      await this.service.revoke(userId, query.projectId, keyId);
      void auditLogService.recordSafe({
        actorUserId: userId,
        projectId: query.projectId,
        action: 'key.revoked',
        resourceType: 'api_key',
        resourceId: String(keyId),
        ipAddress: req.ip,
        userAgent: req.get('user-agent') ?? null,
      });
      res.status(204).send();
    } catch (error) {
      if (error instanceof Error && error.message === 'PROJECT_ACCESS_DENIED') {
        res.status(403).json(errorBody(res, 'FORBIDDEN', 'No access to project keys'));
        return;
      }

      if (error instanceof Error && error.message === 'KEY_NOT_FOUND') {
        res.status(404).json(errorBody(res, 'NOT_FOUND', 'Key not found'));
        return;
      }

      next(error);
    }
  };
}
