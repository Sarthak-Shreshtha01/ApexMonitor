import { Request, Response, NextFunction } from 'express';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/project.dto';
import { errorBody, successBody } from '@shared/http/api-contract';
import { auditLogService } from '@shared/services/audit-log.service';

export class ProjectsController {
  private service = new ProjectsService();

  listMine = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json(errorBody(res, 'UNAUTHORIZED', 'Missing JWT Token'));
        return;
      }

      const projects = await this.service.listUserProjects(userId);
      res.status(200).json(successBody(res, { projects }));
    } catch (error) {
      next(error);
    }
  };

  createMine = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json(errorBody(res, 'UNAUTHORIZED', 'Missing JWT Token'));
        return;
      }

      const data = CreateProjectDto.parse(req.body);
      const project = await this.service.createUserProject(userId, data);
      void auditLogService.recordSafe({
        actorUserId: userId,
        projectId: project.id,
        action: 'project.created',
        resourceType: 'project',
        resourceId: project.id,
        metadata: { name: project.name },
        ipAddress: req.ip,
        userAgent: req.get('user-agent') ?? null,
      });
      res.status(201).json(successBody(res, { project }));
    } catch (error) {
      next(error);
    }
  };
}
