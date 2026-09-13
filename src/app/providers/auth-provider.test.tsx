import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { paths } from '@/app/paths';
import { RootLayout } from '@/app/root-layout';
import type * as AuthModule from '@/lib/auth-session';
import AuthCallbackPage from '@/pages/auth-callback-page';
import LoginPage from '@/pages/LoginPage';

import { AuthProvider } from './auth-provider';
import { useAuthCtx } from './auth-provider.context';
import { QueryProvider } from './query-provider';

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
vi.mock('@/lib/api-client', () => ({
  apiClient: { get: mocks.get },
  ApiError: class extends Error {},
}));
vi.mock('@/app/dashboard-data', () => ({ prefetchDashboardData: vi.fn() }));
vi.mock('@/lib/auth-session', async (original) => ({
  ...(await original<typeof AuthModule>()),
  authIsConfigured: () => true,
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
    expect(await screen.findByRole('heading', { name: 'Sign in to MQS' })).toBeInTheDocument();
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
    expect(await screen.findByRole('heading', { name: 'Sign in to MQS' })).toBeInTheDocument();
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
});
