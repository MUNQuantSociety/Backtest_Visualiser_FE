import { Skeleton } from '@/components/ui/skeleton';

import type { PortfolioConfig } from '../types';

interface ConfigPanelProps {
    config: PortfolioConfig | undefined;
    isLoading?: boolean | undefined;
}

/**
 * Read-only view of the portfolio's `config.json`, exactly as the engine loads
 * it — original key casing, unknown blocks and all.
 *
 * Deliberately not an editor. MQSMaster discovers config by file location
 * (`inspect.getfile(portfolio_cls)` → sibling `config.json`) and the live
 * pipeline places real orders from it, so a browser control that writes here
 * would be a trading action behind a text field. Promoting a config change is a
 * pull request against the trading repo, with review.
 */
export function ConfigPanel({ config, isLoading = false }: ConfigPanelProps) {
    if (isLoading) return <Skeleton className="h-64" />;

    if (!config) {
        return (
            <p className="text-muted-foreground py-8 text-center text-sm">No config available.</p>
        );
    }

    return (
        <div className="space-y-3">
            <p className="text-muted-foreground text-xs">
                Read-only. Config is loaded by the engine from{' '}
                <code className="font-mono">
                    src/portfolios/portfolio_{config.PORTFOLIO_ID}/config.json
                </code>
                ; changing it is a pull request against the trading repo.
            </p>
            <pre className="bg-muted/40 max-h-96 overflow-auto rounded-md border p-3 font-mono text-xs">
                <code>{JSON.stringify(config, null, 2)}</code>
            </pre>
        </div>
    );
}
