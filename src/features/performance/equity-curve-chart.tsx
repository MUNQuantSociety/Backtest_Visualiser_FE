import {
  BaselineSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  LineSeries,
  TickMarkType,
  type AutoscaleInfo,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
} from 'lightweight-charts';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { EquityPoint, Trade } from '@/features/backtests';
import { withAlpha } from '@/lib/chart-theme';
import { formatCompact, formatCurrency, formatPercent } from '@/utils/format';
import { drawdownSeries } from '@/utils/metrics';
import { useChartPalette } from '@/utils/use-chart-palette';

import { sampleTradeMarkers, tradeMarkers } from './chart-data';

interface EquityCurveChartProps {
  data: readonly EquityPoint[];
  showBenchmark?: boolean;
  showDrawdownPane?: boolean;
  /** Recorded trade lots; both entries and exits are shown. */
  trades?: readonly Trade[] | undefined;
}

const STRATEGY_COLOR = 'rgb(52, 152, 219)';
const BENCHMARK_COLOR = 'rgb(234, 179, 8)';

/** Account value and drawdown share one date axis and crosshair. */
export function EquityCurveChart({
  data,
  showBenchmark = true,
  showDrawdownPane = false,
  trades,
}: EquityCurveChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const equitySeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const drawdownSeriesRef = useRef<ISeriesApi<'Baseline'> | null>(null);
  const benchmarkSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [showTrades, setShowTrades] = useState(true);
  const palette = useChartPalette();
  const paletteRef = useRef(palette);
  const events = useMemo(() => tradeMarkers(data, trades ?? []), [data, trades]);
  const drawdowns = useMemo(() => drawdownSeries(data.map((point) => point.equity)), [data]);
  const hasBenchmark = showBenchmark && data.some((point) => typeof point.benchmark === 'number');
  const selectedIndex =
    hoveredDate === null ? -1 : data.findIndex((point) => point.date === hoveredDate);
  const readoutIndex = selectedIndex < 0 ? data.length - 1 : selectedIndex;
  const readout = data[readoutIndex];

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: paletteRef.current.mutedText,
        attributionLogo: false,
      },
      leftPriceScale: { visible: true, scaleMargins: { top: 0.08, bottom: 0.08 } },
      rightPriceScale: { visible: false },
      timeScale: {
        fixLeftEdge: true,
        fixRightEdge: true,
        borderVisible: false,
        tickMarkFormatter: (time: Time, type: TickMarkType) => {
          const date =
            typeof time === 'object'
              ? new Date(Date.UTC(time.year, time.month - 1, time.day))
              : new Date(typeof time === 'number' ? time * 1000 : time);
          return new Intl.DateTimeFormat('en-US', {
            timeZone: 'UTC',
            ...(type === TickMarkType.Year
              ? { year: 'numeric' as const }
              : type === TickMarkType.Month
                ? { month: 'short' as const, year: '2-digit' as const }
                : { month: 'short' as const, day: 'numeric' as const }),
          }).format(date);
        },
      },
      handleScale: { axisPressedMouseMove: { time: true, price: false } },
    });
    chartRef.current = chart;
    const priceFormat = {
      type: 'custom' as const,
      minMove: 0.01,
      formatter: (value: number) => '$' + formatCompact(value),
    };
    equitySeriesRef.current = chart.addSeries(LineSeries, {
      color: STRATEGY_COLOR,
      lineWidth: 2,
      priceScaleId: 'left',
      priceFormat,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    benchmarkSeriesRef.current = chart.addSeries(LineSeries, {
      color: BENCHMARK_COLOR,
      lineWidth: 2,
      lineStyle: 2,
      priceScaleId: 'left',
      priceFormat,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    if (showDrawdownPane) {
      drawdownSeriesRef.current = chart.addSeries(
        BaselineSeries,
        {
          baseValue: { type: 'price', price: 0 },
          priceScaleId: 'left',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          priceFormat: { type: 'percent' },
          autoscaleInfoProvider: (original: () => AutoscaleInfo | null) => {
            const info = original();
            if (info?.priceRange) info.priceRange.maxValue = 0;
            return info;
          },
        },
        1,
      );
      chart.panes()[0]?.setStretchFactor(3);
      chart.panes()[1]?.setStretchFactor(1);
      drawdownSeriesRef.current
        .priceScale()
        .applyOptions({ scaleMargins: { top: 0.12, bottom: 0.08 } });
    }
    chart.subscribeCrosshairMove((event) => {
      const time = event.time;
      setHoveredDate(
        typeof time === 'string'
          ? time
          : time && typeof time === 'object'
            ? [
                String(time.year),
                String(time.month).padStart(2, '0'),
                String(time.day).padStart(2, '0'),
              ].join('-')
            : null,
      );
    });
    return () => {
      chart.remove();
      chartRef.current = null;
      equitySeriesRef.current = null;
      benchmarkSeriesRef.current = null;
      drawdownSeriesRef.current = null;
      markersRef.current = null;
    };
  }, [showDrawdownPane]);

  useEffect(() => {
    chartRef.current?.applyOptions({
      layout: {
        textColor: palette.mutedText,
        fontFamily: getComputedStyle(document.documentElement).getPropertyValue('--font-mono'),
        fontSize: 11,
      },
      crosshair: {
        vertLine: { labelBackgroundColor: palette.background },
        horzLine: { labelBackgroundColor: palette.background },
      },
      grid: { vertLines: { color: palette.grid }, horzLines: { color: palette.grid } },
      leftPriceScale: { borderColor: palette.grid },
    });
    drawdownSeriesRef.current?.applyOptions({
      topLineColor: palette.loss,
      topFillColor1: withAlpha(palette.loss, 0),
      topFillColor2: withAlpha(palette.loss, 0),
      bottomLineColor: palette.loss,
      bottomFillColor1: withAlpha(palette.loss, 0.45),
      bottomFillColor2: withAlpha(palette.loss, 0.45),
    });
  }, [palette, showDrawdownPane]);

  useEffect(() => {
    equitySeriesRef.current?.setData(
      data.map((point) => ({ time: point.date, value: point.equity })),
    );
    benchmarkSeriesRef.current?.setData(
      hasBenchmark
        ? data.map((point) =>
            typeof point.benchmark === 'number'
              ? { time: point.date, value: point.benchmark }
              : { time: point.date },
          )
        : [],
    );
    drawdownSeriesRef.current?.setData(
      drawdowns.flatMap((point) => {
        const date = data[point.index]?.date;
        return date === undefined ? [] : [{ time: date, value: point.drawdown * 100 }];
      }),
    );
    chartRef.current?.timeScale().fitContent();
  }, [data, hasBenchmark, drawdowns, showDrawdownPane]);

  useEffect(() => {
    const chart = chartRef.current;
    const container = containerRef.current;
    if (!equitySeriesRef.current || !chart || !container) return;
    markersRef.current ??= createSeriesMarkers(equitySeriesRef.current);
    const indices = new Map(data.map((point, index) => [point.date, index]));
    const updateMarkers = () => {
      const range = chart.timeScale().getVisibleLogicalRange();
      const visible = events.filter((event) => {
        const index = indices.get(event.date);
        return index !== undefined && (!range || (index >= range.from && index <= range.to));
      });
      const sampled = sampleTradeMarkers(visible, Math.floor(container.clientWidth / 28));
      const markers: SeriesMarker<Time>[] = showTrades
        ? sampled.map((event) => ({
            time: event.date,
            position: event.action === 'Buy' ? 'belowBar' : 'aboveBar',
            // The library has no triangle shape; use a triangle glyph with no base shape.
            shape: 'circle',
            text: event.action === 'Buy' ? '▲' : '▼',
            color: event.action === 'Buy' ? palette.profit : palette.loss,
            size: 0,
          }))
        : [];
      markersRef.current?.setMarkers(markers);
    };
    updateMarkers();
    chart.timeScale().subscribeVisibleLogicalRangeChange(updateMarkers);
    const observer = new ResizeObserver(updateMarkers);
    observer.observe(container);
    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(updateMarkers);
      observer.disconnect();
    };
  }, [events, data, showTrades, palette, showDrawdownPane]);

  return (
    <div className="flex size-full min-h-0 min-w-0 flex-col gap-3">
      <div
        className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 text-xs"
        aria-label="Chart legend"
      >
        <span className="flex items-center gap-2">
          <span className="w-6 border-t-2" style={{ borderColor: STRATEGY_COLOR }} />
          Strategy value ($)
        </span>
        {hasBenchmark ? (
          <span className="flex items-center gap-2">
            <span
              className="w-6 border-t-2 border-dashed"
              style={{ borderColor: BENCHMARK_COLOR }}
            />
            Buy & hold benchmark ($)
          </span>
        ) : null}
        {events.length > 0 ? (
          <button
            type="button"
            aria-pressed={showTrades}
            onClick={() => setShowTrades((value) => !value)}
            className="flex cursor-pointer items-center gap-3 rounded border border-border px-2 py-1 hover:bg-accent"
            title="Toggle recorded trade entries and exits; multiple lots on a day share a marker"
          >
            <span>
              <span className="text-profit" aria-hidden="true">
                ▲
              </span>{' '}
              Buy
            </span>
            <span>
              <span className="text-loss" aria-hidden="true">
                ▼
              </span>{' '}
              Sell
            </span>
            <span className="text-muted-foreground">{showTrades ? 'Hide' : 'Show'}</span>
          </button>
        ) : null}
        {showDrawdownPane ? (
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-6 border-t border-loss bg-loss/45" />
            Drawdown (%)
          </span>
        ) : null}
      </div>
      <div
        className="flex min-h-8 shrink-0 flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums"
        aria-label="Chart values"
      >
        <span className="text-muted-foreground">{readout?.date ?? 'No observations'}</span>
        {readout ? (
          <>
            <span>
              Strategy <strong>{formatCurrency(readout.equity)}</strong>
            </span>
            {hasBenchmark ? (
              <span>
                Benchmark{' '}
                <strong>
                  {readout.benchmark == null ? '—' : formatCurrency(readout.benchmark)}
                </strong>
              </span>
            ) : null}
            {showDrawdownPane ? (
              <span>
                Drawdown <strong>{formatPercent(drawdowns[readoutIndex]?.drawdown ?? 0)}</strong>
              </span>
            ) : null}
          </>
        ) : null}
      </div>
      <div
        ref={containerRef}
        className="min-h-0 w-full min-w-0 flex-1"
        role="img"
        aria-label="Strategy value, buy-and-hold benchmark and drawdown over time"
      />
      {trades ? (
        <p className="shrink-0 text-xs text-muted-foreground">
          {events.length > 0
            ? 'Markers show recorded entries and exits, grouped by day. Dense views sample markers; zoom in for more.'
            : 'No recorded trade entries or exits in this date range.'}
        </p>
      ) : null}
    </div>
  );
}
