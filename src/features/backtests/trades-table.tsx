import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatNumber, formatSigned } from '@/utils/format';

import { recordedFillCount } from './trade-report';
import type { BacktestDetail } from './types';

export function TradesTable({
  detail,
  isLoading = false,
}: {
  detail: BacktestDetail | undefined;
  isLoading?: boolean;
}) {
  const trades = detail?.trades ?? [];
  const closedCount = trades.filter((trade) => trade.exitDate !== null).length;
  const fillCount = recordedFillCount(detail?.reportMetadata);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trade ledger</CardTitle>
        <CardDescription>
          Each execution is a fill. Fills are paired into trade lots; a partial exit can split a lot
          into multiple rows. Realized P&amp;L excludes the separately listed fees. Open lots have
          no realized P&amp;L yet.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-40" />
        ) : !detail ? (
          <p className="text-sm text-muted-foreground">Trade records unavailable.</p>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Recorded fills', fillCount],
                ['Trade lots', trades.length],
                ['Open trade lots', trades.length - closedCount],
                ['Closed trades', closedCount],
              ].map(([label, count]) => (
                <div key={label}>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="tabular mt-1 text-lg font-semibold">
                    {typeof count === 'number' ? formatNumber(count, 0) : '—'}
                  </dd>
                </div>
              ))}
            </dl>
            {trades.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                {fillCount === 0
                  ? detail.reportMetadata?.execution?.message?.trim() ||
                    'No fills were recorded in this run.'
                  : 'No trade lots are available for this report.'}
              </p>
            ) : (
              <div
                className="report-table-scroll"
                role="region"
                aria-label="Trade ledger rows"
                tabIndex={0}
              >
                <table className="w-full min-w-[980px] text-xs">
                  <caption className="sr-only">
                    Recorded trade lots, including open positions
                  </caption>
                  <thead className="sticky top-0 z-10 border-b bg-card text-left text-muted-foreground">
                    <tr className="[&>th]:px-2 [&>th]:py-2 [&>th]:font-medium [&>th]:whitespace-nowrap">
                      <th scope="col">Ticker</th>
                      <th scope="col">Direction</th>
                      <th scope="col">Status</th>
                      <th scope="col" className="text-right">
                        Quantity
                      </th>
                      <th scope="col">Entry date</th>
                      <th scope="col" className="text-right">
                        Entry price
                      </th>
                      <th scope="col">Exit date</th>
                      <th scope="col" className="text-right">
                        Exit price
                      </th>
                      <th scope="col" className="text-right">
                        Realized P&amp;L
                      </th>
                      <th scope="col" className="text-right">
                        Fees
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map((trade) => {
                      const closed = trade.exitDate !== null;
                      return (
                        <tr
                          key={trade.id}
                          className="tabular border-b last:border-0 [&>td]:px-2 [&>td]:py-2 [&>td]:whitespace-nowrap"
                        >
                          <td className="font-medium">{trade.symbol}</td>
                          <td>{trade.side === 'long' ? 'Long' : 'Short'}</td>
                          <td>
                            <Badge variant={closed ? 'secondary' : 'outline'}>
                              {closed ? 'Closed' : 'Open'}
                            </Badge>
                          </td>
                          <td className="text-right">
                            {trade.quantity.toLocaleString('en-US', { maximumFractionDigits: 6 })}
                          </td>
                          <td>{trade.entryDate}</td>
                          <td className="text-right">
                            {formatCurrency(trade.entryPrice, 'USD', { maximumFractionDigits: 4 })}
                          </td>
                          <td>{trade.exitDate ?? '—'}</td>
                          <td className="text-right">
                            {closed && trade.exitPrice !== null
                              ? formatCurrency(trade.exitPrice, 'USD', { maximumFractionDigits: 4 })
                              : '—'}
                          </td>
                          <td className="text-right">
                            {closed ? formatSigned(trade.pnl, formatCurrency) : '—'}
                          </td>
                          <td className="text-right">{formatCurrency(trade.fees)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
