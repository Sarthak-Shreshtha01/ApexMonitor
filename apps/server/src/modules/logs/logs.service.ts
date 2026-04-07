import { UserService } from '@modules/users/user.service';
import { LogsQuery } from './dto/logs-query.dto';
import { LogsRepository } from './logs.repository';

export class LogsService {
  private repository = new LogsRepository();
  private usersService = new UserService();

  async list(userId: string, query: LogsQuery) {
    const projects = await this.usersService.listProjects(userId);
    const hasAccess = projects.some((project) => project.id === query.projectId);

    if (!hasAccess) {
      throw new Error('PROJECT_ACCESS_DENIED');
    }

    return this.repository.list(query);
  }
}
