import { useQuery } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { QueryProvider } from './query-provider';

const auth = vi.hoisted(() => ({ id: 'account-a' }));
vi.mock('./auth-provider.context', () => ({
  useAuthCtx: () => ({ authState: { isAuthenticated: true, user: { id: auth.id } } }),
}));
vi.mock('@/app/dashboard-data', () => ({ prefetchDashboardData: vi.fn() }));

function History({ fetchHistory }: { fetchHistory: () => Promise<string> }) {
  const query = useQuery({ queryKey: ['backtests', 'list'], queryFn: fetchHistory });
  return <p>{query.data ?? 'Loading owned runs'}</p>;
}
beforeEach(() => {
  auth.id = 'account-a';
});

describe('per-account query isolation', () => {
  it('does not reuse cached runs for the next account', async () => {
    const a = () => Promise.resolve('Account A saved runs');
    const b = () => new Promise<string>(() => undefined);
    const view = render(
      <QueryProvider>
        <History fetchHistory={a} />
      </QueryProvider>,
    );
    await screen.findByText('Account A saved runs');
    auth.id = 'account-b';
    view.rerender(
      <QueryProvider>
        <History fetchHistory={b} />
      </QueryProvider>,
    );
    expect(screen.queryByText('Account A saved runs')).not.toBeInTheDocument();
    expect(screen.getByText('Loading owned runs')).toBeInTheDocument();
  });

  it('discards a late previous-account response after switching identity', async () => {
    let finishA!: (value: string) => void;
    let finishB!: (value: string) => void;
    const a = () =>
      new Promise<string>((resolve) => {
        finishA = resolve;
      });
    const b = () =>
      new Promise<string>((resolve) => {
        finishB = resolve;
      });
    const view = render(
      <QueryProvider>
        <History fetchHistory={a} />
      </QueryProvider>,
    );
    auth.id = 'account-b';
    view.rerender(
      <QueryProvider>
        <History fetchHistory={b} />
      </QueryProvider>,
    );
    await act(async () => {
      finishA('Account A late response');
      await Promise.resolve();
    });
    expect(screen.queryByText('Account A late response')).not.toBeInTheDocument();
    expect(screen.getByText('Loading owned runs')).toBeInTheDocument();
    await act(async () => {
      finishB('Account B owned runs');
      await Promise.resolve();
    });
    expect(await screen.findByText('Account B owned runs')).toBeInTheDocument();
  });
});
