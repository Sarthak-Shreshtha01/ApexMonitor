import { getPg } from '@infrastructure/db/postgres';

interface CreateUserWithDefaultProjectInput {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  defaultProjectId: string;
  defaultProjectName: string;
}

export interface UserProjectRecord {
  id: string;
  name: string;
  owner_user_id: string;
  plan: string;
  rate_limit_rpm: number;
  log_retention_days: number;
  role: string;
  created_at: string;
  updated_at: string;
}

export class UserRepository {
  private get db() { return getPg(); }

  async createUserWithDefaultProject(input: CreateUserWithDefaultProjectInput): Promise<void> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO users (id, email, password_hash, name) VALUES ($1, $2, $3, $4)`,
        [input.id, input.email, input.passwordHash, input.name]
      );

      await client.query(
        `INSERT INTO projects (id, name, owner_user_id, plan, rate_limit_rpm, log_retention_days)
         VALUES ($1, $2, $3, 'free', 60000, 90)`,
        [input.defaultProjectId, input.defaultProjectName, input.id]
      );

      await client.query(
        `INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, 'owner')
         ON CONFLICT (project_id, user_id) DO NOTHING`,
        [input.defaultProjectId, input.id]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async createUser(id: string, email: string, passwordHash: string, name: string) {
    await this.db.query(
      `INSERT INTO users (id, email, password_hash, name) VALUES ($1, $2, $3, $4)`,
      [id, email, passwordHash, name]
    );
  }

  async findByEmail(email: string) {
    const { rows } = await this.db.query(
      `SELECT * FROM users WHERE email = $1`,
      [email]
    );
    return rows[0];
  }

  async listProjectsByUserId(userId: string): Promise<UserProjectRecord[]> {
    const { rows } = await this.db.query(
      `SELECT
         p.id,
         p.name,
         p.owner_user_id,
         p.plan,
         p.rate_limit_rpm,
         p.log_retention_days,
         pm.role,
         p.created_at,
         p.updated_at
       FROM project_members pm
       INNER JOIN projects p ON p.id = pm.project_id
       WHERE pm.user_id = $1
       ORDER BY p.created_at ASC`,
      [userId]
    );

    return rows;
  }

  async createProjectForUser(userId: string, projectId: string, projectName: string): Promise<void> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO projects (id, name, owner_user_id, plan, rate_limit_rpm, log_retention_days)
         VALUES ($1, $2, $3, 'free', 60000, 90)`,
        [projectId, projectName, userId]
      );

      await client.query(
        `INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, 'owner')
         ON CONFLICT (project_id, user_id) DO NOTHING`,
        [projectId, userId]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async findById(userId: string) {
    const { rows } = await this.db.query(
      `SELECT id, email, name, created_at FROM users WHERE id = $1`,
      [userId]
    );
    return rows[0];
  }

  async updateProfile(userId: string, name: string, email: string) {
    const { rows } = await this.db.query(
      `UPDATE users SET name = $1, email = $2 WHERE id = $3 RETURNING id, email, name, created_at`,
      [name, email, userId]
    );
    return rows[0];
  }

  async listProjectMembers(projectId: string) {
    const { rows } = await this.db.query(
      `SELECT pm.user_id, u.name, u.email, pm.role, u.created_at
       FROM project_members pm
       JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = $1
       ORDER BY u.created_at ASC`,
      [projectId]
    );
    return rows;
  }

  async getProjectMember(projectId: string, userId: string) {
    const { rows } = await this.db.query(
      `SELECT pm.user_id, u.name, u.email, pm.role, u.created_at
       FROM project_members pm
       JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = $1 AND pm.user_id = $2`,
      [projectId, userId]
    );
    return rows[0];
  }

  async addProjectMember(projectId: string, userId: string, role: string) {
    const { rows } = await this.db.query(
      `INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3)
       ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role
       RETURNING user_id, role`,
      [projectId, userId, role]
    );
    return rows[0];
  }

  async updateMemberRole(projectId: string, userId: string, role: string) {
    const { rows } = await this.db.query(
      `UPDATE project_members SET role = $1 WHERE project_id = $2 AND user_id = $3
       RETURNING user_id, role`,
      [role, projectId, userId]
    );
    return rows[0];
  }

  async removeMember(projectId: string, userId: string) {
    await this.db.query(
      `DELETE FROM project_members WHERE project_id = $1 AND user_id = $2`,
      [projectId, userId]
    );
  }
}