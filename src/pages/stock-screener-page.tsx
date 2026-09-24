import { Filter } from 'lucide-react';

import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';

// TODO: placeholder only. It holds the route and the nav entry until the
// screener itself is built.
export default function StockScreenerPage() {
  return (
    <>
      <PageHeader title="Stock Screener" description="Filter the stock universe by metric." />
      <EmptyState
        icon={Filter}
        title="Coming soon"
        description="The stock screener is not built yet."
      />
    </>
  );
}
