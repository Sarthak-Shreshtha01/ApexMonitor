import { getPg } from '@infrastructure/db/postgres';
import { logger } from '@shared/utils/logger';

export interface AuditEventInput {
  actorUserId?: string | null;
  projectId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export class AuditLogService {
  private get db() {
    return getPg();
  }

  async record(event: AuditEventInput): Promise<void> {
    await this.db.query(
      `INSERT INTO audit_logs (
         actor_user_id,
         project_id,
         action,
         resource_type,
         resource_id,
         metadata,
         ip_address,
         user_agent
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        event.actorUserId ?? null,
        event.projectId ?? null,
        event.action,
        event.resourceType,
        event.resourceId ?? null,
        event.metadata ?? {},
        event.ipAddress ?? null,
        event.userAgent ?? null,
      ]
    );
  }

  async recordSafe(event: AuditEventInput): Promise<void> {
    try {
      await this.record(event);
    } catch (error) {
      logger.warn({ error, event }, 'Failed to write audit log');
    }
  }
}

export const auditLogService = new AuditLogService();