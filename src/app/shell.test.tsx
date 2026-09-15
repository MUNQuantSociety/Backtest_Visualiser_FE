import '@/test/storage-global';

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useUiStore } from '@/lib/ui-store';

import { AppShell } from './shell';

vi.mock('@/app/providers/auth-provider.context', () => ({
  useAuthCtx: () => ({ logout: vi.fn() }),
}));

// The shell carries the validation notice, which polls through React Query.
// This file renders `AppShell` bare to assert nav highlighting, so the notice
// is stubbed rather than given a QueryClient it would only use to fetch
// nothing. Its own behaviour is covered by the strategies feature's tests.
vi.mock('@/features/strategies', () => ({
  ValidationNotifications: () => null,
}));

// Mutable so a single test can stand in for a production build. Hoisted above
// the vi.mock factory it feeds. The real env module is exercised by
// src/config/env.test.ts.
const { env } = vi.hoisted(() => ({
  env: {
    apiBaseUrl: '/api',
    apiTimeout: 30_000,
    devUserId: undefined as string | undefined,
    devHideDemoPanels: false,
    useFixtures: false,
    isDev: true,
    isProd: false,
  },
}));
vi.mock('@/config/env', () => ({ env }));

describe('Backtests navigation', () => {
  it.each(['/backtests', '/backtests/run-1', '/backtests/run-1?tab=risk'])(
    'keeps Backtests selected on desktop and mobile at %s',
    (path) => {
      render(
        <MemoryRouter initialEntries={[path]}>
          <AppShell>Results</AppShell>
        </MemoryRouter>,
      );
      for (const nav of screen.getAllByRole('navigation', { name: 'Main' })) {
        const links = within(nav).getAllByRole('link');
        expect(links.slice(0, 2).map((link) => link.textContent)).toEqual([
          'Dashboard',
          'Backtests',
        ]);
        expect(within(nav).getByRole('link', { name: 'Backtests' })).toHaveAttribute(
          'aria-current',
          'page',
        );
        expect(within(nav).getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute(
          'aria-current',
        );
        expect(within(nav).queryByRole('link', { name: 'Library' })).not.toBeInTheDocument();
      }
    },
  );

  it('keeps Dashboard selected on the overview', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppShell>Overview</AppShell>
      </MemoryRouter>,
    );
    for (const nav of screen.getAllByRole('navigation', { name: 'Main' })) {
      expect(within(nav).getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      expect(within(nav).getByRole('link', { name: 'Backtests' })).not.toHaveAttribute(
        'aria-current',
      );
    }
  });
});

describe('Demo data panels', () => {
  beforeEach(() => {
    useUiStore.setState({ hideDemoPanels: false });
    env.isDev = true;
    env.isProd = false;
  });

  it('toggles the preference to hide demo-marked cards', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppShell>Overview</AppShell>
      </MemoryRouter>,
    );

    const toggle = screen.getByRole('button', { name: 'Hide demo' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await user.click(toggle);
    expect(screen.getByRole('button', { name: 'Show demo' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(screen.getByRole('button', { name: 'Show demo' }));
    expect(screen.getByRole('button', { name: 'Hide demo' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('hides Log out for a dev-identity sign-in, which has no session to end', () => {
    env.devUserId = '5a9c9e7a-0b8f-4d3a-9d2a-6a4f1e2b3c4d';
    try {
      render(
        <MemoryRouter initialEntries={['/']}>
          <AppShell>Overview</AppShell>
        </MemoryRouter>,
      );
      expect(screen.queryByRole('button', { name: /log out/i })).not.toBeInTheDocument();
    } finally {
      env.devUserId = undefined;
    }
  });

  it('offers Log out when no dev identity is in play', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppShell>Overview</AppShell>
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument();
  });

  it('omits the demo toggle in a production build', () => {
    env.isDev = false;
    env.isProd = true;
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppShell>Overview</AppShell>
      </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: 'Hide demo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show demo' })).not.toBeInTheDocument();
  });
});
