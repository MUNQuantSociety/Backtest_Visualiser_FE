import { afterEach, describe, expect, it, vi } from 'vitest';

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

afterEach(() => {
  window.history.replaceState(null, '', '/');
  vi.restoreAllMocks();
});

describe('real OIDC callback state validation', () => {
  it.each(['?code=untrusted', '?code=untrusted&state=unknown'])(
    'rejects %s before any token exchange',
    async (query) => {
      vi.resetModules();
      window.sessionStorage.clear();
      window.history.replaceState(null, '', '/auth/callback' + query);
      const network = vi.spyOn(globalThis, 'fetch');
      const { authSession } = await import('./auth-session');
      await expect(authSession.completeSignIn()).rejects.toThrow();
      expect(network).not.toHaveBeenCalled();
    },
  );
});
