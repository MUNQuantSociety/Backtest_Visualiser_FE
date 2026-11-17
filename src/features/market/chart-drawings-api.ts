import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { env } from '@/config/env';
import { apiClient } from '@/lib/api-client';

import {
  MAX_NOTE_LENGTH,
  saveDrawings as saveLocalDrawings,
  type Drawing,
} from './components/chart-drawings-model';

/**
 * Chart drawings saved on the backend, per member and ticker:
 * `GET` and `PUT /chart-drawings/{ticker}`. The chart sends its whole list
 * after each change, so the last save wins. Fixture sessions have no backend
 * and keep drawings in this browser instead.
 */

const drawingSchema = z
  .object({
    id: z.string(),
    tool: z.enum(['trend', 'ray', 'horizontal', 'vertical', 'rectangle', 'fib', 'text']),
    points: z
      .array(z.object({ date: z.string(), price: z.number() }))
      .min(1)
      .max(2),
    text: z.string().max(MAX_NOTE_LENGTH).nullish(),
  })
  .transform(({ text, ...drawing }): Drawing => (text ? { ...drawing, text } : drawing));

const responseSchema = z.object({
  ticker: z.string(),
  drawings: z.array(drawingSchema),
  updatedAt: z.string().nullable(),
});

export type ChartDrawingsResponse = z.infer<typeof responseSchema>;

export const chartDrawingKeys = {
  ticker: (ticker: string) => ['chart-drawings', ticker] as const,
};

export async function fetchChartDrawings(
  ticker: string,
  signal?: AbortSignal,
): Promise<ChartDrawingsResponse> {
  const data = await apiClient.get<unknown>(`/chart-drawings/${encodeURIComponent(ticker)}`, {
    ...(signal ? { signal } : {}),
  });
  return responseSchema.parse(data);
}

export async function saveChartDrawings(
  ticker: string,
  drawings: readonly Drawing[],
): Promise<ChartDrawingsResponse> {
  const data = await apiClient.put<unknown>(`/chart-drawings/${encodeURIComponent(ticker)}`, {
    drawings,
  });
  return responseSchema.parse(data);
}

/**
 * Where a chart's drawings are kept. `saved` is the backend's list for
 * `ticker`, undefined until it loads (and always in fixture mode, which keeps
 * drawings in the browser). `persist` saves a list: one request at a time, in
 * order, so a quick series of edits cannot land out of order.
 */
export function useDrawingStorage(ticker: string) {
  const remote = !env.useFixtures;
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: chartDrawingKeys.ticker(ticker),
    queryFn: ({ signal }) => fetchChartDrawings(ticker, signal),
    enabled: remote && ticker.length > 0,
    // The chart is the only writer, and it keeps this cache current itself.
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
  const mutation = useMutation({
    mutationFn: ({ key, drawings }: { key: string; drawings: readonly Drawing[] }) =>
      saveChartDrawings(key, drawings),
    scope: { id: 'chart-drawings' },
  });

  const persist = (key: string, drawings: readonly Drawing[]) => {
    if (!remote) {
      saveLocalDrawings(key, drawings);
      return;
    }
    queryClient.setQueryData<ChartDrawingsResponse>(chartDrawingKeys.ticker(key), {
      ticker: key,
      drawings: [...drawings],
      updatedAt: null,
    });
    mutation.mutate({ key, drawings });
    // The account copy is the one that counts now; drop any browser copy.
    saveLocalDrawings(key, []);
  };

  return {
    remote,
    saved: remote ? query.data?.drawings : undefined,
    loadError: query.isError ? query.error.message : null,
    saveError: mutation.isError ? mutation.error.message : null,
    persist,
  };
}
