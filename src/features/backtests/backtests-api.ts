import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';

import { env } from '@/config/env';
import { apiClient } from '@/lib/api-client';

import { fixtureBacktest, fixtureBacktests } from './fixtures';
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

/** Fake latency, so loading states are visible in the demo instead of flashing. */
const FIXTURE_DELAY_MS = 220;

async function withFixtureDelay<T>(value: T): Promise<T> {
    await new Promise((resolve) => setTimeout(resolve, FIXTURE_DELAY_MS));
    return value;
}

export async function fetchBacktests(filters: BacktestFilters = {}) {
    if (env.useFixtures) {
        const all = fixtureBacktests();
        const search = filters.search?.toLowerCase();

        // Filtering happens here rather than in the component so the demo exercises
        // the same round trip the real endpoint will: query in, filtered page out.
        const items = all.filter((item) => {
            if (filters.status && item.status !== filters.status) return false;
            if (filters.strategyId && item.strategyId !== filters.strategyId) return false;
            if (
                search &&
                !`${item.name} ${item.symbol} ${item.strategyName}`.toLowerCase().includes(search)
            ) {
                return false;
            }
            return true;
        });

        const pageSize = filters.pageSize ?? items.length;
        const page = filters.page ?? 1;

        return withFixtureDelay(
            backtestListResponseSchema.parse({
                items: items.slice((page - 1) * pageSize, page * pageSize),
                total: items.length,
                page,
                pageSize,
            }),
        );
    }

    const data = await apiClient.get<unknown>('/backtests', { params: filters });
    return backtestListResponseSchema.parse(data);
}

export async function fetchBacktest(id: string): Promise<BacktestDetail> {
    if (env.useFixtures) {
        return withFixtureDelay(backtestDetailSchema.parse(fixtureBacktest(id)));
    }

    const data = await apiClient.get<unknown>(`/backtests/${encodeURIComponent(id)}`);
    return backtestDetailSchema.parse(data);
}

export async function deleteBacktest(id: string): Promise<void> {
    if (env.useFixtures) return withFixtureDelay(undefined);

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

/**
 * Several backtest details at once, for side-by-side comparison.
 *
 * `useQueries` rather than a bulk endpoint: each detail is already cached
 * individually by `useBacktest`, so opening a run you have compared before is
 * free, and adding a fourth strategy fetches one payload instead of re-fetching
 * all four.
 */
export function useBacktestDetails(ids: readonly string[]) {
    return useQueries({
        queries: ids.map((id) => ({
            queryKey: backtestKeys.detail(id),
            queryFn: () => fetchBacktest(id),
            staleTime: Number.POSITIVE_INFINITY,
        })),
        combine: (results) => ({
            data: results.flatMap((result) => (result.data ? [result.data] : [])),
            isPending: results.some((result) => result.isPending),
            isError: results.some((result) => result.isError),
        }),
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
