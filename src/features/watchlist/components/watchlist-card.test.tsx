import '@/test/storage-global';

import { useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { UniverseRow } from '@/features/backtests';
import { apiClient } from '@/lib/api-client';
import type * as ApiClientModule from '@/lib/api-client';
import { readChartPalette } from '@/lib/chart-theme';
import { renderWithProviders, screen, userEvent, waitFor, within } from '@/test/test-utils';

import { useWatchlistStore } from '../watchlist-store';

import { WatchlistCard } from './watchlist-card';

vi.mock('@/config/env', () => ({
  env: { apiBaseUrl: '/api', apiTimeout: 30_000, useFixtures: false, isDev: false, isProd: true },
}));
vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClientModule>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

const get = vi.mocked(apiClient.get);

const UNIVERSE: UniverseRow[] = [
  { ticker: 'AAPL', strategyIndexes: [0, 1], coverageStart: null },
  { ticker: 'MSFT', strategyIndexes: [0], coverageStart: null },
];
/** Symbols the fake FMP check knows. */
const KNOWN = new Set(['AAPL', 'MSFT', 'NVDA']);

function indicatorsFor(ticker: string) {
  return {
    ticker,
    last: 100,
    change1d: -0.012,
    rsi14: 50,
    macdHistogram: 0,
    smaRegime: 'above',
    momentum20d: 0.05,
    sentiment7d: 0,
    sentimentDelta7d: 0,
    asOf: '2026-09-18',
  };
}

function CurrentPath() {
  return <output aria-label="Current path">{useLocation().pathname}</output>;
}

function renderCard(className?: string) {
  renderWithProviders(
    <>
      <WatchlistCard
        className={className}
        universe={UNIVERSE}
        palette={readChartPalette()}
        isLoading={false}
        isUnavailable={false}
      />
      <CurrentPath />
    </>,
  );
}

function watchlistTickers() {
  return within(screen.getByRole('list', { name: 'Watchlist' }))
    .queryAllByRole('link')
    .map((link) => link.getAttribute('aria-label'));
}

async function addTicker(symbol: string) {
  await userEvent.type(screen.getByLabelText('Add ticker to watchlist'), symbol);
  await userEvent.click(screen.getByRole('button', { name: 'Add' }));
}

beforeEach(() => {
  vi.clearAllMocks();
  useWatchlistStore.getState().reset();
  get.mockImplementation((url, config) => {
    const params = (config?.params ?? {}) as { tickers?: string };
    const tickers = (params.tickers ?? '').split(',').filter(Boolean);
    if (url === '/indicators') return Promise.resolve({ items: tickers.map(indicatorsFor) });
    if (url === '/market-data/validate-tickers') {
      const unknown = tickers.filter((ticker) => !KNOWN.has(ticker));
      return Promise.resolve({
        tickers: tickers.map((ticker) => ({
          ticker,
          status: unknown.includes(ticker) ? 'unknown' : 'valid',
        })),
        unknown,
      });
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
});

describe('WatchlistCard', () => {
  it('starts as the strategy universe', () => {
    renderCard();

    expect(watchlistTickers()).toEqual(['Open AAPL', 'Open MSFT']);
  });

  it('scrolls its rows inside a focusable region, headings included', () => {
    renderCard();

    const region = screen.getByRole('region', { name: 'Watchlist rows' });
    expect(region).toHaveAttribute('tabindex', '0');
    expect(within(region).getByRole('list', { name: 'Watchlist' })).toBeInTheDocument();
    expect(within(region).getByTestId('watchlist-columns')).toBeInTheDocument();
  });

  it('keeps the add-ticker field outside the scrolling rows', () => {
    renderCard();

    const region = screen.getByRole('region', { name: 'Watchlist rows' });
    expect(region).not.toContainElement(screen.getByLabelText('Add ticker to watchlist'));
  });

  it('takes its size from the class the page gives it', () => {
    renderCard('xl:h-0 xl:min-h-full');

    const card = screen.getByRole('list', { name: 'Watchlist' }).closest('[data-slot="card"]');
    expect(card).toHaveClass('xl:h-0', 'xl:min-h-full');
  });

  it('labels each column above the rows', () => {
    renderCard();

    const header = screen.getByTestId('watchlist-columns');
    expect(
      [...header.querySelectorAll('span')].map((cell) => cell.textContent).filter(Boolean),
    ).toEqual(['Ticker', 'Strategies', 'Last', 'Day']);
  });

  it('shows each ticker’s last close and daily change', async () => {
    renderCard();

    const row = screen.getByRole('link', { name: 'Open AAPL' });
    await waitFor(() => expect(row).toHaveTextContent('100.00'));
    expect(row).toHaveTextContent('-1.2%');
    expect(row).not.toHaveTextContent('+5.0%');
  });

  it('shows a dash for the daily change when the backend does not send it', async () => {
    const initial = get.getMockImplementation()!;
    get.mockImplementation(async (url, config) => {
      const data = (await initial(url, config)) as { items?: Record<string, unknown>[] };
      if (url !== '/indicators') return data;
      return { items: (data.items ?? []).map(({ change1d: _dropped, ...row }) => row) };
    });
    renderCard();

    const row = screen.getByRole('link', { name: 'Open AAPL' });
    await waitFor(() => expect(row).toHaveTextContent('100.00'));
    expect(row).toHaveTextContent(/100\.00\s*—$/);
  });

  it('opens the ticker page when a row is clicked', async () => {
    renderCard();

    await userEvent.click(screen.getByRole('link', { name: 'Open MSFT' }));

    expect(screen.getByLabelText('Current path')).toHaveTextContent('/tickers/MSFT');
  });

  it('removes a ticker', async () => {
    renderCard();

    await userEvent.click(screen.getByRole('button', { name: 'Remove AAPL from watchlist' }));

    expect(watchlistTickers()).toEqual(['Open MSFT']);
  });

  it('adds a ticker FMP knows, after the universe', async () => {
    renderCard();

    await addTicker('nvda');

    await waitFor(() =>
      expect(watchlistTickers()).toEqual(['Open AAPL', 'Open MSFT', 'Open NVDA']),
    );
    expect(screen.getByLabelText('Add ticker to watchlist')).toHaveValue('');
  });

  it('refuses a ticker FMP does not know', async () => {
    renderCard();

    await addTicker('ZZZZ');

    expect(await screen.findByRole('alert')).toHaveTextContent('FMP does not know ZZZZ');
    expect(watchlistTickers()).toEqual(['Open AAPL', 'Open MSFT']);
  });

  it('refuses text that cannot be a ticker without asking FMP', async () => {
    renderCard();

    await addTicker('A B');

    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a ticker symbol');
    expect(get.mock.calls.some(([url]) => url === '/market-data/validate-tickers')).toBe(false);
  });

  it('says a ticker is already listed rather than adding it twice', async () => {
    renderCard();

    await addTicker('aapl');

    expect(await screen.findByRole('alert')).toHaveTextContent('AAPL is already on the watchlist');
  });

  it('says so when the FMP check fails, and adds nothing', async () => {
    const initial = get.getMockImplementation()!;
    get.mockImplementation((url, config) =>
      url === '/market-data/validate-tickers'
        ? Promise.reject(new Error('Network Error'))
        : initial(url, config),
    );
    renderCard();

    await addTicker('NVDA');

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not check NVDA right now');
    expect(watchlistTickers()).toEqual(['Open AAPL', 'Open MSFT']);
  });

  it('reset restores the universe after edits', async () => {
    renderCard();
    expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove AAPL from watchlist' }));

    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));

    expect(watchlistTickers()).toEqual(['Open AAPL', 'Open MSFT']);
  });
});
