import '@/test/storage-global';

import type { Coordinate, MouseEventParams, Time } from 'lightweight-charts';
import type * as ChartsModule from 'lightweight-charts';
import { beforeEach, expect, it, vi } from 'vitest';

import { apiClient } from '@/lib/api-client';
import type * as ApiClientModule from '@/lib/api-client';
import { useUiStore } from '@/lib/ui-store';
import { act, renderWithProviders, screen, userEvent, waitFor } from '@/test/test-utils';

import DashboardPage from './dashboard-page';

// Keep the real ComparisonChart and its effects. Only the canvas library is
// replaced: changing series data can emit a crosshair event without a mouse move.
const chart = vi.hoisted(() => ({
  move: undefined as ((event: MouseEventParams<Time>) => void) | undefined,
  active: false,
  echoes: 0,
  removeSeries: vi.fn(),
  setData: vi.fn(),
  fitContent: vi.fn(),
}));
vi.mock('lightweight-charts', async (importOriginal) => ({
  ...(await importOriginal<typeof ChartsModule>()),
  createChart: () => ({
    applyOptions: vi.fn(),
    addSeries: () => ({ setData: chart.setData }),
    removeSeries: chart.removeSeries,
    timeScale: () => ({ fitContent: chart.fitContent }),
    subscribeCrosshairMove: (callback: typeof chart.move) => {
      chart.move = callback;
    },
    unsubscribeCrosshairMove: vi.fn(),
    subscribeClick: vi.fn(),
    unsubscribeClick: vi.fn(),
    remove: vi.fn(),
  }),
}));
vi.mock('@/config/env', () => ({
  env: { apiBaseUrl: '/api', apiTimeout: 30_000, useFixtures: false, isDev: true, isProd: false },
}));
vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiClientModule>()),
  apiClient: { get: vi.fn() },
}));

const run = {
  id: 'chart-run',
  name: 'Chart run',
  strategyId: 'strategy',
  strategyName: 'Chart strategy',
  symbol: 'AAPL',
  timeframe: '1d',
  status: 'completed',
  startDate: '2025-12-29',
  endDate: '2025-12-31',
  createdAt: '2026-01-01T00:00:00Z',
  initialCapital: 100,
  finalEquity: 120,
  totalReturn: 0.2,
  sharpe: 1,
  maxDrawdown: 0,
};
const points = [
  { date: '2025-12-29', equity: 100, benchmark: 100 },
  { date: '2025-12-30', equity: 110, benchmark: 101 },
  { date: '2025-12-31', equity: 120, benchmark: 102 },
];
const crosshair: MouseEventParams<Time> = {
  time: '2025-12-30',
  point: { x: 100 as Coordinate, y: 80 as Coordinate },
  seriesData: new Map(),
};

beforeEach(() => {
  vi.clearAllMocks();
  chart.active = false;
  chart.echoes = 0;
  useUiStore.setState({ dashboardBenchmark: 'spy', dashboardPeriod: '1y' });
  chart.setData.mockImplementation(() => {
    // Bound the echo so a regression fails an assertion instead of hanging.
    if (chart.active && chart.echoes++ < 10) chart.move?.(crosshair);
  });
  vi.mocked(apiClient.get).mockImplementation((url) => {
    if (url === '/strategies') return Promise.resolve({ items: [], total: 0 });
    if (url === '/backtests')
      return Promise.resolve({ items: [run], total: 1, page: 1, pageSize: 25 });
    if (url === '/backtests/live' || url === '/indicators' || url === '/news') {
      return Promise.resolve({ items: [] });
    }
    if (url === '/market-data/closes') {
      return Promise.resolve({
        ticker: 'SPY',
        points: points.map((p) => ({ date: p.date, close: p.benchmark })),
      });
    }
    if (url.endsWith('/equity'))
      return Promise.resolve({
        id: run.id,
        strategyId: run.strategyId,
        symbol: run.symbol,
        equityCurve: points,
        window: {
          period: '1y',
          requestedStart: '2024-12-31',
          requestedEnd: run.endDate,
          availableStart: run.startDate,
          availableEnd: run.endDate,
        },
      });
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
});

it('keeps chart data unchanged when the crosshair updates dashboard pointer state', async () => {
  renderWithProviders(<DashboardPage />);
  await screen.findByRole('img', { name: 'Strategy comparison' });
  await waitFor(() =>
    expect(chart.setData).toHaveBeenCalledWith([
      { time: '2025-12-29', value: 100 },
      { time: '2025-12-30', value: 101 },
      { time: '2025-12-31', value: 102 },
    ]),
  );
  chart.removeSeries.mockClear();
  chart.setData.mockClear();
  chart.fitContent.mockClear();
  chart.active = true;

  act(() => chart.move?.(crosshair));

  expect(screen.getByRole('region', { name: /Run values/ })).toBeInTheDocument();
  expect(chart.removeSeries).not.toHaveBeenCalled();
  expect(chart.setData).not.toHaveBeenCalled();
  expect(chart.fitContent).not.toHaveBeenCalled();

  // Visibility changes must still redraw the chart, then settle with the
  // crosshair active instead of starting a new redraw on each pointer update.
  await userEvent.click(
    screen.getByRole('checkbox', { name: 'Show Chart strategy on comparison chart' }),
  );
  expect(chart.fitContent).toHaveBeenCalledTimes(1);
});
