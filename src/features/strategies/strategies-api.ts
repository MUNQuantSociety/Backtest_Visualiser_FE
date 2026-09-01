import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { env } from '@/config/env';
import { fetchBacktests } from '@/features/backtests';
import { apiClient } from '@/lib/api-client';

import { fixtureStrategyBlueprints } from './fixtures';
import {
  strategyCheckResultSchema,
  strategyTemplateSchema,
  strategyListResponseSchema,
  strategySubmissionResultSchema,
  type Strategy,
  type StrategyCheckRequest,
  type StrategyCheckResult,
  type StrategyTemplate,
  type StrategySubmission,
  type StrategySubmissionResult,
} from './types';

/** Fake latency, so loading states are visible in the demo instead of flashing. */
const FIXTURE_DELAY_MS = 220;

async function withFixtureDelay<T>(value: T): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, FIXTURE_DELAY_MS));
  return value;
}

export const strategyKeys = {
  all: ['strategies'] as const,
  lists: () => [...strategyKeys.all, 'list'] as const,
  template: () => [...strategyKeys.all, 'template'] as const,
} as const;

/**
 * The catalogue, with each strategy's run aggregates attached.
 *
 * In fixture mode the aggregates are folded in from the real backtest list
 * rather than hardcoded, so a strategy card can never claim a Sharpe that its
 * own runs disagree with. The live endpoint is expected to return them
 * precomputed — the client should not be fetching every run to render a list.
 */
export async function fetchStrategies(): Promise<Strategy[]> {
  if (env.useFixtures) {
    const { items: backtests } = await fetchBacktests();

    const strategies = fixtureStrategyBlueprints().map((blueprint) => {
      const runs = backtests.filter((run) => run.strategyId === blueprint.id);
      const sharpes = runs.map((run) => run.sharpe);
      const returns = runs.map((run) => run.totalReturn);

      return {
        ...blueprint,
        runCount: runs.length,
        bestSharpe: sharpes.length > 0 ? Math.max(...sharpes) : null,
        bestReturn: returns.length > 0 ? Math.max(...returns) : null,
        lastRunAt: runs.length > 0 ? (runs[runs.length - 1]?.createdAt ?? null) : null,
      };
    });

    return withFixtureDelay(strategyListResponseSchema.parse({
      items: strategies,
      total: strategies.length,
    }).items);
  }

  const data = await apiClient.get<unknown>('/strategies');
  return strategyListResponseSchema.parse(data).items;
}

export function useStrategies() {
  return useQuery({ queryKey: strategyKeys.lists(), queryFn: fetchStrategies });
}

/**
 * The starter strategy the editor opens with.
 *
 * Served by the backend, beside the check that judges it, so the two cannot
 * disagree. The editor keeps a local copy as a fallback for when this cannot
 * be fetched, because an empty editor is worse than a slightly stale example.
 */
export async function fetchStrategyTemplate(): Promise<StrategyTemplate> {
  const data = await apiClient.get<unknown>('/strategies/template');
  return strategyTemplateSchema.parse(data);
}

export function useStrategyTemplate() {
  return useQuery({
    queryKey: strategyKeys.template(),
    queryFn: fetchStrategyTemplate,
    // No backend to ask in fixture mode; the caller falls back.
    enabled: !env.useFixtures,
    // It changes when the engine does, which is not during a sitting.
    staleTime: Number.POSITIVE_INFINITY,
    // One failure is enough to fall back. Retrying delays the editor for a
    // file the caller already has a copy of.
    retry: false,
  });
}

/**
 * Asks the backend whether this source would run on the engine.
 *
 * A pre-flight, not a submission: nothing is stored and nothing is executed.
 * The backend reads the source with `ast` and answers in a millisecond. It is
 * what turns "banned import on line 3" from something a student discovers when
 * a validation backtest fails minutes later into something they see before
 * they submit.
 *
 * A verdict of "incompatible" is a *successful* request and comes back 200, so
 * it is returned rather than thrown. Only a real failure (the server being
 * unreachable, or source over the size limit) rejects, and reaches the caller
 * as the usual `ApiError`.
 */
export async function checkStrategy(request: StrategyCheckRequest): Promise<StrategyCheckResult> {
  if (env.useFixtures) {
    // There is no backend to ask, and guessing would be worse than useless:
    // the check exists precisely so nobody has to guess. Say so instead.
    return withFixtureDelay(
      strategyCheckResultSchema.parse({
        status: 'unchecked',
        ok: false,
        className: null,
        issues: [],
        warnings: [],
        message:
          'Nothing was checked: the app is running on fixtures. Set VITE_USE_FIXTURES=false to check against the engine.',
      }),
    );
  }

  const data = await apiClient.post<unknown>('/strategies/check', request);
  return strategyCheckResultSchema.parse(data);
}

export function useCheckStrategy() {
  // No cache and no invalidation: the answer is a pure function of the source
  // in the textarea, and caching it would mean showing a verdict for code the
  // author has since edited.
  return useMutation({ mutationFn: checkStrategy });
}

/**
 * Submits strategy source for validation and registration.
 *
 * The source is sent as text whether the user typed it or picked a file — the
 * upload path reads the file client-side so it can be reviewed in the editor
 * before it is sent. One payload shape means the backend has one code path.
 *
 * NOTE FOR THE BACKEND: this is untrusted user code. It must be validated and
 * executed in a sandbox with no network egress, a CPU/memory cap and a wall
 * clock timeout. Never import it into the engine process.
 */
export async function submitStrategy(
  submission: StrategySubmission,
): Promise<StrategySubmissionResult> {
  if (env.useFixtures) {
    return withFixtureDelay(
      strategySubmissionResultSchema.parse({
        id: `draft-${String(Date.now())}`,
        name: submission.name,
        status: 'draft',
        // The real endpoint compiles and lints; the demo cannot, and says so
        // rather than implying the code was checked.
        message: 'Saved as a draft. Validation runs on the backend, which is not wired up yet.',
      }),
    );
  }

  const data = await apiClient.post<unknown>('/strategies', submission);
  return strategySubmissionResultSchema.parse(data);
}

export function useSubmitStrategy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submitStrategy,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: strategyKeys.lists() });
    },
  });
}
