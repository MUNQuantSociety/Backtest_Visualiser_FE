import { PageHeader } from '@/components/common/page-header';

import { PortfolioList } from '../features/portfolios/components/portfolio-list';

export default function PortfoliosPage() {
  return (
    <>
      <PageHeader
        title="Portfolios"
        description="Every sleeve the live engine is configured to run."
      />
      <PortfolioList />
    </>
  );
}
