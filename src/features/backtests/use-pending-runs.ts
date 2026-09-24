import { useQueries, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { strategyKeys } from '@/features/strategies/keys';
import { ApiError } from '@/lib/api-client';
import { createLogger } from '@/lib/logger';

import { backtestKeys, fetchBacktest, IN_FLIGHT_POLL_MS } from './backtests-api';
import {
  forgetPendingRun,
  PENDING_RUNS_CHANGED_EVENT,
  PENDING_RUNS_STORAGE_KEY,
  readPendingRuns,
  type PendingRun,
} from './pending-runs';
import {
  backtestSummarySchema,
  isInFlight,
  type BacktestDetail,
  type BacktestSummary,
} from './types';

const log = createLogger('pending-runs');

/** What a page needs from one pending run's detail query. */
interface RunPoll {
  data: BacktestDetail | undefined;
  error: Error | null;
}

/** The pending runs in storage, kept current across this tab and others. */
function usePendingStore(): PendingRun[] {
  const [pending, setPending] = useState(() => readPendingRuns());

  useEffect(() => {
    function sync() {
      setPending(readPendingRuns());
    }
    function onStorage(event: StorageEvent) {
      if (event.key === PENDING_RUNS_STORAGE_KEY) sync();
    }
    window.addEventListener('storage', onStorage);
    window.addEventListener(PENDING_RUNS_CHANGED_EVENT, sync);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(PENDING_RUNS_CHANGED_EVENT, sync);
    };
  }, []);

  return pending;
}

/** A run the backend answered 404 for will never finish. */
function isGone(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

/** Whether a poll has reached an answer that ends the watch. */
function hasSettled(poll: RunPoll): boolean {
  const status = poll.data?.status;
  return isGone(poll.error) || (status !== undefined && !isInFlight(status));
}

/**
 * The row a pending run shows: its latest poll, or — before the first poll
 * answers — the summary the backend accepted it with, which is `queued`.
 */
function toRow(run: PendingRun, poll: RunPoll | undefined): BacktestSummary {
  // `parse` strips what only a detail carries (curve, trades, metrics).
  return poll?.data ? backtestSummarySchema.parse(poll.data) : run.summary;
}

/** Keeps only what the rows and the settle check read, so it can be compared. */
function toPolls(results: readonly RunPoll[]): RunPoll[] {
  return results.map(({ data, error }) => ({ data, error }));
}

function useRows(pending: readonly PendingRun[], polls: readonly RunPoll[]): BacktestSummary[] {
  return useMemo(() => pending.map((run, index) => toRow(run, polls[index])), [pending, polls]);
}

/**
 * Rows for the runs this browser started that the run history does not list
 * yet: `queued`, then `running`, then `completed` until the saved report
 * replaces it. Merge with `mergeRunRows`.
 *
 * Read-only: it shares the detail queries `usePendingRuns` polls, and neither
 * polls nor settles anything itself, so any number of pages can mount it.
 */
export function usePendingRunRows(): BacktestSummary[] {
  const pending = usePendingStore();
  const polls = useQueries({
    queries: pending.map((run) => ({
      queryKey: backtestKeys.detail(run.id),
      queryFn: ({ signal }: { signal: AbortSignal }) => fetchBacktest(run.id, signal),
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    })),
    combine: toPolls,
  });
  return useRows(pending, polls);
}

/**
 * Keeps polling the runs this browser started until each one finishes, then
 * refreshes everything that lists them.
 *
 * Mounted once, in the shell, so the watch outlives the detail page: leaving a
 * run at 40% for the run history must not mean the row never shows up. The
 * same query key as `useBacktest`, so a detail page that is open shares the
 * fetch rather than doubling it.
 *
 * @returns The same rows as `usePendingRunRows`.
 */
export function usePendingRuns(): BacktestSummary[] {
  const pending = usePendingStore();
  const queryClient = useQueryClient();
  // Effects re-run on every poll; one settle per run.
  const settled = useRef(new Set<string>());

  // The run becomes a row in the history, and its strategy's run count, best
  // Sharpe and last run all move with it. Resolves once active lists refetched.
  const refreshLists = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: backtestKeys.lists() }),
      queryClient.invalidateQueries({ queryKey: strategyKeys.lists() }),
    ]);
  }, [queryClient]);

  const finish = useCallback(
    async (id: string, status: string) => {
      log.info('pending run settled', { id, status });
      try {
        await refreshLists();
      } catch (error) {
        log.warn('could not refresh the run history after a run settled', { id, error });
      }
      // Only now: until the refetched list carries the run, its pending row is
      // what shows it. Forgetting first would drop the row for a moment.
      forgetPendingRun(id);
    },
    [refreshLists],
  );

  const polls = useQueries({
    queries: pending.map((run) => ({
      queryKey: backtestKeys.detail(run.id),
      queryFn: ({ signal }: { signal: AbortSignal }) => fetchBacktest(run.id, signal),
      refetchInterval: (query: { state: RunPoll }) =>
        hasSettled(query.state) ? false : IN_FLIGHT_POLL_MS,
      refetchIntervalInBackground: true,
      staleTime: 0,
    })),
    combine: toPolls,
  });

  useEffect(() => {
    pending.forEach((run, index) => {
      const poll = polls[index];
      if (!poll || settled.current.has(run.id) || !hasSettled(poll)) return;
      settled.current.add(run.id);
      void finish(run.id, poll.data?.status ?? 'missing');
    });
  }, [pending, polls, finish]);

  // Another tab polling the same run may see it finish first and forget it.
  // That tab refreshed its own lists; this one still has to, and it no longer
  // gets a poll of its own to notice from.
  const watched = useRef(new Set(pending.map((run) => run.id)));
  useEffect(() => {
    const remaining = new Set(pending.map((run) => run.id));
    for (const id of watched.current) {
      if (remaining.has(id) || settled.current.has(id)) continue;
      settled.current.add(id);
      log.info('pending run settled', { id, status: 'settled elsewhere' });
      refreshLists().catch((error: unknown) => {
        log.warn('could not refresh the run history after a run settled', { id, error });
      });
    }
    watched.current = remaining;
  }, [pending, refreshLists]);

  return useRows(pending, polls);
}

/** Renders nothing; exists so the shell can mount the watch on every page. */
export function PendingRunWatcher() {
  usePendingRuns();
  return null;
}
