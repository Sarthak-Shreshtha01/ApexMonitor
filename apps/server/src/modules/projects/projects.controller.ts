import { Request, Response, NextFunction } from 'express';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/project.dto';

export class ProjectsController {
  private service = new ProjectsService();

  listMine = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'UNAUTHORIZED' });
        return;
      }

      const projects = await this.service.listUserProjects(userId);
      res.status(200).json({ projects });
    } catch (error) {
      next(error);
    }
  };

  createMine = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'UNAUTHORIZED' });
        return;
      }

      const data = CreateProjectDto.parse(req.body);
      const project = await this.service.createUserProject(userId, data);
      res.status(201).json({ project });
    } catch (error) {
      next(error);
    }
  };
}
