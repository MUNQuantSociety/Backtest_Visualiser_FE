import { z } from 'zod';

import { formatNumber } from '@/utils/format';

import type { BacktestDetail } from './types';

const count = z.number().int().nonnegative().optional();
const snapshotSchema = z.object({
  date: z.iso.date(),
  momentumPct: z.number(),
  thresholdPct: z.number().nonnegative(),
});
const diagnosticsSchema = z.object({
  strategy: z.literal('VolMomentum'),
  volatilityMultiplier: z.number().positive().optional(),
  evaluationCount: count,
  warmupSkipCount: count,
  missingMarketDataSkipCount: count,
  bullishSignalCount: count,
  buyRequestCount: count,
  sellRequestCount: count,
  tickers: z.record(
    z.string(),
    z.object({ strongestMomentum: snapshotSchema.nullable().optional() }),
  ),
});

/** Only interpret diagnostics for the strategy and shape that recorded them. */
export function NoTradesExplanation({ run }: { run: BacktestDetail }) {
  if (run.status !== 'completed' || run.reportMetadata?.execution?.fillCount !== 0) return null;
  const parsed = diagnosticsSchema.safeParse(run.reportMetadata['strategyDiagnostics']);
  if (!parsed.success) return null;
  const diagnostics = parsed.data;
  const rows = Object.entries(diagnostics.tickers).map(([ticker, value]) => ({
    ticker,
    snapshot: value.strongestMomentum,
  }));

  return (
    <details className="rounded-md border bg-card">
      <summary className="cursor-pointer rounded-md px-4 py-3 text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        Why no trades?
      </summary>
      <div className="space-y-4 border-t px-4 py-4 text-sm">
        <p className="text-muted-foreground">
          Momentum must be above the entry threshold before this strategy can buy.
          {diagnostics.volatilityMultiplier !== undefined
            ? ` That threshold is ${formatNumber(diagnostics.volatilityMultiplier, 1)} times annualized volatility.`
            : ''}{' '}
          Each row shows the saved check with the highest momentum relative to its threshold.
        </p>
        {diagnostics.evaluationCount !== undefined ? (
          <p>
            {formatNumber(diagnostics.evaluationCount, 0)} ticker checks evaluated
            {diagnostics.bullishSignalCount !== undefined
              ? ` · ${formatNumber(diagnostics.bullishSignalCount, 0)} entry signals`
              : ''}
            {diagnostics.buyRequestCount !== undefined
              ? ` · ${formatNumber(diagnostics.buyRequestCount, 0)} buy requests`
              : ''}
            {diagnostics.sellRequestCount !== undefined
              ? ` · ${formatNumber(diagnostics.sellRequestCount, 0)} sell requests`
              : ''}
          </p>
        ) : null}
        {diagnostics.warmupSkipCount !== undefined &&
        diagnostics.missingMarketDataSkipCount !== undefined ? (
          <p className="text-muted-foreground">
            {diagnostics.warmupSkipCount === 0 && diagnostics.missingMarketDataSkipCount === 0
              ? 'No checks were skipped for missing prices or insufficient history.'
              : `${formatNumber(diagnostics.warmupSkipCount, 0)} checks skipped for insufficient history; ${formatNumber(diagnostics.missingMarketDataSkipCount, 0)} for missing prices.`}
          </p>
        ) : null}
        {rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[460px] text-left text-sm">
              <caption className="sr-only">Closest recorded entry check for each ticker</caption>
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Ticker
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Date
                  </th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">
                    Momentum
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    Required entry threshold
                  </th>
                </tr>
              </thead>
              <tbody className="tabular">
                {rows.map(({ ticker, snapshot }) => (
                  <tr key={ticker} className="border-b last:border-0">
                    <th scope="row" className="py-2 pr-4 font-medium">
                      {ticker}
                    </th>
                    <td className="py-2 pr-4 text-muted-foreground">{snapshot?.date ?? '—'}</td>
                    <td className="py-2 pr-4 text-right">
                      {snapshot ? `${formatNumber(snapshot.momentumPct)}%` : '—'}
                    </td>
                    <td className="py-2 text-right">
                      {snapshot ? `${formatNumber(snapshot.thresholdPct)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Matching the threshold is not enough; momentum must exceed it. These are the recorded
          entry checks for this run.
        </p>
      </div>
    </details>
  );
}
