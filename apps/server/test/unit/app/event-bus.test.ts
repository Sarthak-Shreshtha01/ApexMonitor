import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { EVENT_CHANNEL, TypedEventBus } from '@events/event-bus';

/** In-memory stand-in for Redis pub/sub shared by several "replicas". */
function fakeBroker() {
  const subscribers: Array<EventEmitter & { channels: Set<string> }> = [];
  const publisher = () => ({
    publish: vi.fn(async (channel: string, message: string) => {
      for (const s of subscribers) if (s.channels.has(channel)) s.emit('message', channel, message);
      return subscribers.length;
    }),
  });
  const subscriber = () => {
    const s = Object.assign(new EventEmitter(), {
      channels: new Set<string>(),
      subscribe: vi.fn(async (channel: string) => { s.channels.add(channel); }),
      quit: vi.fn(async () => { s.channels.clear(); }),
      disconnect: vi.fn(),
    });
    subscribers.push(s);
    return s;
  };
  return { publisher, subscriber };
}

const payload = { alertRuleId: 1, projectId: 'p', message: 'm', severity: 'critical' as const };

describe('event bus bridge across replicas (KI-20)', () => {
  it('an event emitted on one replica reaches listeners on the others, exactly once each', async () => {
    const broker = fakeBroker();
    const a = new TypedEventBus('replica-a');
    const b = new TypedEventBus('replica-b');
    await a.connectBridge(broker.publisher() as never, broker.subscriber() as never);
    await b.connectBridge(broker.publisher() as never, broker.subscriber() as never);
    const onA = vi.fn();
    const onB = vi.fn();
    a.on('alert.triggered', onA);
    b.on('alert.triggered', onB);

    a.emit('alert.triggered', payload);
    await new Promise((r) => setImmediate(r));

    expect(onA).toHaveBeenCalledTimes(1); // local delivery, not duplicated by its own echo
    expect(onB).toHaveBeenCalledTimes(1);
    expect(onB).toHaveBeenCalledWith(payload);
  });

  it('relayed events are not published again (no ping-pong between replicas)', async () => {
    const broker = fakeBroker();
    const pubA = broker.publisher();
    const pubB = broker.publisher();
    const a = new TypedEventBus('a');
    const b = new TypedEventBus('b');
    await a.connectBridge(pubA as never, broker.subscriber() as never);
    await b.connectBridge(pubB as never, broker.subscriber() as never);
    a.emit('aggregation.completed', { projectIds: ['p1'] });
    await new Promise((r) => setImmediate(r));
    expect(pubA.publish).toHaveBeenCalledTimes(1);
    expect(pubA.publish).toHaveBeenCalledWith(EVENT_CHANNEL, expect.stringContaining('"origin":"a"'));
    expect(pubB.publish).not.toHaveBeenCalled();
  });

  it('works locally without a bridge, ignores garbage on the channel, and stops after disconnect', async () => {
    const local = new TypedEventBus('solo');
    const listener = vi.fn();
    local.on('alert.triggered', listener);
    local.emit('alert.triggered', payload);
    expect(listener).toHaveBeenCalledTimes(1);

    const broker = fakeBroker();
    const sub = broker.subscriber();
    const b = new TypedEventBus('b');
    await b.connectBridge(broker.publisher() as never, sub as never);
    const onB = vi.fn();
    b.on('alert.triggered', onB);
    sub.emit('message', EVENT_CHANNEL, 'not json');
    sub.emit('message', 'other-channel', JSON.stringify({ origin: 'x', event: 'alert.triggered', payload }));
    expect(onB).not.toHaveBeenCalled();
    await b.disconnectBridge();
    expect(sub.quit).toHaveBeenCalled();
  });
});
