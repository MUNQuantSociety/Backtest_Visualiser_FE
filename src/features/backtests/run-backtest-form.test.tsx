import { useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, apiClient } from '@/lib/api-client';
import type * as ApiClientModule from '@/lib/api-client';
import { installFakeStorage } from '@/test/fake-storage';
import {
  act,
  fireEvent,
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
  within,
} from '@/test/test-utils';

import { RunBacktestDialog } from './run-backtest-dialog';
import { RunBacktestForm } from './run-backtest-form';
import { listRunPresets, saveRunPreset } from './run-presets';

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
    validationState: status,
    validationRunId: null,
    // What this strategy's INDICATORS block declares; the Indicators row
    // highlights these.
    indicators: id === 'portfolio_1' ? ['RateOfChange'] : [],
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
  installFakeStorage();
  vi.spyOn(globalThis, 'scrollTo').mockImplementation(() => undefined);
  get.mockImplementation(
    (url: string, config?: { params?: { strategyKey?: string; tickers?: string } }) => {
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
      if (url === '/strategies/indicators') {
        return Promise.resolve({
          items: [
            { name: 'RateOfChange', parameters: [] },
            { name: 'SimpleMovingAverage', parameters: [] },
          ],
          total: 2,
        });
      }
      if (url === '/market-data/coverage') {
        if (config?.params?.tickers === 'AAPL,MSFT') {
          return Promise.resolve({ ...COVERAGE.portfolio_1, start: '2022-01-03' });
        }
        const key = config?.params?.strategyKey ?? '';
        return Promise.resolve(COVERAGE[key as keyof typeof COVERAGE]);
      }
      if (url === '/market-data/validate-tickers') {
        return Promise.resolve({
          tickers: (config?.params?.tickers ?? '')
            .split(',')
            .map((ticker) => ({ ticker, status: 'valid' })),
          unknown: [],
        });
      }
      throw new Error(`unexpected GET ${url}`);
    },
  );
});

function interceptTickerCheck(ticker: string, response: () => Promise<unknown>) {
  const fallback = get.getMockImplementation()!;
  get.mockImplementation((url, config) => {
    const params = config?.params as { tickers?: string } | undefined;
    if (url === '/market-data/validate-tickers' && params?.tickers === ticker) {
      return response();
    }
    return fallback(url, config);
  });
}

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

function CurrentPath() {
  return <output aria-label="Current path">{useLocation().pathname}</output>;
}

function mockNativeDialog() {
  // jsdom has the element but not the browser's showModal/close methods.
  const dialog = document.querySelector('dialog')!;
  dialog.showModal = () => {
    dialog.open = true;
  };
  dialog.close = () => {
    dialog.open = false;
    dialog.dispatchEvent(new Event('close'));
  };
  return dialog;
}

describe('RunBacktestForm', () => {
  it('does not offer an execution-mode selector', () => {
    renderWithProviders(<RunBacktestForm />);
    expect(screen.queryByRole('radiogroup', { name: 'Run mode' })).not.toBeInTheDocument();
    expect(screen.queryByText('Fast')).not.toBeInTheDocument();
  });
  it('offers only strategies that have passed validation', async () => {
    // Flush the already-resolved mocked query before starting the DOM wait.
    // Cold schema initialization can otherwise exhaust the one-second wait.
    await act(async () => {
      renderWithProviders(<RunBacktestForm />);
      await Promise.resolve();
    });

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

  it('posts the selected inputs and opens the accepted run without a Follow link', async () => {
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

    renderWithProviders(
      <>
        <RunBacktestForm />
        <CurrentPath />
      </>,
    );
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
        sentimentGate: { enabled: false, threshold: -0.25 },
      },
    });
    expect((body as { params: Record<string, unknown> }).params).not.toHaveProperty('signals');

    await waitFor(() => {
      expect(screen.getByLabelText('Current path')).toHaveTextContent('/backtests/bt-9');
    });
    expect(screen.queryByText(/Follow/)).not.toBeInTheDocument();
    expect(globalThis.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' });
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
    expect(await screen.findByRole('button', { name: 'Remove MSFT' })).toBeInTheDocument();

    await waitFor(() => {
      expect(get).toHaveBeenCalledWith('/market-data/coverage', {
        params: { tickers: 'AAPL,MSFT' },
      });
      expect(screen.getByLabelText('Start')).toHaveAttribute('min', '2022-01-03');
      expect(screen.getByRole('button', { name: /run backtest/i })).toBeEnabled();
    });

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

  it('lists the engine’s indicators read-only, highlighting the strategy’s own', async () => {
    renderWithProviders(<RunBacktestForm />);

    const name = await screen.findByText('SimpleMovingAverage');
    expect(name.tagName).toBe('SPAN');
    expect(screen.queryByRole('button', { name: 'SimpleMovingAverage' })).not.toBeInTheDocument();
    expect(screen.getByText(/a run cannot add or remove them/i)).toBeInTheDocument();

    await pickStrategy('portfolio_1');
    await waitFor(() => {
      expect(screen.getByText('RateOfChange').className).toContain('border-primary');
    });
    expect(screen.getByText('SimpleMovingAverage').className).not.toContain('border-primary');
  });

  it('checks a draft before adding it, deduplicates Enter/blur, and blocks submission while pending', async () => {
    let resolve!: (value: unknown) => void;
    const check = vi.fn(
      () =>
        new Promise((accept) => {
          resolve = accept;
        }),
    );
    interceptTickerCheck('MSFT', check);
    renderWithProviders(<RunBacktestForm initialStrategyKey="portfolio_1" />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /run backtest/i })).toBeEnabled(),
    );
    const input = screen.getByLabelText('Add ticker');
    await userEvent.type(input, 'msft{Enter}');
    fireEvent.blur(input);
    expect(check).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Checking MSFT with FMP…')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove MSFT' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /run backtest/i })).toBeDisabled();
    submitForm();
    expect(post).not.toHaveBeenCalled();
    await act(async () => {
      resolve({ tickers: [{ ticker: 'MSFT', status: 'valid' }], unknown: [] });
      await Promise.resolve();
    });
    expect(await screen.findByRole('button', { name: 'Remove MSFT' })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /run backtest/i })).toBeEnabled(),
    );
  });

  it('rejects an unknown draft without changing the universe or selected dates', async () => {
    interceptTickerCheck('XZCER', () =>
      Promise.resolve({ tickers: [{ ticker: 'XZCER', status: 'unknown' }], unknown: ['XZCER'] }),
    );
    renderWithProviders(<RunBacktestForm initialStrategyKey="portfolio_1" />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /run backtest/i })).toBeEnabled(),
    );
    fireEvent.change(screen.getByLabelText('Start'), { target: { value: '2024-01-03' } });
    await userEvent.type(screen.getByLabelText('Add ticker'), 'xzcer{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('XZCER was not found by FMP');
    expect(screen.getByLabelText('Start')).toHaveValue('2024-01-03');
    expect(screen.getByLabelText('End')).toHaveValue('2026-07-15');
    expect(screen.queryByRole('button', { name: 'Remove XZCER' })).not.toBeInTheDocument();
    expect(get.mock.calls.filter(([url]) => url === '/market-data/coverage')).toHaveLength(1);
    submitForm();
    expect(post).not.toHaveBeenCalled();
    await userEvent.clear(screen.getByLabelText('Add ticker'));
    expect(screen.getByRole('button', { name: /run backtest/i })).toBeEnabled();
  });

  it('treats provider failure as retryable verification failure, not an unknown symbol', async () => {
    const check = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('Unavailable', 503, 'UNAVAILABLE'))
      .mockResolvedValue({ tickers: [{ ticker: 'MSFT', status: 'valid' }], unknown: [] });
    interceptTickerCheck('MSFT', check);
    renderWithProviders(<RunBacktestForm initialStrategyKey="portfolio_1" />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /run backtest/i })).toBeEnabled(),
    );
    await userEvent.type(screen.getByLabelText('Add ticker'), 'msft{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not verify MSFT right now');
    expect(screen.queryByText(/was not found/)).not.toBeInTheDocument();
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByRole('button', { name: 'Remove MSFT' })).toBeInTheDocument();
    expect(check).toHaveBeenCalledTimes(2);
  });

  it.each(['edit', 'strategy change'] as const)(
    'ignores a late successful draft check after %s',
    async (action) => {
      let resolve!: (value: unknown) => void;
      interceptTickerCheck(
        'MSFT',
        () =>
          new Promise((accept) => {
            resolve = accept;
          }),
      );
      renderWithProviders(<RunBacktestForm initialStrategyKey="portfolio_1" />);
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /run backtest/i })).toBeEnabled(),
      );
      await userEvent.type(screen.getByLabelText('Add ticker'), 'msft{Enter}');
      const request = get.mock.calls.find(([url, config]) => {
        const params = config?.params as { tickers?: string } | undefined;
        return url === '/market-data/validate-tickers' && params?.tickers === 'MSFT';
      });
      if (action === 'edit') {
        await userEvent.clear(screen.getByLabelText('Add ticker'));
      } else {
        await pickStrategy('portfolio_2');
      }
      expect(request?.[1]?.signal?.aborted).toBe(true);
      await act(async () => {
        resolve({ tickers: [{ ticker: 'MSFT', status: 'valid' }], unknown: [] });
        await Promise.resolve();
      });
      expect(screen.queryByRole('button', { name: 'Remove MSFT' })).not.toBeInTheDocument();
      expect(screen.getByLabelText('Add ticker')).toHaveValue('');
    },
  );

  it('verifies the default strategy universe before permitting a run', async () => {
    let resolve!: (value: unknown) => void;
    interceptTickerCheck(
      'AAPL',
      () =>
        new Promise((accept) => {
          resolve = accept;
        }),
    );
    renderWithProviders(<RunBacktestForm initialStrategyKey="portfolio_1" />);
    await waitFor(() => expect(screen.getByLabelText('End')).toHaveValue('2026-07-15'));
    expect(screen.getByRole('button', { name: /run backtest/i })).toBeDisabled();
    submitForm();
    expect(post).not.toHaveBeenCalled();
    await act(async () => {
      resolve({ tickers: [{ ticker: 'AAPL', status: 'unknown' }], unknown: ['AAPL'] });
      await Promise.resolve();
    });
    expect(await screen.findByText(/FMP did not recognize: AAPL/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /run backtest/i })).toBeDisabled();
  });

  it('can retry an unavailable universe check without discarding the selected window', async () => {
    const check = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('Unavailable', 503, 'UNAVAILABLE'))
      .mockResolvedValue({ tickers: [{ ticker: 'AAPL', status: 'valid' }], unknown: [] });
    interceptTickerCheck('AAPL', check);
    renderWithProviders(<RunBacktestForm initialStrategyKey="portfolio_1" />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ticker verification is unavailable',
    );
    await waitFor(() => expect(screen.getByLabelText('End')).toHaveValue('2026-07-15'));
    await userEvent.click(screen.getByRole('button', { name: 'Retry verification' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /run backtest/i })).toBeEnabled(),
    );
    expect(screen.getByLabelText('End')).toHaveValue('2026-07-15');
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

  it('saves the current configuration as a named preset', async () => {
    renderWithProviders(<RunBacktestForm />);
    await pickStrategy('portfolio_1');
    await waitFor(() => {
      expect(screen.getByLabelText('End')).toHaveValue('2026-07-15');
    });

    await userEvent.click(screen.getByRole('button', { name: 'Save as preset' }));
    await userEvent.clear(screen.getByLabelText('Preset name'));
    await userEvent.type(screen.getByLabelText('Preset name'), 'Momentum snapshot');
    await userEvent.click(screen.getByRole('button', { name: 'Save preset' }));

    expect(await screen.findByText(/Saved "Momentum snapshot"/)).toBeInTheDocument();
    expect(listRunPresets()).toHaveLength(1);
    expect(listRunPresets()[0]).toMatchObject({
      name: 'Momentum snapshot',
      config: {
        strategyKey: 'portfolio_1',
        universe: ['AAPL'],
        startDate: '2025-07-15',
        endDate: '2026-07-15',
        capital: '100000',
        slippageBps: '5',
        commission: '0.005',
      },
    });
  });

  it('loads a saved preset back into the form', async () => {
    saveRunPreset('Mean Reversion window', {
      strategyKey: 'portfolio_2',
      runName: 'Loaded run',
      universe: ['AAPL', 'MSFT'],
      startDate: '2024-01-03',
      endDate: '2025-11-07',
      capital: '50000',
      slippageBps: '8',
      commission: '0.01',
      paramValues: {},
      gateEnabled: false,
      gateThreshold: -0.25,
    });

    renderWithProviders(<RunBacktestForm />);
    await userEvent.click(screen.getByRole('button', { name: /^Presets/ }));
    const loadButton = await screen.findByRole('button', { name: 'Load' });
    await waitFor(() => {
      expect(loadButton).toBeEnabled();
    });
    await userEvent.click(loadButton);

    await waitFor(() => {
      expect(screen.getByLabelText('End')).toHaveValue('2025-11-07');
    });
    expect(screen.getByLabelText('Start')).toHaveValue('2024-01-03');
    expect(screen.getByLabelText('Run name')).toHaveValue('Loaded run');
    expect(screen.getByLabelText('Initial capital')).toHaveValue(50000);
    expect(screen.getByLabelText('Slippage')).toHaveValue(8);
    expect(screen.getByLabelText('Commission')).toHaveValue(0.01);
    expect(screen.getByRole('radio', { name: /Mean Reversion/ })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Remove AAPL' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove MSFT' })).toBeInTheDocument();
    expect(screen.queryByText('Saved presets')).not.toBeInTheDocument();
  });

  it('deletes a saved preset without touching the others', async () => {
    saveRunPreset('Keep me', {
      strategyKey: 'portfolio_1',
      runName: '',
      universe: ['AAPL'],
      startDate: '2025-07-15',
      endDate: '2026-07-15',
      capital: '100000',
      slippageBps: '5',
      commission: '0.005',
      paramValues: {},
      gateEnabled: false,
      gateThreshold: -0.25,
    });
    saveRunPreset('Drop me', {
      strategyKey: 'portfolio_1',
      runName: '',
      universe: ['AAPL'],
      startDate: '2025-01-02',
      endDate: '2026-07-15',
      capital: '100000',
      slippageBps: '5',
      commission: '0.005',
      paramValues: {},
      gateEnabled: false,
      gateThreshold: -0.25,
    });

    renderWithProviders(<RunBacktestForm />);
    await userEvent.click(screen.getByRole('button', { name: /^Presets/ }));
    expect(await screen.findByText('Drop me')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Delete Drop me' }));

    expect(screen.queryByText('Drop me')).not.toBeInTheDocument();
    expect(screen.getByText('Keep me')).toBeInTheDocument();
    expect(listRunPresets().map((preset) => preset.name)).toEqual(['Keep me']);
  });

  it('disables Save as preset until a strategy and a window exist', async () => {
    renderWithProviders(<RunBacktestForm />);
    expect(screen.getByRole('button', { name: 'Save as preset' })).toBeDisabled();

    await pickStrategy('portfolio_1');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save as preset' })).toBeEnabled();
    });
  });

  it('keeps the modal pending, then closes it and opens the exact accepted run', async () => {
    let accept!: (value: unknown) => void;
    post.mockReturnValueOnce(
      new Promise((resolve) => {
        accept = resolve;
      }),
    );
    renderWithProviders(
      <>
        <RunBacktestDialog initialStrategyKey="portfolio_1" />
        <CurrentPath />
      </>,
    );
    const dialog = mockNativeDialog();
    fireEvent.click(screen.getByRole('button', { name: /run backtest/i }));
    expect(screen.getByRole('dialog')).toBe(dialog);
    await waitFor(() => expect(screen.getByLabelText('End')).toHaveValue('2026-07-15'));
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: /run backtest/i })).toBeEnabled(),
    );
    const form = screen.getByLabelText('Run name').closest('form')!;
    fireEvent.submit(form);
    const pendingButton = await screen.findByRole('button', { name: 'Starting backtest…' });
    expect(pendingButton).toBeDisabled();
    expect(dialog).toHaveAttribute('open');
    expect(screen.getByLabelText('Current path')).toHaveTextContent(/^\/$/);
    // Enter/programmatic submit while pending must not start a duplicate run.
    fireEvent.submit(form);
    expect(post).toHaveBeenCalledTimes(1);
    await act(async () => {
      accept({
        id: 'bt-direct',
        name: 'Direct run',
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
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(screen.getByLabelText('Current path')).toHaveTextContent('/backtests/bt-direct');
      expect(dialog).not.toHaveAttribute('open');
    });
    expect(screen.queryByLabelText('Run name')).not.toBeInTheDocument();
  });

  it('keeps the modal and entered values when the API rejects submission', async () => {
    post.mockRejectedValueOnce(new Error('Strategy storage is unavailable'));
    renderWithProviders(
      <>
        <RunBacktestDialog initialStrategyKey="portfolio_1" />
        <CurrentPath />
      </>,
    );
    const dialog = mockNativeDialog();
    fireEvent.click(screen.getByRole('button', { name: /run backtest/i }));
    expect(screen.getByRole('dialog')).toBe(dialog);
    await waitFor(() => expect(screen.getByLabelText('End')).toHaveValue('2026-07-15'));
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: /run backtest/i })).toBeEnabled(),
    );
    fireEvent.change(screen.getByLabelText('Run name'), { target: { value: 'Keep my inputs' } });
    fireEvent.submit(screen.getByLabelText('Run name').closest('form')!);
    expect(await screen.findByRole('alert')).toHaveTextContent('Strategy storage is unavailable');
    expect(dialog).toHaveAttribute('open');
    expect(screen.getByLabelText('Run name')).toHaveValue('Keep my inputs');
    expect(screen.getByLabelText('Current path')).toHaveTextContent(/^\/$/);
    expect(globalThis.scrollTo).not.toHaveBeenCalled();
  });
});
