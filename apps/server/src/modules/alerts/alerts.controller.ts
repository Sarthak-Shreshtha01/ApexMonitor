import { Request, Response } from 'express';
import { errorBody, successBody } from '@shared/http/api-contract';
import { auditLogService } from '@shared/services/audit-log.service';
import { AlertRule, AlertsRepository } from './alerts.repository';
import {
  AlertEventsQueryDto,
  CreateAlertRuleDto,
  ProjectQueryDto,
  RuleIdParamDto,
  thresholdInRange,
  UpdateAlertRuleDto,
} from './dto/alert-rule.dto';

/** API shape of a rule (camelCase, no internal columns). */
export function toRuleView(rule: AlertRule) {
  return {
    id: rule.id,
    projectId: rule.project_id,
    name: rule.name,
    conditionType: rule.condition_type,
    threshold: rule.threshold,
    windowMinutes: rule.window_minutes,
    endpointFilter: rule.endpoint_filter,
    notifyWebhook: rule.notify_webhook,
    notifyEmail: rule.notify_email,
    isActive: rule.is_active,
    state: rule.state,
    lastValue: rule.last_value,
    lastEvaluatedAt: iso(rule.last_evaluated_at),
    lastTriggeredAt: iso(rule.last_triggered_at),
    lastResolvedAt: iso(rule.last_resolved_at),
    createdAt: iso(rule.created_at),
    updatedAt: iso(rule.updated_at),
  };
}

const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);

/**
 * Alert rules for a project. `requireProjectAccess` has already checked membership (and
 * ownership for writes) and set `req.project.id`; every query is scoped to that project.
 * Zod errors become 400 through the global error handler.
 */
export class AlertsController {
  private repo = new AlertsRepository();

  listRules = async (req: Request, res: Response): Promise<void> => {
    const { projectId } = ProjectQueryDto.parse(req.query);
    const rules = await this.repo.listRules(projectId);
    res.status(200).json(successBody(res, { projectId, rules: rules.map(toRuleView) }));
  };

  createRule = async (req: Request, res: Response): Promise<void> => {
    const input = CreateAlertRuleDto.parse(req.body);
    const rule = await this.repo.createRule(input);
    this.audit(req, 'alert_rule.created', rule);
    res.status(201).json(successBody(res, { rule: toRuleView(rule) }));
  };

  updateRule = async (req: Request, res: Response): Promise<void> => {
    const { projectId } = ProjectQueryDto.parse(req.query);
    const { ruleId } = RuleIdParamDto.parse(req.params);
    const patch = UpdateAlertRuleDto.parse(req.body);

    const current = await this.repo.getRule(projectId, ruleId);
    if (!current) {
      res.status(404).json(errorBody(res, 'NOT_FOUND', 'Alert rule not found'));
      return;
    }
    const merged = { conditionType: patch.conditionType ?? current.condition_type, threshold: patch.threshold ?? current.threshold };
    if (!thresholdInRange(merged)) {
      res.status(400).json(errorBody(res, 'VALIDATION_ERROR', 'An error-rate threshold is a percentage between 0 and 100'));
      return;
    }

    const rule = await this.repo.updateRule(projectId, ruleId, patch);
    if (!rule) {
      res.status(404).json(errorBody(res, 'NOT_FOUND', 'Alert rule not found'));
      return;
    }
    this.audit(req, 'alert_rule.updated', rule, { fields: Object.keys(patch) });
    res.status(200).json(successBody(res, { rule: toRuleView(rule) }));
  };

  deleteRule = async (req: Request, res: Response): Promise<void> => {
    const { projectId } = ProjectQueryDto.parse(req.query);
    const { ruleId } = RuleIdParamDto.parse(req.params);
    if (!(await this.repo.deleteRule(projectId, ruleId))) {
      res.status(404).json(errorBody(res, 'NOT_FOUND', 'Alert rule not found'));
      return;
    }
    void auditLogService.recordSafe({
      actorUserId: req.user?.id ?? null,
      projectId,
      action: 'alert_rule.deleted',
      resourceType: 'alert_rule',
      resourceId: String(ruleId),
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? null,
    });
    res.status(204).send();
  };

  listEvents = async (req: Request, res: Response): Promise<void> => {
    const query = AlertEventsQueryDto.parse(req.query);
    const events = await this.repo.listEvents(query.projectId, query.limit, query.ruleId);
    res.status(200).json(successBody(res, { projectId: query.projectId, events }));
  };

  private audit(req: Request, action: string, rule: AlertRule, extra: Record<string, unknown> = {}): void {
    void auditLogService.recordSafe({
      actorUserId: req.user?.id ?? null,
      projectId: rule.project_id,
      action,
      resourceType: 'alert_rule',
      resourceId: String(rule.id),
      metadata: { name: rule.name, conditionType: rule.condition_type, threshold: rule.threshold, ...extra },
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? null,
    });
  }
}
