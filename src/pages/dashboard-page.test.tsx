import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { backtestKeys, type BacktestSummary } from '@/features/backtests';
import type { ComparisonSeries } from '@/features/performance';
import { ApiError, apiClient } from '@/lib/api-client';
import type * as ApiClientModule from '@/lib/api-client';
import {
  act,
  render,
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
  within,
} from '@/test/test-utils';

import DashboardPage from './dashboard-page';

vi.mock('@/config/env', () => ({
  env: { apiBaseUrl: '/api', apiTimeout: 30_000, useFixtures: false, isDev: false, isProd: true },
}));
vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClientModule>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});
vi.mock('@/features/performance', () => ({
  ComparisonChart: ({
    series,
    showSeriesLabels,
  }: {
    series: ComparisonSeries[];
    showSeriesLabels: boolean;
  }) => (
    <div data-testid="comparison-chart" data-show-labels={String(showSeriesLabels)}>
      {series.map((line) => (
        <span key={line.id} data-series-id={line.id}>
          {line.title}
        </span>
      ))}
    </div>
  ),
  RiskReturnScatter: ({ backtests }: { backtests: BacktestSummary[] }) => (
    <div data-testid="run-scatter">{backtests.map((run) => run.name).join(', ')}</div>
  ),
}));

const run = {
  id: 'saved-run',
  name: 'Saved user run',
  strategyId: 'current',
  strategyName: 'Current strategy',
  symbol: 'AAPL',
  timeframe: '1d',
  status: 'completed',
  startDate: '2025-01-01',
  endDate: '2025-12-31',
  createdAt: '2026-01-01T00:00:00Z',
  initialCapital: 100_000,
  finalEquity: 100_000,
  totalReturn: 0,
  sharpe: 0,
  maxDrawdown: 0,
};
const strategy = {
  id: 'current',
  name: 'Current strategy',
  className: 'CurrentStrategy',
  description: '',
  status: 'active',
  tags: [],
  parameters: [],
  universe: ['AAPL'],
  runCount: 1,
  bestSharpe: 0,
  bestReturn: 0,
  lastRunAt: '2026-01-01T00:00:00Z',
};
const runPage = { items: [run], total: 1, page: 1, pageSize: 25 };
const strategiesPage = { items: [strategy], total: 1 };
const timeout = () => new ApiError('The request timed out.', 0, 'ECONNABORTED');

function deferred() {
  let resolve!: (value: unknown) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function tile(label: string) {
  return within(screen.getByText(label).closest('[data-slot="card"]') as HTMLElement);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(apiClient.get).mockImplementation((url) => {
    if (url === '/strategies') return Promise.resolve(strategiesPage);
    if (url === '/backtests') return Promise.resolve(runPage);
    if (url.endsWith('/equity')) return Promise.reject(timeout());
    if (url === '/indicators' || url === '/news') return Promise.resolve({ items: [] });
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
});

describe('Dashboard request isolation', () => {
  it('keeps loaded runs visible while strategies wait, fail, and recover through their own retry', async () => {
    const pending = deferred();
    const initial = vi.mocked(apiClient.get).getMockImplementation()!;
    vi.mocked(apiClient.get).mockImplementation((url, config) =>
      url === '/strategies' ? pending.promise : initial(url, config),
    );
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByRole('link', { name: /Saved user run/ })).toBeInTheDocument();
    expect(screen.getByTestId('run-scatter')).toHaveTextContent('Saved user run');
    act(() => {
      pending.reject(timeout());
    });
    expect(await screen.findByRole('button', { name: 'Retry strategies' })).toBeEnabled();
    expect(screen.getByRole('link', { name: /Saved user run/ })).toBeInTheDocument();
    expect(screen.getByText(/Could not load strategies:/)).toHaveTextContent(
      'The request timed out.',
    );
    expect(screen.getByRole('button', { name: 'Run backtest' })).toBeInTheDocument();
    expect(tile('Active strategies').getByText('—')).toBeInTheDocument();
    vi.mocked(apiClient.get).mockImplementation(initial);
    await userEvent.click(screen.getByRole('button', { name: 'Retry strategies' }));
    await waitFor(() => expect(tile('Active strategies').getByText('1')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Retry strategies' })).not.toBeInTheDocument();
    expect(
      vi.mocked(apiClient.get).mock.calls.filter(([url]) => url === '/backtests'),
    ).toHaveLength(1);
  });

  it('renders the strategy count and universe while run history waits and after it fails', async () => {
    const pending = deferred();
    const initial = vi.mocked(apiClient.get).getMockImplementation()!;
    vi.mocked(apiClient.get).mockImplementation((url, config) =>
      url === '/backtests' ? pending.promise : initial(url, config),
    );
    renderWithProviders(<DashboardPage />);
    await waitFor(() => expect(tile('Active strategies').getByText('1')).toBeInTheDocument());
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    act(() => {
      pending.reject(timeout());
    });
    expect(await screen.findByRole('button', { name: 'Retry run history' })).toBeEnabled();
    expect(tile('Active strategies').getByText('1')).toBeInTheDocument();
    expect(tile('Book Sharpe').getByText('—')).toBeInTheDocument();
    expect(screen.queryByText('No runs yet.')).not.toBeInTheDocument();
    expect(
      screen.queryByText('No completed-run observations in this window.'),
    ).not.toBeInTheDocument();
  });

  it('ends skeletons on a full outage and allows either failed request to retry independently', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(timeout());
    const { container } = renderWithProviders(<DashboardPage />);
    expect(await screen.findByRole('button', { name: 'Retry run history' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Retry strategies' })).toBeEnabled();
    expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument();
    expect(screen.queryByText('No runs yet.')).not.toBeInTheDocument();
    const pending = deferred();
    vi.mocked(apiClient.get).mockReturnValue(pending.promise);
    await userEvent.click(screen.getByRole('button', { name: 'Retry strategies' }));
    expect(screen.getByRole('button', { name: 'Retry run history' })).toBeEnabled();
  });

  it('does not leave disabled market queries loading when the strategy universe is empty', async () => {
    vi.mocked(apiClient.get).mockImplementation((url) =>
      Promise.resolve(
        url === '/strategies' ? { items: [], total: 0 } : { ...runPage, items: [], total: 0 },
      ),
    );
    const { container } = renderWithProviders(<DashboardPage />);
    expect(await screen.findByText('No runs yet.')).toBeInTheDocument();
    expect(screen.getByText('No scored articles.')).toBeInTheDocument();
    expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument();
    expect(vi.mocked(apiClient.get).mock.calls.map(([url]) => url)).not.toContain('/indicators');
  });

  it('marks book metrics unavailable when one equity query fails while another is still pending', async () => {
    const pending = deferred();
    const initial = vi.mocked(apiClient.get).getMockImplementation()!;
    vi.mocked(apiClient.get).mockImplementation((url, config) => {
      if (url === '/strategies')
        return Promise.resolve({ items: [strategy, { ...strategy, id: 'second' }], total: 2 });
      if (url === '/backtests')
        return Promise.resolve({
          ...runPage,
          items: [run, { ...run, id: 'second-run', strategyId: 'second' }],
          total: 2,
        });
      if (url === '/backtests/second-run/equity') return pending.promise;
      return initial(url, config);
    });
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByText('Book history unavailable.')).toBeInTheDocument();
    expect(tile('Book Sharpe').getByText('—')).toBeInTheDocument();
    expect(screen.queryByTestId('comparison-chart')).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Saved user run/ })).toHaveLength(2);
  });

  it('preserves cached run history with a refresh warning when refreshing it fails', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(backtestKeys.completeList(), runPage);
    const initial = vi.mocked(apiClient.get).getMockImplementation()!;
    vi.mocked(apiClient.get).mockImplementation((url, config) =>
      url === '/backtests' ? Promise.reject(timeout()) : initial(url, config),
    );
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText(/Could not refresh run history:/)).toHaveTextContent(
      'Showing previously loaded data.',
    );
    expect(screen.getByRole('link', { name: /Saved user run/ })).toBeInTheDocument();
    expect(screen.getByTestId('run-scatter')).toHaveTextContent('Saved user run');
  });
});

describe('Dashboard saved run comparison', () => {
  it('shows every page and keeps same-strategy and unlisted-strategy runs as separate named curves', async () => {
    const savedRuns = Array.from({ length: 26 }, (_, index) => ({
      ...run,
      id: `run-${index}`,
      name: index === 0 ? 'temp' : index === 1 ? 'neo' : `Run ${index}`,
      strategyId: index === 25 ? 'archived-strategy' : 'current',
      sharpe: index,
    }));
    const initial = vi.mocked(apiClient.get).getMockImplementation()!;
    vi.mocked(apiClient.get).mockImplementation((url, config) => {
      if (url === '/backtests') {
        const page = (config?.params as { page: number }).page;
        return Promise.resolve({
          items: savedRuns.slice((page - 1) * 25, page * 25),
          total: 26,
          page,
          pageSize: 25,
        });
      }
      if (url.endsWith('/equity')) {
        const id = url.split('/')[2];
        const saved = savedRuns.find((item) => item.id === id)!;
        return Promise.resolve({
          id,
          strategyId: saved.strategyId,
          symbol: saved.symbol,
          equityCurve: [
            { date: '2025-12-29', equity: 100, benchmark: 100 },
            { date: '2025-12-30', equity: 101, benchmark: 102 },
            { date: '2025-12-31', equity: 103, benchmark: 103 },
          ],
          window: {
            period: '1y',
            requestedStart: '2024-12-31',
            requestedEnd: '2025-12-31',
            availableStart: '2025-12-29',
            availableEnd: '2025-12-31',
          },
        });
      }
      return initial(url, config);
    });
    renderWithProviders(<DashboardPage />);
    const chart = await screen.findByTestId('comparison-chart');
    await waitFor(() => expect(chart.querySelectorAll('[data-series-id]')).toHaveLength(26));
    expect(chart).toHaveAttribute('data-show-labels', 'false');
    expect(screen.getByRole('region', { name: 'Scrollable run alpha table' })).toHaveAttribute(
      'tabindex',
      '0',
    );
    expect(within(chart).getByText('temp')).toBeInTheDocument();
    expect(within(chart).getByText('neo')).toBeInTheDocument();
    expect(within(chart).getByText('Run 25')).toBeInTheDocument();
    const alpha = within(screen.getByRole('table', { name: 'Run alpha metrics' }));
    expect(alpha.getByRole('link', { name: 'temp' })).toHaveAttribute('href', '/backtests/run-0');
    expect(alpha.getByRole('link', { name: 'neo' })).toHaveAttribute('href', '/backtests/run-1');
    expect(alpha.getAllByRole('row')).toHaveLength(27);
    expect(screen.getByTestId('run-scatter')).toHaveTextContent('Run 25');
    const history = screen.getByText('All saved runs').closest('[data-slot="card"]') as HTMLElement;
    expect(within(history).getAllByRole('link')).toHaveLength(27); // 26 runs and library link
    expect(
      vi.mocked(apiClient.get).mock.calls.filter(([url]) => url === '/backtests'),
    ).toHaveLength(2);
    expect(screen.queryByText(/with observations in this window/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Available observations:/)).not.toBeInTheDocument();
  });
});
