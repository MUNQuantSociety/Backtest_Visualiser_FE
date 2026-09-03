import {
  ColorType,
  createChart,
  LineSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type Time,
} from 'lightweight-charts';
import { useEffect, useMemo, useRef } from 'react';

import type { BacktestDetail, EquityPoint } from '@/features/backtests';
import { seriesColor } from '@/lib/chart-theme';
import { useChartPalette } from '@/utils/use-chart-palette';

/** One line on the chart. `colorIndex` picks from the series palette. */
export interface ComparisonSeries {
  id: string;
  title: string;
  points: readonly EquityPoint[];
  colorIndex?: number | undefined;
}

interface ComparisonChartProps {
  /** Runs to overlay; each is titled by its run name. */
  backtests?: readonly BacktestDetail[] | undefined;
  /** Or arbitrary series — a book of strategies, say — with their own titles. */
  series?: readonly ComparisonSeries[] | undefined;
  /**
   * A reference line drawn dashed in the benchmark grey. Rebased with the
   * rest, so the gap to it is what doing nothing would have earned.
   */
  benchmark?: { title: string; points: readonly EquityPoint[] } | undefined;
}

function rebased(points: readonly EquityPoint[]): LineData<Time>[] {
  const base = points[0]?.equity;
  if (base === undefined || base === 0) return [];
  return points.map((point) => ({ time: point.date, value: (point.equity / base) * 100 }));
}

/**
 * Several equity curves on one axis, each rebased to 100 at its own start.
 *
 * Rebasing is not cosmetic. Runs can start from different capital, over
 * different windows, and plotting raw account value would rank them by how much
 * money they were given rather than how well they performed. Rebased, the
 * vertical distance between two lines is the difference in return, which is the
 * only question this chart is asked.
 *
 * Lines rather than areas: filled areas would occlude each other and the whole
 * point here is reading several series against one another.
 */
export function ComparisonChart({ backtests, series, benchmark }: ComparisonChartProps) {
  // Either prop shape becomes the same list, so the drawing code has one path.
  const lines = useMemo<readonly ComparisonSeries[]>(
    () =>
      series ??
      (backtests ?? []).map((backtest, index) => ({
        id: backtest.id,
        title: backtest.name,
        points: backtest.equityCurve,
        colorIndex: index,
      })),
    [backtests, series],
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Line'>[]>([]);
  const palette = useChartPalette();
  /*
   * The palette as it stood on the first render, for the create-once effect
   * below. Reading `palette` there directly would make the chart a dependency
   * of the theme and rebuild the whole thing on every light/dark flip; the
   * theme effect further down is what keeps colours current.
   */
  const paletteRef = useRef(palette);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        attributionLogo: false,
        // The library defaults `textColor` to a near-black (#191919), so every
        // axis label painted before the theme effect first runs is black text
        // on a dark card. Set it here as well as there.
        textColor: paletteRef.current.mutedText,
      },
      // Crosshair readouts are canvas text, and the library picks black or
      // white from the label background's luminance. Pinning the background to
      // the card colour is what makes that choice come out white.
      crosshair: {
        vertLine: { labelBackgroundColor: paletteRef.current.background },
        horzLine: { labelBackgroundColor: paletteRef.current.background },
      },
      rightPriceScale: { scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { fixLeftEdge: true, fixRightEdge: true },
      handleScale: { axisPressedMouseMove: { time: true, price: false } },
    });

    chartRef.current = chart;
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = [];
    };
  }, []);

  useEffect(() => {
    chartRef.current?.applyOptions({
      layout: { textColor: palette.mutedText },
      crosshair: {
        vertLine: { labelBackgroundColor: palette.background },
        horzLine: { labelBackgroundColor: palette.background },
      },
      grid: { vertLines: { color: palette.grid }, horzLines: { color: palette.grid } },
      rightPriceScale: { borderColor: palette.grid },
      timeScale: { borderColor: palette.grid },
    });
  }, [palette]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    // Rebuilt on every change: the selection is what drives this chart, and
    // diffing series against a set the user is actively toggling is more code
    // than redrawing a handful of lines.
    for (const series of seriesRef.current) chart.removeSeries(series);
    seriesRef.current = [];

    lines.forEach((line, index) => {
      const points = rebased(line.points);
      if (points.length === 0) return;

      const series = chart.addSeries(LineSeries, {
        color: seriesColor(palette, line.colorIndex ?? index),
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
        title: line.title,
        /*
         * The name-and-value badge on the price scale, not a price line: that
         * is already off. Its background otherwise defaults to the series
         * colour, and the library derives the label's text colour from that
         * background's luminance, so every one of these light series colours
         * produced dark text that was hard to read. Pinning the badge to the
         * card colour is what makes the text come out white; the series stays
         * identifiable by the line, which keeps its own colour.
         */
        priceLineColor: palette.background,
      });

      series.setData(points);
      seriesRef.current.push(series);
    });

    if (benchmark) {
      const points = rebased(benchmark.points);
      if (points.length > 0) {
        const series = chart.addSeries(LineSeries, {
          color: palette.benchmark,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          priceLineVisible: false,
          lastValueVisible: true,
          title: benchmark.title,
          priceLineColor: palette.background,
        });
        series.setData(points);
        seriesRef.current.push(series);
      }
    }

    chart.timeScale().fitContent();
  }, [lines, benchmark, palette]);

  return (
    <div ref={containerRef} className="size-full" role="img" aria-label="Strategy comparison" />
  );
}
