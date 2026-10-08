import { CandlestickChart, Plus, Search, X } from 'lucide-react';
import { useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import { ChartContainer } from '@/components/charts/chart-container';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Segmented } from '@/components/ui/segmented';
import { env } from '@/config/env';
import { RunBacktestDialog, TickerCombobox } from '@/features/backtests';
import {
  CANDLE_RANGES,
  CandleChart,
  candleWindow,
  useCandles,
  useFmpIndicators,
  useIndicatorSeries,
  type CandleRange,
  type ChartLine,
} from '@/features/market';
import {
  RULE_INDICATOR_NAMES,
  RULE_INDICATORS,
  RuleBuilder,
  StrategyEditor,
  type RuleIndicator,
} from '@/features/strategies';
import { ApiError } from '@/lib/api-client';

const RANGE_OPTIONS = CANDLE_RANGES.map((range) => ({ value: range, label: range }));
type AuthorMode = 'rules' | 'code';
const AUTHOR_MODES = [
  { value: 'rules' as const, label: 'No code' },
  { value: 'code' as const, label: 'Write code' },
];
const TICKER_PATTERN = /^[A-Z0-9^][A-Z0-9.^=-]{0,19}$/;
/** More than this and the panels below the candles get too short to read. */
const MAX_LINES = 4;

interface LineChoice {
  indicator: RuleIndicator;
  period: number;
}

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
  const [lineChoices, setLineChoices] = useState<LineChoice[]>([]);
  const searchRef = useRef<HTMLLabelElement>(null);
  const validTicker = TICKER_PATTERN.test(ticker) ? ticker : '';
  const candles = useCandles(validTicker, range);
  const chartWindow = candleWindow(range);
  const series = useIndicatorSeries(validTicker, chartWindow, lineChoices);
  // Rebuilt only when a line's data or the list changes, not on every render:
  // the chart redraws its lines whenever this array is a new one.
  const lines = useMemo<ChartLine[]>(
    () =>
      lineChoices.flatMap((choice, index) => {
        const data = series.data[index];
        if (!data) return [];
        const info = RULE_INDICATORS[choice.indicator];
        return [
          {
            key: `${choice.indicator}-${String(choice.period)}`,
            label: `${info.short} ${String(choice.period)}`,
            pane: info.pane,
            points: data.points,
          },
        ];
      }),
    [lineChoices, series.data],
  );
  const lineErrors = series.errors.flatMap((message, index) => {
    const choice = lineChoices[index];
    if (message === null || !choice) return [];
    return [`${RULE_INDICATORS[choice.indicator].short} ${String(choice.period)}: ${message}`];
  });

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
        height={520}
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
        <ChartBody
          ticker={ticker}
          candles={candles}
          lines={lines}
          indicatorBar={
            <IndicatorBar
              choices={lineChoices}
              loading={series.isFetching}
              errors={lineErrors}
              onChange={setLineChoices}
            />
          }
        />
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
        <CardContent>
          {authorMode === 'rules' ? <RuleBuilder ticker={validTicker} /> : <StrategyEditor />}
        </CardContent>
      </Card>
    </div>
  );
}

function ChartBody({
  ticker,
  candles,
  lines,
  indicatorBar,
}: {
  ticker: string;
  candles: ReturnType<typeof useCandles>;
  lines: readonly ChartLine[];
  indicatorBar: ReactNode;
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
  return (
    <div className="flex size-full flex-col gap-2">
      {indicatorBar}
      <div className="min-h-0 flex-1">
        <CandleChart candles={candles.data} lines={lines} />
      </div>
    </div>
  );
}

/**
 * Pick FMP indicators to draw over the chart: the same series a rule-built
 * strategy trades on, so a rule can be checked against what it will read.
 * Only indicators the server lists are offered.
 */
function IndicatorBar({
  choices,
  loading,
  errors,
  onChange,
}: {
  choices: readonly LineChoice[];
  loading: boolean;
  errors: readonly string[];
  onChange: (choices: LineChoice[]) => void;
}) {
  const catalogue = useFmpIndicators();
  const available = catalogue.data
    ? RULE_INDICATOR_NAMES.filter((name) => catalogue.data.some((item) => item.name === name))
    : RULE_INDICATOR_NAMES;
  const [indicator, setIndicator] = useState<RuleIndicator>('sma');
  const [period, setPeriod] = useState<number>(RULE_INDICATORS.sma.defaultPeriod);
  const selectId = useId();
  const periodId = useId();
  const validPeriod = Number.isInteger(period) && period >= 2 && period <= 250;
  const duplicate = choices.some(
    (choice) => choice.indicator === indicator && choice.period === period,
  );
  const full = choices.length >= MAX_LINES;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <label htmlFor={selectId} className="text-muted-foreground">
        Indicators
      </label>
      <select
        id={selectId}
        value={indicator}
        onChange={(event) => {
          const next = event.target.value as RuleIndicator;
          setIndicator(next);
          setPeriod(RULE_INDICATORS[next].defaultPeriod);
        }}
        className="h-7 rounded-md border border-input bg-background px-1.5"
      >
        {available.map((name) => (
          <option key={name} value={name}>
            {RULE_INDICATORS[name].label}
          </option>
        ))}
      </select>
      <label htmlFor={periodId} className="sr-only">
        Period in days
      </label>
      <input
        id={periodId}
        type="number"
        min={2}
        max={250}
        step={1}
        value={Number.isFinite(period) ? period : ''}
        onChange={(event) => {
          setPeriod(event.target.valueAsNumber);
        }}
        className="tabular h-7 w-14 rounded-md border border-input bg-background px-1.5"
      />
      <span className="text-muted-foreground">days</span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7"
        disabled={!validPeriod || duplicate || full}
        title={full ? `At most ${String(MAX_LINES)} indicators` : undefined}
        onClick={() => {
          onChange([...choices, { indicator, period }]);
        }}
      >
        <Plus className="mr-1 size-3" aria-hidden />
        Add
      </Button>
      {choices.map((choice) => {
        const label = `${RULE_INDICATORS[choice.indicator].short} ${String(choice.period)}`;
        return (
          <span
            key={`${choice.indicator}-${String(choice.period)}`}
            className="tabular flex items-center gap-1 rounded-md border border-border py-0.5 pr-0.5 pl-1.5"
          >
            {label}
            <button
              type="button"
              aria-label={`Remove ${label}`}
              onClick={() => {
                onChange(choices.filter((existing) => existing !== choice));
              }}
              className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" aria-hidden />
            </button>
          </span>
        );
      })}
      {loading ? <span className="text-muted-foreground">Loading…</span> : null}
      {errors.map((message) => (
        <span key={message} role="alert" className="text-[var(--loss)]">
          {message}
        </span>
      ))}
    </div>
  );
}
