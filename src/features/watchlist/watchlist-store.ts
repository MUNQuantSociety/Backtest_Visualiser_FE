import { z } from 'zod';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * The dashboard watchlist: the strategy universe, plus tickers the person
 * added, minus the ones they removed.
 *
 * Stored as two edits against the universe rather than as a finished list, so
 * a ticker a strategy starts trading later still shows up — a frozen copy of
 * the universe would silently miss it. There is no watchlist endpoint, so the
 * edits live in this browser's localStorage; a future API can replace the
 * store behind the same hook.
 */

export const WATCHLIST_STORAGE_KEY = 'mqs:watchlist:v1';

/** FMP-style symbols: letters, digits, and the `.`/`-` of share classes (BRK.B, BF-B). */
const TICKER_PATTERN = /^[A-Z0-9][A-Z0-9.-]{0,9}$/;

/** Upper-cased and trimmed, or null when it cannot be a ticker. */
export function normaliseTicker(raw: string): string | null {
  const ticker = raw.trim().toUpperCase();
  return TICKER_PATTERN.test(ticker) ? ticker : null;
}

const watchlistEditsSchema = z.object({
  added: z.array(z.string()),
  removed: z.array(z.string()),
});
type WatchlistEdits = z.infer<typeof watchlistEditsSchema>;

/**
 * The tickers on the watchlist, in display order: the universe first, in its
 * own order, then additions in the order they were added.
 */
export function resolveWatchlist(universe: readonly string[], edits: WatchlistEdits): string[] {
  const removed = new Set(edits.removed);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const ticker of [...universe, ...edits.added]) {
    if (removed.has(ticker) || seen.has(ticker)) continue;
    seen.add(ticker);
    result.push(ticker);
  }
  return result;
}

interface WatchlistState extends WatchlistEdits {
  add: (ticker: string) => void;
  remove: (ticker: string) => void;
  /** Drops every edit, so the watchlist is the universe again. */
  reset: () => void;
}

export const useWatchlistStore = create<WatchlistState>()(
  persist(
    (set) => ({
      added: [],
      removed: [],

      add: (ticker) => {
        set((state) => ({
          added: state.added.includes(ticker) ? state.added : [...state.added, ticker],
          removed: state.removed.filter((existing) => existing !== ticker),
        }));
      },

      remove: (ticker) => {
        set((state) => ({
          added: state.added.filter((existing) => existing !== ticker),
          // Recorded even for an added ticker: it may also be in the universe.
          removed: state.removed.includes(ticker) ? state.removed : [...state.removed, ticker],
        }));
      },

      reset: () => {
        set({ added: [], removed: [] });
      },
    }),
    {
      name: WATCHLIST_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ added: state.added, removed: state.removed }),
      // localStorage is plain text anyone can edit; a row that does not parse
      // is dropped rather than read without guards.
      merge: (persisted, current) => {
        const parsed = watchlistEditsSchema.safeParse(persisted);
        if (!parsed.success) return current;
        const clean = (tickers: string[]) =>
          tickers.flatMap((ticker) => normaliseTicker(ticker) ?? []);
        return { ...current, added: clean(parsed.data.added), removed: clean(parsed.data.removed) };
      },
    },
  ),
);

/** The watchlist for this universe, plus the actions that edit it. */
export function useWatchlist(universe: readonly string[]) {
  const added = useWatchlistStore((state) => state.added);
  const removed = useWatchlistStore((state) => state.removed);
  const add = useWatchlistStore((state) => state.add);
  const remove = useWatchlistStore((state) => state.remove);
  const reset = useWatchlistStore((state) => state.reset);
  return {
    tickers: resolveWatchlist(universe, { added, removed }),
    isEdited: added.length > 0 || removed.length > 0,
    add,
    remove,
    reset,
  };
}

/** Whether a ticker is on the watchlist, and the action that flips it. */
export function useIsWatched(ticker: string, universe: readonly string[]) {
  const { tickers, add, remove } = useWatchlist(universe);
  const isWatched = tickers.includes(ticker);
  return {
    isWatched,
    toggle: () => {
      if (isWatched) remove(ticker);
      else add(ticker);
    },
  };
}
