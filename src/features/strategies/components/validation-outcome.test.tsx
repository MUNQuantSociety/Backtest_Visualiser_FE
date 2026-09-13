import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@/lib/api-client';
import type * as ApiClientModule from '@/lib/api-client';
import { renderWithProviders, screen } from '@/test/test-utils';

import type { StrategySubmissionResult } from '../types';

import { ValidationOutcome } from './validation-outcome';

/**
 * A save answers `draft` and starts a validation run. Everything that matters
 * to the author happens after that, so these cover the run's outcomes — a
 * failure above all, because the strategy then drops out of the catalogue and
 * used to leave no trace at all.
 */

vi.mock('@/config/env', () => ({
  env: { apiBaseUrl: '/api', apiTimeout: 30_000, useFixtures: false, isDev: false, isProd: true },
}));

vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClientModule>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

const get = vi.mocked(apiClient.get);

const RUN_ID = '30593cec-46fb-488d-9ba8-46d63efb28d5';

const SAVED: StrategySubmissionResult = {
  id: 'user-test-b0a184b1',
  name: 'test',
  status: 'draft',
  message: 'Validation started.',
  validationRunId: RUN_ID,
};

function run(status: string, errorMessage: string | null = null) {
  return {
    id: RUN_ID,
    name: 'validation',
    strategyId: 'user-test-b0a184b1',
    strategyName: 'test',
    symbol: 'MULTI',
    timeframe: '1d',
    status,
    startDate: '2026-09-01',
    endDate: '2026-09-10',
    createdAt: '2026-09-11T23:26:24Z',
    initialCapital: 100_000,
    finalEquity: 100_000,
    totalReturn: 0,
    sharpe: 0,
    maxDrawdown: 0,
    metrics: {
      totalReturn: 0,
      cagr: 0,
      sharpe: 0,
      sortino: 0,
      maxDrawdown: 0,
      volatility: 0,
      winRate: 0,
      profitFactor: 0,
      totalTrades: 0,
    },
    equityCurve: [],
    trades: [],
    parameters: {},
    progressPct: null,
    errorMessage,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('ValidationOutcome', () => {
  it('reports a failed validation as an alert, tagged, with the engine error', async () => {
    get.mockResolvedValue(
      run(
        'failed',
        "UserStrategyError: strategy.py failed while being imported (NameError: name 'BasePortfolio' is not defined)",
      ),
    );

    renderWithProviders(<ValidationOutcome result={SAVED} />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Validation failed/);
    expect(alert).toHaveTextContent(/saved as a draft/i);
    expect(alert).toHaveTextContent(/failed validation/);
    // The engine's own words, verbatim: this is the only place the author is
    // told why, and paraphrasing a NameError helps nobody.
    expect(alert).toHaveTextContent(/NameError: name 'BasePortfolio' is not defined/);
    expect(screen.getByRole('link', { name: /Open the validation run/ })).toHaveAttribute(
      'href',
      `/backtests/${RUN_ID}`,
    );
  });

  it('says a passing run made the strategy active', async () => {
    get.mockResolvedValue(run('completed'));

    renderWithProviders(<ValidationOutcome result={SAVED} />);

    // Waiting on the text, not on `role="status"`: the pending panel carries
    // that role too, so the role alone matches before the query resolves.
    expect(await screen.findByText(/passed validation and is active/)).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows progress while the run is still going, without alerting', async () => {
    get.mockResolvedValue(run('running'));

    renderWithProviders(<ValidationOutcome result={SAVED} />);

    expect(await screen.findByRole('status')).toHaveTextContent(/Validating/);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('still explains itself when no validation run was started', () => {
    renderWithProviders(
      <ValidationOutcome
        result={{ ...SAVED, validationRunId: null, message: 'Worker offline.' }}
      />,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/Saved as a draft, not validated/);
    expect(alert).toHaveTextContent(/Worker offline/);
    expect(get).not.toHaveBeenCalled();
  });

  it('falls back to plain language when a failure recorded no reason', async () => {
    get.mockResolvedValue(run('failed', null));

    renderWithProviders(<ValidationOutcome result={SAVED} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/No reason was recorded/);
  });
});
