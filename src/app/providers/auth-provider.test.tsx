import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';
import { createBrowserRouter, MemoryRouter, Route, RouterProvider, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { paths } from '@/app/paths';
import { RootLayout } from '@/app/root-layout';
import { ApiError } from '@/lib/api-client';
import type * as ApiModule from '@/lib/api-client';
import type * as AuthModule from '@/lib/auth-session';
import AuthCallbackPage from '@/pages/auth-callback-page';
import LoginPage from '@/pages/LoginPage';

import { AuthProvider } from './auth-provider';
import { useAuthCtx } from './auth-provider.context';
import { QueryProvider } from './query-provider';

import { AppProviders } from './index';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  token: vi.fn(),
  signIn: vi.fn(),
  logout: vi.fn(),
  complete: vi.fn(),
  clear: vi.fn(),
  listeners: new Set<() => void>(),
  signal: new AbortController().signal,
}));
const authConfig = vi.hoisted(() => ({ configured: true }));
const envState = vi.hoisted(() => ({ devUserId: undefined as string | undefined }));
vi.mock('@/config/env', () => ({
  env: {
    apiBaseUrl: '/api',
    apiTimeout: 30_000,
    useFixtures: false,
    isDev: true,
    isProd: false,
    get devUserId() {
      return envState.devUserId;
    },
    auth: {
      authority: '',
      clientId: '',
      domain: '',
      redirectUri: '',
      logoutRedirectUri: '',
    },
  },
}));
vi.mock('@/lib/api-client', async (original) => ({
  ...(await original<typeof ApiModule>()),
  apiClient: { get: mocks.get },
}));
vi.mock('@/app/dashboard-data', () => ({ prefetchDashboardData: vi.fn() }));
vi.mock('@/lib/auth-session', async (original) => ({
  ...(await original<typeof AuthModule>()),
  authIsConfigured: () => authConfig.configured,
  authSession: {
    signal: mocks.signal,
    getAccessToken: mocks.token,
    signIn: mocks.signIn,
    logout: mocks.logout,
    completeSignIn: mocks.complete,
    clear: mocks.clear,
    subscribeSignedOut: (fn: () => void) => {
      mocks.listeners.add(fn);
      return () => {
        mocks.listeners.delete(fn);
      };
    },
  },
}));
vi.mock('@/app/shell', () => ({ AppShell: ({ children }: { children: ReactNode }) => children }));

function ProtectedPage() {
  const { authState, logout } = useAuthCtx();
  return (
    <>
      <h1>Private backtests</h1>
      <p>{authState.user?.id}</p>
      <button onClick={logout}>Log out</button>
    </>
  );
}
function TestApp({ path = '/' }: { path?: string }) {
  return (
    <AuthProvider>
      <QueryProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path={paths.login} element={<LoginPage />} />
            <Route path={paths.authCallback} element={<AuthCallbackPage />} />
            <Route element={<RootLayout />}>
              <Route path="/" element={<ProtectedPage />} />
              <Route path="/backtests" element={<ProtectedPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryProvider>
    </AuthProvider>
  );
}
const appUser = { id: '76125fb2-45a8-4ff5-9195-3bb0dc092c91', email: null, displayName: null };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.listeners.clear();
  window.sessionStorage.clear();
  window.history.replaceState(null, '', '/');
  authConfig.configured = true;
  envState.devUserId = undefined;
  mocks.token.mockResolvedValue(null);
  mocks.get.mockResolvedValue(appUser);
  mocks.clear.mockImplementation(() => {
    mocks.listeners.forEach((fn) => fn());
    return Promise.resolve();
  });
  mocks.logout.mockImplementation(() => {
    mocks.listeners.forEach((fn) => fn());
    return Promise.resolve();
  });
});
afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('verified sign-in and protected routes', () => {
  it('ignores the legacy fake sign-in marker', async () => {
    window.sessionStorage.setItem('mqs:local-sign-in:v1', 'signed-in');
    render(<TestApp />);
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Private backtests' })).not.toBeInTheDocument();
    expect(mocks.get).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem('mqs:local-sign-in:v1')).toBeNull();
  });

  it('waits for backend verification before rendering a private deep link', async () => {
    mocks.token.mockResolvedValue('provider-access-token');
    let verify!: (value: typeof appUser) => void;
    mocks.get.mockReturnValue(
      new Promise((resolve) => {
        verify = resolve;
      }),
    );
    render(<TestApp path="/backtests" />);
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith('/auth/me', expect.any(Object)));
    expect(screen.queryByRole('heading', { name: 'Private backtests' })).not.toBeInTheDocument();
    await act(async () => {
      verify(appUser);
      await Promise.resolve();
    });
    expect(await screen.findByRole('heading', { name: 'Private backtests' })).toBeInTheDocument();
    expect(screen.getByText(appUser.id)).toBeInTheDocument();
  });

  it('rejects a locally stored provider session when the API rejects it', async () => {
    mocks.token.mockResolvedValue('unverified');
    mocks.get.mockRejectedValue(new Error('401'));
    render(<TestApp />);
    expect(await screen.findByRole('alert')).toHaveTextContent('session could not be verified');
    expect(screen.queryByRole('heading', { name: 'Private backtests' })).not.toBeInTheDocument();
  });

  it('sends the intended local route to managed sign-in', async () => {
    render(<TestApp path="/backtests?strategy=one" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Continue to secure sign-in' }));
    expect(mocks.signIn).toHaveBeenCalledWith('/backtests?strategy=one');
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
  });

  it('clears private UI immediately on sign-out', async () => {
    mocks.token.mockResolvedValue('provider-access-token');
    render(<TestApp />);
    fireEvent.click(await screen.findByRole('button', { name: 'Log out' }));
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.queryByText(appUser.id)).not.toBeInTheDocument();
  });

  it('verifies the callback identity then returns to the saved private route', async () => {
    window.history.replaceState(null, '', '/auth/callback?code=one&state=matching');
    mocks.complete.mockResolvedValue({ state: { returnTo: '/backtests' } });
    render(<TestApp path={paths.authCallback} />);
    expect(await screen.findByRole('heading', { name: 'Private backtests' })).toBeInTheDocument();
    expect(mocks.get).toHaveBeenCalledWith('/auth/me', expect.any(Object));
    expect(mocks.complete).toHaveBeenCalledOnce();
  });

  it('shows safe callback failure copy, strips callback parameters, and never opens private UI', async () => {
    window.history.replaceState(null, '', '/auth/callback?code=one&state=invalid');
    mocks.complete.mockRejectedValue(new Error('provider details must not appear'));
    render(<TestApp path={paths.authCallback} />);
    expect(
      await screen.findByRole('heading', { name: 'Sign-in could not be completed' }),
    ).toBeInTheDocument();
    expect(mocks.get).not.toHaveBeenCalled();
    expect(window.location.search).toBe('');
    expect(screen.queryByText('provider details must not appear')).not.toBeInTheDocument();
  });

  it.each(['ECONNABORTED', 'ETIMEDOUT', 'ERR_NETWORK', 'NETWORK_ERROR'])(
    'explains API connectivity after successful provider sign-in for %s and remains signed out',
    async (code) => {
      window.history.replaceState(null, '', '/auth/callback?code=one&state=matching');
      mocks.complete.mockResolvedValue({ state: { returnTo: '/backtests' } });
      mocks.get.mockRejectedValue(new ApiError('internal request details', 0, code));
      render(<TestApp path={paths.authCallback} />);
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(
        'Secure sign-in succeeded, but the MQS server could not be reached.',
      );
      expect(alert).not.toHaveTextContent('internal request details');
      expect(mocks.clear).toHaveBeenCalledOnce();
      expect(window.location.search).toBe('');
      expect(screen.queryByRole('heading', { name: 'Private backtests' })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('link', { name: 'Back to sign in' }));
      expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent('MQS server could not be reached');
    },
  );

  it.each(['expired authorization code', 'invalid callback state'])(
    'keeps %s separate from API connectivity failures',
    async (reason) => {
      window.history.replaceState(null, '', '/auth/callback?code=one&state=invalid');
      mocks.complete.mockRejectedValue(new Error(reason));
      render(<TestApp path={paths.authCallback} />);
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Sign-in could not be completed. Please start again.',
      );
      expect(screen.getByRole('alert')).not.toHaveTextContent('Secure sign-in succeeded');
      expect(mocks.get).not.toHaveBeenCalled();
      expect(mocks.clear).toHaveBeenCalledOnce();
      expect(window.location.search).toBe('');
    },
  );

  it('does not label an API identity rejection as a connection error', async () => {
    window.history.replaceState(null, '', '/auth/callback?code=one&state=matching');
    mocks.complete.mockResolvedValue({ state: { returnTo: '/backtests' } });
    mocks.get.mockRejectedValue(new ApiError('invalid access token', 401, 'UNAUTHORIZED'));
    render(<TestApp path={paths.authCallback} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Sign-in could not be completed. Please start again.',
    );
    expect(screen.getByRole('alert')).not.toHaveTextContent('MQS server could not be reached');
  });

  it('completes sign-in through the real provider stack and browser router across the account-cache remount', async () => {
    window.history.replaceState(null, '', '/auth/callback?code=one&state=matching');
    mocks.complete.mockResolvedValue({ state: { returnTo: '/backtests' } });
    const router = createBrowserRouter([
      { path: paths.authCallback, element: <AuthCallbackPage /> },
      { path: paths.login, element: <LoginPage /> },
      { element: <RootLayout />, children: [{ path: '/backtests', element: <ProtectedPage /> }] },
    ]);
    try {
      render(
        <StrictMode>
          <AppProviders>
            <RouterProvider router={router} />
          </AppProviders>
        </StrictMode>,
      );
      expect(await screen.findByRole('heading', { name: 'Private backtests' })).toBeInTheDocument();
      expect(screen.getByText(appUser.id)).toBeInTheDocument();
      expect(mocks.complete).toHaveBeenCalledOnce();
      expect(mocks.get).toHaveBeenCalledOnce();
      expect(router.state.location.pathname).toBe('/backtests');
      expect(window.location.search).toBe('');
      expect(mocks.clear).not.toHaveBeenCalled();
    } finally {
      router.dispose();
    }
  });
});

describe('local dev identity without a hosted provider', () => {
  it('signs in through the backend identity check when no provider is configured', async () => {
    authConfig.configured = false;
    envState.devUserId = appUser.id;
    render(<TestApp path="/backtests" />);
    expect(await screen.findByRole('heading', { name: 'Private backtests' })).toBeInTheDocument();
    expect(mocks.get).toHaveBeenCalledWith('/auth/me', expect.any(Object));
    expect(mocks.token).not.toHaveBeenCalled();
    expect(screen.getByText(appUser.id)).toBeInTheDocument();
  });

  it('stays signed out with the not-configured message when no dev user is set', async () => {
    authConfig.configured = false;
    envState.devUserId = undefined;
    render(<TestApp />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Sign-in is not configured. Please contact the site administrator.',
    );
    expect(screen.queryByRole('heading', { name: 'Private backtests' })).not.toBeInTheDocument();
  });

  it('explains a failed identity check rather than claiming sign-in is unconfigured', async () => {
    authConfig.configured = false;
    envState.devUserId = appUser.id;
    mocks.get.mockRejectedValue(new Error('401'));
    render(<TestApp />);
    expect(await screen.findByRole('alert')).toHaveTextContent('session could not be verified');
  });
});
