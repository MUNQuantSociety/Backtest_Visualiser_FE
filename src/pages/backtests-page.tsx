import { useSearchParams } from 'react-router';

import { PageHeader } from '@/components/common/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DEFAULT_PAGE_SIZE } from '@/config/constants';
import {
  BacktestList,
  RunBacktestForm,
  type BacktestFilters,
  type BacktestStatus,
} from '@/features/backtests';

const STATUSES: BacktestStatus[] = ['queued', 'running', 'completed', 'failed'];

function isStatus(value: string | null): value is BacktestStatus {
  return value !== null && STATUSES.includes(value as BacktestStatus);
}

export default function BacktestsPage() {
  // Filters live in the URL, so a filtered view is shareable and survives reload.
  const [searchParams] = useSearchParams();
  const status = searchParams.get('status');

  const filters: BacktestFilters = {
    page: Number(searchParams.get('page') ?? '1'),
    pageSize: DEFAULT_PAGE_SIZE,
    ...(searchParams.get('q') ? { search: searchParams.get('q') as string } : {}),
    ...(isStatus(status) ? { status } : {}),
  };

  return (
    <>
      <PageHeader title="Backtests" description="Every run, newest first." />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">New run</CardTitle>
          <CardDescription>
            Pick a strategy and a window, and it runs against historical data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RunBacktestForm />
        </CardContent>
      </Card>

      <BacktestList filters={filters} />
    </>
  );
}
