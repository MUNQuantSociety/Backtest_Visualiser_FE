import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient, ApiError } from '@/lib/api-client';
import type * as ApiClientModule from '@/lib/api-client';
import { renderWithProviders, screen } from '@/test/test-utils';

import { RunNewsPanel } from './run-news-panel';

vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClientModule>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

const run = { tickers: ['AAPL', 'MSFT'], start: '2026-05-01', end: '2026-05-29' };

const article = {
  id: '42',
  source: 'reuters.com',
  // 20:30 New York on May 28, already May 29 in UTC.
  publishedAt: '2026-05-29T00:30:00+00:00',
  headline: 'Apple beats on revenue',
  tickers: ['AAPL'],
  score: 0.4,
};

describe('RunNewsPanel', () => {
  beforeEach(() => vi.resetAllMocks());

  it('asks for the run’s tickers and dates', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ items: [article] });

    renderWithProviders(<RunNewsPanel window={run} />);

    expect(await screen.findByText('Apple beats on revenue')).toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledWith('/news', {
      params: { tickers: 'AAPL,MSFT', start: '2026-05-01', end: '2026-05-29', limit: 20 },
    });
  });

  it('dates an article by its New York publication day', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ items: [article] });

    renderWithProviders(<RunNewsPanel window={run} />);

    expect(await screen.findByText('2026-05-28')).toBeInTheDocument();
  });

  it('names the tickers and window it covers', () => {
    vi.mocked(apiClient.get).mockResolvedValue({ items: [] });

    renderWithProviders(<RunNewsPanel window={run} />);

    expect(screen.getByText(/AAPL, MSFT · 2026-05-01 to 2026-05-29/)).toBeInTheDocument();
  });

  it('says so when the window has no articles', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ items: [] });

    renderWithProviders(<RunNewsPanel window={run} />);

    expect(
      await screen.findByText('No scored articles for these tickers in this window.'),
    ).toBeInTheDocument();
  });

  it('shows an error when news cannot be loaded', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new ApiError('down', 503, 'error'));

    renderWithProviders(<RunNewsPanel window={run} />);

    expect(await screen.findByText('News unavailable.')).toBeInTheDocument();
  });

  it('makes no request when the run recorded no tickers', () => {
    renderWithProviders(<RunNewsPanel window={{ ...run, tickers: [] }} />);

    expect(screen.getByText(/did not record which tickers/)).toBeInTheDocument();
    expect(apiClient.get).not.toHaveBeenCalled();
  });
});
