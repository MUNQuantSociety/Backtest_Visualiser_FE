import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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

describe('Tools routes', () => {
  it.each([
    ['/tools/screener', 'Stock Screener'],
    ['/tools/calculator', 'Financial Calculator'],
  ])('serves the page at %s', async (path, heading) => {
    const memory = createMemoryRouter(router.routes, { initialEntries: [path] });
    // The calculator fetches Treasury rates, so it needs the app's query client.
    const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queries}>
        <RouterProvider router={memory} />
      </QueryClientProvider>,
    );
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
    memory.dispose();
  });
});
