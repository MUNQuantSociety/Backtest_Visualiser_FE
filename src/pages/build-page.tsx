import { CandlestickChart, Search } from 'lucide-react';
import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { ChartContainer } from '@/components/charts/chart-container';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Segmented } from '@/components/ui/segmented';
import { env } from '@/config/env';
import { RunBacktestDialog, TickerCombobox } from '@/features/backtests';
import { CANDLE_RANGES, CandleChart, useCandles, type CandleRange } from '@/features/market';
import { RuleBuilder, StrategyEditor } from '@/features/strategies';
import { ApiError } from '@/lib/api-client';

const RANGE_OPTIONS = CANDLE_RANGES.map((range) => ({ value: range, label: range }));
type AuthorMode = 'rules' | 'code';
const AUTHOR_MODES = [
  { value: 'rules' as const, label: 'No code' },
  { value: 'code' as const, label: 'Write code' },
];
const TICKER_PATTERN = /^[A-Z0-9^][A-Z0-9.^=-]{0,19}$/;

/**
 * Look at a market, then write a strategy for it.
 *
 * The chart reads daily candles for any symbol FMP lists, through the
 * backend, so the provider key never reaches the browser. The ticker lives
 * in `?ticker=` so a chart is a link. Below it is the same strategy editor
 * the Backtests page opens in a dialog, behind a rule builder that needs
 * no code at all. Once a saved strategy passes validation, "Run backtest"
 * runs it from here.
 */
export default function BuildPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const ticker = (searchParams.get('ticker') ?? '').trim().toUpperCase();
  const [typed, setTyped] = useState('');
  const [range, setRange] = useState<CandleRange>('1Y');
  const [authorMode, setAuthorMode] = useState<AuthorMode>('rules');
  const searchRef = useRef<HTMLLabelElement>(null);
  const candles = useCandles(TICKER_PATTERN.test(ticker) ? ticker : '', range);

  function choose(symbol?: string) {
    const next = (symbol ?? typed).trim().toUpperCase();
    if (!TICKER_PATTERN.test(next)) return;
    setTyped('');
    const params = new URLSearchParams(searchParams);
    params.set('ticker', next);
    setSearchParams(params, { replace: true });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Build"
        description="Chart any ticker, then write a strategy and run it as a backtest."
        actions={<RunBacktestDialog />}
      />

      <ChartContainer
        title={ticker ? `${ticker} daily candles` : 'Daily candles'}
        description="Daily open, high, low and close from FMP, with volume below."
        height={460}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <label
              ref={searchRef}
              htmlFor="build-ticker"
              className="flex h-8 w-full items-center gap-1.5 rounded-md border border-border px-2 sm:w-80"
            >
              <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <TickerCombobox
                id="build-ticker"
                value={typed}
                onChange={setTyped}
                onSubmit={choose}
                onBlur={() => undefined}
                disabled={false}
                invalid={false}
                describedBy=""
                anchorRef={searchRef}
                label="Search ticker"
                placeholder="Search ticker or company…"
              />
            </label>
            <Segmented
              value={range}
              options={RANGE_OPTIONS}
              onChange={setRange}
              ariaLabel="Chart range"
            />
          </div>
        }
      >
        <ChartBody ticker={ticker} candles={candles} />
      </ChartContainer>

      <Card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div className="min-w-0 flex-1 space-y-1">
            <CardTitle className="text-base">Your strategy</CardTitle>
            <CardDescription>
              {authorMode === 'rules' ? (
                <>Choose when to buy and when to sell from plain-English rules; no coding needed.</>
              ) : (
                <>
                  Write <code className="tabular">OnData</code>, declare its indicators and state,
                  or upload a <code className="tabular">.py</code> file.
                </>
              )}{' '}
              Saving starts a validation run; once it passes, pick it in Run backtest with the
              tickers you charted.
            </CardDescription>
          </div>
          <Segmented
            value={authorMode}
            options={AUTHOR_MODES}
            onChange={setAuthorMode}
            ariaLabel="How to build the strategy"
          />
        </CardHeader>
        <CardContent>{authorMode === 'rules' ? <RuleBuilder /> : <StrategyEditor />}</CardContent>
      </Card>
    </div>
  );
}

function ChartBody({
  ticker,
  candles,
}: {
  ticker: string;
  candles: ReturnType<typeof useCandles>;
}) {
  if (!ticker) {
    return (
      <EmptyState
        icon={CandlestickChart}
        title="Search for a ticker"
        description="Type a symbol or company name above to chart its daily candles."
        className="h-full"
      />
    );
  }
  if (!TICKER_PATTERN.test(ticker)) {
    return <EmptyState title={`"${ticker}" is not a ticker symbol`} className="h-full" />;
  }
  if (env.useFixtures) {
    return (
      <EmptyState
        title="No market data in fixture mode"
        description="Candles come from FMP through the backend; turn fixtures off to chart them."
        className="h-full"
      />
    );
  }
  if (candles.isError) {
    const notFound = candles.error instanceof ApiError && candles.error.status === 404;
    return (
      <EmptyState
        title={notFound ? `FMP has no history for ${ticker}` : 'Candles could not be loaded'}
        description={notFound ? 'Check the symbol.' : candles.error.message}
        className="h-full"
      />
    );
  }
  if (candles.data === undefined) {
    return <div className="size-full animate-pulse rounded-md bg-muted/40" />;
  }
  if (candles.data.length === 0) {
    return (
      <EmptyState
        title={`No sessions for ${ticker} in this range`}
        description="Try a longer range, or check the symbol: FMP answers an unknown one with no bars."
        className="h-full"
      />
    );
  }
  return <CandleChart candles={candles.data} />;
}
