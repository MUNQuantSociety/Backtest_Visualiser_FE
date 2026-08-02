import {
  AreaSeries,
  ColorType,
  createChart,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type AreaData,
  type LineData,
  type Time,
} from 'lightweight-charts';
import { useEffect, useRef } from 'react';

import type { EquityPoint } from '@/features/backtests';
import { useChartPalette } from '@/utils/use-chart-palette';

interface EquityCurveChartProps {
  data: readonly EquityPoint[];
  /** Draw the benchmark series when the payload includes one. */
  showBenchmark?: boolean;
}

/**
 * lightweight-charts is imperative and owns its own DOM, so it lives behind a
 * ref and is created once. Data and colours are pushed in via separate effects —
 * recreating the chart on every data change would reset the user's zoom.
 */
export function EquityCurveChart({ data, showBenchmark = true }: EquityCurveChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const equitySeriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const benchmarkSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const palette = useChartPalette();

  // Create the chart once, on mount.
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
    equitySeriesRef.current = chart.addSeries(AreaSeries, {
      lineWidth: 2,
      priceLineVisible: false,
    });
    benchmarkSeriesRef.current = chart.addSeries(LineSeries, {
      lineWidth: 1,
      lineStyle: 2, // dashed
      priceLineVisible: false,
      lastValueVisible: false,
    });

    return () => {
      chart.remove();
      chartRef.current = null;
      equitySeriesRef.current = null;
      benchmarkSeriesRef.current = null;
    };
  }, []);

  // Re-apply colours whenever the theme flips.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    chart.applyOptions({
      layout: { textColor: palette.mutedText },
      grid: {
        vertLines: { color: palette.grid },
        horzLines: { color: palette.grid },
      },
      rightPriceScale: { borderColor: palette.grid },
      timeScale: { borderColor: palette.grid },
    });

    const [primary, , tertiary] = palette.series;
    equitySeriesRef.current?.applyOptions({
      lineColor: primary,
      topColor: `color-mix(in oklab, ${primary} 35%, transparent)`,
      bottomColor: `color-mix(in oklab, ${primary} 0%, transparent)`,
    });
    benchmarkSeriesRef.current?.applyOptions({ color: tertiary });
  }, [palette]);

  // Push data; keep the chart instance and the user's viewport intact.
  useEffect(() => {
    const equitySeries = equitySeriesRef.current;
    const benchmarkSeries = benchmarkSeriesRef.current;
    if (!equitySeries || !benchmarkSeries) return;

    const equityData: AreaData<Time>[] = data.map((point) => ({
      time: point.date,
      value: point.equity,
    }));
    equitySeries.setData(equityData);

    const hasBenchmark =
      showBenchmark &&
      data.some((point) => point.benchmark !== null && point.benchmark !== undefined);

    if (hasBenchmark) {
      const benchmarkData: LineData<Time>[] = data
        .filter(
          (point): point is EquityPoint & { benchmark: number } =>
            typeof point.benchmark === 'number',
        )
        .map((point) => ({ time: point.date, value: point.benchmark }));
      benchmarkSeries.setData(benchmarkData);
    } else {
      benchmarkSeries.setData([]);
    }

    chartRef.current?.timeScale().fitContent();
  }, [data, showBenchmark]);

  return <div ref={containerRef} className="size-full" role="img" aria-label="Equity curve" />;
}
