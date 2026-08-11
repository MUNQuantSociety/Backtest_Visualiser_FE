import { Suspense } from 'react';
import { Outlet } from 'react-router';

import { ErrorBoundary } from '@/components/common/error-boundary';

import { AppShell } from './shell';

/** Chrome that persists across every route, plus per-route error isolation. */
export function RootLayout() {
  return (
    <AppShell>
      <ErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
      </ErrorBoundary>
    </AppShell>
  );
}

function RouteFallback() {
  return (
    <div className="flex min-h-64 items-center justify-center" role="status" aria-live="polite">
      <span className="size-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
      <span className="sr-only">Loading page</span>
    </div>
  );
}
