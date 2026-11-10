import { createSlice, PayloadAction } from '@reduxjs/toolkit';

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
}

const initialState: AuthState = {
  accessToken: null,
  status: 'unknown',
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAccessToken: (state, action: PayloadAction<string>) => {
      state.accessToken = action.payload;
      state.status = 'authenticated';
    },
    clearAuth: (state) => {
      state.accessToken = null;
      state.status = 'anonymous';
    },
  },
});

export const { setAccessToken, clearAuth } = authSlice.actions;
export default authSlice.reducer;
