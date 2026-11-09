import { describe, expect, it } from 'vitest';
import { IngestBatchDto, LogEntrySchema } from '@modules/ingest/dto/ingest-batch.dto';
import { RumIngestBatchDto } from '@modules/rum/dto/rum-ingest.dto';
import { RumQueryDto } from '@modules/rum/dto/rum-query.dto';
import { MetricsQueryDto } from '@modules/metrics/dto/metrics-query.dto';
import { LogsQueryDto } from '@modules/logs/dto/logs-query.dto';
import { TraceDetailQueryDto, TracesQueryDto } from '@modules/traces/dto/traces-query.dto';
import { InsightsQueryDto } from '@modules/insights/dto/insights-query.dto';
import { CreateKeyDto, KeysStatsQueryDto, ListKeysQueryDto, RevokeKeyQueryDto } from '@modules/keys/dto/keys.dto';
import { CreateProjectDto } from '@modules/projects/dto/project.dto';
import { LoginDto, RegisterDto, UpdateProfileDto } from '@modules/users/dto/user.dto';
import { logEntry, PROJECT_A } from '../../helpers/fakes';

const now = new Date().toISOString();

describe('IngestBatchDto', () => {
  it('accepts a minimal batch without projectId (project comes from the key)', () => {
    const parsed = IngestBatchDto.parse({ logs: [logEntry()] });
    expect(parsed.projectId).toBeUndefined();
    expect(parsed.sdkVersion).toBe('1.0.0');
  });

  it('applies log entry defaults', () => {
    const parsed = LogEntrySchema.parse({ method: 'GET', endpoint: '/', statusCode: 200, latencyMs: 1, timestamp: now });
    expect(parsed).toMatchObject({ ip: '0.0.0.0', userAgent: '', tags: [] });
  });

  it('validates projectId format when present', () => {
    expect(IngestBatchDto.safeParse({ projectId: PROJECT_A, logs: [logEntry()] }).success).toBe(true);
    expect(IngestBatchDto.safeParse({ projectId: 'proj_short', logs: [logEntry()] }).success).toBe(false);
    expect(IngestBatchDto.safeParse({ projectId: `${PROJECT_A}!`, logs: [logEntry()] }).success).toBe(false);
    expect(IngestBatchDto.safeParse({ projectId: 'other_aaaaaaaaaaaaaaaaaaaa', logs: [logEntry()] }).success).toBe(false);
  });

  it.each([
    ['empty logs', { logs: [] }],
    ['501 logs', { logs: Array.from({ length: 501 }, () => logEntry()) }],
    ['bad method', { logs: [logEntry({ method: 'TRACE' })] }],
    ['status 600', { logs: [logEntry({ statusCode: 600 })] }],
    ['status 99', { logs: [logEntry({ statusCode: 99 })] }],
    ['negative latency', { logs: [logEntry({ latencyMs: -1 })] }],
    ['fractional latency', { logs: [logEntry({ latencyMs: 1.5 })] }],
    ['latency > 300s', { logs: [logEntry({ latencyMs: 300_001 })] }],
    ['non-ISO timestamp', { logs: [logEntry({ timestamp: '2026-01-01 00:00' })] }],
    ['endpoint too long', { logs: [logEntry({ endpoint: `/${'a'.repeat(512)}` })] }],
    ['empty endpoint', { logs: [logEntry({ endpoint: '' })] }],
    ['11 tags', { logs: [logEntry({ tags: Array.from({ length: 11 }, (_, i) => `t${i}`) })] }],
    ['long tag', { logs: [logEntry({ tags: ['x'.repeat(51)] })] }],
    ['bad sdkVersion', { sdkVersion: 'v1', logs: [logEntry()] }],
    ['short idempotency key', { idempotencyKey: 'abc', logs: [logEntry()] }],
  ])('rejects %s', (_label, body) => {
    expect(IngestBatchDto.safeParse(body).success).toBe(false);
  });

  it('accepts the max batch size of 500', () => {
    expect(IngestBatchDto.safeParse({ logs: Array.from({ length: 500 }, () => logEntry()) }).success).toBe(true);
  });
});

describe('RumIngestBatchDto', () => {
  const event = { type: 'page_view', path: '/a', timestamp: now };

  it('accepts events and applies defaults', () => {
    const parsed = RumIngestBatchDto.parse({ events: [{ path: '/', timestamp: now }] });
    expect(parsed.events[0]).toMatchObject({ type: 'page_view', referrer: '', metadata: {} });
  });

  it.each([
    ['no events', { events: [] }],
    ['201 events', { events: Array.from({ length: 201 }, () => event) }],
    ['unknown type', { events: [{ ...event, type: 'error' }] }],
    ['missing path', { events: [{ type: 'page_view', timestamp: now }] }],
    ['metric > 600000', { events: [{ ...event, lcpMs: 600_001 }] }],
    ['negative metric', { events: [{ ...event, ttfbMs: -1 }] }],
    ['object metadata value', { events: [{ ...event, metadata: { a: { b: 1 } } }] }],
  ])('rejects %s', (_l, body) => {
    expect(RumIngestBatchDto.safeParse(body).success).toBe(false);
  });
});

describe('query DTOs', () => {
  it('MetricsQueryDto defaults and coercion', () => {
    expect(MetricsQueryDto.parse({ projectId: PROJECT_A })).toMatchObject({ timeframe: '24h', page: 1, limit: 50 });
    expect(MetricsQueryDto.parse({ projectId: PROJECT_A, page: '3', limit: '200' })).toMatchObject({ page: 3, limit: 200 });
    expect(MetricsQueryDto.safeParse({ projectId: PROJECT_A, limit: '201' }).success).toBe(false);
    expect(MetricsQueryDto.safeParse({ projectId: PROJECT_A, timeframe: '2d' }).success).toBe(false);
    expect(MetricsQueryDto.safeParse({}).success).toBe(false);
  });

  it('LogsQueryDto', () => {
    expect(LogsQueryDto.parse({ projectId: PROJECT_A })).toMatchObject({ page: 1, limit: 25 });
    expect(LogsQueryDto.safeParse({ projectId: PROJECT_A, statusClass: '6xx' }).success).toBe(false);
    expect(LogsQueryDto.safeParse({ projectId: PROJECT_A, from: 'yesterday' }).success).toBe(false);
    expect(LogsQueryDto.safeParse({ projectId: PROJECT_A, method: 'OPTIONS', statusClass: '5xx', from: now, to: now, search: 'x' }).success).toBe(true);
    expect(LogsQueryDto.safeParse({ projectId: PROJECT_A, search: '   ' }).success).toBe(false);
  });

  it('TracesQueryDto / TraceDetailQueryDto', () => {
    expect(TracesQueryDto.parse({ projectId: PROJECT_A })).toMatchObject({ page: 1, limit: 20 });
    expect(TracesQueryDto.safeParse({ projectId: PROJECT_A, limit: '101' }).success).toBe(false);
    expect(TraceDetailQueryDto.safeParse({}).success).toBe(false);
  });

  it('RumQueryDto requires a well-formed project id', () => {
    expect(RumQueryDto.parse({ projectId: PROJECT_A })).toMatchObject({ timeframe: '24h', limit: 20 });
    expect(RumQueryDto.safeParse({ projectId: 'abc' }).success).toBe(false);
  });

  it('InsightsQueryDto', () => {
    expect(InsightsQueryDto.parse({ projectId: PROJECT_A }).limit).toBe(10);
    expect(InsightsQueryDto.safeParse({ projectId: PROJECT_A, limit: '51' }).success).toBe(false);
  });

  it('keys DTOs', () => {
    expect(ListKeysQueryDto.parse({})).toEqual({});
    expect(KeysStatsQueryDto.parse({}).timeframe).toBe('24h');
    expect(CreateKeyDto.safeParse({ projectId: PROJECT_A, label: '  ' }).success).toBe(false);
    expect(CreateKeyDto.parse({ projectId: PROJECT_A, label: ' prod ' }).label).toBe('prod');
    expect(RevokeKeyQueryDto.safeParse({}).success).toBe(false);
  });

  it('CreateProjectDto trims and bounds the name', () => {
    expect(CreateProjectDto.parse({ name: '  Shop  ' }).name).toBe('Shop');
    expect(CreateProjectDto.safeParse({ name: 'a' }).success).toBe(false);
    expect(CreateProjectDto.safeParse({ name: 'a'.repeat(101) }).success).toBe(false);
  });

  it('user DTOs', () => {
    expect(RegisterDto.safeParse({ email: 'a@b.co', password: '12345678', name: 'Al' }).success).toBe(true);
    expect(RegisterDto.safeParse({ email: 'nope', password: '12345678', name: 'Al' }).success).toBe(false);
    expect(RegisterDto.safeParse({ email: 'a@b.co', password: '1234567', name: 'Al' }).success).toBe(false);
    expect(RegisterDto.safeParse({ email: 'a@b.co', password: '12345678', name: 'A' }).success).toBe(false);
    expect(LoginDto.safeParse({ email: 'a@b.co' }).success).toBe(false);
    expect(UpdateProfileDto.safeParse({ name: 'Al', email: 'a@b.co', timezone: 'x'.repeat(65) }).success).toBe(false);
  });
});
