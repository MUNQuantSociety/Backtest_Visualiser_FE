import { apiClient } from '@/lib/api-client';

import {
  backtestDetailSchema,
  backtestListResponseSchema,
  type BacktestDetail,
  type BacktestFilters,
} from '../types/backtest';

/**
 * Transport layer for the backtests feature. Every function returns parsed,
 * validated data — callers get a `BacktestDetail`, never a raw `unknown`.
 * No React here: these stay trivially unit-testable and reusable outside hooks.
 */

export async function fetchBacktests(filters: BacktestFilters = {}) {
  const data = await apiClient.get<unknown>('/backtests', { params: filters });
  return backtestListResponseSchema.parse(data);
}

export async function fetchBacktest(id: string): Promise<BacktestDetail> {
  const data = await apiClient.get<unknown>(`/backtests/${encodeURIComponent(id)}`);
  return backtestDetailSchema.parse(data);
}

export async function deleteBacktest(id: string): Promise<void> {
  await apiClient.delete(`/backtests/${encodeURIComponent(id)}`);
}
