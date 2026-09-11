import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router';
import { afterAll, describe, expect, it, vi } from 'vitest';

import { router } from './index';

vi.mock('@/app/root-layout', () => ({ RootLayout: () => <Outlet /> }));
vi.mock('@/pages/dashboard-page', () => ({ default: () => null }));
vi.mock('@/pages/library-page', () => ({ default: () => <h1>Backtests hub</h1> }));

afterAll(() => router.dispose());

describe('Backtests routes', () => {
  it('preserves bookmarked strategy and filter selections from /library', async () => {
    const memory = createMemoryRouter(router.routes, {
      initialEntries: ['/library?strategy=portfolio_1&status=completed&sort=sharpe'],
    });
    render(<RouterProvider router={memory} />);
    await screen.findByRole('heading', { name: 'Backtests hub' });
    await waitFor(() => expect(memory.state.location.pathname).toBe('/backtests'));
    expect(memory.state.location.search).toBe('?strategy=portfolio_1&status=completed&sort=sharpe');
    memory.dispose();
  });
});
