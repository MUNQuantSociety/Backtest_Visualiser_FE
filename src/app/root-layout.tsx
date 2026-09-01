import { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';

import { ErrorBoundary } from '@/components/common/error-boundary';
import { createLogger } from '@/lib/logger';

import { AppShell } from './shell';

const log = createLogger('route');

/** Chrome that persists across every route, plus per-route error isolation. */
export function RootLayout() {
  const location = useLocation();

  // Logged from the layout rather than the router: this fires after the route
  // has actually rendered, so a line here means the page really did mount.
  useEffect(() => {
    log.info(`navigated to ${location.pathname}`, {
      ...(location.search ? { search: location.search } : {}),
    });
  }, [location.pathname, location.search]);

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
