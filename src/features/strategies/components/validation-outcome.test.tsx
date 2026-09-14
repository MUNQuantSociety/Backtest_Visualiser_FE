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

function strategy(validationState: string) {
  return {
    id: 'user-test-b0a184b1',
    name: 'test',
    className: 'UserStrategy',
    description: '',
    status: 'draft',
    tags: ['user'],
    parameters: [],
    universe: ['AAPL'],
    runCount: 0,
    bestSharpe: null,
    bestReturn: null,
    lastRunAt: null,
    indicators: [],
    validationState,
    validationRunId: RUN_ID,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('ValidationOutcome', () => {
  it('reports a failed validation as an alert, tagged, with the engine error', async () => {
    get.mockResolvedValue(strategy('failed_validation'));

    renderWithProviders(<ValidationOutcome result={SAVED} />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Validation failed/);
    expect(alert).toHaveTextContent(/saved as a draft/i);
    expect(alert).toHaveTextContent(/failed validation/);
    expect(alert).toHaveTextContent(/validation run did not pass/i);
    expect(screen.getByRole('link', { name: /Open the validation run/ })).toHaveAttribute(
      'href',
      `/backtests/${RUN_ID}`,
    );
  });

  it('says a passing run made the strategy active', async () => {
    get.mockResolvedValue(strategy('active'));

    renderWithProviders(<ValidationOutcome result={SAVED} />);

    // Waiting on the text, not on `role="status"`: the pending panel carries
    // that role too, so the role alone matches before the query resolves.
    expect(await screen.findByText(/passed validation and is active/)).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows progress while the run is still going, without alerting', async () => {
    get.mockResolvedValue(strategy('validating'));

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
    get.mockResolvedValue(strategy('failed_validation'));

    renderWithProviders(<ValidationOutcome result={SAVED} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/validation run did not pass/i);
  });

  it('does not report an archived strategy as having passed', async () => {
    get.mockResolvedValue(strategy('archived'));

    renderWithProviders(<ValidationOutcome result={SAVED} />);

    // Text, not role: the pending panel is `role="status"` too (see above).
    expect(await screen.findByText(/unexpected state \(archived\)/)).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText(/passed validation/)).not.toBeInTheDocument();
  });

  it('keeps polling after a failed first read and reports the outcome once it can be read', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      get.mockRejectedValueOnce(new Error('registry lag')).mockResolvedValue(strategy('active'));

      renderWithProviders(<ValidationOutcome result={SAVED} />);

      expect(await screen.findByRole('alert')).toHaveTextContent(/could not be read/);
      await vi.advanceTimersByTimeAsync(4_500);
      expect(await screen.findByText(/passed validation and is active/)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
