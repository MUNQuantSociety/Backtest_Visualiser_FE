import { useState } from 'react';
import { Link } from 'react-router';

import { paths } from '@/app/paths';
import { ChartContainer } from '@/components/charts/chart-container';
import { DemoBadge } from '@/components/common/demo-badge';
import { PageHeader } from '@/components/common/page-header';
import { StatTile } from '@/components/common/stat-tile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Segmented } from '@/components/ui/segmented';
import { SentimentGauge, useIndicators } from '@/features/market';
import { EquityCurveChart } from '@/features/performance';
import {
  BookPositionsTable,
  bookPositions,
  bookSentiment,
  currentDrawdown,
  FillsTable,
  fillsToday,
  FlattenBookDialog,
  HeartbeatStrip,
  HeldSentiment,
  heldRows,
  LIVE_PERIODS,
  mtdReturn,
  periodDays,
  RiskReportDialog,
  SectorExposureTable,
  SleevesTable,
  sleeveRows,
  useAttribution,
  useMasterEquity,
  usePortfolios,
  usePortfolioTotals,
  useRisk,
  useSleeveDetails,
  useSleeveEquities,
  useSleeveExecutions,
  ytdReturn,
  type LivePeriod,
} from '@/features/portfolios';
import {
  formatCompact,
  formatCurrency,
  formatNumber,
  formatPercent,
  formatSigned,
} from '@/utils/format';
import { toneFromValue } from '@/utils/tone';

/** Calendar days that comfortably hold 60 sessions for the sleeve sparklines. */
const SPARK_DAYS = 100;
const POSITIONS_SHOWN = 10;
const FILLS_SHOWN = 12;

/**
 * MQS Master's overview: the master book across every sleeve.
 *
 * Same tokens as the backtest pages, denser, with the engine's heartbeat in
 * the header so nothing below it is trusted without one. Every figure is
 * rolled up client-side from the sleeves the list already returns, so the
 * headline can never disagree with the rows beneath it.
 */
export default function LiveOverviewPage() {
  const [period, setPeriod] = useState<LivePeriod>('1M');

  const { data: portfolios, isPending: listPending } = usePortfolios();
  const sleeves = portfolios?.items ?? [];
  const ids = sleeves.map((sleeve) => sleeve.id);
  const { totals } = usePortfolioTotals();

  const { data: master, isPending: masterPending } = useMasterEquity(periodDays(period));
  // The KPIs need the year regardless of what the chart is showing.
  const { data: yearSeries } = useMasterEquity(periodDays('YTD'));
  const { data: attribution, isPending: attributionPending } = useAttribution();
  const { data: risk } = useRisk();
  const details = useSleeveDetails(ids);
  const equities = useSleeveEquities(ids, SPARK_DAYS);
  const executions = useSleeveExecutions(ids);

  const detailMap = new Map(details.data.map((detail) => [detail.id, detail]));
  const rows = sleeveRows(sleeves, equities.byId, detailMap);
  const positions = bookPositions(details.data, attribution?.tickerSectors ?? {});
  const tickers = [...new Set(positions.map((position) => position.ticker))];
  const { data: indicators, isPending: indicatorsPending } = useIndicators(tickers);
  const held = heldRows(indicators ?? [], positions);
  const fills = fillsToday(
    sleeves.map((sleeve) => ({ sleeve, items: executions.byId.get(sleeve.id) ?? [] })),
  );

  const points = master?.points ?? [];
  const yearPoints = yearSeries?.points ?? [];
  const nav = totals?.totalValue ?? 0;
  const day = totals?.dayPnl ?? 0;
  const mtd = mtdReturn(yearPoints);
  const ytd = ytdReturn(yearPoints);
  const drawdown = currentDrawdown(yearPoints);
  const grossNotional = positions.reduce(
    (sum, position) => sum + Math.abs(position.marketValue),
    0,
  );
  const placeholder = '—';
  const loadingTotals = listPending && !totals;

  return (
    <>
      <PageHeader
        title="Live Trading"
        description={`Master book across ${String(sleeves.filter((s) => s.state === 'running').length || sleeves.length)} sleeves. Every number is from fills, not simulation.`}
        actions={
          <>
            <Segmented
              value={period}
              options={LIVE_PERIODS.map((value) => ({ value, label: value }))}
              onChange={setPeriod}
              ariaLabel="NAV chart window"
            />
            <RiskReportDialog nav={nav} />
            <FlattenBookDialog
              positionCount={positions.length}
              grossNotional={grossNotional}
              disabled={positions.length === 0}
            />
          </>
        }
      />

      <HeartbeatStrip />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <StatTile
          size="dense"
          label="NAV"
          value={totals ? `$${formatCompact(nav)}` : placeholder}
          hint={totals ? `${formatCurrency(nav)} · ${formatCurrency(totals.cash)} cash` : undefined}
          isLoading={loadingTotals}
        />
        <StatTile
          size="dense"
          label="Day P&L"
          value={totals ? formatSigned(day, (n) => formatCurrency(n)) : placeholder}
          tone={totals ? toneFromValue(day) : 'neutral'}
          hint={totals && nav > 0 ? formatSigned(day / nav, (n) => formatPercent(n)) : undefined}
          isLoading={loadingTotals}
        />
        <StatTile
          size="dense"
          label="MTD"
          value={yearPoints.length ? formatSigned(mtd, (n) => formatPercent(n)) : placeholder}
          tone={yearPoints.length ? toneFromValue(mtd) : 'neutral'}
          hint={yearPoints.length ? formatSigned(mtd * nav, (n) => formatCurrency(n)) : undefined}
          isLoading={!yearSeries}
        />
        <StatTile
          size="dense"
          label="YTD"
          value={yearPoints.length ? formatSigned(ytd, (n) => formatPercent(n)) : placeholder}
          tone={yearPoints.length ? toneFromValue(ytd) : 'neutral'}
          hint={yearPoints.length ? formatSigned(ytd * nav, (n) => formatCurrency(n)) : undefined}
          isLoading={!yearSeries}
        />
        <StatTile
          size="dense"
          label="Drawdown"
          value={yearPoints.length ? formatPercent(drawdown.drawdown) : placeholder}
          tone={drawdown.drawdown < -0.0005 ? 'loss' : 'neutral'}
          hint={drawdown.peakDate ? `peak ${drawdown.peakDate}` : undefined}
          isLoading={!yearSeries}
        />
        <StatTile
          size="dense"
          label="Gross exposure"
          value={risk ? `${formatNumber(risk.grossExposure, 2)}× NAV` : placeholder}
          hint={
            risk
              ? `net ${formatSigned(risk.netExposure, (n) => formatPercent(n, 0))} · β ${formatNumber(risk.betaToSpy, 2)}`
              : undefined
          }
          isLoading={!risk}
        />
        <StatTile
          size="dense"
          label="1-day VaR 95%"
          value={risk ? formatPercent(risk.var95) : placeholder}
          hint={
            risk
              ? `${formatCurrency(risk.var95 * nav)} · ES ${formatPercent(risk.expectedShortfall95)}`
              : undefined
          }
          isLoading={!risk}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <ChartContainer
          title="NAV and drawdown"
          description="Marked to close; today's point is live. SPY is the same capital held passively."
          height={340}
          isLoading={masterPending}
        >
          <EquityCurveChart data={points} showBenchmark showDrawdownPane />
        </ChartContainer>

        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-[15px]">Sleeves</CardTitle>
              <CardDescription>
                One row per live portfolio. Sparkline is the last 60 sessions.
              </CardDescription>
            </div>
            <Link
              to={paths.portfolios}
              className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
            >
              Portfolios →
            </Link>
          </CardHeader>
          <CardContent>
            <SleevesTable rows={rows} isLoading={listPending} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-[15px]">
              Sector exposure and MTD attribution <DemoBadge />
            </CardTitle>
            <CardDescription>
              Left: long and short as % of NAV. Right: what each sector added or cost this month, in
              bps of NAV.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SectorExposureTable
              sectors={attribution?.sectors ?? []}
              isLoading={attributionPending}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-[15px]">
                Sentiment on held names <DemoBadge />
              </CardTitle>
              <CardDescription>
                7-day article score per position, weighted by |weight|. Red on a long is what to
                look at first.
              </CardDescription>
            </div>
            <SentimentGauge label="Book" score={bookSentiment(held)} />
          </CardHeader>
          <CardContent>
            <HeldSentiment rows={held} isLoading={indicatorsPending || details.isPending} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-[15px]">Positions</CardTitle>
            <CardDescription className="tabular">
              {String(Math.min(POSITIONS_SHOWN, positions.length))} of {String(positions.length)} ·
              by |weight| ·{' '}
              <Link to={paths.portfolios} className="hover:text-foreground">
                all →
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BookPositionsTable
              positions={positions.slice(0, POSITIONS_SHOWN)}
              isLoading={details.isPending}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-[15px]">Fills today</CardTitle>
            <CardDescription className="tabular">
              {String(fills.length)} ·{' '}
              <Link to={paths.log} className="hover:text-foreground">
                Log →
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FillsTable fills={fills.slice(0, FILLS_SHOWN)} isLoading={executions.isPending} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
