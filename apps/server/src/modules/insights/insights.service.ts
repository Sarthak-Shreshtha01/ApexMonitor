import { UserService } from '@modules/users/user.service';
import { InsightsQuery } from './dto/insights-query.dto';
import { InsightsRepository } from './insights.repository';

export class InsightsService {
  private repository = new InsightsRepository();
  private usersService = new UserService();

  async listRecent(userId: string, query: InsightsQuery) {
    const projects = await this.usersService.listProjects(userId);
    const hasAccess = projects.some((project) => project.id === query.projectId);

    if (!hasAccess) {
      throw new Error('PROJECT_ACCESS_DENIED');
    }

    return this.repository.listRecent(query.projectId, query.limit);
  }
}
