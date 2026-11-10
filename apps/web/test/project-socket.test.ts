import { describe, expect, it, vi } from 'vitest';
import { connectProjectSocket, ProjectSocketDeps, SocketLike } from '@/shared/realtime/projectSocket';

class FakeSocket implements SocketLike {
  listeners = new Map<string, (...args: never[]) => void>();
  emitted: Array<[string, unknown]> = [];
  disconnected = false;
  on(event: string, listener: (...args: never[]) => void) {
    this.listeners.set(event, listener);
  }
  emit(event: string, payload: unknown) {
    this.emitted.push([event, payload]);
  }
  disconnect() {
    this.disconnected = true;
  }
  /** Simulates the server sending `event`. */
  serverSends(event: string, payload?: unknown) {
    (this.listeners.get(event) as ((p: unknown) => void) | undefined)?.(payload);
  }
}

function setup(token: string | null = 'access-1', refresh: ProjectSocketDeps['refreshAccessToken'] = async () => 'access-2') {
  const socket = new FakeSocket();
  const deps: ProjectSocketDeps = { createSocket: () => socket, getAccessToken: () => token, refreshAccessToken: vi.fn(refresh) };
  const handlers = { onJoined: vi.fn(), onLeft: vi.fn(), onPulse: vi.fn() };
  const close = connectProjectSocket('p1', handlers, deps);
  return { socket, deps, handlers, close };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('connectProjectSocket (KI-41)', () => {
  it('joins with the access token on connect and on every reconnect', () => {
    const { socket } = setup();
    socket.serverSends('connect');
    socket.serverSends('disconnect');
    socket.serverSends('connect');
    expect(socket.emitted).toEqual([
      ['join', { projectId: 'p1', token: 'access-1' }],
      ['join', { projectId: 'p1', token: 'access-1' }],
    ]);
  });

  it('reports joined only after join:ok, and left on disconnect', () => {
    const { socket, handlers } = setup();
    socket.serverSends('connect');
    expect(handlers.onJoined).not.toHaveBeenCalled();
    socket.serverSends('join:ok', { projectId: 'p1' });
    expect(handlers.onJoined).toHaveBeenCalledTimes(1);
    socket.serverSends('disconnect');
    expect(handlers.onLeft).toHaveBeenCalledTimes(1);
  });

  it('passes on pulses for this project only', () => {
    const { socket, handlers } = setup();
    socket.serverSends('pulse:live', { projectId: 'other', data: { rps: 1 } });
    socket.serverSends('pulse:live', { projectId: 'p1', data: { rps: 2 } });
    expect(handlers.onPulse).toHaveBeenCalledTimes(1);
    expect(handlers.onPulse).toHaveBeenCalledWith({ projectId: 'p1', data: { rps: 2 } });
  });

  it('an unauthorized join (expired token) refreshes once and retries', async () => {
    const { socket, deps } = setup();
    socket.serverSends('connect');
    socket.serverSends('join:error', { message: 'Unauthorized websocket join' });
    await flush();
    expect(deps.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(socket.emitted.at(-1)).toEqual(['join', { projectId: 'p1', token: 'access-2' }]);

    socket.serverSends('join:error', { message: 'Unauthorized websocket join' });
    await flush();
    expect(deps.refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  it('does not refresh when the user simply has no access to the project', async () => {
    const { socket, deps } = setup();
    socket.serverSends('connect');
    socket.serverSends('join:error', { message: 'No access to this project' });
    await flush();
    expect(deps.refreshAccessToken).not.toHaveBeenCalled();
  });

  it('a failed refresh does not throw or rejoin', async () => {
    const { socket } = setup('expired', async () => {
      throw new Error('refresh failed');
    });
    socket.serverSends('connect');
    socket.serverSends('join:error', { message: 'Unauthorized websocket join' });
    await flush();
    expect(socket.emitted).toHaveLength(1);
  });

  it('the returned function disconnects', () => {
    const { socket, close } = setup();
    close();
    expect(socket.disconnected).toBe(true);
  });
});
