import { beforeEach, expect, it, vi } from 'vitest';

import { apiClient, ApiError } from '@/lib/api-client';
import type * as ApiClientModule from '@/lib/api-client';
import { renderWithProviders, screen, userEvent } from '@/test/test-utils';

import ComparePage from './compare-page';

vi.mock('@/config/env', () => ({
  env: { apiBaseUrl: '/api', apiTimeout: 30_000, useFixtures: false, isDev: false, isProd: true },
}));
vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiClientModule>()),
  apiClient: { get: vi.fn() },
}));
vi.mock('@/features/performance', () => ({
  ComparisonChart: () => <div>Comparison loaded</div>,
  DrawdownOverlay: () => null,
  MonthlyDifferenceHeatmap: () => null,
  RollingSharpeOverlay: () => null,
}));

function run(id: string) {
  return {
    id,
    name: id,
    strategyId: 's',
    strategyName: 'Strategy',
    symbol: 'AAPL',
    timeframe: '1d',
    status: 'completed',
    startDate: '2025-01-01',
    endDate: '2025-12-31',
    createdAt: '2026-01-01T00:00:00Z',
    initialCapital: 100,
    finalEquity: 110,
    totalReturn: 0.1,
    sharpe: 1,
    maxDrawdown: -0.02,
    metrics: {
      totalReturn: 0.1,
      cagr: 0.1,
      sharpe: 1,
      sortino: 2,
      maxDrawdown: -0.02,
      volatility: 0.1,
      winRate: 0.5,
      profitFactor: 1,
      totalTrades: 1,
    },
    equityCurve: [],
    trades: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(apiClient.get).mockImplementation((url) => {
    if (url === '/backtests')
      return Promise.resolve({ items: [run('a'), run('b')], total: 2, page: 1, pageSize: 100 });
    return Promise.resolve(run(url.split('/').at(-1)!));
  });
});

it('deduplicates URL ids before querying and rendering comparison columns', async () => {
  renderWithProviders(<ComparePage />, { routes: ['/compare?runs=a,a'] });
  expect(await screen.findByRole('heading', { name: 'Compare 1 run' })).toBeInTheDocument();
  expect(screen.getByText('One more to compare')).toBeInTheDocument();
  expect(screen.queryByText('Comparison loaded')).not.toBeInTheDocument();
});

it('shows report errors and retries instead of rendering a partial comparison', async () => {
  const get = vi.mocked(apiClient.get).getMockImplementation()!;
  let failed = true;
  vi.mocked(apiClient.get).mockImplementation((url, config) => {
    if (url === '/backtests/b' && failed)
      return Promise.reject(new ApiError('Missing report', 404, 'HTTP_404'));
    return get(url, config);
  });
  renderWithProviders(<ComparePage />, { routes: ['/compare?runs=a,b'] });
  expect(await screen.findByText('Could not load all selected runs')).toBeInTheDocument();
  expect(screen.queryByText('Comparison loaded')).not.toBeInTheDocument();
  failed = false;
  await userEvent.click(screen.getByRole('button', { name: 'Retry comparison' }));
  expect(await screen.findByText('Comparison loaded')).toBeInTheDocument();
});

it('does not confuse an unavailable list with an empty account', async () => {
  vi.mocked(apiClient.get).mockRejectedValue(new ApiError('Forbidden', 403, 'HTTP_403'));
  renderWithProviders(<ComparePage />, { routes: ['/compare'] });
  expect(await screen.findByText('Could not load saved runs')).toBeInTheDocument();
  expect(screen.queryByText('Nothing to compare yet')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Retry saved runs' })).toBeInTheDocument();
});

it('lets a failed run be removed while keeping the available run', async () => {
  const get = vi.mocked(apiClient.get).getMockImplementation()!;
  vi.mocked(apiClient.get).mockImplementation((url, config) =>
    url === '/backtests/b'
      ? Promise.reject(new ApiError('Missing', 404, 'HTTP_404'))
      : get(url, config),
  );
  renderWithProviders(<ComparePage />, { routes: ['/compare?runs=a,b'] });
  await screen.findByText('Could not load all selected runs');
  await userEvent.click(screen.getByRole('button', { name: 'Remove run B' }));
  expect(await screen.findByRole('heading', { name: 'Compare 1 run' })).toBeInTheDocument();
  expect(screen.queryByText('Could not load all selected runs')).not.toBeInTheDocument();
});
