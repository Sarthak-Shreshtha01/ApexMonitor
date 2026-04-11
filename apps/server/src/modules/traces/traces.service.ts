import { UserService } from '@modules/users/user.service';
import { TraceDetailQuery, TracesQuery } from './dto/traces-query.dto';
import { TracesRepository } from './traces.repository';

export class TracesService {
  private repo = new TracesRepository();
  private usersService = new UserService();

  async list(userId: string, query: TracesQuery) {
    await this.assertProjectAccess(userId, query.projectId);
    return this.repo.list(query);
  }

  async detail(userId: string, traceId: string, query: TraceDetailQuery) {
    await this.assertProjectAccess(userId, query.projectId);
    const trace = await this.repo.getByTraceId(query.projectId, traceId);
    if (!trace) throw new Error('TRACE_NOT_FOUND');
    return trace;
  }

  private async assertProjectAccess(userId: string, projectId: string) {
    const projects = await this.usersService.listProjects(userId);
    if (!projects.some((project) => project.id === projectId)) {
      throw new Error('PROJECT_ACCESS_DENIED');
    }
  }
}
