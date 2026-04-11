import { apiClient } from '@/shared/api/apiClient';
import { ENDPOINTS } from '@/shared/api/endpoints';

export interface ProjectMember {
  userId: string;
  name: string;
  email: string;
  role: 'owner' | 'editor' | 'viewer';
  createdAt: string;
}

export interface AddMemberRequest {
  email: string;
  role: 'owner' | 'editor' | 'viewer';
}

export interface UpdateMemberRoleRequest {
  role: 'owner' | 'editor' | 'viewer';
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
