import { Suspense } from 'react';
import { Navigate, Outlet } from 'react-router';

import { ErrorBoundary } from '@/components/common/error-boundary';

import { paths } from './paths';
import { useAuthCtx } from './providers/auth-provider.context';
import { AppShell } from './shell';

/** Chrome that persists across every route, plus per-route error isolation. */
export function RootLayout() {
    const { authState } = useAuthCtx();

    // Please stop trying to hack us
    // You need to be logged in for these pages to work
    // Don't do that!
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
            <span className="border-muted-foreground/30 border-t-primary size-6 animate-spin rounded-full border-2" />
            <span className="sr-only">Loading page</span>
        </div>
    );
}
