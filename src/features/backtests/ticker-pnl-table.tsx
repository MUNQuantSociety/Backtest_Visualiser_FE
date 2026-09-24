import { Link } from 'react-router';

import { paths } from '@/app/paths';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatCurrency, formatNumber, formatPercent, formatSigned } from '@/utils/format';
import { toneFromValue } from '@/utils/tone';

import { tickerPnlRows, tickerPnlTotal, type TickerPnlTotal } from './ticker-pnl';
import type { BacktestDetail } from './types';

const toneClass = {
  profit: 'text-[var(--profit)]',
  loss: 'text-[var(--loss)]',
  neutral: '',
} as const;

/**
 * P&L broken down by ticker, above the trade ledger.
 *
 * The ledger lists every lot, which answers "what happened" but not "which
 * tickers made or lost the money" — on a multi-ticker run that meant adding
 * up rows by hand. This rolls the same lots up per ticker, with a total row
 * that matches the ledger's own sums.
 */
export function TickerPnlTable({
  detail,
  isLoading = false,
}: {
  detail: BacktestDetail | undefined;
  isLoading?: boolean;
}) {
  const rows = tickerPnlRows(detail?.trades ?? []);
  const total = tickerPnlTotal(rows);

  return (
    <Card>
      <CardHeader>
        <CardTitle>P&amp;L by ticker</CardTitle>
        <CardDescription>
          Realized P&amp;L counts closed trades only; fees count every lot, open ones included. Net
          is realized minus fees. Best ticker first.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-32" />
        ) : !detail ? (
          <p className="text-sm text-muted-foreground">Trade records unavailable.</p>
        ) : rows.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No trades to break down.</p>
        ) : (
          <div
            className="report-table-scroll"
            role="region"
            aria-label="P&L by ticker rows"
            tabIndex={0}
          >
            <table className="w-full min-w-[720px] text-xs">
              <caption className="sr-only">Profit and loss for each ticker the run traded</caption>
              <thead className="sticky top-0 z-10 border-b bg-card text-left text-muted-foreground">
                <tr className="[&>th]:px-2 [&>th]:py-2 [&>th]:font-medium [&>th]:whitespace-nowrap">
                  <th scope="col">Ticker</th>
                  <th scope="col" className="text-right">
                    Net P&amp;L
                  </th>
                  <th scope="col" className="text-right">
                    Realized P&amp;L
                  </th>
                  <th scope="col" className="text-right">
                    Fees
                  </th>
                  <th scope="col" className="text-right">
                    Closed trades
                  </th>
                  <th scope="col" className="text-right">
                    Win rate
                  </th>
                  <th scope="col" className="text-right">
                    Open lots
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.ticker}
                    className="tabular border-b [&>td]:px-2 [&>td]:py-2 [&>td]:whitespace-nowrap"
                  >
                    <th scope="row" className="px-2 py-2 text-left font-medium">
                      <Link
                        to={paths.tickerDetail(row.ticker)}
                        className="underline-offset-4 hover:underline"
                      >
                        {row.ticker}
                      </Link>
                    </th>
                    <FigureCells figures={row} />
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 font-semibold">
                <tr className="tabular [&>td]:px-2 [&>td]:py-2 [&>td]:whitespace-nowrap">
                  <th scope="row" className="px-2 py-2 text-left">
                    Total
                  </th>
                  <FigureCells figures={total} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Every column after the ticker, shared by the ticker rows and the total. */
function FigureCells({ figures }: { figures: TickerPnlTotal }) {
  return (
    <>
      <td className={cn('text-right', toneClass[toneFromValue(figures.netPnl)])}>
        {formatSigned(figures.netPnl, formatCurrency)}
      </td>
      <td className="text-right">{formatSigned(figures.realisedPnl, formatCurrency)}</td>
      <td className="text-right">{formatCurrency(figures.fees)}</td>
      <td className="text-right">{formatNumber(figures.closedTrades, 0)}</td>
      <td className="text-right">
        {figures.winRate === null ? '—' : formatPercent(figures.winRate, 0)}
      </td>
      <td className="text-right">{formatNumber(figures.openLots, 0)}</td>
    </>
  );
}
