/**
 * Process lifecycle: the "shutting down" flag (read by /ready) and an ordered, time-boxed
 * shutdown runner used by bootstrap.ts on SIGTERM/SIGINT.
 */

let shuttingDown = false;

export const isShuttingDown = (): boolean => shuttingDown;
export const markShuttingDown = (): void => {
  shuttingDown = true;
};
/** Tests only. */
export const resetLifecycleForTests = (): void => {
  shuttingDown = false;
};

export interface ShutdownStep {
  name: string;
  run: () => Promise<unknown> | unknown;
}

export interface ShutdownResult {
  completed: string[];
  failed: Array<{ name: string; error: string }>;
  timedOut: boolean;
}

/**
 * Runs `steps` one after another. A failing step is logged and the next one still runs
 * (closing the database must not be skipped because the broker was already gone). If the
 * whole sequence takes longer than `timeoutMs`, it stops waiting and reports `timedOut`.
 */
export async function runShutdown(steps: ShutdownStep[], timeoutMs: number, log: (line: string) => void = () => undefined): Promise<ShutdownResult> {
  const result: ShutdownResult = { completed: [], failed: [], timedOut: false };
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), timeoutMs);
    timer.unref?.();
  });

  const sequence = (async () => {
    for (const step of steps) {
      if (result.timedOut) return;
      const started = Date.now();
      try {
        await step.run();
        result.completed.push(step.name);
        log(`✔ ${step.name} (${Date.now() - started} ms)`);
      } catch (error) {
        result.failed.push({ name: step.name, error: (error as Error)?.message ?? String(error) });
        log(`✖ ${step.name}: ${(error as Error)?.message ?? error}`);
      }
    }
  })();

  if ((await Promise.race([sequence.then(() => 'done' as const), deadline])) === 'timeout') {
    result.timedOut = true;
    log(`✖ shutdown did not finish within ${timeoutMs} ms`);
  }
  clearTimeout(timer);
  return result;
}

/** Resolves when `isIdle()` is true, polling every `intervalMs`, or after `timeoutMs`. Returns whether it became idle. */
export async function waitUntil(isIdle: () => boolean, timeoutMs: number, intervalMs = 50): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (!isIdle()) {
    if (Date.now() >= deadline) return false;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return true;
}
