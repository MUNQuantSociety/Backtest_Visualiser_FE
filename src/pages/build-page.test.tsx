import { beforeEach, expect, it, vi } from 'vitest';

import type * as BacktestsModule from '@/features/backtests';
import type * as MarketModule from '@/features/market';
import type * as StrategiesModule from '@/features/strategies';
import { apiClient, ApiError } from '@/lib/api-client';
import type * as ApiClientModule from '@/lib/api-client';
import { renderWithProviders, screen, userEvent } from '@/test/test-utils';

import BuildPage from './build-page';

vi.mock('@/config/env', () => ({
  env: { apiBaseUrl: '/api', apiTimeout: 30_000, useFixtures: false, isDev: false, isProd: true },
}));
vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiClientModule>()),
  apiClient: { get: vi.fn(), post: vi.fn() },
}));
vi.mock('@/features/market', async (importOriginal) => ({
  ...(await importOriginal<typeof MarketModule>()),
  CandleChart: ({
    candles,
    lines = [],
  }: {
    candles: readonly unknown[];
    lines?: readonly { label: string; pane: string; points: readonly unknown[] }[];
  }) => (
    <div>
      {candles.length} candles drawn
      {lines.map((line) => (
        <span key={line.label}>
          {' '}
          {line.label} on the {line.pane} pane with {line.points.length} points
        </span>
      ))}
    </div>
  ),
}));
// The editor and run dialog have their own tests; here they only need to be present.
vi.mock('@/features/strategies', async (importOriginal) => ({
  ...(await importOriginal<typeof StrategiesModule>()),
  RuleBuilder: ({ ticker }: { ticker?: string }) => <div>Rule builder for {ticker || 'none'}</div>,
  StrategyEditor: () => <div>Strategy editor</div>,
}));
vi.mock('@/features/backtests', async (importOriginal) => ({
  ...(await importOriginal<typeof BacktestsModule>()),
  RunBacktestDialog: () => <button type="button">Run backtest</button>,
}));

const CANDLE = { date: '2026-03-02', open: 1, high: 2, low: 0.5, close: 1.5, volume: 100 };

beforeEach(() => {
  vi.clearAllMocks();
});

it('asks for a ticker before charting anything', () => {
  renderWithProviders(<BuildPage />, { routes: ['/build'] });

  expect(screen.getByText('Search for a ticker')).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: 'Search ticker' })).toBeInTheDocument();
  expect(screen.getByText('Rule builder for none')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Run backtest' })).toBeInTheDocument();
  expect(apiClient.get).not.toHaveBeenCalledWith('/market-data/candles', expect.anything());
});

it('charts the ticker in the URL', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ ticker: 'AAPL', candles: [CANDLE] });

  renderWithProviders(<BuildPage />, { routes: ['/build?ticker=aapl'] });

  expect(await screen.findByText('1 candles drawn')).toBeInTheDocument();
  expect(screen.getByText('AAPL daily candles')).toBeInTheDocument();
  expect(apiClient.get).toHaveBeenCalledWith(
    '/market-data/candles',
    expect.objectContaining({ params: expect.objectContaining({ ticker: 'AAPL' }) }),
  );
});

it('says when FMP has no such symbol', async () => {
  vi.mocked(apiClient.get).mockRejectedValue(new ApiError('Not found', 404, 'ERR_BAD_REQUEST'));

  renderWithProviders(<BuildPage />, { routes: ['/build?ticker=ZZZZ'] });

  expect(await screen.findByText('FMP has no history for ZZZZ')).toBeInTheDocument();
});

it('opens on the no-code builder and switches to the code editor', async () => {
  renderWithProviders(<BuildPage />, { routes: ['/build'] });

  await userEvent.click(screen.getByRole('radio', { name: 'Write code' }));

  expect(screen.getByText('Strategy editor')).toBeInTheDocument();
  expect(screen.queryByText(/Rule builder/)).not.toBeInTheDocument();
});

it('hands the charted ticker to the builder', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ ticker: 'NVDA', candles: [CANDLE] });

  renderWithProviders(<BuildPage />, { routes: ['/build?ticker=nvda'] });

  expect(await screen.findByText('Rule builder for NVDA')).toBeInTheDocument();
});

it('draws an FMP indicator the reader adds, on its own pane', async () => {
  vi.mocked(apiClient.get).mockImplementation((url, config) => {
    if (url === '/market-data/indicator-series') {
      const params = (config as { params: { indicator: string; period: number } }).params;
      return Promise.resolve({
        ticker: 'AAPL',
        indicator: params.indicator,
        period: params.period,
        points: [{ date: '2026-03-02', value: 55.5 }],
      });
    }
    if (url === '/market-data/candles')
      return Promise.resolve({ ticker: 'AAPL', candles: [CANDLE] });
    return new Promise(() => undefined);
  });
  renderWithProviders(<BuildPage />, { routes: ['/build?ticker=AAPL'] });
  await screen.findByText(/1 candles drawn/);

  await userEvent.selectOptions(
    screen.getByRole('combobox', { name: 'Indicators' }),
    'RSI (overbought / oversold)',
  );
  await userEvent.click(screen.getByRole('button', { name: 'Add' }));

  expect(await screen.findByText(/RSI 14 on the separate pane with 1 points/)).toBeInTheDocument();
  expect(apiClient.get).toHaveBeenCalledWith(
    '/market-data/indicator-series',
    expect.objectContaining({
      params: expect.objectContaining({ ticker: 'AAPL', indicator: 'rsi', period: 14 }),
    }),
  );

  await userEvent.click(screen.getByRole('button', { name: 'Remove RSI 14' }));
  expect(screen.queryByText(/RSI 14 on the/)).not.toBeInTheDocument();
});
