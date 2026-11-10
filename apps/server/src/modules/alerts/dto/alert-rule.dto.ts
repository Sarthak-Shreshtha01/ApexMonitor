import { z } from 'zod';
import { assertSafeWebhookUrl, UnsafeWebhookError } from '@shared/net/webhook';

export const ALERT_CONDITIONS = ['error_rate_high', 'latency_p99_high'] as const;
export type AlertCondition = (typeof ALERT_CONDITIONS)[number];

const PROJECT_ID = z.string().regex(/^proj_[A-Za-z0-9_-]{16,}$/, 'Invalid projectId');

/** https only and not a private/loopback literal; DNS is checked again at send time. */
const WebhookUrl = z
  .string()
  .trim()
  .max(2048)
  .superRefine((value, ctx) => {
    try {
      assertSafeWebhookUrl(value);
    } catch (error) {
      ctx.addIssue({ code: 'custom', message: error instanceof UnsafeWebhookError ? error.message : 'Invalid webhook URL' });
    }
  });

const RuleFields = z.object({
  name: z.string().trim().min(1).max(100),
  conditionType: z.enum(ALERT_CONDITIONS),
  /** error_rate_high: percent (0–100). latency_p99_high: milliseconds. */
  threshold: z.number().finite().positive(),
  windowMinutes: z.number().int().min(1).max(1440).default(5),
  endpointFilter: z.string().trim().min(1).max(512).nullable().optional(),
  notifyWebhook: WebhookUrl.nullable().optional(),
  /** Stored for when email delivery exists; nothing is sent yet. */
  notifyEmail: z.string().trim().email().max(255).nullable().optional(),
  isActive: z.boolean().default(true),
});

const thresholdInRange = (rule: { conditionType?: AlertCondition; threshold?: number }) =>
  rule.conditionType !== 'error_rate_high' || rule.threshold === undefined || rule.threshold <= 100;
const thresholdMessage = { message: 'An error-rate threshold is a percentage between 0 and 100', path: ['threshold'] };

export const CreateAlertRuleDto = RuleFields.extend({ projectId: PROJECT_ID }).refine(thresholdInRange, thresholdMessage);

/** PATCH: any subset of fields; the condition/threshold pair is re-checked against the stored rule. */
export const UpdateAlertRuleDto = RuleFields.partial()
  .extend({ windowMinutes: z.number().int().min(1).max(1440).optional(), isActive: z.boolean().optional() })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

export const ProjectQueryDto = z.object({ projectId: PROJECT_ID });

export const AlertEventsQueryDto = ProjectQueryDto.extend({
  ruleId: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const RuleIdParamDto = z.object({ ruleId: z.coerce.number().int().positive() });

export type CreateAlertRuleInput = z.infer<typeof CreateAlertRuleDto>;
export type UpdateAlertRuleInput = z.infer<typeof UpdateAlertRuleDto>;
export type AlertEventsQuery = z.infer<typeof AlertEventsQueryDto>;

export { thresholdInRange };
