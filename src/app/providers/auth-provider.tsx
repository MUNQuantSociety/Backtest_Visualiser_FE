import { useState } from 'react';

import { createLogger } from '@/lib/logger';

import { AuthCtx } from './auth-provider.context';
import type { AuthProviderProps, AuthState, AuthCtxInterface } from './auth-provider.types';

const log = createLogger('auth');
const SESSION_KEY = 'mqs:local-sign-in:v1';

function restoreSession(): AuthState {
  try {
    const isAuthenticated = window.sessionStorage.getItem(SESSION_KEY) === 'signed-in';
    log.info('local sign-in restored', { isAuthenticated });
    return { isAuthenticated };
  } catch (error) {
    log.warn('could not restore local sign-in; starting signed out', { error });
    return { isAuthenticated: false };
  }
}

export function AuthProvider({ children }: AuthProviderProps) {
  // Restore synchronously so the route guard never sees a temporary signed-out
  // state during a reload. This marker is only for the existing local sign-in;
  // backend authentication must validate its own session when it is connected.
  const [authState, setAuthState] = useState<AuthState>(restoreSession);

  const login = (): void => {
    try {
      // Keep no credentials or access tokens in browser storage.
      window.sessionStorage.setItem(SESSION_KEY, 'signed-in');
      log.info('local sign-in saved for this browser tab');
    } catch (error) {
      log.warn('local sign-in is memory-only; browser storage is unavailable', { error });
    }
    setAuthState({ isAuthenticated: true });
  };

  const logout = (): void => {
    try {
      window.sessionStorage.removeItem(SESSION_KEY);
    } catch (error) {
      log.warn('could not clear stored local sign-in', { error });
    }
    setAuthState({ isAuthenticated: false });
    log.info('signed out of local session');
  };

  const value: AuthCtxInterface = {
    authState,
    login,
    logout,
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
