import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatCurrency, formatNumber, formatPercent, formatSigned } from '@/utils/format';
import { toneFromValue } from '@/utils/tone';

import type { Position } from '../types';

const toneClass = {
    profit: 'text-[var(--profit)]',
    loss: 'text-[var(--loss)]',
    neutral: 'text-foreground',
} as const;

interface PositionsTableProps {
    positions: readonly Position[] | undefined;
    isLoading?: boolean | undefined;
}

/** "Asset Breakdown" from the prototype, with real numbers behind it. */
export function PositionsTable({ positions, isLoading = false }: PositionsTableProps) {
    if (isLoading) return <Skeleton className="h-64" />;

    if (!positions || positions.length === 0) {
        return <p className="text-muted-foreground py-8 text-center text-sm">No open positions.</p>;
    }

    return (
        // Wide tables scroll inside their own container; the page itself must never
        // scroll sideways.
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <caption className="sr-only">Open positions</caption>
                <thead>
                    <tr className="text-muted-foreground border-b text-xs">
                        <th scope="col" className="py-2 pr-4 text-left font-medium">
                            Ticker
                        </th>
                        <th scope="col" className="py-2 pr-4 text-right font-medium">
                            Quantity
                        </th>
                        <th scope="col" className="py-2 pr-4 text-right font-medium">
                            Avg price
                        </th>
                        <th scope="col" className="py-2 pr-4 text-right font-medium">
                            Last
                        </th>
                        <th scope="col" className="py-2 pr-4 text-right font-medium">
                            Market value
                        </th>
                        <th scope="col" className="py-2 pr-4 text-right font-medium">
                            Unrealised
                        </th>
                        <th scope="col" className="py-2 text-right font-medium">
                            Weight
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {positions.map((position) => {
                        const tone = toneFromValue(position.unrealizedPnl);
                        return (
                            <tr key={position.ticker} className="border-b last:border-0">
                                <th
                                    scope="row"
                                    className="py-2 pr-4 text-left font-mono font-medium"
                                >
                                    {position.ticker}
                                </th>
                                <td className="tabular py-2 pr-4 text-right">
                                    {formatNumber(position.quantity, 0)}
                                </td>
                                <td className="tabular py-2 pr-4 text-right">
                                    {formatCurrency(position.avgPrice)}
                                </td>
                                <td className="tabular py-2 pr-4 text-right">
                                    {formatCurrency(position.lastPrice)}
                                </td>
                                <td className="tabular py-2 pr-4 text-right">
                                    {formatCurrency(position.marketValue)}
                                </td>
                                <td
                                    className={cn(
                                        'tabular py-2 pr-4 text-right font-medium',
                                        toneClass[tone],
                                    )}
                                >
                                    {formatSigned(position.unrealizedPnl, (n) => formatCurrency(n))}
                                </td>
                                <td className="tabular text-muted-foreground py-2 text-right">
                                    {formatPercent(position.weight, 1)}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
