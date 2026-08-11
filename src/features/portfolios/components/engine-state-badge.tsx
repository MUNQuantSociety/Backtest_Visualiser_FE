import { Badge, type BadgeProps } from '@/components/ui/badge';

import type { EngineState } from '../types';

/**
 * `RunEngine` runs each portfolio in its own thread behind a consecutive-failure
 * circuit breaker, so "not running" has more than one cause and they are not
 * equally urgent. `halted` (breaker tripped) reads as destructive; `stopped`
 * (deliberately allocated 0% capital) is merely informational.
 */
const presentation: Record<EngineState, { label: string; variant: BadgeProps['variant'] }> = {
  running: { label: 'Running', variant: 'profit' },
  stopped: { label: 'Stopped', variant: 'secondary' },
  halted: { label: 'Halted', variant: 'destructive' },
  error: { label: 'Error', variant: 'destructive' },
};

export function EngineStateBadge({ state }: { state: EngineState }) {
  const { label, variant } = presentation[state];
  return <Badge variant={variant}>{label}</Badge>;
}
