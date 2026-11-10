import { create } from 'zustand';

/**
 * The access token lives only in memory (never localStorage), so XSS can't read a stored
 * copy and a closed tab leaves nothing behind. The refresh token is an httpOnly cookie set
 * by the API that page scripts can't see; on load the app gets a fresh access token from it.
 *
 * status: `unknown` until the first session check, `authenticated` with a token,
 * `anonymous` after a failed check, a failed refresh or logout.
 */
export type SessionStatus = 'unknown' | 'authenticated' | 'anonymous';

export interface AuthState {
  accessToken: string | null;
  status: SessionStatus;
  setAccessToken: (token: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  accessToken: null,
  status: 'unknown',
  setAccessToken: (token) => set({ accessToken: token, status: 'authenticated' }),
  clearAuth: () => set({ accessToken: null, status: 'anonymous' }),
}));

/** For code outside React (API client, websockets). */
export const getAccessToken = () => useAuthStore.getState().accessToken;
export const setAccessToken = (token: string) => useAuthStore.getState().setAccessToken(token);
export const clearAuth = () => useAuthStore.getState().clearAuth();

/**
 * Earlier versions persisted { accessToken, refreshToken } to localStorage under this key.
 * Remove it so old tokens don't linger on users' machines.
 */
export const LEGACY_PERSIST_KEY = 'persist:persistroot';
if (typeof window !== 'undefined') {
  try {
    window.localStorage.removeItem(LEGACY_PERSIST_KEY);
  } catch {
    // storage unavailable (private mode etc.): nothing to clean
  }
}
