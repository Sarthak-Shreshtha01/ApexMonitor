import { combineReducers, configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/state/auth.slice';

const rootReducer = combineReducers({
  auth: authReducer,
});

export const store = configureStore({ reducer: rootReducer });

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

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
