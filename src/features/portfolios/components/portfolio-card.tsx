import { Link } from 'react-router';

import { paths } from '@/app/paths';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatCompact, formatCurrency, formatPercent, formatSigned } from '@/utils/format';
import { toneFromValue } from '@/utils/tone';

import type { PortfolioSummary } from '../types';

import { EngineStateBadge } from './engine-state-badge';

const toneClass = {
    profit: 'text-[var(--profit)]',
    loss: 'text-[var(--loss)]',
    neutral: 'text-foreground',
} as const;

export function PortfolioCard({ portfolio }: { portfolio: PortfolioSummary }) {
    const dayTone = toneFromValue(portfolio.dayPnl);
    const totalTone = toneFromValue(portfolio.totalPnl);

    return (
        <Card className="hover:border-primary/50 transition-colors">
            <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
                <div className="min-w-0">
                    <CardTitle className="truncate text-base">
                        <Link to={paths.portfolioDetail(portfolio.id)} className="hover:underline">
                            {portfolio.name}
                        </Link>
                    </CardTitle>
                    <p className="text-muted-foreground mt-1 truncate font-mono text-xs">
                        {portfolio.strategyClass}
                    </p>
                </div>
                <EngineStateBadge state={portfolio.state} />
            </CardHeader>

            <CardContent className="space-y-3">
                <div>
                    <p className="text-muted-foreground text-xs">Total value</p>
                    <p className="tabular text-2xl font-semibold">
                        {formatCurrency(portfolio.totalValue)}
                    </p>
                </div>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div>
                        <dt className="text-muted-foreground text-xs">Today</dt>
                        <dd className={cn('tabular font-medium', toneClass[dayTone])}>
                            {formatSigned(portfolio.dayPnl, (n) => formatCompact(n))}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-muted-foreground text-xs">Total P&amp;L</dt>
                        <dd className={cn('tabular font-medium', toneClass[totalTone])}>
                            {formatSigned(portfolio.totalReturn, (n) => formatPercent(n))}
                        </dd>
                    </div>
                </dl>

                <div className="flex flex-wrap gap-1 border-t pt-3">
                    {portfolio.tickers.map((ticker) => (
                        <span
                            key={ticker}
                            className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-[0.6875rem]"
                        >
                            {ticker}
                        </span>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
