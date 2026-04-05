import { EventEmitter } from 'events';

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

  // Emitted by: AlertEvaluator after threshold breach
  'alert.triggered': {
    alertRuleId: number;
    projectId:   string;
    message:     string;
    severity:    'info' | 'warning' | 'critical';
  };
}

class TypedEventBus extends EventEmitter {
  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): boolean {
    return super.emit(event, payload);
  }
  on<K extends keyof EventMap>(event: K, listener: (payload: EventMap[K]) => void): this {
    return super.on(event, listener);
  }
}

export const eventBus = new TypedEventBus();