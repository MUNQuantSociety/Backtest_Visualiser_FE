import { Briefcase, WifiOff } from 'lucide-react';

import { EmptyState } from '@/components/common/empty-state';
import { Skeleton } from '@/components/ui/skeleton';

import { usePortfolios } from '../portfolios-api';

import { PortfolioCard } from './portfolio-card';

interface PortfolioListProps {
  /** Cap the number rendered — the overview shows a few, the list page shows all. */
  limit?: number | undefined;
}

export function PortfolioList({ limit }: PortfolioListProps) {
  const { data, isPending, isPaused, isError, error } = usePortfolios();

  // A paused query is pending *and* not fetching: React Query has detected the
  // browser is offline and is holding the request. Without this branch the user
  // stares at a skeleton indefinitely with no idea why.
  if (isPaused && !data) {
    return (
      <EmptyState
        icon={WifiOff}
        title="You appear to be offline"
        description="Portfolios will load automatically once the connection is back."
      />
    );
  }

  if (isPending) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_unused, index) => (
          <Skeleton key={index} className="h-56" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState icon={Briefcase} title="Could not load portfolios" description={error.message} />
    );
  }

  if (data.items.length === 0) {
    return (
      <EmptyState
        icon={Briefcase}
        title="No portfolios configured"
        description="The live engine reports no portfolios. Check that portfolio_manager_config.json assigns capital weights."
      />
    );
  }

  const items = limit === undefined ? data.items : data.items.slice(0, limit);

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((portfolio) => (
        <PortfolioCard key={portfolio.id} portfolio={portfolio} />
      ))}
    </div>
  );
}
