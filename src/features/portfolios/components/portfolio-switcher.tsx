import { NavLink } from 'react-router';

import { paths } from '@/app/router/paths';
import { cn } from '@/lib/utils';

import { usePortfolios } from '../hooks/use-portfolios';

/**
 * The tab strip from the SvelteKit prototype's `<nav id="portfolios">`, except
 * the tabs come from the API rather than three hardcoded links. Rendering a
 * "Portfolio 3" tab that 404s on click was the prototype's most visible lie.
 */
export function PortfolioSwitcher({ activeId }: { activeId: string | undefined }) {
  const { data } = usePortfolios();
  if (!data) return null;

  return (
    <nav aria-label="Portfolios" className="-mb-px flex gap-1 overflow-x-auto border-b">
      {data.items.map((portfolio) => (
        <NavLink
          key={portfolio.id}
          to={paths.portfolioDetail(portfolio.id)}
          className={cn(
            'border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors',
            portfolio.id === activeId
              ? 'border-primary font-medium text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {portfolio.name}
        </NavLink>
      ))}
    </nav>
  );
}
