import { type ReactNode } from 'react';

import { ErrorBoundary } from '@/components/common/error-boundary';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface ChartContainerProps {
  title: string;
  description?: string | undefined;
  /** Fixed pixel height — charts need a definite height to size their canvas. */
  height?: number | undefined;
  isLoading?: boolean | undefined;
  actions?: ReactNode | undefined;
  children: ReactNode;
  className?: string | undefined;
}

/**
 * Standard frame for every chart: title, loading skeleton, and its own error
 * boundary so a malformed series takes down one panel rather than the page.
 */
export function ChartContainer({
  title,
  description,
  height = 320,
  isLoading = false,
  actions,
  children,
  className,
}: ChartContainerProps) {
  return (
    <Card className={className}>
      <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
        <div className="min-w-0 flex-1 space-y-1">
          <CardTitle className="text-base">{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {actions}
      </CardHeader>
      <CardContent>
        <div
          data-slot="chart-viewport"
          style={{ height }}
          className="relative w-full max-w-full min-w-0 overflow-hidden [contain:inline-size]"
        >
          {isLoading ? (
            <Skeleton className="size-full" />
          ) : (
            <ErrorBoundary>{children}</ErrorBoundary>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
