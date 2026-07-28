import { type ReactNode } from 'react';

import { ErrorBoundary } from '@/components/common/error-boundary';

import { QueryProvider } from './query-provider';
import { ThemeProvider } from './theme-provider';

/**
 * Every app-wide provider, composed in one place. Order matters: the error
 * boundary is outermost so a provider blowing up is still caught.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <QueryProvider>{children}</QueryProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
