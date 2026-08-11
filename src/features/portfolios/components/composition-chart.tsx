import {
  AreaSeries,
  ColorType,
  createChart,
  type AreaData,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from 'lightweight-charts';
import { useEffect, useRef } from 'react';

import { seriesColor, withAlpha } from '@/lib/chart-theme';
import { useChartPalette } from '@/utils/use-chart-palette';

import type { CompositionSeries } from '../types';

interface CompositionChartProps {
  data: CompositionSeries | undefined;
}

/**
 * Notional value by component over time, stacked.
 *
 * lightweight-charts has no stacked-area series, so this uses the standard
 * trick: plot the *cumulative* total of each band and draw them back-to-front
 * (largest first). Every area fills down to zero, so each later series paints
 * over the one behind it and the visible slice is exactly that component's
 * contribution. Fills must be opaque for this — a translucent fill would let
 * the band underneath show through and every colour would be wrong.
 *
 * Canvas rather than SVG is the whole reason for the choice: at the minute
 * resolution this endpoint is meant to serve, a Recharts stacked area would be
 * emitting hundreds of thousands of DOM nodes.
 */
export function CompositionChart({ data }: CompositionChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'>[]>([]);
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
      rightPriceScale: { scaleMargins: { top: 0.1, bottom: 0 } },
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
    const chart = chartRef.current;
    if (!chart) return;

    chart.applyOptions({
      layout: { textColor: palette.mutedText },
      grid: { vertLines: { color: palette.grid }, horzLines: { color: palette.grid } },
      rightPriceScale: { borderColor: palette.grid },
      timeScale: { borderColor: palette.grid },
    });
  }, [palette]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !data) return;

    // Rebuilt rather than diffed: the band list changes only when the portfolio
    // does, and matching series to tickers incrementally is far more code than
    // this is worth.
    for (const series of seriesRef.current) chart.removeSeries(series);
    seriesRef.current = [];

    const tickers = Object.keys(data.holdings);
    // Cash sits at the bottom of the stack, under the holdings.
    const bands = [
      { label: 'Cash', values: data.cash, color: palette.neutral },
      ...tickers.map((ticker, index) => ({
        label: ticker,
        values: data.holdings[ticker] ?? [],
        color: seriesColor(palette, index),
      })),
    ];

    // Cumulative totals, then drawn largest-first so each paints over the last.
    const cumulative = bands.map((_band, bandIndex) =>
      data.timestamps.map((_timestamp, pointIndex) =>
        bands
          .slice(0, bandIndex + 1)
          .reduce((sum, other) => sum + (other.values[pointIndex] ?? 0), 0),
      ),
    );

    for (let index = bands.length - 1; index >= 0; index -= 1) {
      const band = bands[index];
      const totals = cumulative[index];
      if (!band || !totals) continue;

      const series = chart.addSeries(AreaSeries, {
        lineColor: band.color,
        lineWidth: 1,
        // Opaque: translucency would reveal the band behind and mix colours.
        topColor: band.color,
        bottomColor: withAlpha(band.color, 0.85),
        priceLineVisible: false,
        lastValueVisible: false,
        title: band.label,
      });

      const points: AreaData<Time>[] = data.timestamps.flatMap((timestamp, pointIndex) => {
        const value = totals[pointIndex];
        return value === undefined ? [] : [{ time: timestamp, value }];
      });
      series.setData(points);
      seriesRef.current.push(series);
    }

    chart.timeScale().fitContent();
  }, [data, palette]);

  return (
    <div ref={containerRef} className="size-full" role="img" aria-label="Portfolio composition" />
  );
}
