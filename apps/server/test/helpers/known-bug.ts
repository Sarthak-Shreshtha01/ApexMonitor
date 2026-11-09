import { it } from 'vitest';

/**
 * A test that documents a defect listed in docs/known-issues.md.
 *
 * It asserts the *correct* behaviour and is expected to fail while the bug exists
 * (`it.fails`). When someone fixes the bug, the test starts passing, `it.fails`
 * reports it, and the test must be converted to a regular `it`.
 *
 * Run with SHOW_KNOWN_BUGS=1 to execute these as normal tests and see each failure reason.
 */
export function knownBug(id: string, name: string, fn: () => unknown | Promise<unknown>, timeout?: number) {
  const title = `[known bug ${id}] ${name}`;
  if (process.env.SHOW_KNOWN_BUGS) {
    it(title, fn, timeout);
  } else {
    it.fails(title, fn, timeout);
  }
}
