import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';

import {
  backtestDetailSchema,
  backtestListResponseSchema,
  type BacktestDetail,
  type BacktestFilters,
} from './types';

/**
 * Transport layer for the backtests feature. Every function returns parsed,
 * validated data — callers get a `BacktestDetail`, never a raw `unknown`.
 * No React here: these stay trivially unit-testable and reusable outside hooks.
 */

export async function fetchBacktests(filters: BacktestFilters = {}) {
  const data = await apiClient.get<unknown>('/backtests', { params: filters });
  return backtestListResponseSchema.parse(data);
}

export async function fetchBacktest(id: string): Promise<BacktestDetail> {
  const data = await apiClient.get<unknown>(`/backtests/${encodeURIComponent(id)}`);
  return backtestDetailSchema.parse(data);
}

export async function deleteBacktest(id: string): Promise<void> {
  await apiClient.delete(`/backtests/${encodeURIComponent(id)}`);
}

export const backtestKeys = {
  all: ['backtests'] as const,
  lists: () => [...backtestKeys.all, 'list'] as const,
  list: (filters: BacktestFilters) => [...backtestKeys.lists(), filters] as const,
  details: () => [...backtestKeys.all, 'detail'] as const,
  detail: (id: string) => [...backtestKeys.details(), id] as const,
  trades: (id: string) => [...backtestKeys.detail(id), 'trades'] as const,
} as const;

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
