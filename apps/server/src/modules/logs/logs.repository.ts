import { ApiLog, IApiLog } from './logs.schema';
import { LogsQuery } from './dto/logs-query.dto';

export interface LogListItem {
  reqId: string;
  method: string;
  endpoint: string;
  statusCode: number;
  latencyMs: number;
  ip: string;
  userAgent: string;
  region: string;
  timestamp: string;
  sdkVersion: string;
  tags: string[];
}

export interface LogsSummary {
  total: number;
  errorRate: number;
  avgLatency: number;
}

export class LogsRepository {
  async list(query: LogsQuery): Promise<{ logs: LogListItem[]; total: number; summary: LogsSummary }> {
    const match = this.buildFilter(query);
    const skip = (query.page - 1) * query.limit;

    const [logs, total, aggregateSummary] = await Promise.all([
      ApiLog.find(match)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(query.limit)
        .lean<IApiLog[]>(),
      ApiLog.countDocuments(match),
      ApiLog.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            errors: {
              $sum: {
                $cond: [{ $gte: ['$statusCode', 400] }, 1, 0],
              },
            },
            avgLatency: { $avg: '$latencyMs' },
          },
        },
      ]),
    ]);

    const summaryRow = aggregateSummary[0] as { total: number; errors: number; avgLatency: number } | undefined;
    const totalForSummary = summaryRow?.total ?? 0;
    const errors = summaryRow?.errors ?? 0;

    return {
      logs: logs.map((log) => ({
        reqId: log.reqId,
        method: log.method,
        endpoint: log.endpoint,
        statusCode: log.statusCode,
        latencyMs: log.latencyMs,
        ip: log.ip,
        userAgent: log.userAgent,
        region: log.region,
        timestamp: new Date(log.timestamp).toISOString(),
        sdkVersion: log.sdkVersion,
        tags: log.tags,
      })),
      total,
      summary: {
        total: totalForSummary,
        errorRate: totalForSummary > 0 ? Number(((errors / totalForSummary) * 100).toFixed(2)) : 0,
        avgLatency: Number((summaryRow?.avgLatency ?? 0).toFixed(2)),
      },
    };
  }

  private buildFilter(query: LogsQuery): Record<string, unknown> {
    const match: Record<string, unknown> = {
      projectId: query.projectId,
    };

    if (query.method) {
      match.method = query.method;
    }

    if (query.statusClass) {
      const start = Number(query.statusClass[0]) * 100;
      match.statusCode = { $gte: start, $lt: start + 100 };
    }

    if (query.endpoint) {
      match.endpoint = { $regex: escapeRegex(query.endpoint), $options: 'i' };
    }

    if (query.search) {
      const safe = escapeRegex(query.search);
      match.$or = [
        { endpoint: { $regex: safe, $options: 'i' } },
        { userAgent: { $regex: safe, $options: 'i' } },
        { ip: { $regex: safe, $options: 'i' } },
      ];
    }

    if (query.from || query.to) {
      match.timestamp = {
        ...(query.from ? { $gte: new Date(query.from) } : {}),
        ...(query.to ? { $lte: new Date(query.to) } : {}),
      };
    }

    return match;
  }
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
