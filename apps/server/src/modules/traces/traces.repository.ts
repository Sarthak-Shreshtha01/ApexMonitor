import { ApiLog, IApiLog } from '@modules/logs/logs.schema';
import { TracesQuery } from './dto/traces-query.dto';

export interface TraceListItem {
  traceId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  latencyMs: number;
  timestamp: string;
  region: string;
  ip: string;
}

export interface TraceSpanItem {
  spanId: string;
  name: string;
  service: string;
  durationMs: number;
  startOffsetMs: number;
  attributes: Record<string, string | number | boolean>;
}

export interface TraceDetail {
  traceId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  latencyMs: number;
  timestamp: string;
  region: string;
  ip: string;
  userAgent: string;
  sdkVersion: string;
  tags: string[];
  spans: TraceSpanItem[];
}

export class TracesRepository {
  async list(query: TracesQuery): Promise<{ traces: TraceListItem[]; total: number }> {
    const match = this.buildFilter(query);
    const skip = (query.page - 1) * query.limit;

    const [rows, total] = await Promise.all([
      ApiLog.find(match)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(query.limit)
        .lean<IApiLog[]>(),
      ApiLog.countDocuments(match),
    ]);

    return {
      traces: rows.map((row) => ({
        traceId: row.reqId,
        endpoint: row.endpoint,
        method: row.method,
        statusCode: row.statusCode,
        latencyMs: row.latencyMs,
        timestamp: new Date(row.timestamp).toISOString(),
        region: row.region,
        ip: row.ip,
      })),
      total,
    };
  }

  async getByTraceId(projectId: string, traceId: string): Promise<TraceDetail | null> {
    const log = await ApiLog.findOne({ projectId, reqId: traceId }).lean<IApiLog | null>();
    if (!log) return null;

    const dbMs = Math.max(1, Math.round(log.latencyMs * 0.2));
    const appMs = Math.max(1, Math.round(log.latencyMs * 0.55));
    const networkMs = Math.max(1, log.latencyMs - dbMs - appMs);

    const rootAttributes: Record<string, string | number | boolean> = {
      'http.method': log.method,
      'http.route': log.endpoint,
      'http.status_code': log.statusCode,
    };
    const appAttributes: Record<string, string | number | boolean> = {
      region: log.region,
      'sdk.version': log.sdkVersion,
    };
    const dbAttributes: Record<string, string | number | boolean> = {
      operation: 'SELECT',
      outcome: log.statusCode >= 500 ? 'degraded' : 'ok',
    };
    const networkAttributes: Record<string, string | number | boolean> = {
      ip: log.ip,
      'user.agent': log.userAgent || 'unknown',
    };

    const spans: TraceSpanItem[] = [
      {
        spanId: `${log.reqId}_root`,
        name: `${log.method} ${log.endpoint}`,
        service: 'api-gateway',
        durationMs: log.latencyMs,
        startOffsetMs: 0,
        attributes: rootAttributes,
      },
      {
        spanId: `${log.reqId}_app`,
        name: 'Application Handler',
        service: 'app-service',
        durationMs: appMs,
        startOffsetMs: Math.max(1, networkMs - 1),
        attributes: appAttributes,
      },
      {
        spanId: `${log.reqId}_db`,
        name: 'Database Query',
        service: 'postgres',
        durationMs: dbMs,
        startOffsetMs: Math.max(2, networkMs + Math.round(appMs * 0.35)),
        attributes: dbAttributes,
      },
      {
        spanId: `${log.reqId}_network`,
        name: 'Response Transfer',
        service: 'edge-network',
        durationMs: networkMs,
        startOffsetMs: Math.max(1, log.latencyMs - networkMs),
        attributes: networkAttributes,
      },
    ].sort((a, b) => a.startOffsetMs - b.startOffsetMs);

    return {
      traceId: log.reqId,
      endpoint: log.endpoint,
      method: log.method,
      statusCode: log.statusCode,
      latencyMs: log.latencyMs,
      timestamp: new Date(log.timestamp).toISOString(),
      region: log.region,
      ip: log.ip,
      userAgent: log.userAgent,
      sdkVersion: log.sdkVersion,
      tags: log.tags,
      spans,
    };
  }

  private buildFilter(query: TracesQuery): Record<string, unknown> {
    const match: Record<string, unknown> = {
      projectId: query.projectId,
    };

    if (query.statusClass) {
      const start = Number(query.statusClass[0]) * 100;
      match.statusCode = { $gte: start, $lt: start + 100 };
    }

    if (query.search) {
      const safe = escapeRegex(query.search);
      match.$or = [
        { endpoint: { $regex: safe, $options: 'i' } },
        { reqId: { $regex: safe, $options: 'i' } },
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
