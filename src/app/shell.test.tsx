import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

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
