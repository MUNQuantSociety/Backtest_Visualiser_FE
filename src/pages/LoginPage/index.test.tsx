import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthState } from '@/app/providers/auth-provider.types';
import type * as AuthSessionModule from '@/lib/auth-session';

import LoginPage from './index';

const auth = vi.hoisted(() => {
  const authState: AuthState = {
    status: 'signed-out',
    isAuthenticated: false,
    user: null,
    error: null,
  };
  return { authState, login: vi.fn(), configured: true };
});
vi.mock('@/app/providers/auth-provider.context', () => ({ useAuthCtx: () => auth }));
vi.mock('@/lib/auth-session', async (original) => ({
  ...(await original<typeof AuthSessionModule>()),
  authIsConfigured: () => auth.configured,
}));

beforeEach(() => {
  vi.clearAllMocks();
  auth.authState = { status: 'signed-out', isAuthenticated: false, user: null, error: null };
  auth.configured = true;
});
const show = (path = '/auth/login') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <LoginPage />
    </MemoryRouter>,
  );

describe('restored sign-in page', () => {
  it('restores the welcome/account sections and the styled primary action without fake credentials', () => {
    show();
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.getByText('New here?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue to secure sign-in' })).toHaveClass(
      'login-button--primary',
    );
    expect(screen.getByRole('button', { name: 'Create an account' })).toHaveClass(
      'login-button--register',
    );
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    expect(screen.queryByText('Register with Discord')).not.toBeInTheDocument();
  });

  it('keeps sign-in, account creation, and recovery on the existing safe login flow', () => {
    show('/auth/login?returnTo=%2Fbacktests%3Fstrategy%3Done');
    for (const name of [
      'Continue to secure sign-in',
      'Create an account',
      'Forgot your password?',
    ]) {
      fireEvent.click(screen.getByRole('button', { name }));
    }
    expect(auth.login.mock.calls).toEqual([
      ['/backtests?strategy=one'],
      ['/backtests?strategy=one'],
      ['/backtests?strategy=one'],
    ]);
    expect(
      screen.getByText(
        'Account creation and password recovery are available on the secure sign-in page.',
      ),
    ).toBeInTheDocument();
  });

  it('does not pass an external return URL into sign-in', () => {
    show('/auth/login?returnTo=https%3A%2F%2Foutside.example');
    fireEvent.click(screen.getByRole('button', { name: 'Continue to secure sign-in' }));
    expect(auth.login).toHaveBeenCalledWith('/');
  });

  it('keeps session-check feedback visible and disables alternate actions while loading', () => {
    auth.authState.status = 'loading';
    show();
    expect(screen.getByRole('status')).toHaveTextContent('Checking your session');
    expect(
      screen.queryByRole('button', { name: 'Continue to secure sign-in' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create an account' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Forgot your password?' })).toBeDisabled();
  });

  it('shows configuration errors and keeps all authentication actions disabled when unavailable', () => {
    auth.configured = false;
    auth.authState.error = 'Sign-in is not configured.';
    show();
    expect(screen.getByRole('alert')).toHaveTextContent('Sign-in is not configured.');
    expect(screen.getByRole('alert')).toHaveClass('login-alert');
    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled();
  });
});
