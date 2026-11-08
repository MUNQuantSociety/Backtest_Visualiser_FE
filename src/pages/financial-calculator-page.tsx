import { Calculator } from 'lucide-react';

import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';

// TODO: placeholder only. It holds the route and the nav entry until the
// calculator itself is built.
export default function FinancialCalculatorPage() {
  return (
    <>
      <PageHeader title="Financial Calculator" description="Everyday finance calculations." />
      <EmptyState
        icon={Calculator}
        title="Coming soon"
        description="The financial calculator is not built yet."
      />
    </>
  );
}
