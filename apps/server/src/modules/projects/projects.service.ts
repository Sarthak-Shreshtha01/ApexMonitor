import { UserService } from '@modules/users/user.service';
import { CreateProjectRequest } from './dto/project.dto';

export class ProjectsService {
  private usersService = new UserService();

  async listUserProjects(userId: string) {
    return this.usersService.listProjects(userId);
  }

  async createUserProject(userId: string, dto: CreateProjectRequest) {
    return this.usersService.createProject(userId, dto.name);
  }
}
