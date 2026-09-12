import type { QueryClient } from '@tanstack/react-query';

import {
  backtestKeys,
  dashboardEndDate,
  equityKey,
  fetchBacktestEquity,
  fetchAllBacktests,
} from '@/features/backtests/data';
import { fetchStrategies, strategyKeys } from '@/features/strategies/data';
import { useUiStore } from '@/lib/ui-store';

/**
 * Start API work while the router downloads the dashboard and chart modules.
 * These cache prefetches intentionally outlive transient page subscriptions:
 * consuming their signal lets StrictMode's test unmount abort and restart them.
 * Ordinary page queries retain their navigation cancellation behavior.
 */
export async function prefetchDashboardData(client: QueryClient): Promise<void> {
  try {
    const [, runs] = await Promise.all([
      client.fetchQuery({
        queryKey: strategyKeys.lists(),
        queryFn: () => fetchStrategies(),
      }),
      client.fetchQuery({
        queryKey: backtestKeys.completeList(),
        queryFn: () => fetchAllBacktests(),
      }),
    ]);
    const selected = runs.items.filter((run) => run.status === 'completed');
    const endDate = dashboardEndDate(selected);
    if (!endDate) return;
    const window = { period: useUiStore.getState().dashboardPeriod, endDate };
    await Promise.all(
      selected.map((run) =>
        client.prefetchQuery({
          queryKey: equityKey(run.id, window),
          queryFn: () => fetchBacktestEquity(run.id, window),
          staleTime: Infinity,
        }),
      ),
    );
  } catch {
    // The same query cache carries the error to the page's retry UI.
  }
}
