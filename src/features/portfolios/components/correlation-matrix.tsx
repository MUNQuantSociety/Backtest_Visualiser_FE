import { Skeleton } from '@/components/ui/skeleton';
import { formatNumber } from '@/utils/format';

import { usePortfolioCorrelations } from '../portfolios-api';

/**
 * Diverging fill for a signed quantity in [-1, 1].
 *
 * The colour convention is risk-oriented, not return-oriented: strong *positive*
 * correlation is the dangerous end (every holding falls together), so it gets
 * the loss token, and negative correlation gets the profit token because it is
 * diversifying. That is the opposite of what green means everywhere else in the
 * app, which is exactly why the panel spells it out in its description.
 */
function cellStyle(value: number): { background: string } {
    const magnitude = Math.min(Math.abs(value), 1);
    const token = value >= 0 ? 'var(--loss)' : 'var(--profit)';
    const percent = Math.round(magnitude * 55);
    return { background: `color-mix(in oklab, ${token} ${String(percent)}%, transparent)` };
}

export function CorrelationMatrix({ portfolioId }: { portfolioId: string | undefined }) {
    const { data, isPending, isError, error } = usePortfolioCorrelations(portfolioId);

    if (isPending) return <Skeleton className="h-64" />;

    if (isError) {
        return <p className="text-muted-foreground py-8 text-center text-sm">{error.message}</p>;
    }

    if (data.tickers.length === 0) {
        return (
            <p className="text-muted-foreground py-8 text-center text-sm">
                Not enough history to compute correlations.
            </p>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="text-sm">
                <caption className="text-muted-foreground pb-3 text-left text-xs">
                    Pairwise return correlation over {formatNumber(data.lookbackDays, 0)} days. Red
                    is concentration risk (moves together); green is diversifying.
                </caption>
                <thead>
                    <tr>
                        <td className="p-1" />
                        {data.tickers.map((ticker) => (
                            <th
                                key={ticker}
                                scope="col"
                                className="text-muted-foreground p-1 text-center font-mono text-xs font-medium"
                            >
                                {ticker}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.tickers.map((rowTicker, rowIndex) => (
                        <tr key={rowTicker}>
                            <th
                                scope="row"
                                className="text-muted-foreground p-1 pr-2 text-right font-mono text-xs font-medium"
                            >
                                {rowTicker}
                            </th>
                            {data.tickers.map((columnTicker, columnIndex) => {
                                const value = data.matrix[rowIndex]?.[columnIndex];
                                return (
                                    <td key={columnTicker} className="p-0.5">
                                        <div
                                            className="tabular flex size-12 items-center justify-center rounded text-xs"
                                            style={
                                                value === undefined ? undefined : cellStyle(value)
                                            }
                                            title={`${rowTicker} vs ${columnTicker}`}
                                        >
                                            {value === undefined ? '—' : formatNumber(value, 2)}
                                        </div>
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
