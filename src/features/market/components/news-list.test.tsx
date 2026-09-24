import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient, ApiError } from '@/lib/api-client';
import type * as ApiClientModule from '@/lib/api-client';
import { renderWithProviders, screen, userEvent, waitFor, within } from '@/test/test-utils';

import { newsArticleSchema, type NewsArticle } from '../types';

import { NewsList } from './news-list';

vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClientModule>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

const PUBLISHER_SUMMARY = 'The company guided above consensus for the second half.';

function story(overrides: Record<string, unknown> = {}) {
  return {
    id: '42',
    title: 'Apple beats on revenue, guides higher',
    summary: PUBLISHER_SUMMARY,
    origin: 'publisher',
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(apiClient.get).mockReset();
  vi.mocked(apiClient.get).mockResolvedValue(story());
});

function article(overrides: Partial<Record<keyof NewsArticle, unknown>> = {}): NewsArticle {
  return newsArticleSchema.parse({
    id: '42',
    source: 'reuters.com',
    // 14:30 New York on May 28.
    publishedAt: '2026-05-28T18:30:00+00:00',
    headline: 'Apple beats on revenue',
    summary: 'Apple beats on revenue. The company guided above consensus for the second half.',
    url: 'https://www.reuters.com/markets/apple-beats',
    tickers: ['AAPL'],
    score: 0.4,
    ...overrides,
  });
}

/** jsdom has the element but not the browser's showModal/close methods. */
function mockNativeDialog(): HTMLDialogElement {
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

async function openStory(item: NewsArticle = article()) {
  renderWithProviders(<NewsList articles={[item]} isLoading={false} />);
  const dialog = mockNativeDialog();
  await userEvent.click(screen.getByRole('button', { name: `Open story: ${item.headline}` }));
  return dialog;
}

describe('NewsList story card', () => {
  it('opens the story when a row is clicked', async () => {
    const dialog = await openStory();

    expect(dialog.open).toBe(true);
  });

  it('asks for that story’s own page summary', async () => {
    await openStory();

    expect(apiClient.get).toHaveBeenCalledWith('/news/42/story');
  });

  it('shows the publisher’s summary paragraph, separate from the title', async () => {
    const dialog = await openStory();

    expect(await within(dialog).findByText(PUBLISHER_SUMMARY)).toBeInTheDocument();
    expect(
      within(dialog).getByRole('heading', { name: 'Apple beats on revenue, guides higher' }),
    ).toBeInTheDocument();
  });

  it('shows the list headline while the story loads', async () => {
    vi.mocked(apiClient.get).mockReturnValue(new Promise(() => undefined));

    const dialog = await openStory();

    expect(
      within(dialog).getByRole('heading', { name: 'Apple beats on revenue' }),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Loading summary')).toBeInTheDocument();
  });

  it('says so when no summary could be found, instead of repeating the title', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(story({ summary: null, origin: 'none' }));

    const dialog = await openStory();

    expect(
      await within(dialog).findByText('No summary available for this story.'),
    ).toBeInTheDocument();
  });

  it('says so when the story cannot be loaded', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new ApiError('down', 503, 'error'));

    const dialog = await openStory();

    await waitFor(() => {
      expect(within(dialog).getByText('No summary available for this story.')).toBeInTheDocument();
    });
    expect(
      within(dialog).getByRole('heading', { name: 'Apple beats on revenue' }),
    ).toBeInTheDocument();
  });

  it('shows the publication time on the exchange clock', async () => {
    const dialog = await openStory();

    expect(within(dialog).getByText(/2026-05-28, 14:30 ET/)).toBeInTheDocument();
  });

  it('shows the model score', async () => {
    const dialog = await openStory();

    expect(within(dialog).getByText('+0.40')).toBeInTheDocument();
  });

  it('links to the publisher in a new tab without an opener', async () => {
    const dialog = await openStory();

    const link = within(dialog).getByRole('link', { name: /Read on reuters.com/ });
    expect(link).toHaveAttribute('href', 'https://www.reuters.com/markets/apple-beats');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it.each(['javascript:alert(1)', 'data:text/html,x', 'not a url'])(
    'shows no link for the unsafe address %s',
    async (url) => {
      const dialog = await openStory(article({ url }));

      expect(within(dialog).queryByRole('link')).not.toBeInTheDocument();
    },
  );

  it('draws a larger sentiment bar than the list row', async () => {
    const dialog = await openStory();

    const cardBar = within(dialog).getByTestId('diverging-bar');
    const rowBar = screen.getAllByTestId('diverging-bar').find((bar) => !dialog.contains(bar));
    expect(cardBar.style.width).toBe('260px');
    expect(cardBar.style.height).toBe('12px');
    expect(rowBar?.style.width).toBe('96px');
  });

  it('has no storage note, only the source link', async () => {
    const dialog = await openStory();

    expect(within(dialog).queryByText(/Stored excerpt/)).not.toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: /Read on reuters.com/ })).toBeInTheDocument();
  });

  it('closes from the close button', async () => {
    const dialog = await openStory();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Close story' }));

    expect(dialog.open).toBe(false);
  });

  it('loads the story that was clicked', async () => {
    const second = article({ id: '43', headline: 'Microsoft slips' });
    vi.mocked(apiClient.get).mockResolvedValue(story({ id: '43', title: 'Microsoft slips' }));
    renderWithProviders(<NewsList articles={[article(), second]} isLoading={false} />);
    const dialog = mockNativeDialog();

    await userEvent.click(screen.getByRole('button', { name: 'Open story: Microsoft slips' }));

    expect(apiClient.get).toHaveBeenCalledWith('/news/43/story');
    expect(within(dialog).getByRole('heading', { name: 'Microsoft slips' })).toBeInTheDocument();
  });
});
