import { getPg } from '@infrastructure/db/postgres';
import type { PipelineStage } from 'mongoose';
import { ApiLog } from '@modules/logs/logs.schema';
import type { AlertCondition, CreateAlertRuleInput, UpdateAlertRuleInput } from './dto/alert-rule.dto';

export type AlertState = 'ok' | 'firing';

export interface AlertRule {
  id: number;
  project_id: string;
  name: string;
  condition_type: AlertCondition;
  endpoint_filter: string | null;
  threshold: number;
  window_minutes: number;
  notify_webhook: string | null;
  notify_email: string | null;
  is_active: boolean;
  state: AlertState;
  last_value: number | null;
  last_evaluated_at: Date | null;
  last_triggered_at: Date | null;
  last_resolved_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface WindowStats {
  totalRequests: number;
  totalErrors: number;
  /** null when there was no traffic in the window */
  p99Ms: number | null;
}

/** API field ↔ column for the editable parts of a rule. */
const EDITABLE: Array<[keyof UpdateAlertRuleInput, string]> = [
  ['name', 'name'],
  ['conditionType', 'condition_type'],
  ['threshold', 'threshold'],
  ['windowMinutes', 'window_minutes'],
  ['endpointFilter', 'endpoint_filter'],
  ['notifyWebhook', 'notify_webhook'],
  ['notifyEmail', 'notify_email'],
  ['isActive', 'is_active'],
];

export class AlertsRepository {
  private get db() { return getPg(); }

  // ---------------------------------------------------------------- rules (CRUD)

  async listRules(projectId: string): Promise<AlertRule[]> {
    const { rows } = await this.db.query(`SELECT * FROM alert_rules WHERE project_id = $1 ORDER BY created_at DESC, id DESC`, [projectId]);
    return rows.map(normalizeRule);
  }

  async getRule(projectId: string, ruleId: number): Promise<AlertRule | undefined> {
    const { rows } = await this.db.query(`SELECT * FROM alert_rules WHERE id = $1 AND project_id = $2`, [ruleId, projectId]);
    return rows[0] ? normalizeRule(rows[0]) : undefined;
  }

  async createRule(input: CreateAlertRuleInput): Promise<AlertRule> {
    const { rows } = await this.db.query(
      `INSERT INTO alert_rules
         (project_id, name, condition_type, threshold, window_minutes, endpoint_filter, notify_webhook, notify_email, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        input.projectId, input.name, input.conditionType, input.threshold, input.windowMinutes,
        input.endpointFilter ?? null, input.notifyWebhook ?? null, input.notifyEmail ?? null, input.isActive,
      ],
    );
    return normalizeRule(rows[0]);
  }

  /**
   * Updates the given fields. Changing what a rule measures (condition, threshold, window,
   * endpoint) or disabling it resets it to `ok`, so the next evaluation decides afresh.
   */
  async updateRule(projectId: string, ruleId: number, patch: UpdateAlertRuleInput): Promise<AlertRule | undefined> {
    const sets: string[] = [];
    const params: unknown[] = [ruleId, projectId];
    for (const [field, column] of EDITABLE) {
      if (patch[field] === undefined) continue;
      params.push(patch[field]);
      sets.push(`${column} = $${params.length}`);
    }
    const redefines = (['conditionType', 'threshold', 'windowMinutes', 'endpointFilter'] as const).some((f) => patch[f] !== undefined);
    if (redefines || patch.isActive === false) sets.push(`state = 'ok'`);
    sets.push('updated_at = NOW()');

    const { rows } = await this.db.query(
      `UPDATE alert_rules SET ${sets.join(', ')} WHERE id = $1 AND project_id = $2 RETURNING *`,
      params,
    );
    return rows[0] ? normalizeRule(rows[0]) : undefined;
  }

  async deleteRule(projectId: string, ruleId: number): Promise<boolean> {
    const { rowCount } = await this.db.query(`DELETE FROM alert_rules WHERE id = $1 AND project_id = $2`, [ruleId, projectId]);
    return (rowCount ?? 0) > 0;
  }

  async listEvents(projectId: string, limit: number, ruleId?: number) {
    const { rows } = await this.db.query(
      `SELECT e.id, e.alert_rule_id, e.kind, e.message, e.value, e.triggered_at, r.name AS rule_name
         FROM alert_events e
         LEFT JOIN alert_rules r ON r.id = e.alert_rule_id
        WHERE e.project_id = $1 AND ($2::bigint IS NULL OR e.alert_rule_id = $2)
        ORDER BY e.triggered_at DESC, e.id DESC
        LIMIT $3`,
      [projectId, ruleId ?? null, limit],
    );
    return rows.map((r) => ({
      id: Number(r.id),
      ruleId: Number(r.alert_rule_id),
      ruleName: (r.rule_name as string | null) ?? null,
      kind: r.kind as 'triggered' | 'resolved',
      message: r.message as string,
      value: r.value === null || r.value === undefined ? null : Number(r.value),
      at: new Date(r.triggered_at).toISOString(),
    }));
  }

  // ---------------------------------------------------------------- evaluation

  async getActiveRules(): Promise<AlertRule[]> {
    const { rows } = await this.db.query(`SELECT * FROM alert_rules WHERE is_active = TRUE ORDER BY id`);
    return rows.map(normalizeRule);
  }

  /**
   * Request count, errors (status >= 400) and p99 latency over the last `windowMinutes`,
   * read from raw logs so short windows mean what they say.
   */
  async getWindowStats(projectId: string, endpoint: string | null, windowMinutes: number, now = new Date()): Promise<WindowStats> {
    const match: Record<string, unknown> = {
      projectId,
      timestamp: { $gte: new Date(now.getTime() - windowMinutes * 60_000), $lte: now },
    };
    if (endpoint) match.endpoint = endpoint;

    // $percentile needs MongoDB 7.0+; mongoose's types don't include it yet.
    const group = {
      $group: {
        _id: null,
        total: { $sum: 1 },
        errors: { $sum: { $cond: [{ $gte: ['$statusCode', 400] }, 1, 0] } },
        p99: { $percentile: { input: '$latencyMs', p: [0.99], method: 'approximate' } },
      },
    } as unknown as PipelineStage;
    const [row] = await ApiLog.aggregate<{ total: number; errors: number; p99: number[] | null }>([{ $match: match }, group]);
    if (!row) return { totalRequests: 0, totalErrors: 0, p99Ms: null };
    return { totalRequests: row.total, totalErrors: row.errors, p99Ms: row.p99?.[0] ?? null };
  }

  async recordEvaluation(ruleId: number, value: number | null): Promise<void> {
    await this.db.query(`UPDATE alert_rules SET last_value = $2, last_evaluated_at = NOW() WHERE id = $1`, [ruleId, value]);
  }

  /**
   * Moves a rule from `from` to `to` only if it is still in `from`, and records the event in
   * the same statement. Returns false if another evaluation already made the transition.
   */
  async transition(rule: AlertRule, from: AlertState, to: AlertState, message: string, value: number | null): Promise<boolean> {
    const stamp = to === 'firing' ? 'last_triggered_at' : 'last_resolved_at';
    const { rows } = await this.db.query(
      `WITH moved AS (
         UPDATE alert_rules SET state = $3, ${stamp} = NOW()
          WHERE id = $1 AND state = $2 AND is_active = TRUE
        RETURNING id, project_id
       )
       INSERT INTO alert_events (alert_rule_id, project_id, kind, message, value)
       SELECT id, project_id, $4, $5, $6 FROM moved
       RETURNING id`,
      [rule.id, from, to, to === 'firing' ? 'triggered' : 'resolved', message, value],
    );
    return rows.length > 0;
  }
}

function normalizeRule(row: Record<string, any>): AlertRule {
  return {
    ...(row as AlertRule),
    id: Number(row.id),
    threshold: Number(row.threshold),
    window_minutes: Number(row.window_minutes),
    last_value: row.last_value === null || row.last_value === undefined ? null : Number(row.last_value),
    state: (row.state ?? 'ok') as AlertState,
  };
}
