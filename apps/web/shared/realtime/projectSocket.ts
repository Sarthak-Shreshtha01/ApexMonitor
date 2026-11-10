import { io } from 'socket.io-client';
import { store } from '@/lib/redux/store';
import { refreshAccessToken } from '@/shared/api/apiClient';

export const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000';

export interface PulseEvent<T = unknown> {
  projectId: string;
  data: T;
}

export interface ProjectSocketHandlers<T> {
  /** The server accepted the join: live events will arrive. */
  onJoined?: () => void;
  /** Disconnected, or the join was refused. */
  onLeft?: () => void;
  /** A `pulse:live` event for this project (the server sends one every 2 s, traffic or not). */
  onPulse?: (event: PulseEvent<T>) => void;
  /**
   * New requests arrived (a pulse with rps > 0), at most once per `trafficIntervalMs`.
   * Use this to reload lists instead of reloading on every pulse.
   */
  onTraffic?: () => void;
  trafficIntervalMs?: number;
}

/** The parts of a socket.io client this module uses (a fake in unit tests). */
export interface SocketLike {
  on(event: string, listener: (...args: never[]) => void): unknown;
  emit(event: string, payload: unknown): unknown;
  disconnect(): unknown;
}

export interface ProjectSocketDeps {
  createSocket: (url: string) => SocketLike;
  getAccessToken: () => string | null;
  refreshAccessToken: () => Promise<string>;
  now?: () => number;
}

const defaultDeps: ProjectSocketDeps = {
  createSocket: (url) => io(url, { transports: ['websocket'], withCredentials: true }),
  getAccessToken: () => store.getState().auth.accessToken,
  refreshAccessToken,
};

/**
 * Connects to the API's websocket and joins a project's live room.
 *
 * The server admits a socket only if the join carries a valid access token of a project
 * member, so the in-memory token is sent with every join (and every reconnect). A join
 * refused as unauthorized (for example an expired token) is retried once after a refresh.
 * Returns a function that disconnects.
 */
export function connectProjectSocket<T = unknown>(
  projectId: string,
  handlers: ProjectSocketHandlers<T>,
  deps: ProjectSocketDeps = defaultDeps,
): () => void {
  const socket = deps.createSocket(WS_URL);
  const now = deps.now ?? Date.now;
  const trafficIntervalMs = handlers.trafficIntervalMs ?? 5_000;
  let retriedAfterRefresh = false;
  let lastTrafficAt = -Infinity;

  const join = (token: string | null) => socket.emit('join', { projectId, token: token ?? undefined });

  socket.on('connect', () => {
    retriedAfterRefresh = false;
    join(deps.getAccessToken());
  });
  socket.on('join:ok', () => handlers.onJoined?.());
  socket.on('join:error', (error: { message?: string } | undefined) => {
    handlers.onLeft?.();
    if (retriedAfterRefresh || !/unauthori[sz]ed/i.test(error?.message ?? '')) return;
    retriedAfterRefresh = true;
    // A failed refresh clears the session; RouteGate then sends the user to /login.
    deps.refreshAccessToken().then(join, () => undefined);
  });
  socket.on('disconnect', () => handlers.onLeft?.());
  socket.on('pulse:live', (event: PulseEvent<T>) => {
    if (event?.projectId !== projectId) return;
    handlers.onPulse?.(event);
    const rps = Number((event.data as { rps?: unknown } | undefined)?.rps ?? 0);
    if (handlers.onTraffic && rps > 0 && now() - lastTrafficAt >= trafficIntervalMs) {
      lastTrafficAt = now();
      handlers.onTraffic();
    }
  });

  return () => {
    socket.disconnect();
  };
}
