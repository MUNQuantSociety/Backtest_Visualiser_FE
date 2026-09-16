/**
 * Query keys only, with no imports: the one part of this feature another
 * feature may depend on without pulling the whole API module — and its
 * `@/features/backtests/data` import — in behind it.
 */
export const strategyKeys = {
  all: ['strategies'] as const,
  lists: () => [...strategyKeys.all, 'list'] as const,
  detail: (key: string) => [...strategyKeys.all, 'detail', key] as const,
  template: () => [...strategyKeys.all, 'template'] as const,
} as const;
