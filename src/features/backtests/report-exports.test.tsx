import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, apiClient } from '@/lib/api-client';
import type * as ApiClientModule from '@/lib/api-client';
import { saveBlob } from '@/lib/download';
import { renderWithProviders, screen, userEvent, waitFor } from '@/test/test-utils';

import { ReportExports } from './report-exports';
import type { BacktestDetail } from './types';

/**
 * The four downloads a finished run offers.
 *
 * `saveBlob` is mocked rather than exercised: what it does with an object URL
 * is its own unit test's business (`src/lib/download.test.ts`), and what
 * matters here is that the right file is asked for and the right name is
 * handed on.
 */

vi.mock('@/config/env', () => ({
  env: { apiBaseUrl: '/api', apiTimeout: 30_000, useFixtures: false, isDev: false, isProd: true },
}));

vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClientModule>();
  return {
    ...actual,
    apiClient: { ...actual.apiClient, get: vi.fn() },
  };
});

vi.mock('@/lib/download', () => ({ saveBlob: vi.fn() }));

const get = vi.mocked(apiClient.get);
const save = vi.mocked(saveBlob);

const RUN_ID = '80cb98a1-b526-438a-b886-eb988ffa6ce9';

function run(overrides: Partial<BacktestDetail> = {}): BacktestDetail {
  return {
    id: RUN_ID,
    name: 'Volatility Momentum',
    strategyId: 'portfolio_1',
    strategyName: 'Volatility Momentum',
    symbol: 'MULTI',
    timeframe: '1d',
    status: 'completed',
    startDate: '2025-09-10',
    endDate: '2026-09-10',
    createdAt: '2026-09-10T10:00:00Z',
    initialCapital: 100_000,
    finalEquity: 105_536,
    totalReturn: 0.055,
    sharpe: 1.2,
    maxDrawdown: -0.07,
    metrics: {
      totalReturn: 0.055,
      cagr: 0.054,
      sharpe: 1.2,
      sortino: 1.4,
      maxDrawdown: -0.07,
      volatility: 0.11,
      winRate: 0.5,
      profitFactor: 1.3,
      totalTrades: 4,
    },
    equityCurve: [],
    trades: [],
    parameters: {},
    progressPct: null,
    errorMessage: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('ReportExports', () => {
  it('downloads the file the button names, prefixed with the short run id', async () => {
    const blob = new Blob(['date,equity\n'], { type: 'text/csv' });
    get.mockResolvedValue(blob);

    renderWithProviders(<ReportExports run={run()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Equity' }));

    await waitFor(() => {
      expect(get).toHaveBeenCalledTimes(1);
    });
    expect(get).toHaveBeenCalledWith(`/backtests/${RUN_ID}/exports/equity.csv`, {
      responseType: 'blob',
    });
    // The server calls every run's file `equity.csv`; two runs' downloads would
    // then collide in the same folder.
    expect(save).toHaveBeenCalledWith(blob, '80cb98a1-equity.csv');
  });

  it('offers all four exports the backend serves', () => {
    renderWithProviders(<ReportExports run={run()} />);

    for (const label of ['Equity', 'Trades', 'Metrics', 'JSON']) {
      expect(screen.getByRole('button', { name: label })).toBeEnabled();
    }
  });

  it('renders nothing until the run has finished', () => {
    const { container } = renderWithProviders(<ReportExports run={run({ status: 'running' })} />);

    // The endpoint answers 409 before then, and RunStatusBanner is already
    // explaining the wait a few pixels below.
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('explains a 409 in terms of the run rather than the status code', async () => {
    get.mockRejectedValue(new ApiError('Request failed with status code 409', 409, 'HTTP_409'));

    renderWithProviders(<ReportExports run={run()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Trades' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Downloads are ready once the run finishes/,
    );
    expect(save).not.toHaveBeenCalled();
  });
});
