import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';

import { env } from '@/config/env';
import { apiClient, ApiError } from '@/lib/api-client';
import { authIsConfigured, authSession, safeReturnPath } from '@/lib/auth-session';

import { AuthCtx } from './auth-provider.context';
import type { AuthProviderProps, AuthState } from './auth-provider.types';

const appUserSchema = z.object({
  id: z.uuid(),
  email: z.string().nullable(),
  displayName: z.string().nullable(),
});
const signedOut: AuthState = {
  status: 'signed-out',
  isAuthenticated: false,
  user: null,
  error: null,
};
const loading: AuthState = { ...signedOut, status: 'loading' };

export function AuthProvider({ children }: AuthProviderProps) {
  const [authState, setAuthState] = useState<AuthState>(loading);
  const callback = useRef<Promise<string> | null>(null);

  const verifyIdentity = useCallback(async (signal: AbortSignal) => {
    const user = appUserSchema.parse(await apiClient.get<unknown>('/auth/me', { signal }));
    if (signal.aborted) throw new Error('Sign-in was cancelled.');
    setAuthState({ status: 'authenticated', isAuthenticated: true, user, error: null });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const unsubscribe = authSession.subscribeSignedOut(() => setAuthState(signedOut));
    // An old UI marker has no authentication meaning and is never restored.
    try {
      window.sessionStorage.removeItem('mqs:local-sign-in:v1');
    } catch {
      /* Storage may be blocked. */
    }
    if (window.location.pathname !== '/auth/callback') {
      void (async () => {
        try {
          if (!authIsConfigured()) {
            // Local-only dev identity: VITE_DEV_USER_ID becomes a full sign-in
            // so the app renders without a hosted provider. The backend still
            // owns the identity, answered through /auth/me, so a stale or
            // unknown id fails here rather than inventing a session.
            if (env.isDev && env.devUserId) await verifyIdentity(controller.signal);
            else
              throw new Error('Sign-in is not configured. Please contact the site administrator.');
          } else {
            const token = await authSession.getAccessToken();
            if (controller.signal.aborted) return;
            if (token) await verifyIdentity(controller.signal);
            else setAuthState(signedOut);
          }
        } catch {
          if (!controller.signal.aborted)
            setAuthState({
              ...signedOut,
              status: 'error',
              error:
                authIsConfigured() || (env.isDev && env.devUserId)
                  ? 'Your session could not be verified. Please sign in again.'
                  : 'Sign-in is not configured. Please contact the site administrator.',
            });
        }
      })();
    }
    return () => {
      controller.abort();
      unsubscribe();
    };
  }, [verifyIdentity]);

  const login = useCallback(async (returnTo = '/') => {
    setAuthState(loading);
    try {
      await authSession.signIn(safeReturnPath(returnTo));
    } catch {
      setAuthState({
        ...signedOut,
        status: 'error',
        error: 'Could not open secure sign-in. Please try again.',
      });
    }
  }, []);

  const logout = useCallback(async () => {
    setAuthState(signedOut);
    if (!authIsConfigured()) return;
    try {
      await authSession.logout();
    } catch {
      setAuthState({
        ...signedOut,
        status: 'error',
        error: 'You are signed out here. The sign-in service could not be reached.',
      });
    }
  }, []);

  const completeSignIn = useCallback((): Promise<string> => {
    callback.current ??= (async () => {
      let providerCompleted = false;
      try {
        const oidcUser = await authSession.completeSignIn();
        providerCompleted = true;
        await verifyIdentity(authSession.signal);
        const state: unknown = oidcUser.state;
        return safeReturnPath(
          typeof state === 'object' && state !== null && 'returnTo' in state ? state.returnTo : '/',
        );
      } catch (error) {
        const apiUnreachable =
          providerCompleted &&
          error instanceof ApiError &&
          error.status === 0 &&
          ['ECONNABORTED', 'ETIMEDOUT', 'ERR_NETWORK', 'NETWORK_ERROR'].includes(error.code);
        const message = apiUnreachable
          ? 'Secure sign-in succeeded, but the MQS server could not be reached. Please try again shortly.'
          : 'Sign-in could not be completed. Please start again.';
        await authSession.clear();
        setAuthState({
          ...signedOut,
          status: 'error',
          error: message,
        });
        // Provider errors can include credentials; expose only the safe UI message.
        // eslint-disable-next-line preserve-caught-error
        throw new Error(message);
      }
    })();
    return callback.current;
  }, [verifyIdentity]);

  return (
    <AuthCtx.Provider value={{ authState, login, logout, completeSignIn }}>
      {children}
    </AuthCtx.Provider>
  );
}
