import { ApexClient, type RequestOptions } from '@apexmonitor/sdk';

/**
 * Browser RUM client. Events follow the server's RUM contract
 * (apps/server/src/modules/rum/dto/rum-ingest.dto.ts); the browser SDK test validates
 * real batches against that schema, so the two can't drift apart again.
 */

/** Keep in step with package.json "version"; sent as `sdkVersion` (the server requires x.y.z). */
export const SDK_VERSION = '0.1.0';

/** Server limit per request; larger queues are sent in several requests. */
export const MAX_EVENTS_PER_BATCH = 200;
const MAX_METRIC_MS = 600_000;

export type RumEventType = 'page_view' | 'web_vital' | 'heartbeat';
export type RumMetadata = Record<string, string | number | boolean>;

export interface RumEvent {
  type: RumEventType;
  path: string;
  timestamp: string;
  referrer?: string;
  sessionId?: string;
  ttfbMs?: number;
  fcpMs?: number;
  lcpMs?: number;
  metadata?: RumMetadata;
}

export interface WebVitals {
  /** Time to first byte, ms. */
  ttfbMs?: number;
  /** First contentful paint, ms. */
  fcpMs?: number;
  /** Largest contentful paint, ms. */
  lcpMs?: number;
}

export interface BrowserRumOptions {
  baseUrl: string;
  rumKey: string | (() => string | Promise<string>);
  /**
   * @deprecated Ignored. The project comes from the RUM key on the server.
   */
  projectId?: string;
  flushIntervalMs?: number;
  maxQueueSize?: number;
  /** Added to every event's `metadata`. Only string, number and boolean values are sent. */
  defaultContext?: Record<string, unknown>;
  /** Groups events into a session. Defaults to a random id per client instance. */
  sessionId?: string;
  fetcher?: typeof fetch;
}

export class ApexBrowserRumClient {
  private readonly sdk: ApexClient;
  private readonly flushIntervalMs: number;
  private readonly maxQueueSize: number;
  private readonly defaultMetadata: RumMetadata;
  private readonly sessionId: string;
  private readonly queue: RumEvent[] = [];
  private flushTimer: ReturnType<typeof setInterval> | undefined;

  constructor(options: BrowserRumOptions) {
    this.sdk = new ApexClient({
      baseUrl: options.baseUrl,
      auth: {
        type: 'rumKey',
        key: options.rumKey,
        headerName: 'x-rum-key',
      },
      fetcher: options.fetcher,
    });
    this.flushIntervalMs = options.flushIntervalMs ?? 5000;
    this.maxQueueSize = options.maxQueueSize ?? 50;
    this.defaultMetadata = toMetadata(options.defaultContext);
    this.sessionId = (options.sessionId ?? randomId()).slice(0, 128);
  }

  start(): void {
    if (this.flushTimer) {
      return;
    }

    this.flushTimer = setInterval(() => {
      void this.flush();
    }, this.flushIntervalMs);

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        void this.flush({ timeoutMs: 1000 });
      });
    }
  }

  stop(): void {
    if (!this.flushTimer) {
      return;
    }

    clearInterval(this.flushTimer);
    this.flushTimer = undefined;
  }

  /** Records a page view. `referrer` defaults to `document.referrer` in browsers. */
  trackPageView(path: string, metadata?: Record<string, unknown>, options?: { referrer?: string }): void {
    const referrer = options?.referrer ?? (typeof document === 'undefined' ? undefined : document.referrer);
    this.enqueue({
      type: 'page_view',
      path,
      timestamp: new Date().toISOString(),
      ...(referrer ? { referrer: referrer.slice(0, 2048) } : {}),
      sessionId: this.sessionId,
      metadata: this.metadata(metadata),
    });
  }

  /** Records Core Web Vitals for a page. `path` defaults to the current location. */
  trackWebVitals(vitals: WebVitals, path: string = currentPath()): void {
    this.enqueue({
      type: 'web_vital',
      path,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      ...validMetric('ttfbMs', vitals.ttfbMs),
      ...validMetric('fcpMs', vitals.fcpMs),
      ...validMetric('lcpMs', vitals.lcpMs),
      metadata: this.metadata(),
    });
  }

  /** Marks the session as still active on `path` (e.g. on a timer while the tab is visible). */
  trackHeartbeat(path: string = currentPath()): void {
    this.enqueue({
      type: 'heartbeat',
      path,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      metadata: this.metadata(),
    });
  }

  async flush(options?: RequestOptions): Promise<void> {
    while (this.queue.length > 0) {
      const events = this.queue.splice(0, MAX_EVENTS_PER_BATCH);
      await this.sdk.rum.ingest({ sdkVersion: SDK_VERSION, events }, options);
    }
  }

  private metadata(extra?: Record<string, unknown>): RumMetadata {
    return { ...this.defaultMetadata, ...toMetadata(extra) };
  }

  private enqueue(event: RumEvent): void {
    this.queue.push({ ...event, path: (event.path || '/').slice(0, 1024) });

    if (this.queue.length >= this.maxQueueSize) {
      void this.flush();
    }
  }
}

export function createBrowserRumClient(options: BrowserRumOptions): ApexBrowserRumClient {
  return new ApexBrowserRumClient(options);
}

/** Keeps only values the server accepts in `metadata` (string, finite number, boolean). */
function toMetadata(source?: Record<string, unknown>): RumMetadata {
  const out: RumMetadata = {};
  for (const [key, value] of Object.entries(source ?? {})) {
    if (typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) {
      out[key] = value;
    }
  }
  return out;
}

function validMetric<K extends keyof WebVitals>(name: K, value: number | undefined): Partial<Record<K, number>> {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > MAX_METRIC_MS) return {};
  return { [name]: Math.round(value) } as Partial<Record<K, number>>;
}

function currentPath(): string {
  return typeof location === 'undefined' ? '/' : location.pathname || '/';
}

function randomId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
