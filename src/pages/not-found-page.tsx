import { FileQuestion } from 'lucide-react';
import { Link } from 'react-router';

import { paths } from '@/app/router/paths';
import { EmptyState } from '@/components/common/empty-state';
import { buttonVariants } from '@/components/ui/button';

export default function NotFoundPage() {
  return (
    <EmptyState
      icon={FileQuestion}
      title="Page not found"
      description="That URL does not match any route in this app."
      action={
        <Link to={paths.dashboard} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          Back to dashboard
        </Link>
      }
    />
  );
}
