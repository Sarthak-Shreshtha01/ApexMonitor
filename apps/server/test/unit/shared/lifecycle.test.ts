import { afterEach, describe, expect, it, vi } from 'vitest';
import { isShuttingDown, markShuttingDown, resetLifecycleForTests, runShutdown, waitUntil } from '@shared/lifecycle';

afterEach(() => {
  resetLifecycleForTests();
  vi.useRealTimers();
});

describe('runShutdown (KI-21)', () => {
  it('runs steps in order and reports them', async () => {
    const order: string[] = [];
    const result = await runShutdown([
      { name: 'a', run: () => void order.push('a') },
      { name: 'b', run: async () => void order.push('b') },
    ], 1000);
    expect(order).toEqual(['a', 'b']);
    expect(result).toEqual({ completed: ['a', 'b'], failed: [], timedOut: false });
  });

  it('keeps going after a failing step (the database still gets closed)', async () => {
    const lines: string[] = [];
    const result = await runShutdown([
      { name: 'close broker', run: () => { throw new Error('already closed'); } },
      { name: 'close database', run: () => undefined },
    ], 1000, (l) => lines.push(l));
    expect(result.completed).toEqual(['close database']);
    expect(result.failed).toEqual([{ name: 'close broker', error: 'already closed' }]);
    expect(lines[0]).toContain('✖ close broker: already closed');
  });

  it('gives up after the deadline and skips the remaining steps', async () => {
    const later = vi.fn();
    const result = await runShutdown([
      { name: 'hangs', run: () => new Promise(() => undefined) },
      { name: 'later', run: later },
    ], 30);
    expect(result.timedOut).toBe(true);
    expect(later).not.toHaveBeenCalled();
  });
});

describe('lifecycle flags', () => {
  it('markShuttingDown flips the flag', () => {
    expect(isShuttingDown()).toBe(false);
    markShuttingDown();
    expect(isShuttingDown()).toBe(true);
  });

  it('waitUntil resolves when idle, or false after the timeout', async () => {
    let busy = true;
    setTimeout(() => { busy = false; }, 20);
    expect(await waitUntil(() => !busy, 500, 5)).toBe(true);
    expect(await waitUntil(() => false, 20, 5)).toBe(false);
  });
});
