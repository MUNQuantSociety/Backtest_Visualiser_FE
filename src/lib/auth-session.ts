import { UserManager, WebStorageStateStore, type User } from 'oidc-client-ts';

import { env } from '@/config/env';

export class SessionExpiredError extends Error {
  constructor() {
    super('Your session has ended. Please sign in again.');
    this.name = 'SessionExpiredError';
  }
}

export function safeReturnPath(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return '/';
  const url = new URL(value, window.location.origin);
  if (url.origin !== window.location.origin || url.pathname.startsWith('/auth/')) return '/';
  return url.pathname + url.search + url.hash;
}

export function authIsConfigured(): boolean {
  return Boolean(env.auth?.authority && env.auth.clientId && env.auth.domain);
}

let manager: UserManager | undefined;
let refresh: Promise<User> | undefined;
let callback: Promise<User> | undefined;
let generation = 0;
let invalidated = false;
let requests = new AbortController();
const signedOutListeners = new Set<() => void>();

function getManager(): UserManager {
  if (manager) return manager;
  if (!authIsConfigured())
    throw new Error('Sign-in is not configured. Please contact the site administrator.');
  const authority = new URL(env.auth.authority);
  const domain = new URL(env.auth.domain);
  if (authority.protocol !== 'https:' || domain.protocol !== 'https:') {
    throw new Error('Sign-in requires secure provider URLs.');
  }
  const redirect = new URL(env.auth.redirectUri || '/auth/callback', window.location.origin);
  const logout = new URL(env.auth.logoutRedirectUri || '/auth/login', window.location.origin);
  if (
    redirect.origin !== window.location.origin ||
    logout.origin !== window.location.origin ||
    redirect.pathname !== '/auth/callback' ||
    logout.pathname !== '/auth/login'
  ) {
    throw new Error('Sign-in return URLs must use this site and its authentication routes.');
  }
  manager = new UserManager({
    authority: authority.href.replace(/\/$/, ''),
    client_id: env.auth.clientId,
    redirect_uri: redirect.href,
    post_logout_redirect_uri: logout.href,
    response_type: 'code',
    scope: 'openid email profile',
    disablePKCE: false,
    loadUserInfo: false,
    // Cognito supports refresh-token renewal, not prompt=none iframe renewal.
    automaticSilentRenew: false,
    revokeTokenTypes: ['refresh_token'],
    requestTimeoutInSeconds: 30,
    userStore: new WebStorageStateStore({ store: window.sessionStorage }),
    stateStore: new WebStorageStateStore({ store: window.sessionStorage }),
    metadata: {
      issuer: authority.href.replace(/\/$/, ''),
      authorization_endpoint: new URL('/oauth2/authorize', domain).href,
      token_endpoint: new URL('/oauth2/token', domain).href,
      revocation_endpoint: new URL('/oauth2/revoke', domain).href,
      jwks_uri: authority.href.replace(/\/$/, '') + '/.well-known/jwks.json',
    },
  });
  return manager;
}

function endSession(): void {
  generation += 1;
  invalidated = true;
  requests.abort();
  requests = new AbortController();
  signedOutListeners.forEach((listener) => listener());
}

export const authSession = {
  get signal(): AbortSignal {
    return requests.signal;
  },
  subscribeSignedOut(listener: () => void): () => void {
    signedOutListeners.add(listener);
    return () => {
      signedOutListeners.delete(listener);
    };
  },
  async clear(): Promise<void> {
    endSession();
    if (manager) await manager.removeUser();
  },
  async getAccessToken(rejectedToken?: string): Promise<string | null> {
    if (!authIsConfigured() || invalidated) return null;
    const lookupGeneration = generation;
    const oidc = getManager();
    const user = await oidc.getUser();
    if (generation !== lookupGeneration || invalidated) throw new SessionExpiredError();
    if (!user) return null;
    // A concurrent request may already have replaced the token that got a 401.
    const needsRefresh =
      Boolean(user.expired) ||
      (user.expires_in ?? 0) < 30 ||
      Boolean(rejectedToken && user.access_token === rejectedToken);
    if (!needsRefresh) return user.access_token;
    if (!refresh) {
      const started = generation;
      refresh = (async () => {
        let renewed: User | null = null;
        try {
          if (!user.refresh_token) throw new SessionExpiredError();
          renewed = await oidc.signinSilent();
          if (
            !renewed?.access_token ||
            renewed.expired ||
            renewed.profile.sub !== user.profile.sub ||
            generation !== started
          ) {
            throw new SessionExpiredError();
          }
          return renewed;
        } catch {
          if (generation === started) {
            endSession();
            await oidc.removeUser();
          } else if (renewed) {
            // The SDK may finish writing an old refresh after local sign-out.
            // Remove only that result, never a newer sign-in's stored session.
            const stored = await oidc.getUser();
            if (stored?.access_token === renewed.access_token) await oidc.removeUser();
          }
          throw new SessionExpiredError();
        } finally {
          refresh = undefined;
        }
      })();
    }
    return (await refresh).access_token;
  },
  async signIn(returnTo: string): Promise<void> {
    const oidc = getManager();
    if (refresh) await refresh.catch(() => undefined);
    await oidc.clearStaleState();
    await oidc.signinRedirect({
      state: { returnTo: safeReturnPath(returnTo) },
      nonce: crypto.randomUUID(),
    });
  },
  completeSignIn(): Promise<User> {
    // React StrictMode must not exchange a one-use authorization code twice.
    callback ??= (async () => {
      const started = generation;
      if (refresh) await refresh.catch(() => undefined);
      const user = await getManager().signinRedirectCallback();
      if (started !== generation) throw new SessionExpiredError();
      invalidated = false;
      return user;
    })();
    return callback;
  },
  async logout(): Promise<void> {
    const oidc = getManager();
    endSession();
    try {
      // Capture/revoke the stored refresh credential before a pending renewal's
      // stale-result cleanup can remove it. Still await late writes before exit.
      const revocation = oidc.revokeTokens(['refresh_token']).catch(() => undefined);
      if (refresh) await refresh.catch(() => undefined);
      await revocation;
    } catch {
      // Local sign-out and clearing the managed-login cookie still complete.
    } finally {
      await oidc.removeUser();
      const url = new URL('/logout', env.auth.domain);
      url.searchParams.set('client_id', env.auth.clientId);
      url.searchParams.set('logout_uri', oidc.settings.post_logout_redirect_uri!);
      window.location.assign(url.href);
    }
  },
};
