import { ApexClient, type RequestOptions } from '@apexmonitor/sdk';

export type RumEventType = 'page_view' | 'error' | 'custom' | 'web_vitals';

export interface RumEvent {
  type: RumEventType;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface BrowserRumOptions {
  baseUrl: string;
  projectId: string;
  rumKey: string | (() => string | Promise<string>);
  flushIntervalMs?: number;
  maxQueueSize?: number;
  defaultContext?: Record<string, unknown>;
}

export class ApexBrowserRumClient {
  private readonly sdk: ApexClient;
  private readonly projectId: string;
  private readonly flushIntervalMs: number;
  private readonly maxQueueSize: number;
  private readonly defaultContext: Record<string, unknown>;
  private readonly queue: RumEvent[] = [];
  private flushTimer: ReturnType<typeof setInterval> | undefined;

  constructor(options: BrowserRumOptions) {
    this.sdk = new ApexClient({
      baseUrl: options.baseUrl,
      auth: {
        type: 'rumKey',
        key: options.rumKey,
      },
    });
    this.projectId = options.projectId;
    this.flushIntervalMs = options.flushIntervalMs ?? 5000;
    this.maxQueueSize = options.maxQueueSize ?? 50;
    this.defaultContext = options.defaultContext ?? {};
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

  trackPageView(path: string, extra?: Record<string, unknown>): void {
    this.enqueue({
      type: 'page_view',
      timestamp: new Date().toISOString(),
      payload: {
        projectId: this.projectId,
        path,
        userAgent: typeof navigator === 'undefined' ? undefined : navigator.userAgent,
        ...this.defaultContext,
        ...(extra ?? {}),
      },
    });
  }

  trackError(error: Error, extra?: Record<string, unknown>): void {
    this.enqueue({
      type: 'error',
      timestamp: new Date().toISOString(),
      payload: {
        projectId: this.projectId,
        name: error.name,
        message: error.message,
        stack: error.stack,
        ...this.defaultContext,
        ...(extra ?? {}),
      },
    });
  }

  trackCustom(name: string, payload: Record<string, unknown>): void {
    this.enqueue({
      type: 'custom',
      timestamp: new Date().toISOString(),
      payload: {
        projectId: this.projectId,
        name,
        ...this.defaultContext,
        ...payload,
      },
    });
  }

  trackWebVitals(vitals: Record<string, unknown>): void {
    this.enqueue({
      type: 'web_vitals',
      timestamp: new Date().toISOString(),
      payload: {
        projectId: this.projectId,
        ...this.defaultContext,
        ...vitals,
      },
    });
  }

  async flush(options?: RequestOptions): Promise<void> {
    if (this.queue.length === 0) {
      return;
    }

    const events = this.queue.splice(0, this.queue.length);
    await this.sdk.rum.ingest({
      projectId: this.projectId,
      events,
    }, options);
  }

  private enqueue(event: RumEvent): void {
    this.queue.push(event);

    if (this.queue.length >= this.maxQueueSize) {
      void this.flush();
    }
  }
}

export function createBrowserRumClient(options: BrowserRumOptions): ApexBrowserRumClient {
  return new ApexBrowserRumClient(options);
}
