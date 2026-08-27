import type { BacktestDetail } from '@/features/backtests';
import { seriesColor } from '@/lib/chart-theme';
import { cn } from '@/lib/utils';
import { formatNumber, formatPercent, formatSigned } from '@/utils/format';
import { useChartPalette } from '@/utils/use-chart-palette';

interface ComparisonTableProps {
    backtests: readonly BacktestDetail[];
}

/**
 * `better: 'high'` means a larger number wins the row. Max drawdown is stored
 * as a negative ratio, so "closer to zero" is also "higher" — no special case.
 */
interface Row {
    label: string;
    value: (detail: BacktestDetail) => number;
    format: (value: number) => string;
    better: 'high' | 'low';
}

const ROWS: readonly Row[] = [
    {
        label: 'Total return',
        value: (d) => d.metrics.totalReturn,
        format: (v) => formatSigned(v, (n) => formatPercent(n)),
        better: 'high',
    },
    {
        label: 'CAGR',
        value: (d) => d.metrics.cagr,
        format: (v) => formatSigned(v, (n) => formatPercent(n)),
        better: 'high',
    },
    {
        label: 'Sharpe',
        value: (d) => d.metrics.sharpe,
        format: (v) => formatNumber(v),
        better: 'high',
    },
    {
        label: 'Sortino',
        value: (d) => d.metrics.sortino,
        format: (v) => formatNumber(v),
        better: 'high',
    },
    {
        label: 'Max drawdown',
        value: (d) => d.metrics.maxDrawdown,
        format: (v) => formatPercent(v),
        better: 'high',
    },
    {
        label: 'Volatility',
        value: (d) => d.metrics.volatility,
        format: (v) => formatPercent(v),
        better: 'low',
    },
    {
        label: 'Win rate',
        value: (d) => d.metrics.winRate,
        format: (v) => formatPercent(v),
        better: 'high',
    },
    {
        label: 'Profit factor',
        value: (d) => d.metrics.profitFactor,
        format: (v) => (Number.isFinite(v) ? formatNumber(v) : 'No losses'),
        better: 'high',
    },
    {
        label: 'Trades',
        value: (d) => d.metrics.totalTrades,
        format: (v) => formatNumber(v, 0),
        better: 'high',
    },
];

/**
 * Metrics as rows, strategies as columns — the orientation that lets you read
 * one metric across every candidate, which is the actual comparison question.
 *
 * The best cell in each row is marked. Note that "best" is per metric and does
 * not compose: the highest Sharpe and the shallowest drawdown are often
 * different strategies, and seeing that split is the point.
 */
export function ComparisonTable({ backtests }: ComparisonTableProps) {
    const palette = useChartPalette();

    if (backtests.length === 0) return null;

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <caption className="sr-only">Strategy comparison</caption>
                <thead>
                    <tr className="text-muted-foreground border-b text-xs">
                        <th scope="col" className="py-2 pr-4 text-left font-medium">
                            Metric
                        </th>
                        {backtests.map((backtest, index) => (
                            <th
                                key={backtest.id}
                                scope="col"
                                className="py-2 pr-4 text-right font-medium"
                            >
                                <span className="inline-flex items-center gap-1.5">
                                    <span
                                        aria-hidden
                                        className="size-2 shrink-0 rounded-full"
                                        style={{ background: seriesColor(palette, index) }}
                                    />
                                    <span className="text-foreground max-w-[10rem] truncate">
                                        {backtest.name}
                                    </span>
                                </span>
                            </th>
                        ))}
                    </tr>
                </thead>

                <tbody>
                    {ROWS.map((row) => {
                        const values = backtests.map((backtest) => row.value(backtest));
                        const finite = values.filter((value) => Number.isFinite(value));
                        const best =
                            finite.length === 0
                                ? null
                                : row.better === 'high'
                                  ? Math.max(...finite)
                                  : Math.min(...finite);

                        return (
                            <tr
                                key={row.label}
                                className="border-border/40 border-b last:border-b-0"
                            >
                                <th
                                    scope="row"
                                    className="py-2 pr-4 text-left font-medium whitespace-nowrap"
                                >
                                    {row.label}
                                </th>
                                {values.map((value, index) => {
                                    const isBest =
                                        best !== null && value === best && backtests.length > 1;
                                    return (
                                        <td
                                            key={backtests[index]?.id ?? index}
                                            className={cn(
                                                'py-2 pr-4 text-right font-mono tabular-nums',
                                                isBest
                                                    ? 'font-semibold text-[var(--profit)]'
                                                    : 'text-muted-foreground',
                                            )}
                                        >
                                            {row.format(value)}
                                            {isBest ? (
                                                <span className="sr-only"> (best)</span>
                                            ) : null}
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
