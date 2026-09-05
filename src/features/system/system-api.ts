import { useQuery } from '@tanstack/react-query';

import { LIVE_REFETCH_MS, LOG_TAIL_SIZE } from '@/config/constants';
import { env } from '@/config/env';
import { ApiError, apiClient } from '@/lib/api-client';
import { createLogger } from '@/lib/logger';

import { fixtureLogTail, fixtureSystemStatus } from './fixtures';
import {
  logTailResponseSchema,
  systemStatusSchema,
  type LogTail,
  type SystemStatus,
} from './types';

/**
 * Transport layer for system health and the log tail. Fixtures are swapped in
 * here and nowhere else, exactly as in the portfolios feature.
 */

const log = createLogger('system');

const FIXTURE_DELAY_MS = 180;

async function withFixtureDelay<T>(value: T): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, FIXTURE_DELAY_MS));
  return value;
}

/** Statuses that mean "nothing answered", as opposed to "the backend said no". */
const UNREACHABLE = new Set([0, 502, 503, 504]);

/**
 * Fixtures when they are on, or — in development only — when the backend did
 * not answer. Production never falls back: a health strip showing demo
 * heartbeats for a dead engine is the one thing this feature must not do.
 */
async function fetchOrFixture<T>(
  label: string,
  request: () => Promise<T>,
  fixture: () => T,
): Promise<T> {
  if (env.useFixtures) return withFixtureDelay(fixture());
  try {
    return await request();
  } catch (error) {
    const status = error instanceof ApiError ? error.status : null;
    if (env.isDev && status !== null && UNREACHABLE.has(status)) {
      log.warn(`${label}: backend unreachable, serving fixture data`, { status });
      return fixture();
    }
    throw error;
  }
}

export async function fetchSystemStatus(): Promise<SystemStatus> {
  return fetchOrFixture(
    'GET /live/system/status',
    async () => systemStatusSchema.parse(await apiClient.get<unknown>('/live/system/status')),
    () => systemStatusSchema.parse(fixtureSystemStatus()),
  );
}

export async function fetchLogTail(size: number): Promise<LogTail> {
  return fetchOrFixture(
    'GET /live/system/logs',
    async () =>
      logTailResponseSchema.parse(
        await apiClient.get<unknown>('/live/system/logs', { params: { size } }),
      ),
    () => logTailResponseSchema.parse({ entries: fixtureLogTail(size), truncated: true }),
  );
}

export function useSystemStatus() {
  return useQuery({
    queryKey: systemKeys.status(),
    queryFn: fetchSystemStatus,
    refetchInterval: LIVE_REFETCH_MS,
    refetchIntervalInBackground: false,
  });
}

export function useLogTail(size: number = LOG_TAIL_SIZE) {
  return useQuery({
    queryKey: systemKeys.logs(size),
    queryFn: () => fetchLogTail(size),
    // Logs move faster than portfolio valuations and are what someone watches
    // during an incident, so this polls harder than the rest of the live views.
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
    placeholderData: (previous) => previous,
  });
}

/** Hierarchical query keys for the system feature. */
export const systemKeys = {
  all: ['system'] as const,
  status: () => [...systemKeys.all, 'status'] as const,
  logs: (size: number) => [...systemKeys.all, 'logs', size] as const,
} as const;
