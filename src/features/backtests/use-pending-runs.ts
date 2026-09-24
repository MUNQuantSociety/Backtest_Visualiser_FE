import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { strategyKeys } from '@/features/strategies/keys';
import { ApiError } from '@/lib/api-client';
import { createLogger } from '@/lib/logger';

import {
  backtestKeys,
  fetchBacktest,
  fetchLiveBacktests,
  IN_FLIGHT_POLL_MS,
} from './backtests-api';
import {
  forgetPendingRun,
  PENDING_RUNS_CHANGED_EVENT,
  PENDING_RUNS_STORAGE_KEY,
  readPendingRuns,
  rememberPendingRun,
  type PendingRun,
} from './pending-runs';
import {
  backtestSummarySchema,
  isInFlight,
  type BacktestDetail,
  type BacktestSummary,
} from './types';

const log = createLogger('pending-runs');

/**
 * How often to ask for runs started in other browsers. Slower than the 3s run
 * poll: this only has to notice a run exists, and each one found is then
 * followed at the run poll's pace. Window focus asks again straight away.
 */
const LIVE_RUNS_POLL_MS = 15_000;

/** What a page needs from one pending run's detail query. */
interface RunPoll {
  data: BacktestDetail | undefined;
  error: Error | null;
}

/**
 * Refetches everything that lists runs: the run becomes a row in the history,
 * and its strategy's run count, best Sharpe and last run all move with it.
 * Resolves once the active lists have answered.
 */
function useRefreshLists(): () => Promise<void> {
  const queryClient = useQueryClient();
  return useCallback(async () => {
    // Every mounted pending hook may ask at once; `cancelRefetch: false` lets
    // one fetch per list serve them all instead of each cancelling the last.
    const options = { cancelRefetch: false };
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: backtestKeys.lists() }, options),
      queryClient.invalidateQueries({ queryKey: strategyKeys.lists() }, options),
    ]);
  }, [queryClient]);
}

/** The pending runs in storage, kept current across this tab and others. */
function usePendingStore(): PendingRun[] {
  const [pending, setPending] = useState(() => readPendingRuns());
  const refreshLists = useRefreshLists();
  const shown = useRef(pending);
  useEffect(() => {
    shown.current = pending;
  }, [pending]);

  useEffect(() => {
    let mounted = true;
    function sync() {
      setPending(readPendingRuns());
    }

    // Another tab polling the same run may see it finish first and forget it.
    // That tab refreshed its own lists; this one has to refresh its own before
    // letting the row go, or the run is briefly in neither.
    async function syncFromOtherTab() {
      const remaining = new Set(readPendingRuns().map((run) => run.id));
      const departed = shown.current.filter((run) => !remaining.has(run.id));
      if (departed.length > 0) {
        log.info('pending runs settled in another tab', { ids: departed.map((run) => run.id) });
        try {
          await refreshLists();
        } catch (error) {
          log.warn('could not refresh the run history after another tab settled a run', {
            error,
          });
        }
      }
      if (mounted) sync();
    }
    function onStorage(event: StorageEvent) {
      if (event.key === PENDING_RUNS_STORAGE_KEY) void syncFromOtherTab();
    }

    window.addEventListener('storage', onStorage);
    window.addEventListener(PENDING_RUNS_CHANGED_EVENT, sync);
    return () => {
      mounted = false;
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(PENDING_RUNS_CHANGED_EVENT, sync);
    };
  }, [refreshLists]);

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
  const refreshLists = useRefreshLists();
  // Effects re-run on every poll; one settle per run.
  const settled = useRef(new Set<string>());

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

  // Runs this user started in another browser or device. Each one not already
  // followed is remembered, and from then on it is watched like one started
  // here. A backend without the endpoint just leaves this empty.
  const live = useQuery({
    queryKey: backtestKeys.live(),
    queryFn: ({ signal }) => fetchLiveBacktests(signal),
    refetchInterval: LIVE_RUNS_POLL_MS,
    refetchOnWindowFocus: true,
    retry: false,
  });
  useEffect(() => {
    const followed = new Set(pending.map((run) => run.id));
    for (const summary of live.data ?? []) {
      // A run that just settled here can still be in a list fetched before it
      // finished; watching it again would only settle it twice.
      if (followed.has(summary.id) || settled.current.has(summary.id)) continue;
      log.info('following a run started elsewhere', { id: summary.id });
      rememberPendingRun(summary);
    }
  }, [live.data, pending]);

  useEffect(() => {
    pending.forEach((run, index) => {
      const poll = polls[index];
      if (!poll || settled.current.has(run.id) || !hasSettled(poll)) return;
      settled.current.add(run.id);
      void finish(run.id, poll.data?.status ?? 'missing');
    });
  }, [pending, polls, finish]);

  return useRows(pending, polls);
}

/** Renders nothing; exists so the shell can mount the watch on every page. */
export function PendingRunWatcher() {
  usePendingRuns();
  return null;
}
