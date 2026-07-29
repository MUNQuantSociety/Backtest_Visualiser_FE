import { env } from '@/config/env';
import { apiClient } from '@/lib/api-client';

import {
  correlationMatrixSchema,
  equitySeriesSchema,
  executionListResponseSchema,
  portfolioDetailSchema,
  portfolioListResponseSchema,
  type CorrelationMatrix,
  type EquitySeries,
  type ExecutionFilters,
  type PortfolioDetail,
} from '../types/portfolio';

import {
  fixtureCorrelations,
  fixtureEquity,
  fixtureExecutions,
  fixturePortfolio,
  fixturePortfolios,
} from './fixtures';

/**
 * Transport layer for MQS Master's live portfolios. Every function returns
 * parsed, validated data — callers get a `PortfolioDetail`, never a raw
 * `unknown`. No React here, so these stay trivially testable outside hooks.
 *
 * Fixtures are swapped in at this layer and nowhere else. Components, hooks and
 * query keys are identical in both modes, which is what makes deleting the
 * fixture path a one-line change once a real server answers.
 */

/** Fake latency, so loading states are visible in the demo instead of flashing. */
const FIXTURE_DELAY_MS = 220;

async function withFixtureDelay<T>(value: T): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, FIXTURE_DELAY_MS));
  return value;
}

export async function fetchPortfolios() {
  if (env.useFixtures) {
    const items = fixturePortfolios();
    return withFixtureDelay(
      portfolioListResponseSchema.parse({
        items,
        total: items.length,
        page: 1,
        pageSize: items.length,
      }),
    );
  }

  const data = await apiClient.get<unknown>('/live/portfolios');
  return portfolioListResponseSchema.parse(data);
}

export async function fetchPortfolio(id: string): Promise<PortfolioDetail> {
  if (env.useFixtures) {
    return withFixtureDelay(portfolioDetailSchema.parse(fixturePortfolio(id)));
  }

  const data = await apiClient.get<unknown>(`/live/portfolios/${encodeURIComponent(id)}`);
  return portfolioDetailSchema.parse(data);
}

export async function fetchPortfolioEquity(id: string, days: number): Promise<EquitySeries> {
  if (env.useFixtures) {
    return withFixtureDelay(
      equitySeriesSchema.parse({ points: fixtureEquity(id, days), downsampled: false }),
    );
  }

  const data = await apiClient.get<unknown>(`/live/portfolios/${encodeURIComponent(id)}/equity`, {
    params: { days },
  });
  return equitySeriesSchema.parse(data);
}

export async function fetchPortfolioExecutions(id: string, filters: ExecutionFilters = {}) {
  if (env.useFixtures) {
    const all = fixtureExecutions(id);
    const pageSize = filters.pageSize ?? 25;
    const page = filters.page ?? 1;
    const start = (page - 1) * pageSize;

    return withFixtureDelay(
      executionListResponseSchema.parse({
        items: all.slice(start, start + pageSize),
        total: all.length,
        page,
        pageSize,
      }),
    );
  }

  const data = await apiClient.get<unknown>(
    `/live/portfolios/${encodeURIComponent(id)}/executions`,
    { params: filters },
  );
  return executionListResponseSchema.parse(data);
}

export async function fetchPortfolioCorrelations(id: string): Promise<CorrelationMatrix> {
  if (env.useFixtures) {
    return withFixtureDelay(correlationMatrixSchema.parse(fixtureCorrelations(id)));
  }

  const data = await apiClient.get<unknown>(
    `/live/portfolios/${encodeURIComponent(id)}/correlations`,
  );
  return correlationMatrixSchema.parse(data);
}
