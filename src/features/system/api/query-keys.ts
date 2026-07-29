/** Hierarchical query keys for the system feature. */
export const systemKeys = {
  all: ['system'] as const,
  status: () => [...systemKeys.all, 'status'] as const,
  logs: (size: number) => [...systemKeys.all, 'logs', size] as const,
} as const;
