import { useState } from 'react';

import { ChartContainer } from '@/components/charts/chart-container';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useBacktestDetails, useBacktests } from '@/features/backtests';
import { ComparisonChart, ComparisonTable } from '@/features/performance';
import { seriesColor } from '@/lib/chart-theme';
import { cn } from '@/lib/utils';
import { formatPercent } from '@/utils/format';
import { useChartPalette } from '@/utils/use-chart-palette';

/** Beyond this the lines stop being distinguishable and the table stops fitting. */
const MAX_SELECTED = 5;

/**
 * Compare runs against each other: overlaid equity curves plus a metric-by-metric
 * table.
 *
 * Selection lives in component state rather than the URL for now. `STORAGE_KEYS
 * .comparisonSet` exists for persisting it, and the URL would make a comparison
 * shareable — both are worth doing once the shape of the page settles.
 */
export default function ComparePage() {
    const { data: list, isPending: isListPending } = useBacktests();
    const [selected, setSelected] = useState<string[] | null>(null);

    const palette = useChartPalette();

    const available = list?.items ?? [];
    // Default to the first three so the page is never an empty prompt.
    const active = selected ?? available.slice(0, 3).map((item) => item.id);

    const { data: details, isPending: isDetailPending } = useBacktestDetails(active);

    function toggle(id: string) {
        setSelected((current) => {
            const base = current ?? active;
            if (base.includes(id)) return base.filter((candidate) => candidate !== id);
            if (base.length >= MAX_SELECTED) return base;
            return [...base, id];
        });
    }

    if (isListPending) {
        return (
            <>
                <PageHeader title="Compare" />
                <Skeleton className="h-24" />
                <Skeleton className="h-96" />
            </>
        );
    }

    if (available.length === 0) {
        return (
            <>
                <PageHeader title="Compare" />
                <EmptyState
                    title="Nothing to compare yet"
                    description="Run a couple of backtests and they will show up here."
                />
            </>
        );
    }

    // Keep chart and table in the selection's order, not the fetch order, so a
    // strategy does not change colour when another one finishes loading.
    const ordered = active.flatMap((id) => {
        const match = details.find((detail) => detail.id === id);
        return match ? [match] : [];
    });

    return (
        <>
            <PageHeader
                title="Compare"
                description="Overlay strategies on one axis and read their metrics side by side."
            />

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">
                        Strategies{' '}
                        <span className="text-muted-foreground font-normal">
                            ({active.length} of {MAX_SELECTED})
                        </span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                    {available.map((item) => {
                        const index = active.indexOf(item.id);
                        const isActive = index !== -1;
                        const atLimit = !isActive && active.length >= MAX_SELECTED;

                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                    toggle(item.id);
                                }}
                                disabled={atLimit}
                                aria-pressed={isActive}
                                className={cn(
                                    'flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors',
                                    isActive
                                        ? 'bg-accent text-accent-foreground border-transparent'
                                        : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                                    atLimit && 'cursor-not-allowed opacity-40',
                                )}
                            >
                                <span
                                    aria-hidden
                                    className="size-2 shrink-0 rounded-full"
                                    style={{
                                        background: isActive
                                            ? seriesColor(palette, index)
                                            : palette.grid,
                                    }}
                                />
                                <span className="max-w-[12rem] truncate">{item.name}</span>
                                <span className="font-mono text-xs opacity-70">
                                    {formatPercent(item.totalReturn, 1)}
                                </span>
                            </button>
                        );
                    })}
                </CardContent>
            </Card>

            {active.length === 0 ? (
                <EmptyState
                    title="Nothing selected"
                    description="Pick at least one strategy above to plot it."
                />
            ) : (
                <>
                    <ChartContainer
                        title="Equity curves, rebased to 100"
                        description="Each run starts at 100 so the comparison is about return, not starting capital."
                        height={420}
                        isLoading={isDetailPending && ordered.length === 0}
                    >
                        <ComparisonChart backtests={ordered} />
                    </ChartContainer>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Metrics side by side</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {isDetailPending && ordered.length === 0 ? (
                                <Skeleton className="h-72" />
                            ) : (
                                <ComparisonTable backtests={ordered} />
                            )}
                        </CardContent>
                    </Card>
                </>
            )}
        </>
    );
}
