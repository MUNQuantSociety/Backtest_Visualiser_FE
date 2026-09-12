import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { paths } from '@/app/paths';
import { RootLayout } from '@/app/root-layout';
import LoginPage from '@/pages/LoginPage';

import { AuthProvider } from './auth-provider';
import { useAuthCtx } from './auth-provider.context';

vi.mock('@/app/shell', () => ({ AppShell: ({ children }: { children: ReactNode }) => children }));
const log = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));
vi.mock('@/lib/logger', () => ({ createLogger: () => log }));

function ProtectedPage({ title }: { title: string }) {
  const { logout } = useAuthCtx();
  return (
    <>
      <h1>{title}</h1>
      <button onClick={logout}>Log out</button>
    </>
  );
}

function TestApp({ path = paths.dashboard }: { path?: string }) {
  return (
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={paths.login} element={<LoginPage />} />
          <Route element={<RootLayout />}>
            <Route path={paths.dashboard} element={<ProtectedPage title="Dashboard" />} />
            <Route path={paths.library} element={<ProtectedPage title="Library" />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

async function signIn() {
  await screen.findByRole('heading', { name: 'Welcome back' });
  fireEvent.change(screen.getByLabelText('Email address'), {
    target: { value: 'preview@example.com' },
  });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'preview-only' } });
  fireEvent.submit(screen.getByRole('button', { name: 'Sign in' }).closest('form')!);
  await screen.findByRole('heading', { name: 'Dashboard' });
}

beforeEach(() => {
  window.sessionStorage.clear();
  vi.clearAllMocks();
});
afterEach(() => vi.restoreAllMocks());

describe('local sign-in persistence', () => {
  it('restores sign-in before a protected deep route renders after a reload', async () => {
    const first = render(<TestApp />);
    await signIn();
    first.unmount();

    render(<TestApp path={paths.library} />);
    expect(screen.getByRole('heading', { name: 'Library' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Welcome back' })).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem('mqs:local-sign-in:v1')).toBe('signed-in');
    expect(JSON.stringify(window.sessionStorage)).not.toContain('preview@example.com');
    expect(JSON.stringify(window.sessionStorage)).not.toContain('preview-only');
    expect(JSON.stringify(window.sessionStorage)).not.toContain('access_token');
  });

  it('clears the session on logout so reloading remains signed out', async () => {
    const first = render(<TestApp />);
    await signIn();
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    await screen.findByRole('heading', { name: 'Welcome back' });
    first.unmount();

    render(<TestApp path={paths.library} />);
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(window.sessionStorage.getItem('mqs:local-sign-in:v1')).toBeNull();
  });

  it('rejects an unrecognised stored session value', async () => {
    window.sessionStorage.setItem('mqs:local-sign-in:v1', 'invalid');
    render(<TestApp />);
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });

  it('allows in-memory sign-in and logout when browser storage is blocked', async () => {
    const storagePrototype = Object.getPrototypeOf(window.sessionStorage) as Storage;
    vi.spyOn(storagePrototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage blocked');
    });
    vi.spyOn(storagePrototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage blocked');
    });
    vi.spyOn(storagePrototype, 'removeItem').mockImplementation(() => {
      throw new Error('Storage blocked');
    });
    render(<TestApp />);
    await signIn();
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(log.warn).toHaveBeenCalledWith(
      'local sign-in is memory-only; browser storage is unavailable',
      expect.any(Object),
    );
  });
});
