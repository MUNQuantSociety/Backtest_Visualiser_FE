import '@/test/storage-global';

import { beforeEach, describe, expect, it } from 'vitest';

import { perplexityFinanceUrl } from './external-links';
import {
  normaliseTicker,
  resolveWatchlist,
  useWatchlistStore,
  WATCHLIST_STORAGE_KEY,
} from './watchlist-store';

describe('normaliseTicker', () => {
  it('upper-cases and trims a typed symbol', () => {
    expect(normaliseTicker('  nvda ')).toBe('NVDA');
  });

  it('accepts share-class symbols with a dot or a dash', () => {
    expect(normaliseTicker('brk.b')).toBe('BRK.B');
    expect(normaliseTicker('BF-B')).toBe('BF-B');
  });

  it.each(['', '   ', 'AA PL', 'AAPL;DROP', '.AAPL', 'ABCDEFGHIJK'])(
    'rejects %j as not a ticker',
    (raw) => {
      expect(normaliseTicker(raw)).toBeNull();
    },
  );

  it('accepts a ten-character symbol, the longest allowed', () => {
    expect(normaliseTicker('ABCDEFGHIJ')).toBe('ABCDEFGHIJ');
  });
});

describe('resolveWatchlist', () => {
  it('is the universe when nothing was edited', () => {
    expect(resolveWatchlist(['AAPL', 'MSFT'], { added: [], removed: [] })).toEqual([
      'AAPL',
      'MSFT',
    ]);
  });

  it('puts additions after the universe, in the order they were added', () => {
    expect(resolveWatchlist(['AAPL'], { added: ['TSLA', 'NVDA'], removed: [] })).toEqual([
      'AAPL',
      'TSLA',
      'NVDA',
    ]);
  });

  it('leaves out removed tickers', () => {
    expect(resolveWatchlist(['AAPL', 'MSFT'], { added: [], removed: ['AAPL'] })).toEqual(['MSFT']);
  });

  it('lists a ticker once when it is both in the universe and added', () => {
    expect(resolveWatchlist(['AAPL'], { added: ['AAPL'], removed: [] })).toEqual(['AAPL']);
  });

  it('picks up a ticker a strategy starts trading later', () => {
    const edits = { added: ['TSLA'], removed: [] };
    expect(resolveWatchlist(['AAPL', 'AMZN'], edits)).toEqual(['AAPL', 'AMZN', 'TSLA']);
  });
});

describe('useWatchlistStore', () => {
  beforeEach(() => {
    useWatchlistStore.getState().reset();
  });

  it('re-adding a removed universe ticker brings it back', () => {
    const { remove, add } = useWatchlistStore.getState();
    remove('AAPL');
    add('AAPL');

    const state = useWatchlistStore.getState();
    expect(resolveWatchlist(['AAPL'], state)).toEqual(['AAPL']);
  });

  it('removing an added ticker takes it off even if a strategy also trades it', () => {
    const { add, remove } = useWatchlistStore.getState();
    add('TSLA');
    remove('TSLA');

    expect(resolveWatchlist(['TSLA'], useWatchlistStore.getState())).toEqual([]);
  });

  it('reset drops every edit', () => {
    const { add, remove, reset } = useWatchlistStore.getState();
    add('TSLA');
    remove('AAPL');
    reset();

    expect(useWatchlistStore.getState()).toMatchObject({ added: [], removed: [] });
  });

  it('saves edits to localStorage', () => {
    useWatchlistStore.getState().add('TSLA');

    const saved = JSON.parse(localStorage.getItem(WATCHLIST_STORAGE_KEY) ?? '{}') as {
      state?: unknown;
    };
    expect(saved.state).toEqual({ added: ['TSLA'], removed: [] });
  });

  it('ignores a malformed saved watchlist', async () => {
    localStorage.setItem(
      WATCHLIST_STORAGE_KEY,
      JSON.stringify({ state: { added: 'TSLA', removed: null }, version: 0 }),
    );

    await useWatchlistStore.persist.rehydrate();

    expect(useWatchlistStore.getState()).toMatchObject({ added: [], removed: [] });
  });

  it('drops saved entries that are not tickers', async () => {
    localStorage.setItem(
      WATCHLIST_STORAGE_KEY,
      JSON.stringify({ state: { added: ['tsla', '<script>'], removed: [] }, version: 0 }),
    );

    await useWatchlistStore.persist.rehydrate();

    expect(useWatchlistStore.getState().added).toEqual(['TSLA']);
  });
});

describe('perplexityFinanceUrl', () => {
  it('points at the ticker on Perplexity Finance', () => {
    expect(perplexityFinanceUrl('AAPL')).toBe('https://www.perplexity.ai/finance/AAPL');
  });

  it('encodes characters that are not safe in a path', () => {
    expect(perplexityFinanceUrl('A/B')).toBe('https://www.perplexity.ai/finance/A%2FB');
  });
});
