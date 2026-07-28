import { QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { createQueryClient } from '@/lib/query-client';

export function QueryProvider({ children }: { children: ReactNode }) {
  // useState, not a module-level constant: one client per mount keeps tests
  // isolated from each other's cache.
  const [queryClient] = useState(createQueryClient);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
