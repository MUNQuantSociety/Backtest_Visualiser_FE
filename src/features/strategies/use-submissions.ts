import { useQueries } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import { fetchBacktest } from '@/features/backtests/data';

import { fetchStrategy } from './strategies-api';
import {
  acknowledgeSubmission,
  forgetSubmission,
  readSubmissions,
  rememberSubmission,
  resolveSubmission,
  SUBMISSIONS_STORAGE_KEY,
  type SubmissionRecord,
} from './submissions';
import type { Strategy } from './types';


/**
 * The uploads this browser is waiting on, kept in step with their runs.
 *
 * Resuming is the whole point: on a cold start the stored list is read back and
 * every entry still marked `pending` is polled again, so a validation that
 * finished while the window was closed is reported the moment it reopens
 * instead of never.
 *
 * Storage is written from here rather than from the component tree so the
 * outcome is recorded even if the author navigates away from the editor — the
 * banner is mounted in the shell, on every page.
 */
const POLL_MS = 4_000;

export function useSubmissions() {
  const [records, setRecords] = useState<SubmissionRecord[]>(() => readSubmissions());

  // Another tab saving a strategy is the same author; its entry belongs in
  // this window's list too.
  useEffect(() => {
    function sync(event: StorageEvent) {
      if (event.key === SUBMISSIONS_STORAGE_KEY) setRecords(readSubmissions());
    }
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('storage', sync);
    };
  }, []);

  const watching = records.filter(
    (record) => record.outcome === 'pending' && record.validationRunId !== null,
  );

  useQueries({
    queries: watching.map((record) => ({
      queryKey: ['backtests', 'detail', record.validationRunId],
      queryFn: () => fetchBacktest(record.validationRunId as string),
      // Stops on its own: once the run is terminal this entry leaves
      // `watching`, so the query is no longer mounted at all.
      refetchInterval: POLL_MS,
      refetchIntervalInBackground: true,
      staleTime: 0,
    })),
    combine: (results) => {
      results.forEach((result, index) => {
        const record = watching[index];
        const status = result.data?.status;
        if (!record || !status) return;
        if (status === 'completed') {
          setRecords(resolveSubmission(record.strategyKey, 'passed'));
        } else if (status === 'failed') {
          setRecords(
            resolveSubmission(
              record.strategyKey,
              'failed',
              result.data?.errorMessage ?? null,
            ),
          );
        }
      });
      return null;
    },
  });

  const remember = useCallback(
    (entry: { strategyKey: string; name: string; validationRunId: string | null }) => {
      setRecords(rememberSubmission({ ...entry, submittedAt: new Date().toISOString() }));
    },
    [],
  );

  const acknowledge = useCallback((strategyKey: string) => {
    setRecords(acknowledgeSubmission(strategyKey));
  }, []);

  const forget = useCallback((strategyKey: string) => {
    setRecords(forgetSubmission(strategyKey));
  }, []);

  return {
    /** Every remembered upload, newest first. */
    records,
    /** Uploads still waiting on their run. */
    pending: records.filter((record) => record.outcome === 'pending'),
    /** The ones worth putting in front of the author right now. */
    unacknowledged: records.filter((record) => !record.acknowledged),
    /** Drafts to show where the catalogue would otherwise show nothing. */
    drafts: records.filter((record) => record.outcome !== 'passed'),
    remember,
    acknowledge,
    forget,
  };
}

/**
 * The strategies behind this browser's uploads, as the server sees them.
 *
 * `GET /strategies` omits anything that has not passed validation, so a failed
 * or still-validating upload is missing from the catalogue the Library renders.
 * These are fetched one key at a time through `GET /strategies/{key}`, which
 * ignores `enabled` for exactly this purpose, and merged in so the row appears
 * as a draft instead of disappearing.
 */
export function useDraftStrategies(): Strategy[] {
  const { drafts } = useSubmissions();

  return useQueries({
    queries: drafts.map((record) => ({
      queryKey: ['strategies', 'detail', record.strategyKey],
      queryFn: () => fetchStrategy(record.strategyKey),
      staleTime: 30_000,
      // A key the server has never heard of is not worth retrying.
      retry: false,
    })),
    combine: (results) => results.flatMap((result) => (result.data ? [result.data] : [])),
  });
}
