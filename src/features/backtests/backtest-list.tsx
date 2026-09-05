import { FlaskConical, WifiOff } from 'lucide-react';

import { EmptyState } from '@/components/common/empty-state';
import { Skeleton } from '@/components/ui/skeleton';

import { BacktestCard } from './backtest-card';
import { useBacktests } from './backtests-api';
import type { BacktestFilters } from './types';

interface BacktestListProps {
  filters?: BacktestFilters;
}

export function BacktestList({ filters = {} }: BacktestListProps) {
  const { data, isPending, isPaused, isError, error } = useBacktests(filters);

  // A paused query is pending *and* not fetching: React Query has detected the
  // browser is offline and is holding the request. Without this branch the user
  // stares at a skeleton indefinitely with no idea why.
  if (isPaused && !data) {
    return (
      <EmptyState
        icon={WifiOff}
        title="You appear to be offline"
        description="Backtests will load automatically once the connection is back."
      />
    );
  }

  if (isPending) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon={FlaskConical}
        title="Could not load backtests"
        description={error.message}
      />
    );
  }

  if (data.items.length === 0) {
    return (
      <EmptyState
        icon={FlaskConical}
        title="No backtests yet"
        description="Run a strategy against historical data to see results here."
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {data.items.map((backtest) => (
        <BacktestCard key={backtest.id} backtest={backtest} />
      ))}
    </div>
  );
}
