import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@/lib/api-client';
import type * as ApiClientModule from '@/lib/api-client';
import { fireEvent, renderWithProviders, screen, userEvent, waitFor } from '@/test/test-utils';

import { RunBacktestForm } from './run-backtest-form';

/**
 * The dates are the part of this form worth testing.
 *
 * Market data ends weeks behind the calendar, so a picker bounded by today
 * offers windows with no prices in them. These assert that the bounds and the
 * defaults come from the chosen strategy's coverage and follow it when the
 * strategy changes.
 */

vi.mock('@/config/env', () => ({
  env: { apiBaseUrl: '/api', apiTimeout: 30_000, useFixtures: false, isDev: false, isProd: true },
}));

vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClientModule>();
  return {
    ...actual,
    apiClient: { ...actual.apiClient, get: vi.fn(), post: vi.fn() },
  };
});

const get = vi.mocked(apiClient.get);
const post = vi.mocked(apiClient.post);

function strategy(id: string, name: string, status = 'active') {
  return {
    id,
    name,
    className: name,
    description: '',
    status,
    tags: [],
    parameters: [],
    universe: ['AAPL'],
    runCount: 0,
    bestSharpe: null,
    bestReturn: null,
    lastRunAt: null,
  };
}

const NAMES: Record<string, string> = {
  portfolio_1: 'Vol Momentum',
  portfolio_2: 'Mean Reversion',
  portfolio_3: 'Broken Universe',
};

const COVERAGE = {
  portfolio_1: { tickers: [], start: '2020-01-02', end: '2026-07-15', missing: [] },
  portfolio_2: { tickers: [], start: '2021-03-01', end: '2025-11-07', missing: [] },
  portfolio_3: {
    tickers: [],
    start: null,
    end: null,
    missing: ['NOPE'],
  },
};

beforeEach(() => {
  vi.resetAllMocks();
  get.mockImplementation((url: string, config?: { params?: { strategyKey?: string } }) => {
    if (url === '/strategies') {
      return Promise.resolve({
        items: [
          strategy('portfolio_1', 'Vol Momentum'),
          strategy('portfolio_2', 'Mean Reversion'),
          strategy('portfolio_3', 'Broken Universe'),
          strategy('draft_one', 'Unvalidated Draft', 'draft'),
        ],
        total: 4,
      });
    }
    if (url === '/market-data/coverage') {
      const key = config?.params?.strategyKey ?? '';
      return Promise.resolve(COVERAGE[key as keyof typeof COVERAGE]);
    }
    throw new Error(`unexpected GET ${url}`);
  });
});

/**
 * Submit the form, rather than clicking the button that submits it.
 *
 * `userEvent.click` on a `type="submit"` button does not fire the form's submit
 * event under this jsdom and user-event pairing, though it does in a browser
 * (checked by hand against the running app). Driving the event directly keeps
 * these tests about the form's behaviour instead of about that quirk.
 */
function submitForm() {
  const form = screen.getByRole('button', { name: /run backtest/i }).closest('form');
  expect(form).not.toBeNull();
  fireEvent.submit(form as HTMLFormElement);
}

/** Strategies are radio cards; the accessible name is the card's whole text. */
async function pickStrategy(id: string) {
  const radio = await screen.findByRole('radio', { name: new RegExp(NAMES[id] ?? id) });
  await userEvent.click(radio);
  return radio;
}

describe('RunBacktestForm', () => {
  it('offers only strategies that have passed validation', async () => {
    renderWithProviders(<RunBacktestForm />);

    expect(await screen.findByRole('radio', { name: /Vol Momentum/ })).toBeInTheDocument();
    // A draft has not been proven to run; the backend would refuse it anyway.
    expect(screen.queryByRole('radio', { name: /Unvalidated Draft/ })).not.toBeInTheDocument();
  });

  it('bounds the date inputs by the strategy coverage', async () => {
    renderWithProviders(<RunBacktestForm />);
    await pickStrategy('portfolio_1');

    const start = await screen.findByLabelText('Start');
    await waitFor(() => {
      expect(start).toHaveAttribute('min', '2020-01-02');
    });
    expect(start).toHaveAttribute('max', '2026-07-15');
    expect(screen.getByLabelText('End')).toHaveValue('2026-07-15');
    expect(screen.getByText(/Data runs 2020-01-02 to 2026-07-15/)).toBeInTheDocument();
  });

  it('re-derives the window and universe when the strategy changes', async () => {
    renderWithProviders(<RunBacktestForm />);
    await pickStrategy('portfolio_1');
    await waitFor(() => {
      expect(screen.getByLabelText('End')).toHaveValue('2026-07-15');
    });

    await pickStrategy('portfolio_2');

    // The old dates belonged to the old universe; keeping them would send a
    // window the new one has no prices for.
    await waitFor(() => {
      expect(screen.getByLabelText('End')).toHaveValue('2025-11-07');
    });
    expect(screen.getByLabelText('Start')).toHaveAttribute('min', '2021-03-01');
  });

  it('posts the run with a name derived from the strategy and window, and the extras in params', async () => {
    post.mockResolvedValue({
      id: 'bt-9',
      name: 'Vol Momentum 2025-07-15 to 2026-07-15',
      strategyId: 'portfolio_1',
      strategyName: 'Vol Momentum',
      symbol: 'MULTI',
      timeframe: '1d',
      status: 'queued',
      startDate: '2025-07-15',
      endDate: '2026-07-15',
      createdAt: '2026-09-01T10:00:00Z',
      initialCapital: 100_000,
      finalEquity: 100_000,
      totalReturn: 0,
      sharpe: 0,
      maxDrawdown: 0,
    });

    renderWithProviders(<RunBacktestForm />);
    await pickStrategy('portfolio_1');
    await waitFor(() => {
      expect(screen.getByLabelText('End')).toHaveValue('2026-07-15');
    });

    submitForm();

    await waitFor(() => {
      expect(post).toHaveBeenCalledTimes(1);
    });
    const [url, body] = post.mock.calls[0] ?? [];
    expect(url).toBe('/backtests');
    expect(body).toMatchObject({
      strategyKey: 'portfolio_1',
      endDate: '2026-07-15',
      // A year back from the end, which coverage allows here.
      startDate: '2025-07-15',
      initialCapital: 100_000,
      mode: 'event',
      // The request schema has no fields for these; the record is where the
      // backend is asked to read them, so nothing typed is dropped.
      params: {
        universe: ['AAPL'],
        slippageBps: 5,
        commissionPerShare: 0.005,
        signals: [],
        sentimentGate: { enabled: false, threshold: -0.25 },
      },
    });

    expect(await screen.findByText(/Follow/)).toBeInTheDocument();
  });

  it('carries an added ticker into the universe', async () => {
    post.mockResolvedValue({
      id: 'bt-10',
      name: 'x',
      strategyId: 'portfolio_1',
      strategyName: 'Vol Momentum',
      symbol: 'MULTI',
      timeframe: '1d',
      status: 'queued',
      startDate: '2025-07-15',
      endDate: '2026-07-15',
      createdAt: '2026-09-01T10:00:00Z',
      initialCapital: 100_000,
      finalEquity: 100_000,
      totalReturn: 0,
      sharpe: 0,
      maxDrawdown: 0,
    });

    renderWithProviders(<RunBacktestForm />);
    await pickStrategy('portfolio_1');
    await waitFor(() => {
      expect(screen.getByLabelText('End')).toHaveValue('2026-07-15');
    });

    await userEvent.type(screen.getByLabelText('Add ticker'), 'msft{Enter}');
    expect(screen.getByRole('button', { name: 'Remove MSFT' })).toBeInTheDocument();

    submitForm();
    await waitFor(() => {
      expect(post).toHaveBeenCalledTimes(1);
    });
    expect(post.mock.calls[0]?.[1]).toMatchObject({ params: { universe: ['AAPL', 'MSFT'] } });
  });

  it('refuses to submit when the universe has no data, and says which ticker', async () => {
    renderWithProviders(<RunBacktestForm />);
    await pickStrategy('portfolio_3');

    expect(await screen.findByText(/No market data at all for NOPE/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /run backtest/i })).toBeDisabled();
    expect(post).not.toHaveBeenCalled();
  });

  it('rejects a backwards window without calling the API', async () => {
    renderWithProviders(<RunBacktestForm />);
    await pickStrategy('portfolio_1');
    await waitFor(() => {
      expect(screen.getByLabelText('End')).toHaveValue('2026-07-15');
    });

    await userEvent.clear(screen.getByLabelText('End'));
    await userEvent.type(screen.getByLabelText('End'), '2020-01-03');
    submitForm();

    expect(await screen.findByRole('alert')).toHaveTextContent(/start date has to come before/i);
    expect(post).not.toHaveBeenCalled();
  });
});
