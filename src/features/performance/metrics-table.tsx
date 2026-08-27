import { Skeleton } from '@/components/ui/skeleton';
import type { BacktestDetail } from '@/features/backtests';
import { cn } from '@/lib/utils';
import { formatCurrency, formatNumber, formatPercent, formatSigned } from '@/utils/format';
import { toneFromValue } from '@/utils/tone';

import { buildTearsheet, type TearsheetRow } from './tearsheet';

interface MetricsTableProps {
    detail: BacktestDetail | undefined;
    isLoading?: boolean | undefined;
}

const toneClass = {
    profit: 'text-[var(--profit)]',
    loss: 'text-[var(--loss)]',
    neutral: 'text-foreground',
} as const;

function formatValue(row: TearsheetRow): string {
    if (row.value === null) return '—';
    if (typeof row.value === 'string') return row.value;

    // An infinite profit factor is a real result (no losing trades), not a bug —
    // say so rather than rendering "∞" and leaving the reader to guess.
    if (!Number.isFinite(row.value)) return row.value > 0 ? 'No losses' : '—';

    switch (row.format) {
        case 'currency':
            return row.signed
                ? formatSigned(row.value, (n) => formatCurrency(n))
                : formatCurrency(row.value);
        case 'percent':
            return row.signed
                ? formatSigned(row.value, (n) => formatPercent(n))
                : formatPercent(row.value);
        case 'integer':
            return formatNumber(row.value, 0);
        case 'ratio':
        default:
            return formatNumber(row.value);
    }
}

/**
 * The full tearsheet, in the layout a quant reader already knows from
 * QuantStats and pyfolio. This is a reference view, not a scannable one —
 * `MetricsGrid` stays above it for the headline figures.
 *
 * A table, not a chart: every value here is a single scalar, and a reader
 * comparing Sortino against Sharpe wants them adjacent and aligned, which no
 * visualisation does better than two columns of numbers.
 */
export function MetricsTable({ detail, isLoading = false }: MetricsTableProps) {
    if (isLoading) return <Skeleton className="h-96" />;
    if (!detail) {
        return (
            <p className="text-muted-foreground py-8 text-center text-sm">No metrics available.</p>
        );
    }

    const sections = buildTearsheet(detail);

    return (
        // Wide tables scroll inside their own container; the page itself must never
        // scroll sideways.
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <caption className="sr-only">Backtest performance tearsheet</caption>
                <thead>
                    <tr className="text-muted-foreground border-b text-xs">
                        <th scope="col" className="py-2 pr-4 text-left font-medium">
                            Category
                        </th>
                        <th scope="col" className="py-2 pr-4 text-left font-medium">
                            Metric
                        </th>
                        <th scope="col" className="py-2 text-right font-medium">
                            Value
                        </th>
                    </tr>
                </thead>

                {sections.map((section) => (
                    // One <tbody> per category rather than rowSpan: the group stays a
                    // group for screen readers, and adding a row cannot silently break
                    // a hand-counted span.
                    <tbody key={section.category} className="border-b last:border-b-0">
                        {section.rows.map((row, index) => {
                            const tone =
                                row.signed &&
                                typeof row.value === 'number' &&
                                Number.isFinite(row.value)
                                    ? toneFromValue(row.value)
                                    : 'neutral';

                            return (
                                <tr
                                    key={row.label}
                                    className="border-border/40 border-b last:border-b-0"
                                >
                                    <th
                                        scope="row"
                                        className="py-2 pr-4 text-left align-top font-medium whitespace-nowrap"
                                    >
                                        {/* Printed once per group; the rest are empty so the eye
                        follows one label down the column. */}
                                        {index === 0 ? section.category : ''}
                                    </th>
                                    <td className="text-muted-foreground py-2 pr-4">{row.label}</td>
                                    <td
                                        className={cn(
                                            'py-2 text-right font-mono tabular-nums',
                                            toneClass[tone],
                                        )}
                                    >
                                        {formatValue(row)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                ))}
            </table>
        </div>
    );
}
