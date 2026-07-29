import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatNumber } from '@/utils/format';

import { usePortfolioExecutions } from '../hooks/use-portfolios';

interface ExecutionLogTableProps {
  portfolioId: string | undefined;
  pageSize?: number | undefined;
}

const timeFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/**
 * "Trade Log" from the prototype. These are fills from `trade_execution_logs`,
 * i.e. single legs — not the round-trip trades the backtests feature shows.
 * The column set differs for that reason; sharing one table component would
 * have forced a lowest-common-denominator schema on both.
 */
export function ExecutionLogTable({ portfolioId, pageSize = 25 }: ExecutionLogTableProps) {
  const { data, isPending, isError, error } = usePortfolioExecutions(portfolioId, { pageSize });

  if (isPending) return <Skeleton className="h-64" />;

  if (isError) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{error.message}</p>;
  }

  if (data.items.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No fills recorded.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Execution log</caption>
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            <th scope="col" className="py-2 pr-4 text-left font-medium">
              Time
            </th>
            <th scope="col" className="py-2 pr-4 text-left font-medium">
              Ticker
            </th>
            <th scope="col" className="py-2 pr-4 text-left font-medium">
              Side
            </th>
            <th scope="col" className="py-2 pr-4 text-right font-medium">
              Quantity
            </th>
            <th scope="col" className="py-2 pr-4 text-right font-medium">
              Price
            </th>
            <th scope="col" className="py-2 pr-4 text-right font-medium">
              Notional
            </th>
            <th scope="col" className="py-2 text-left font-medium">
              Algo
            </th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((execution) => (
            <tr key={execution.id} className="border-b last:border-0">
              <td className="tabular py-2 pr-4 whitespace-nowrap text-muted-foreground">
                {timeFormat.format(new Date(execution.executedAt))}
              </td>
              <th scope="row" className="py-2 pr-4 text-left font-mono font-medium">
                {execution.ticker}
              </th>
              <td className="py-2 pr-4">
                <Badge variant={execution.side === 'BUY' ? 'profit' : 'loss'}>
                  {execution.side}
                </Badge>
              </td>
              <td className="tabular py-2 pr-4 text-right">
                {formatNumber(execution.quantity, 0)}
              </td>
              <td className="tabular py-2 pr-4 text-right">{formatCurrency(execution.price)}</td>
              <td className="tabular py-2 pr-4 text-right">{formatCurrency(execution.notional)}</td>
              <td className="py-2 font-mono text-xs text-muted-foreground">
                {execution.algo ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="pt-3 text-xs text-muted-foreground">
        Showing {data.items.length} of {formatNumber(data.total, 0)} fills.
      </p>
    </div>
  );
}
