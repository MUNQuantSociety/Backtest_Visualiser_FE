import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatNumber, formatPercent, formatSigned } from '@/utils/format';
import { toneFromValue } from '@/utils/tone';

import type { BacktestSummary, BacktestStatus } from './types';

const statusVariant: Record<BacktestStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    queued: 'outline',
    running: 'secondary',
    completed: 'default',
    failed: 'destructive',
};

interface BacktestCardProps {
    backtest: BacktestSummary;
}

export function BacktestCard({ backtest }: BacktestCardProps) {
    const tone = toneFromValue(backtest.totalReturn);

    return (
        <Card className="hover:border-primary/50 transition-colors">
            <CardContent className="p-4 pt-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <Link
                            to={`/backtests/${backtest.id}`}
                            className="hover:text-primary flex items-center gap-1.5 font-medium"
                        >
                            <span className="truncate">{backtest.name}</span>
                            <ArrowRight className="size-3.5 shrink-0" aria-hidden />
                        </Link>
                        <p className="text-muted-foreground mt-0.5 truncate text-xs">
                            {backtest.strategyName} · {backtest.symbol} · {backtest.timeframe}
                        </p>
                    </div>
                    <Badge variant={statusVariant[backtest.status]}>{backtest.status}</Badge>
                </div>

                <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
                    <div>
                        <dt className="text-muted-foreground text-xs">Return</dt>
                        <dd
                            className={cn(
                                'tabular font-medium',
                                tone === 'profit' && 'text-[var(--profit)]',
                                tone === 'loss' && 'text-[var(--loss)]',
                            )}
                        >
                            {formatSigned(backtest.totalReturn, (n) => formatPercent(n))}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-muted-foreground text-xs">Sharpe</dt>
                        <dd className="tabular font-medium">{formatNumber(backtest.sharpe)}</dd>
                    </div>
                    <div>
                        <dt className="text-muted-foreground text-xs">Max DD</dt>
                        <dd className="tabular font-medium text-[var(--loss)]">
                            {formatPercent(backtest.maxDrawdown)}
                        </dd>
                    </div>
                </dl>
            </CardContent>
        </Card>
    );
}
