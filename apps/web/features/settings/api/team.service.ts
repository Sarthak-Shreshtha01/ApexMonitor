import { apiClient } from '@/shared/api/apiClient';
import { ENDPOINTS } from '@/shared/api/endpoints';

/** Mirrors the server's PROJECT_ROLES: owners manage the project, developers can read everything. */
export type ProjectRole = 'owner' | 'developer';

export interface ProjectMember {
  userId: string;
  name: string;
  email: string;
  role: ProjectRole;
  createdAt: string;
}

export interface AddMemberRequest {
  email: string;
  role: ProjectRole;
}

export interface UpdateMemberRoleRequest {
  role: ProjectRole;
}

export class TeamService {
  async listMembers(projectId: string): Promise<ProjectMember[]> {
    const response = await apiClient.get<{ members: ProjectMember[] }>(
      ENDPOINTS.projects.members(projectId)
    );
    return response.data.members;
  }

  async addMember(projectId: string, data: AddMemberRequest): Promise<ProjectMember> {
    const response = await apiClient.post<{ member: ProjectMember }>(
      ENDPOINTS.projects.addMember(projectId),
      data
    );
    return response.data.member;
  }

  async updateMemberRole(
    projectId: string,
    memberId: string,
    data: UpdateMemberRoleRequest
  ): Promise<ProjectMember> {
    const response = await apiClient.patch<{ member: ProjectMember }>(
      ENDPOINTS.projects.updateMember(projectId, memberId),
      data
    );
    return response.data.member;
  }

  async removeMember(projectId: string, memberId: string): Promise<void> {
    await apiClient.delete(ENDPOINTS.projects.removeMember(projectId, memberId));
  }
}

export const teamService = new TeamService();
