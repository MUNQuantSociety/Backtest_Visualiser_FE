import { env } from '@/config/env';
import { apiClient } from '@/lib/api-client';

import {
  logTailResponseSchema,
  systemStatusSchema,
  type LogTail,
  type SystemStatus,
} from '../types/system';

import { fixtureLogTail, fixtureSystemStatus } from './fixtures';

/**
 * Transport layer for system health and the log tail. Fixtures are swapped in
 * here and nowhere else, exactly as in the portfolios feature.
 */

const FIXTURE_DELAY_MS = 180;

async function withFixtureDelay<T>(value: T): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, FIXTURE_DELAY_MS));
  return value;
}

export async function fetchSystemStatus(): Promise<SystemStatus> {
  if (env.useFixtures) {
    return withFixtureDelay(systemStatusSchema.parse(fixtureSystemStatus()));
  }

  const data = await apiClient.get<unknown>('/live/system/status');
  return systemStatusSchema.parse(data);
}

export async function fetchLogTail(size: number): Promise<LogTail> {
  if (env.useFixtures) {
    return withFixtureDelay(
      logTailResponseSchema.parse({ entries: fixtureLogTail(size), truncated: true }),
    );
  }

  const data = await apiClient.get<unknown>('/live/system/logs', { params: { size } });
  return logTailResponseSchema.parse(data);
}
