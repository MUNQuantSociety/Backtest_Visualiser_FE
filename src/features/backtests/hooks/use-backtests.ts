import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { deleteBacktest, fetchBacktest, fetchBacktests } from '../api/backtests-api';
import { backtestKeys } from '../api/query-keys';
import type { BacktestFilters } from '../types/backtest';

/**
 * React Query bindings. Components consume these hooks and never touch the
 * api/ module or the query keys directly, which keeps caching decisions in
 * one place.
 */

export function useBacktests(filters: BacktestFilters = {}) {
  return useQuery({
    queryKey: backtestKeys.list(filters),
    queryFn: () => fetchBacktests(filters),
    // Keeps the previous page on screen while the next one loads instead of
    // flashing a skeleton on every pagination click.
    placeholderData: (previous) => previous,
  });
}

export function useBacktest(id: string | undefined) {
  return useQuery({
    queryKey: backtestKeys.detail(id ?? ''),
    queryFn: () => fetchBacktest(id ?? ''),
    enabled: Boolean(id),
    // A completed backtest never changes, so cache it for the session.
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useDeleteBacktest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteBacktest,
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: backtestKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: backtestKeys.lists() });
    },
  });
}
