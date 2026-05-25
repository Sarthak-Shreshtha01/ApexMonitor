import { Request, Response, NextFunction } from 'express';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/project.dto';
import { errorBody, successBody } from '@shared/http/api-contract';

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
      res.status(201).json(successBody(res, { project }));
    } catch (error) {
      next(error);
    }
  };
}
