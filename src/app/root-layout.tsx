/** Just commenting out for Now Have no idea what it does lol
 * it needs to compile first, wait do I even call this compiling? that's a question
 * **/

// import { Navigate, Outlet, useLocation } from 'react-router';
// import { Suspense, useEffect } from 'react';
// import { createLogger } from '@/lib/logger';

import { Suspense } from 'react';
import { Navigate, Outlet } from 'react-router';

import { ErrorBoundary } from '@/components/common/error-boundary';

import { paths } from './paths';
import { useAuthCtx } from './providers/auth-provider.context';
import { AppShell } from './shell';

// const log = createLogger('route');

/** Chrome that persists across every route, plus per-route error isolation. */
export function RootLayout() {
  const { authState } = useAuthCtx();

  // const location = useLocation();
  //
  // // Logged from the layout rather than the router: this fires after the route
  // // has actually rendered, so a line here means the page really did mount.
  // useEffect(() => {
  //   log.info(`navigated to ${location.pathname}`, {
  //     ...(location.search ? { search: location.search } : {}),
  //   });
  // }, [location.pathname, location.search]);

  // Go back and login you cheeky boy
  if (!authState.isAuthenticated) {
    return <Navigate to={paths.login} />;
  }

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
