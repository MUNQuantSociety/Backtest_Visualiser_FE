import {
  AreaSeries,
  BaselineSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type AreaData,
  type BaselineData,
  type LineData,
  type SeriesMarker,
  type Time,
} from 'lightweight-charts';
import { useEffect, useRef } from 'react';

import type { EquityPoint, Trade } from '@/features/backtests';
import { withAlpha } from '@/lib/chart-theme';
import { drawdownSeries } from '@/utils/metrics';
import { useChartPalette } from '@/utils/use-chart-palette';

interface EquityCurveChartProps {
  data: readonly EquityPoint[];
  /** Draw the benchmark series when the payload includes one. */
  showBenchmark?: boolean;
  /**
   * Adds a second, shorter pane plotting drawdown against the same time axis.
   *
   * A pane rather than a separate `DrawdownChart` beneath it: the two are read
   * together — "how deep was the hole when the curve stalled here" — and only a
   * shared axis lets the eye answer that without re-anchoring on the dates.
   * `DrawdownChart` remains the right call when it stands alone.
   */
  showDrawdownPane?: boolean;
  /** Entry markers for each trade. Omitted on the live view, which has no round trips. */
  trades?: readonly Trade[] | undefined;
}

/** Above this many markers the price line disappears under the triangles. */
const MAX_MARKERS = 120;

/**
 * lightweight-charts is imperative and owns its own DOM, so it lives behind a
 * ref and is created once. Data and colours are pushed in via separate effects —
 * recreating the chart on every data change would reset the user's zoom.
 */
export function EquityCurveChart({
  data,
  showBenchmark = true,
  showDrawdownPane = false,
  trades,
}: EquityCurveChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const equitySeriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const drawdownSeriesRef = useRef<ISeriesApi<'Baseline'> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const benchmarkSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const palette = useChartPalette();
  /*
   * The palette as it stood on the first render, for the create-once effect
   * below. Reading `palette` there directly would make the chart a dependency
   * of the theme and rebuild the whole thing on every light/dark flip; the
   * theme effect further down is what keeps colours current.
   */
  const paletteRef = useRef(palette);

  // Create the chart once, on mount.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        attributionLogo: false,
        /*
         * Set at creation, not only in the theme effect below. The library
         * defaults `textColor` to a near-black (#191919), so every axis label
         * painted before that effect first runs is black text on a dark card.
         */
        textColor: paletteRef.current.mutedText,
      },
      /*
       * The crosshair readouts are drawn to canvas, and the library picks
       * black or white text from the label background's luminance. Pinning the
       * background to the card colour is what makes that choice come out white.
       */
      crosshair: {
        vertLine: { labelBackgroundColor: paletteRef.current.background },
        horzLine: { labelBackgroundColor: paletteRef.current.background },
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

    if (showDrawdownPane) {
      // Addressing pane index 1 creates the pane implicitly, so there is no
      // separate `addPane()` call to keep in sync with the index used here.
      drawdownSeriesRef.current = chart.addSeries(
        BaselineSeries,
        {
          baseValue: { type: 'price', price: 0 },
          lineWidth: 1,
          priceLineVisible: false,
          priceFormat: { type: 'percent' },
        },
        1,
      );

      // Only meaningful once the pane exists.
      // 3:1 — the drawdown is context for the curve above it, not a peer.
      chart.panes()[0]?.setStretchFactor(3);
      chart.panes()[1]?.setStretchFactor(1);
    }

    return () => {
      chart.remove();
      chartRef.current = null;
      equitySeriesRef.current = null;
      benchmarkSeriesRef.current = null;
      drawdownSeriesRef.current = null;
      // Owned by the chart; `chart.remove()` has already torn it down.
      markersRef.current = null;
    };
    // `showDrawdownPane` is a structural choice, not live state: changing it
    // rebuilds the chart, which is correct and never happens in practice.
  }, [showDrawdownPane]);

  // Re-apply colours whenever the theme flips.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    chart.applyOptions({
      layout: {
        textColor: palette.mutedText,
        // Canvas text cannot inherit a font from CSS, so the mono token is
        // read off :root and handed over — same face as every other number.
        fontFamily: getComputedStyle(document.documentElement).getPropertyValue('--font-mono'),
        fontSize: 11,
      },
      crosshair: {
        vertLine: { labelBackgroundColor: palette.background },
        horzLine: { labelBackgroundColor: palette.background },
      },
      grid: {
        vertLines: { color: palette.grid },
        horzLines: { color: palette.grid },
      },
      rightPriceScale: { borderColor: palette.grid },
      timeScale: { borderColor: palette.grid },
    });

    /*
     * Ink, not a series colour. The strategy's own curve is the thing the page
     * exists for, and drawing it in a palette hue made it compete with the
     * profit / loss / drawdown signals around it — the reader's eye had to sort
     * "the line" from "the colours that mean something". The benchmark drops
     * to mid grey for the same reason: it is context, not a result.
     */
    equitySeriesRef.current?.applyOptions({
      lineColor: palette.ink,
      lineWidth: 2,
      topColor: withAlpha(palette.ink, 0.14),
      bottomColor: withAlpha(palette.ink, 0),
      /*
       * The last-value badge on the price scale, not a price line: that is
       * already off. Its background otherwise defaults to the series colour,
       * and the library picks the label's text colour by luminance, so a light
       * series line produced black digits that were hard to read against it.
       * Pinning the badge to the card colour is what makes those digits white.
       */
      priceLineColor: palette.background,
    });
    benchmarkSeriesRef.current?.applyOptions({ color: palette.benchmark });

    drawdownSeriesRef.current?.applyOptions({
      // Drawdown is never positive, so only the below-baseline half is ever
      // drawn — but both are set so a floating-point 0 does not render grey.
      topLineColor: palette.loss,
      topFillColor1: withAlpha(palette.loss, 0),
      topFillColor2: withAlpha(palette.loss, 0),
      bottomLineColor: palette.loss,
      lineWidth: 1,
      bottomFillColor1: withAlpha(palette.loss, 0.08),
      bottomFillColor2: withAlpha(palette.loss, 0.45),
      // Same reason as the equity badge above: the drawdown percentage was
      // black on the loss colour.
      priceLineColor: palette.background,
    });
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

    const drawdownTarget = drawdownSeriesRef.current;
    if (drawdownTarget) {
      const drawdowns = drawdownSeries(data.map((point) => point.equity));
      const drawdownData: BaselineData<Time>[] = drawdowns.flatMap((point) => {
        const date = data[point.index]?.date;
        // `* 100` because the pane is formatted as a percentage, and the
        // library's percent format expects 12.5 rather than 0.125.
        return date === undefined ? [] : [{ time: date, value: point.drawdown * 100 }];
      });
      drawdownTarget.setData(drawdownData);
    }

    chartRef.current?.timeScale().fitContent();
  }, [data, showBenchmark]);

  // Trade markers are their own effect: they change independently of the curve,
  // and rebuilding them on every palette read would be wasted work.
  useEffect(() => {
    const equitySeries = equitySeriesRef.current;
    if (!equitySeries) return;

    // Past the threshold the markers stop being information and start being a
    // solid band over the line, so the curve wins.
    const visible = trades && trades.length <= MAX_MARKERS ? trades : [];

    const markers: SeriesMarker<Time>[] = visible
      .map((trade) => ({
        time: trade.entryDate,
        position: trade.side === 'long' ? ('belowBar' as const) : ('aboveBar' as const),
        shape: trade.side === 'long' ? ('arrowUp' as const) : ('arrowDown' as const),
        color: trade.side === 'long' ? palette.profit : palette.loss,
        text: trade.side === 'long' ? 'B' : 'S',
      }))
      // lightweight-charts requires markers in ascending time order and throws
      // otherwise; the API makes no promise about how trades arrive sorted.
      .sort((a, b) => String(a.time).localeCompare(String(b.time)));

    markersRef.current ??= createSeriesMarkers(equitySeries);
    markersRef.current.setMarkers(markers);
  }, [trades, palette]);

  return <div ref={containerRef} className="size-full" role="img" aria-label="Equity curve" />;
}
