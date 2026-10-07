import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
} from 'lightweight-charts';
import { useEffect, useRef, useState } from 'react';

import { withAlpha } from '@/lib/chart-theme';
import { formatCompact } from '@/utils/format';
import { useChartPalette } from '@/utils/use-chart-palette';

import type { Candle } from '../candles-api';

/**
 * Daily candles with volume underneath, on one date axis and crosshair.
 *
 * Up days take the profit colour and down days the loss colour, so the chart
 * reads the same way as every other gain and loss in the app. The readout
 * above shows the hovered session's OHLCV, or the latest one at rest.
 */
export function CandleChart({ candles }: { candles: readonly Candle[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const palette = useChartPalette();
  const paletteRef = useRef(palette);

  const readout =
    (hoveredDate === null ? undefined : candles.find((candle) => candle.date === hoveredDate)) ??
    candles.at(-1);

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
    };
  }, []);

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
        </dl>
      ) : null}
      <div ref={containerRef} className="min-h-0 flex-1" data-testid="candle-chart" />
    </div>
  );
}

function ReadoutItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1">
      <dt>{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}
