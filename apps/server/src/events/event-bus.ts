import { EventEmitter } from 'events';
import type Redis from 'ioredis';
import { INSTANCE_ID } from '@shared/instance';

export interface EventMap {
  // Emitted by: AggregationWorker after DB upsert
  'aggregation.completed': { projectIds: string[] };

  // Emitted by: AnomalyWorker after anomaly detection
  'anomaly.detected': {
    projectId: string;
    endpoint:  string;
    type:      'latency_spike' | 'error_surge' | 'traffic_anomaly';
    meta:      Record<string, unknown>;
  };

  // Emitted by: AlertWorker when a rule triggers or resolves
  'alert.triggered': {
    alertRuleId: number;
    projectId:   string;
    message:     string;
    severity:    'info' | 'warning' | 'critical';
  };
}

/** Redis channel carrying events between replicas. */
export const EVENT_CHANNEL = 'apexmonitor:events';

interface Envelope {
  origin: string;
  event: keyof EventMap;
  payload: unknown;
}

/**
 * Typed event bus. Listeners in this process run synchronously on emit, as before.
 *
 * With `connectBridge`, every emit is also published on Redis and every other replica
 * re-emits it to its own listeners, so (for example) an anomaly found by the worker in one
 * process reaches websocket clients connected to another. A process ignores its own
 * messages, so local listeners never run twice.
 */
export class TypedEventBus extends EventEmitter {
  private publisher: Redis | null = null;
  private subscriber: Redis | null = null;

  constructor(private readonly instanceId: string = INSTANCE_ID) {
    super();
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): boolean {
    const handled = super.emit(event, payload);
    if (this.publisher) {
      const envelope: Envelope = { origin: this.instanceId, event, payload };
      this.publisher.publish(EVENT_CHANNEL, JSON.stringify(envelope)).catch((err: Error) =>
        console.error(`[EventBus] publish of ${event} failed: ${err.message}`),
      );
    }
    return handled;
  }

  on<K extends keyof EventMap>(event: K, listener: (payload: EventMap[K]) => void): this {
    return super.on(event, listener);
  }

  /**
   * Starts relaying events between replicas. `subscriber` must be a dedicated connection
   * (Redis puts it in subscriber mode); `publisher` can be the shared client.
   */
  async connectBridge(publisher: Redis, subscriber: Redis): Promise<void> {
    this.publisher = publisher;
    this.subscriber = subscriber;
    subscriber.on('message', (channel: string, raw: string) => {
      if (channel !== EVENT_CHANNEL) return;
      let envelope: Envelope;
      try {
        envelope = JSON.parse(raw) as Envelope;
      } catch {
        return;
      }
      if (envelope.origin === this.instanceId) return; // our own publish
      super.emit(envelope.event, envelope.payload); // local delivery only, never republished
    });
    await subscriber.subscribe(EVENT_CHANNEL);
  }

  async disconnectBridge(): Promise<void> {
    const subscriber = this.subscriber;
    this.publisher = null;
    this.subscriber = null;
    if (subscriber) await subscriber.quit().catch(() => subscriber.disconnect());
  }
}

export const eventBus = new TypedEventBus();
