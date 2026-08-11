import {
  ColorType,
  createChart,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type Time,
} from 'lightweight-charts';
import { useEffect, useRef } from 'react';

import type { BacktestDetail } from '@/features/backtests';
import { seriesColor } from '@/lib/chart-theme';
import { useChartPalette } from '@/utils/use-chart-palette';

interface ComparisonChartProps {
  backtests: readonly BacktestDetail[];
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
export function ComparisonChart({ backtests }: ComparisonChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Line'>[]>([]);
  const palette = useChartPalette();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        attributionLogo: false,
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

    backtests.forEach((backtest, index) => {
      const base = backtest.equityCurve[0]?.equity;
      if (base === undefined || base === 0) return;

      const series = chart.addSeries(LineSeries, {
        color: seriesColor(palette, index),
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
        title: backtest.name,
      });

      const points: LineData<Time>[] = backtest.equityCurve.map((point) => ({
        time: point.date,
        value: (point.equity / base) * 100,
      }));
      series.setData(points);
      seriesRef.current.push(series);
    });

    chart.timeScale().fitContent();
  }, [backtests, palette]);

  return (
    <div ref={containerRef} className="size-full" role="img" aria-label="Strategy comparison" />
  );
}
