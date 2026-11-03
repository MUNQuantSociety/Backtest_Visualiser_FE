import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
} from 'lightweight-charts';
import { useEffect, useRef, useState } from 'react';

import { seriesColor, withAlpha } from '@/lib/chart-theme';
import { formatCompact } from '@/utils/format';
import { useChartPalette } from '@/utils/use-chart-palette';

import type { Candle } from '../candles-api';

/** An indicator line drawn with the candles. */
export interface ChartLine {
  /** Stable per line, e.g. `rsi-14`. */
  key: string;
  /** Shown in the readout, e.g. `RSI 14`. */
  label: string;
  /** `price` shares the candles' scale; `separate` gets its own panel. */
  pane: 'price' | 'separate';
  points: readonly { date: string; value: number }[];
}

/** Shared, so the default does not rebuild the lines on every hover. */
const NO_LINES: readonly ChartLine[] = [];

/** Panes 0 and 1 are the candles and the volume; separate lines go below. */
const FIRST_LINE_PANE = 2;

/**
 * Daily candles with volume underneath, on one date axis and crosshair.
 *
 * Up days take the profit colour and down days the loss colour, so the chart
 * reads the same way as every other gain and loss in the app. The readout
 * above shows the hovered session's OHLCV, or the latest one at rest, plus
 * the value of each indicator line on that day.
 *
 * `lines` overlay moving averages on the candles and give each bounded or
 * differently scaled indicator (RSI, ADX and the like) a panel of its own.
 * Pass a stable array: a new one rebuilds every line.
 */
export function CandleChart({
  candles,
  lines = NO_LINES,
}: {
  candles: readonly Candle[];
  lines?: readonly ChartLine[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const lineSeriesRef = useRef<ISeriesApi<'Line'>[]>([]);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const palette = useChartPalette();
  const paletteRef = useRef(palette);

  const readout =
    (hoveredDate === null ? undefined : candles.find((candle) => candle.date === hoveredDate)) ??
    candles.at(-1);
  const lineReadout = lines.map((line, index) => ({
    line,
    color: seriesColor(palette, index),
    value: readout ? line.points.find((point) => point.date === readout.date)?.value : undefined,
  }));

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: paletteRef.current.mutedText,
        attributionLogo: false,
      },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.06, bottom: 0.06 } },
      timeScale: { fixLeftEdge: true, fixRightEdge: true, borderVisible: false },
    });
    chartRef.current = chart;
    candleSeriesRef.current = chart.addSeries(CandlestickSeries, {
      priceLineVisible: false,
      borderVisible: false,
    });
    volumeSeriesRef.current = chart.addSeries(
      HistogramSeries,
      {
        priceFormat: { type: 'custom', minMove: 1, formatter: formatCompact },
        priceLineVisible: false,
        lastValueVisible: false,
      },
      1,
    );
    chart.panes()[0]?.setStretchFactor(4);
    chart.panes()[1]?.setStretchFactor(1);
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
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      lineSeriesRef.current = [];
    };
  }, []);

  // Rebuilt whole when the set of lines changes: a handful of series, and
  // panes are simplest to keep in order by starting from none.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    for (const series of lineSeriesRef.current) chart.removeSeries(series);
    lineSeriesRef.current = [];
    for (let index = chart.panes().length - 1; index >= FIRST_LINE_PANE; index -= 1) {
      chart.removePane(index);
    }
    let nextPane = FIRST_LINE_PANE;
    lineSeriesRef.current = lines.map((line, index) => {
      const series = chart.addSeries(
        LineSeries,
        {
          color: seriesColor(paletteRef.current, index),
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
          crosshairMarkerVisible: false,
          title: line.label,
        },
        line.pane === 'price' ? 0 : nextPane++,
      );
      series.setData(line.points.map((point) => ({ time: point.date, value: point.value })));
      return series;
    });
    const panes = chart.panes();
    panes[0]?.setStretchFactor(4);
    panes[1]?.setStretchFactor(1);
    for (const pane of panes.slice(FIRST_LINE_PANE)) pane.setStretchFactor(1.5);
  }, [lines]);

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
    });
    paletteRef.current = palette;
    lineSeriesRef.current.forEach((series, index) => {
      series.applyOptions({ color: seriesColor(palette, index) });
    });
    candleSeriesRef.current?.applyOptions({
      upColor: palette.profit,
      downColor: palette.loss,
      wickUpColor: palette.profit,
      wickDownColor: palette.loss,
    });
  }, [palette]);

  useEffect(() => {
    candleSeriesRef.current?.setData(
      candles.map(({ date, open, high, low, close }) => ({ time: date, open, high, low, close })),
    );
    volumeSeriesRef.current?.setData(
      candles.map((candle) => ({
        time: candle.date,
        value: candle.volume,
        color: withAlpha(candle.close >= candle.open ? palette.profit : palette.loss, 0.5),
      })),
    );
    chartRef.current?.timeScale().fitContent();
  }, [candles, palette]);

  return (
    <div className="flex size-full flex-col gap-2">
      {readout ? (
        <dl className="tabular flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <ReadoutItem label="Date" value={readout.date} />
          <ReadoutItem label="O" value={readout.open.toFixed(2)} />
          <ReadoutItem label="H" value={readout.high.toFixed(2)} />
          <ReadoutItem label="L" value={readout.low.toFixed(2)} />
          <ReadoutItem label="C" value={readout.close.toFixed(2)} />
          <ReadoutItem label="Vol" value={formatCompact(readout.volume)} />
          {lineReadout.map(({ line, color, value }) => (
            <ReadoutItem
              key={line.key}
              label={line.label}
              value={value === undefined ? 'n/a' : value.toFixed(2)}
              color={color}
            />
          ))}
        </dl>
      ) : null}
      <div ref={containerRef} className="min-h-0 flex-1" data-testid="candle-chart" />
    </div>
  );
}

function ReadoutItem({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex gap-1">
      <dt style={color ? { color } : undefined}>{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}
