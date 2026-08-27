import { PageHeader } from '@/components/common/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StrategyEditor, StrategyList } from '@/features/strategies';

/**
 * Where a strategy enters the system: write it here or upload the file, then
 * test it. The catalogue below is what has been added already.
 */
export default function StrategiesPage() {
    return (
        <>
            <PageHeader
                title="Strategies"
                description="Write or upload a strategy, then run it against historical data."
            />

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">New strategy</CardTitle>
                    <CardDescription>
                        Paste or write Python against{' '}
                        <code className="font-mono">BasePortfolio</code>, or upload an existing{' '}
                        <code className="font-mono">.py</code> file.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <StrategyEditor />
                </CardContent>
            </Card>

            <StrategyList />
        </>
    );
}
