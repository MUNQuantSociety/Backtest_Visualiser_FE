import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';

import { prefetchDashboardData } from '@/app/dashboard-data';
import { createQueryClient } from '@/lib/query-client';

import { useAuthCtx } from './auth-provider.context';

export function QueryProvider({ children }: { children: ReactNode }) {
  const { authState } = useAuthCtx();
  return (
    <AccountQueryProvider key={authState.user?.id ?? 'signed-out'}>{children}</AccountQueryProvider>
  );
}

function AccountQueryProvider({ children }: { children: ReactNode }) {
  // useState, not a module-level constant: one client per mount keeps tests
  // isolated from each other's cache.
  const [queryClient] = useState(createQueryClient);
  const { authState } = useAuthCtx();
  useEffect(
    () => () => {
      void queryClient.cancelQueries();
      queryClient.clear();
    },
    [queryClient],
  );
  useEffect(() => {
    if (authState.isAuthenticated && ['/', '/auth/login'].includes(window.location.pathname)) {
      void prefetchDashboardData(queryClient);
    }
  }, [authState.isAuthenticated, queryClient]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
