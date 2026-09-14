import type * as Oidc from 'oidc-client-ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({
  getUser: vi.fn(),
  signinSilent: vi.fn(),
  signinRedirect: vi.fn(),
  signinRedirectCallback: vi.fn(),
  clearStaleState: vi.fn(),
  removeUser: vi.fn(),
  revokeTokens: vi.fn(),
  settings: {},
}));
vi.mock('oidc-client-ts', async (original) => {
  const actual = await original<typeof Oidc>();
  return {
    ...actual,
    UserManager: class {
      constructor(settings: Record<string, unknown>) {
        sdk.settings = settings;
        Object.assign(this, sdk);
      }
    },
  };
});
vi.mock('@/config/env', () => ({
  env: {
    auth: {
      authority: 'https://cognito-idp.us-east-2.amazonaws.com/test',
      clientId: 'public-client',
      domain: 'https://login.example.com',
      redirectUri: '',
      logoutRedirectUri: '',
    },
  },
}));

const current = {
  access_token: 'access-one',
  refresh_token: 'refresh-one',
  profile: { sub: 'subject-one' },
  expired: false,
  expires_in: 3600,
};
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  sdk.getUser.mockResolvedValue(current);
});

describe('managed session lifecycle', () => {
  it('uses code + PKCE and tab storage with Cognito refresh/logout settings', async () => {
    const { authSession } = await import('./auth-session');
    await authSession.signIn('/backtests?strategy=one');
    expect(sdk.settings).toMatchObject({
      response_type: 'code',
      disablePKCE: false,
      scope: 'openid email profile',
      automaticSilentRenew: false,
      loadUserInfo: false,
      revokeTokenTypes: ['refresh_token'],
      redirect_uri: window.location.origin + '/auth/callback',
      post_logout_redirect_uri: window.location.origin + '/auth/login',
    });
    expect(sdk.settings).not.toHaveProperty('client_secret');
    expect(sdk.signinRedirect).toHaveBeenCalledWith({
      state: { returnTo: '/backtests?strategy=one' },
      nonce: expect.any(String),
    });
  });

  it('shares one refresh for concurrent rejected requests and reuses the replacement token', async () => {
    const { authSession } = await import('./auth-session');
    let complete!: (value: typeof current) => void;
    sdk.signinSilent.mockReturnValue(
      new Promise((resolve) => {
        complete = resolve;
      }),
    );
    const first = authSession.getAccessToken('access-one');
    const second = authSession.getAccessToken('access-one');
    await vi.waitFor(() => expect(sdk.signinSilent).toHaveBeenCalledTimes(1));
    const renewed = { ...current, access_token: 'access-two' };
    sdk.getUser.mockResolvedValue(renewed);
    complete(renewed);
    expect(await Promise.all([first, second])).toEqual(['access-two', 'access-two']);
    expect(await authSession.getAccessToken('access-one')).toBe('access-two');
    expect(sdk.signinSilent).toHaveBeenCalledTimes(1);
  });

  it('clears the session and aborts old API requests when refresh fails', async () => {
    const { authSession } = await import('./auth-session');
    const listener = vi.fn();
    authSession.subscribeSignedOut(listener);
    const signal = authSession.signal;
    sdk.signinSilent.mockRejectedValue(new Error('private provider response'));
    await expect(authSession.getAccessToken('access-one')).rejects.toThrow(
      'Your session has ended',
    );
    expect(signal.aborted).toBe(true);
    expect(listener).toHaveBeenCalledOnce();
    expect(sdk.removeUser).toHaveBeenCalledOnce();
  });

  it('does not fall back to iframe renewal when the refresh token is absent', async () => {
    const { authSession } = await import('./auth-session');
    sdk.getUser.mockResolvedValue({ ...current, refresh_token: undefined, expired: true });
    await expect(authSession.getAccessToken()).rejects.toThrow('Your session has ended');
    expect(sdk.signinSilent).not.toHaveBeenCalled();
  });

  it('cannot restore an in-flight refresh after sign-out', async () => {
    const { authSession } = await import('./auth-session');
    let complete!: (value: typeof current) => void;
    sdk.signinSilent.mockReturnValue(
      new Promise((resolve) => {
        complete = resolve;
      }),
    );
    const renewing = authSession.getAccessToken('access-one');
    const rejected = expect(renewing).rejects.toThrow('Your session has ended');
    await vi.waitFor(() => expect(sdk.signinSilent).toHaveBeenCalledOnce());
    await authSession.clear();
    complete({ ...current, access_token: 'late-token' });
    await rejected;
  });

  it('exchanges the one-use callback only once', async () => {
    const { authSession } = await import('./auth-session');
    sdk.signinRedirectCallback.mockResolvedValue(current);
    await Promise.all([authSession.completeSignIn(), authSession.completeSignIn()]);
    expect(sdk.signinRedirectCallback).toHaveBeenCalledOnce();
  });

  it('revokes during pending renewal, then clears late writes and uses Cognito logout_uri', async () => {
    const realWindow = window;
    const assign = vi.fn();
    vi.stubGlobal(
      'window',
      new Proxy(realWindow, {
        get(target, key): unknown {
          return key === 'location'
            ? { origin: realWindow.location.origin, assign }
            : Reflect.get(target, key, target);
        },
      }),
    );
    try {
      const { authSession } = await import('./auth-session');
      let stored: typeof current | null = current;
      let finish!: (value: typeof current) => void;
      let revoked: string | undefined;
      sdk.getUser.mockImplementation(() => Promise.resolve(stored));
      sdk.removeUser.mockImplementation(() => {
        stored = null;
        return Promise.resolve();
      });
      sdk.revokeTokens.mockImplementation(() => {
        revoked = stored?.refresh_token;
        return Promise.resolve();
      });
      sdk.signinSilent.mockImplementation(() =>
        new Promise<typeof current>((resolve) => {
          finish = resolve;
        }).then((user) => {
          stored = user;
          return user;
        }),
      );
      const renewal = authSession.getAccessToken('access-one');
      const rejected = expect(renewal).rejects.toThrow('Your session has ended');
      await vi.waitFor(() => expect(sdk.signinSilent).toHaveBeenCalledOnce());
      const logout = authSession.logout();
      expect(revoked).toBe('refresh-one');
      finish({ ...current, access_token: 'late-token' });
      await Promise.all([logout, rejected]);
      expect(stored).toBeNull();
      const destination = new URL(String(assign.mock.calls[0]![0]));
      expect(destination.origin + destination.pathname).toBe('https://login.example.com/logout');
      expect(destination.searchParams.get('client_id')).toBe('public-client');
      expect(destination.searchParams.get('logout_uri')).toBe(
        realWindow.location.origin + '/auth/login',
      );
      expect(destination.searchParams.has('post_logout_redirect_uri')).toBe(false);
    } finally {
      vi.stubGlobal('window', realWindow);
    }
  });

  it('rejects a session lookup that resolves after sign-out', async () => {
    const { authSession } = await import('./auth-session');
    let finish!: (value: typeof current) => void;
    sdk.getUser.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const lookup = authSession.getAccessToken();
    const rejected = expect(lookup).rejects.toThrow('Your session has ended');
    await authSession.clear();
    finish(current);
    await rejected;
    expect(await authSession.getAccessToken()).toBeNull();
    expect(sdk.signinSilent).not.toHaveBeenCalled();
  });

  it('does not remove a newer stored session while discarding an old refresh', async () => {
    const { authSession } = await import('./auth-session');
    let finish!: (value: typeof current) => void;
    sdk.signinSilent.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const renewal = authSession.getAccessToken('access-one');
    const rejected = expect(renewal).rejects.toThrow('Your session has ended');
    await vi.waitFor(() => expect(sdk.signinSilent).toHaveBeenCalledOnce());
    await authSession.clear();
    sdk.removeUser.mockClear();
    sdk.getUser.mockResolvedValue({
      ...current,
      access_token: 'new-account-token',
      profile: { sub: 'new-subject' },
    });
    finish({ ...current, access_token: 'old-account-late-token' });
    await rejected;
    expect(sdk.removeUser).not.toHaveBeenCalled();
  });

  it.each([
    'https://outside.example',
    '//outside.example',
    '/\\outside.example',
    '/auth/callback?code=secret',
    '/auth/login',
  ])('rejects unsafe return path %s', async (path) => {
    const { safeReturnPath } = await import('./auth-session');
    expect(safeReturnPath(path)).toBe('/');
  });
});
